'use strict'

const router = require('lambda-router/src/router')
const { expectation } = require('sinon')

const { HttpError } = require('./httpError')

const batchDefaultConfig = {
  maxBatchSize: 20,
  handler: undefined
}

module.exports = {
  batchHandler
}

async function batchHandler({ route, config }, event, context) {
  config = { ...batchDefaultConfig, ...config }
  const body = event.body

  // Validate
  validateBatchRequest(body, config.maxBatchSize)

  // build graph of requests
  const orderedRequests = tSort(body.requests)
  const { asyncRequests, syncRequests } = splitAsyncRequests(orderedRequests)

  // execute requests
  const results = await Promise.all([
    (async () => {
      const syncResults = []
      for (let req of syncRequests) {
        syncResults.push(await executeRequest(config, route, event, req))
      }
      return syncResults
    })(),
    ...asyncRequests.map(executeRequest.bind(null, config, route, event))
  ])

  // return response
  return {
    statusCode: 200,
    body:{ responses: results.map((result, index) => {
      if (index === 0){
        return result.map((result, index) => {
          return {
            id: syncRequests[index].id,
            status: result.statusCode,
            body: result.body ? JSON.parse(result.body) : undefined,
            headers: result.headers
          }
        })
      }
      return {
        id: asyncRequests[index - 1].id,
        status: result.statusCode,
        body: result.body ? JSON.parse(result.body) : undefined,
        headers: result.headers
      }
    })},
    headers:{}
  }
}

async function executeRequest(config, route, event, request) {
  //Parse url into pathParameters and multiValueQueryStringParameters formats
  const urlAndQuerystring = request.url.split('?')
  let queryStringParameters = {}
  if (urlAndQuerystring.length > 1) {
    const queryStringParams = urlAndQuerystring[1]
    const keys = queryStringParams.split('&')
    const queryStrings = keys.map((k) => k.split('='))

    for (let queryString of queryStrings) {
      if (queryStringParameters[queryString[0]]) {
        queryStringParameters[queryString[0]].push(queryString[1])
      } else {
        queryStringParameters[queryString[0]] = [queryString[1]]
      }
    }
  }

  //Compose event to appear as native AWS event
  let childEvent = { 
    ...event,
    httpMethod: request.method,
    headers: {...normalizeRequestHeaders(request.headers), authorization: event.headers.authorization},
    body: request.body,
    path: request.url,
    pathParameters: { 
      proxy: urlAndQuerystring[0].split('/').splice(2).join('/') 
    },
    multiValueQueryStringParameters: queryStringParameters,
    _json: true
  }

  //Allow consumers to define a custom handler 
  if (config.handler){
    return await config.handler(childEvent, {})
  }

  return await route(childEvent, {})
}

function normalizeRequestHeaders(reqHeaders = {}) {
  return Object.keys(reqHeaders).reduce((headers, name) => {
    headers[name.toLowerCase()] = reqHeaders[name]
    return headers
  }, {})
}

function splitAsyncRequests(orderedRequests) {
  const asyncRequests = []
  let syncRequests = []
  for (let i = 0; i < orderedRequests.length; i++) {
    if (orderedRequests[i].dependsOn.length > 0) {
      syncRequests.push(...orderedRequests.splice(i))
      break
    }

    if (!orderedRequests.some(req => req.dependsOn.includes(orderedRequests[i].id))) {
      asyncRequests.push(orderedRequests[i])
    } else {
      syncRequests.push(orderedRequests[i])
    }
  }
  return { asyncRequests, syncRequests }
}

//Depth-first topological sort
function tSort(requests) {
  const dependencies = requests.reduce((obj, req) => {
    obj[req.id] = { dependsOn: [], ...req }
    return obj
  }, {})
  let keys = Object.keys(dependencies)
  let length
  let items

  const sorted = new Set()
  const result = []

  do {
    length = keys.length
    items = []
    // eslint-disable-next-line no-loop-func
    keys = keys.filter(k => {
      if (!dependencies[k].dependsOn.every(dependency => sorted.has(dependency))) {
        return true
      }
      items.push(k)
      return false
    })
    result.push(...items)
    items.forEach(i => sorted.add(i))
  } while (keys.length && keys.length !== length)

  if (keys.length > 0) {
    throw new HttpError(400, `invalid body; unable to resolve execution order `+
      `due to circular dependency chain(s) involving: (${keys.join(', ')})`)
  }

  return result.map(res => dependencies[res])
}

function validateBatchRequest(body, maxBatchSize){
  // validate json body has been parsed
  if (typeof body !== 'object' || body === null){
    throw new HttpError(400, `invalid body; expected object`)
  }

  // validate body.requests has array of requests
  if (!body.requests || !Array.isArray(body.requests)){
    throw new HttpError(400, `invalid body; expected requests to be an array`)
  }

  if (body.requests.length > maxBatchSize){
    throw new HttpError(400, `invalid body; max number of requests exceeded (${maxBatchSize})`)
  }

  // validate each body.requests[]
  const ids = body.requests.map(req => req.id)
  for(let i = 0; i < body.requests.length; i++){
    const request = body.requests[i]
    if (!request.id){
      throw new HttpError(400, `invalid body; requests[${i}].id required`)
    }
    if (typeof request.id !== 'string' && !(request.id instanceof String)){
      throw new HttpError(400, `invalid body; requests[${i}].id must be a string`)
    }

    if (!request.method){
      throw new HttpError(400, `invalid body; requests[${i}].method required`)
    }
    if (!['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)){
      throw new HttpError(400, `invalid body; requests[${i}].method must be one of ( GET | POST | PUT | PATCH | DELETE )`)
    }

    if (!request.url){
      throw new HttpError(400, `invalid body; requests[${i}].url required`)
    }
    if (typeof request.id !== 'string' && !(request.id instanceof String)){
      throw new HttpError(400, `invalid body; requests[${i}].url must be a string`)
    }

    if (request.headers && request.headers.authorization){
      throw new HttpError(400, `invalid body; requests[${i}].headers.authorization can not be supplied`)
    }

    if (request.dependsOn){
      if (!Array.isArray(request.dependsOn)){
        throw new HttpError(400, `invalid body; requests[${i}].dependsOn must be an array`)
      }

      const invalidDependsOn = request.dependsOn.filter(depend => !ids.includes(depend))
      if (invalidDependsOn.length > 0){
        throw new HttpError(400, `invalid body; requests[${i}].dependsOn references invalid id(s): ${invalidDependsOn.join(', ')}`)
      }
    }
  }
}
