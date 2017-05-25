# Lambda Router

A small and simple router to simplify managing routers in a NodeJS Lambda function.

# Usage

      const router = require('@nike/lambda-router')({
        logger: console
      })
      
      router.post('/v1/endpoint', service.create)
      router.get('/v1/endpoint/{id}', service.get)
      router.put('/v1/endpoint/{id}', service.put)
      router.delete('/v1/endpoint/{id}', service.delete)
        
      router.route(lambdaEvent, context).then(result => {
        // Build the response body.        
        callback(null, createResponse(200, body, headers))
      }).catch(error => {
        // Handle the error
        callback(null, createResponse(error.statusCode || 500, JSON.stringify(result)))
      })

You must provide a logger to the router. Otherwise, the router will be silent.