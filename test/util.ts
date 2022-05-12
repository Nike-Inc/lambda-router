/* eslint-disable jest/no-jasmine-globals */
// Jest assertions will not fail if they live inside a try-catch block due to
// https://github.com/facebook/jest/issues/3917.

// This file returns a version of `expect` that fails
// the test immediately when an exception is thrown.

/**
 * isPromise detects whether given object is a promise or not.
 */
const isPromise = (obj) =>
  !!obj && (typeof obj === 'object' || typeof obj === 'function') && typeof obj.then === 'function'

/**
 * Wrap a jest matcher so if the expectation fails, it also fails the test.
 * @param func the jest matcher that will be wrapped.
 */
const wrapMatcher = (func) => {
  const wrappedMatcher = {}
  const keys = Object.keys(func)
  keys.forEach((k) => {
    if (typeof func[k] === 'function') {
      wrappedMatcher[k] = (...args) => {
        try {
          const result = func[k](...args)
          if (isPromise(result)) {
            return result.then(undefined, (e) => {
              // Remove this function from stacktrace.
              Error.captureStackTrace(e, wrappedMatcher[k])
              fail(e)
              throw e
            })
          }
          return result
        } catch (e) {
          // Remove this function from stacktrace.
          Error.captureStackTrace(e, wrappedMatcher[k])
          console.log('failed', e)
          fail(e)
          throw e
        }
      }
    } else {
      // This should be `not`, `resolves`, and `rejects`.
      wrappedMatcher[k] = wrapMatcher(func[k])
    }
  })
  return wrappedMatcher
}

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
const originalExpect = global.expect

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
const expectAndFail: jest.Expect = (...args) => {
  const matcher = originalExpect(...args)
  return wrapMatcher(matcher) as jest.Expect
}

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
global.expect = expectAndFail
Object.entries(originalExpect).forEach(([prop, value]) => {
  expectAndFail[prop] = value
})

export default expectAndFail
