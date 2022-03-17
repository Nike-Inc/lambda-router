module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint', 'jest'],
  extends: ['plugin:jest/recommended', 'plugin:@typescript-eslint/recommended'],
  rules: {
    'react/display-name': 0,
    '@typescript-eslint/no-use-before-define': ['error', { functions: false }],
    '@typescript-eslint/no-explicit-any': 0,
  },
  env: {
    'jest/globals': true,
    browser: true,
  },
  settings: {
    jest: {
      version: 27,
    },
  },
}
