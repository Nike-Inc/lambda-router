'use strict'

const test = require('ava')
const { HttpError } = require('../src/httpError')

test('error should contain status code', t => {
  t.plan(1)
  let error = new HttpError(400, 'message')
  t.is(error.statusCode, 400, 'contains status code')
})

test('error should contain default status code', t => {
  t.plan(1)
  let error = new HttpError(undefined, 'message')
  t.is(error.statusCode, 500, 'contains status code')
})

test('error should contain message', t => {
  t.plan(1)
  let error = new HttpError(400, 'message')
  t.is(error.message, 'message', 'contains message')
})

test('error should contain extra props', t => {
  t.plan(1)
  let error = new HttpError(400, 'message', { reasons: true })
  t.is(error.reasons, true, 'contains reasons')
})

test('error wrap error', t => {
  t.plan(1)
  let error = new HttpError(400, new Error('message'))
  t.is(error.message, 'message', 'contains message')
})

test('assert should not throw for true predicate', t => {
  t.plan(1)
  HttpError.assert(true, 400, 'skip')
  t.pass()
})

test('assert should throw for false predicate', t => {
  t.plan(1)
  t.throws(() => HttpError.assert(false, 400, 'skip'), { message: /skip/ }, 'threw')
})
