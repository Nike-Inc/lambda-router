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

# Usage
```javascript

const router = require('@nike/lambda-router')({
  logger: console // uses @nike/logger-wrapper.
  inluceErrorStack: process.env.stage
})

router.post('/v1/endpoint', service.create)
router.get('/v1/endpoint/{id}', service.get)
router.put('/v1/endpoint/{id}', service.put)
router.delete('/v1/endpoint/{id}', service.delete)

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
} = {})
```