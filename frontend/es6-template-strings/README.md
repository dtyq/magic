# @dtyq/es6-template-strings

ES6 Template Strings Parser Engine

[![license][license-badge]][license-link]
![NPM Version](https://img.shields.io/npm/v/@dtyq/es6-template-strings)
[![codecov][codecov-badge]][codecov-link]

[license-badge]: https://img.shields.io/badge/license-apache2-blue.svg
[license-link]: LICENSE
[codecov-badge]: https://codecov.io/gh/dtyq/es6-template-strings/branch/master/graph/badge.svg
[codecov-link]: https://codecov.io/gh/dtyq/es6-template-strings

## Overview

This package provides a template string parsing engine that supports ES6-style syntax. It allows you to interpolate variables and expressions within strings using the `${expression}` syntax.

## Usage

```typescript
import { resolveToString, resolveToArray } from "@dtyq/es6-template-strings";

// Basic usage
console.log(resolveToString("hello ${name}", { name: "world" }));
// Output: "hello world"

// Return array of template parts and substitutions
console.log(resolveToArray("hello ${name}", { name: "world" }));
// Output: ["hello ", "world"]
```

## Configuration Options

| Option | Description | Type | Default | Required |
|:------:|:----------:|:----:|:-------:|:--------:|
| notation | Template syntax prefix | string | "$" | No |
| notationStart | Template syntax start marker | string | "{" | No |
| notationEnd | Template syntax end marker | string | "}" | No |
| partial | Skip failed expressions instead of returning undefined | boolean | false | No |

## Notes

- When an expression cannot be resolved:
  - If `partial: true`, the original `${expression}` string will be preserved
  - If `partial: false` (default), undefined will be returned for that expression
- The package handles nested expressions and escape sequences properly

## Development

To set up the development environment:

1. Clone the repository
2. Install dependencies: `npm install`
3. Build the package: `npm run build`
4. Run tests: `npm test`

## Iteration Process

The package follows semantic versioning:

1. Bug fixes result in patch version increments
2. New features that maintain backward compatibility result in minor version increments
3. Breaking changes result in major version increments

For contributing:
1. Fork the repository
2. Create a feature branch
3. Submit a pull request with detailed description of changes

