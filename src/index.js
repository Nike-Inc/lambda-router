'use strict'

const co = require('co')
const loggerWrapper = require('@nike/logger-wrapper')

module.exports = function (options) {
  return new Router(options || {})
}

function Router (options) {
  this.routes = []
  this.debug = options.debug
  this.tokenizePathParts = options.tokenizePathParts
  this.logger = loggerWrapper(options.logger)
}

Router.prototype.addRoute = function (httpMethod, path, handler) {
  this.routes.push({method: httpMethod, path: path, handler: handler, isRegex: (path instanceof RegExp)})
}

function wrapRoute (httpMethod, args) {
  return this.addRoute.apply(this, [httpMethod].concat(Array.prototype.slice.call(args)))
}

Router.prototype.get = function () {
  return wrapRoute.call(this, 'GET', arguments)
}
Router.prototype.post = function () {
  return wrapRoute.call(this, 'POST', arguments)
}
Router.prototype.put = function () {
  return wrapRoute.call(this, 'PUT', arguments)
}
Router.prototype['delete'] = function () {
  return wrapRoute.call(this, 'DELETE', arguments)
}

Router.prototype.unknown = function (handler) {
  this.unknownRoute = {
    unknown: true,
    handler: handler
  }
}

function getRoute (self, event, requestPath, httpMethod) {
  const method = httpMethod || event.method || event.httpMethod
  const eventPath = requestPath || event.path || event.resourcePath || event.resource

  let route = self.routes.find(route => {
    return eventPath === route.path && method === route.method
  })

  if (!route) {
    let tokens
    route = self.routes.find(route => {
      if (!method === route.method) return false
      tokens = doPathPartsMatch(eventPath, route)
      return !!tokens
    })
    if (self.tokenizePathParts && tokens) {
      Object.assign(event.pathParameters, tokens)
    }
  }

  return route || self.unknownRoute || { handler: defaultUnknownRoute }
}

function doPathPartsMatch (eventPath, route) {
  const eventPathParts = eventPath.split('/')
  const routePathParts = route.path.split('/')

  // Fail fast if they're not the same length
  if (eventPathParts.length !== routePathParts.length) return false
  let tokens = {}

  // Start with 1 because the url should always start with the first back slash
  for (let i = 1; i < eventPathParts.length; ++i) {
    const pathPart = eventPathParts[i]
    const routePart = routePathParts[i]

    // If the part is a curly braces value
    let pathPartMatch = /\{(\w+)}/g.exec(routePart)
    if (pathPartMatch) {
      tokens[pathPartMatch[1]] = pathPart
      continue
    }

    // Fail fast if a part doesn't match
    if (routePart !== pathPart) {
      return false
    }
  }

  return tokens
}

function defaultUnknownRoute (event) {
  console.error('No unknown router or route provided for event: ' + JSON.stringify(event))
  throw new Error('No route specified.')
}

Router.prototype.route = function (event, context, requestPath, httpMethod) {
  let self = this
  self.logger.debug('Routing event', event, requestPath, httpMethod)

  return co(function * () {
    let matchedRoute = getRoute(self, event, requestPath, httpMethod)
    self.logger.debug('Matched on route', matchedRoute)
    return matchedRoute.handler(event, context)
  }).catch(error => {
    self.logger.debug('Route error: ', error)
    throw error
  })
}
