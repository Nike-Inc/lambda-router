/*
  Jest and all dependencies have been downgraded to 26 until these are fixed
  expect in catch does not fail: https://github.com/facebook/jest/issues/12838
  fail missing: https://github.com/facebook/jest/issues/11698
*/

module.exports = {
  clearMocks: true,
  collectCoverageFrom: ['src/**/*.{ts,tsx}', '!src/main.ts'],
  coverageDirectory: 'coverage',
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 50,
      lines: 50,
      statements: 50,
    },
  },
  preset: 'ts-jest',
  testEnvironment: 'node',
  globals: {
    'ts-jest': {
      tsconfig: 'tsconfig.test.json',
      isolatedModules: true,
    },
  },
  watchPlugins: ['jest-watch-typeahead/filename', 'jest-watch-typeahead/testname'],
}
