/* eslint no-unused-vars:0 no-empty-function:0 */
'use strict'

const test = require('ava')
const qs = require('querystring')
const sinon = require('sinon')
const { batchHandler } = require('../src/batch')

test('batchHandler.', async t => {})

test('GET adds a route to the routes list.', async t => {
  t.plan(1)
  let router = Router()
  router.get('/route', () => {
    t.pass('called get')
  })
  await router.route({}, {}, '/route', 'GET')
})
