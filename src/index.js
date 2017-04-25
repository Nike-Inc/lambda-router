'use strict'

const co = require('co')

module.exports = function (options) {
  return new Router(options || {})
}

function Router (options) {
  this.routes = []
  this.debug = options.debug
}

Router.prototype.addRoute = function (httpMethod, path, handler) {
  this.routes.push({method: httpMethod, path: path, handler: handler})
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

Router.prototype.log = function () {
  if (this.debug) {
    console.log.apply(console, arguments)
  }
}

function getRoute (self, event) {
  let route = self.routes.find(route => {
    return (event.path === route.path || event.resourcePath === route.path) &&
      (event.method === route.method || event.httpMethod === route.method)
  })

  return route || self.unknownRoute || { handler: defaultUnknownRoute }
}

function defaultUnknownRoute (event) {
  console.log('No unknown router or route provided for event: ' + JSON.stringify(event))
  throw new Error('No route specified.')
}

Router.prototype.route = function (event, context) {
  let self = this
  self.log('Routing event', event)

  return co(function * () {
    let matchedRoute = getRoute(self, event)
    self.log('Matched on route', matchedRoute)
    return matchedRoute.handler(event, context)
  }).catch(error => {
    self.log('Route error: ', error)
    throw error
  })
}
