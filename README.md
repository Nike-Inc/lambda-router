# Lambda Router

A small and simple router to simplify managing routers in a NodeJS Lambda function.

# Installation

This package is published to Nike's internal Atrificatory npm registry. To install from it you will need an `.npmrc` file in your project

```
registry=http://artifactory.nike.com/artifactory/api/npm/npm-nike
@nike:registry=http://artifactory.nike.com/artifactory/api/npm/npm-nike/
```

The first line is technically optional, since the scope is all you need to get `@nike/` scoped packages. However it is recommended as additional caching and security analysis is done on packages in our Artifactory registry.

After you have that setup, just install from npm normally.

```
npm install @nike/lambda-router
```

# Quick Start
```javascript

const router = require('@nike/lambda-router')({
  logger: console // uses @nike/logger-wrapper.
  inluceErrorStack: process.env.stage !== 'prod'
})

router.post('/v1/endpoint', service.create)
router.get('/v1/endpoint/{id}', service.get)
router.put('/v1/endpoint/{id}', service.put)
router.delete('/v1/endpoint/{id}', service.delete)
router.unknown((event, { response }, path, method) => {
  return response(404, {
    message: `You dun screwed up, now. ${path} doesn't exist!`
  })
})

async function handler (lambdaEvent, context) {
  context.callbackWaitsForEmptyEventLoop = false
  router.formatError((statusCode, error) => {
    error.errorType = getErrorType(statusCode) // custom method
    return error
  })
  let result = await router.route(lambdaEvent, context)

  return result.response
}
```

# API

```javascript
function Router ({
  logger, // @nike/logger-wrapper 
  extractPathParameters = true, // merge proxy path parameters into event.pathParameters
  includeTraceId = true, // include TraceId header
  inluceErrorStack = false, // include stack traces with error responses
  cors = true, // include CORS header, can be a string to set header value or true for '*'
  parseBody = true, // merge parsed json body into event
  decodeEvent = true // merge URI decoded parameters for path and querystring
} = {}) {
  route: async (event, context) => Promise<{
    isOk,
    endpoint,
    uri,
    response
  }
  get|post|put|delete: async (pattern, handler) => {}
  unknown: (event, context, path, method) => {}
}
```

# Routes

Route's can be registered with any of the http verb methods.

`router.[get|post|put|delete](routePattern: string, handler: (event, context) => Object|Promise)`

Route matching is done either literally or by path token. When a route is matched it's handler function is invoked, and the result is used as the response body. If a route pattern matches the path exactly it will be selected. If not, the route will try to match by token, replacing anything in curly braces with values from the path.

For example, the path `/v1/endpoint/1234` will match the route pattern `'/v1/endpoint/{id}'`, because the `{id}` section will be treated as a path token and match the value `1234`.

If the router option `extractPathParameters` is set, the `event.pathParameters` will receive the `id` value as `event.pathParameters.id: 1234`. Similarly, querystring parameters will be merged into `event.queryStringParameters`.

Route handlers that return an object will get a default status code of 200, and the object will be passed to `JSON.stringify` before being returned. Handlers that throw an error will get a default status code of 500. If you throw an error object with a `statusCode` property it's value will replace the default 500 status code. To customize status code for successful responses see the **Custom Response** section below.


## The Unknown Handler

When no route is matched the unknown handler is invoked. The default unknown handler will return a canned response containing the unmatched path, with a 404. You can replace the unknown handler by provider your own to `router.unknown`. This handler will function as a normal handler, returning a 200 unless it throws an error. Since errors default to status code 500, you should probably manually set the status code to 404.

# Custom Response

The `context` object, the second parameter to route handlers, has a `response` property function. It can be used to provide custom status codes, custom headers, and control body serialization.

```javascript

router.post('/v1/endpoint', handleDelete)

async function handleCreate({ headers }, { path, response })
  let dbItem = await createNewItem()
  return response(201, result, { Location: 'https://' + headers.Host + path + '/' + dbItem.id })
```


# Error Formatting

By default error's are serialized as responses, and either use the `error.statusCode` or a default 500 status code. If you want to control the error object, or perform custom instrumentation for errors, you can provide your own error formatter. The error formatter will be called with the status code and the error and must return the error that will be serialized for the response.

```javascript
router.formatError((statusCode, error) => {
  error.errorType = getErrorType(statusCode) // custom method
  return error
})
```

# Router response

When you call `router.route` you must provide the lambda event and context.

```javascript
let result = await router.route(event, context)
```

Optionally you can provide the the path and/or method to route on, in case the default selection method does not match your needs

```javascript
let result = await router.route(event, context, customPath, customMethod)
```

The router will match the route and return a promise that will wait on the matched route handler. The result looks like this

```javascript
{
  isOk: boolean // is the status code a 2xx
  endpoint: string // the route pattern that matched
  uri: string // the real path from the event
  response: {
    statusCode: number,
    body: string // stringified route handler response, or custom response
    headers: {} // default headers or custom response headers
  }
}

```