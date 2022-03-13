# Change Log /  Release Notes
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/)
and this project adheres to [Semantic Versioning](http://semver.org/).

## [3.0.0] - Unreleased
### Added
- Support for `APIGatewayProxyEventV2`
### Changed
- Converted project to TypeScript
- **Breaking Change**: `trimTrailingSlash` defaults to `true`
- **Breaking Change**: `normalizeHeaders` defaults to `true`
- **Breaking Change**: `context.response` now takes an _options_ object as its only parameter
### Removed
- **Breaking Change**: Support for Node < 14

## [2.12.0] - 2021-08-07
### Added
- `routes` to `unknown` as 5th parameter
- `statusCode: 405` to `defaultUnknownRoute` when other methods for the same path exist

## [2.11.0] - 2021-06-06
### Added
- `error.name` pass-through to `formatError`

## [2.10.0] - 2020-04-27
### Added
- `patch` route/verb support

## [2.9.1] - 2019-09-04
### Fixed
- Compound value `content-type` header not identifying correctly

## [2.9.0] - 2019-08-16
### Added
- `normalizeHeaders` options to lower-case all header names

## [2.8.0] - 2019-07-02
### Added
- `beforeRoute` middleware

## [2.7.0] - 2019-06-19
### Added
- `assumeJson` option

## [2.6.0] - 2019-06-19
### Added
- export `getTraceId`

## [2.5.1] - 2019-05-20
### Fixed
- Syntax error

## [2.5.0] - 2019-05-20
### Added
- Body parsing support for `application/x-www-form-urlencoded`
- `event.rawBody` as original, unparsed body when `event.body` is parsed
### Fixed
- Check `Content-Type` for `application/json` before parsing as JSON

## [2.4.1] - 2019-05-01
### Fixed
- Documentation errors

## [2.4.0] - 2018-12-01
### Fixed
- Documentation errors

## [2.3.0] - 2018-10-8
### Added
- Initial OSS release
