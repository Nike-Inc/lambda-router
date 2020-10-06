'use strict'

const { HttpError } = require('./httpError')

const batchDefaultConfig = {
  maxBatchSize: 20
}

module.exports = {
  batchHandler
}

async function batchHandler({ routes, config, extractPathParameters }, event, context) {
  config = { ...batchDefaultConfig, ...config }

  // Validate
  // validate json body has been parsed
  // validate body.requests has array of requests
  // validate each body.requests[]

  // build graph of requests

  // execute requests

  // return response
}

function validateBatchRequest(body) {}
