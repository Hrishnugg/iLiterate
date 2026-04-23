# Documentation Style Guide

This project uses TSDoc/JSDoc comments in a Google-style structure.

## Scope

Add doc comments for:
- Major modules in src/lib and API client layers
- Exported classes, interfaces, and type aliases
- Exported functions and methods
- High-value test files that describe testing strategy and intent

## Required comment style

Use block comments in this format:

```ts
/**
 * One-line summary sentence.
 *
 * Optional details with context.
 *
 * @param input Description of input.
 * @returns Description of return value.
 * @throws Description of known error cases.
 */
```

## Conventions

- Start with a clear summary sentence.
- Document side effects (DB writes, network calls, clock/time behavior).
- Use @param for each non-trivial parameter.
- Use @returns whenever a function returns computed data.
- Use @throws for parsing/API/network validation failures.
- Keep comments accurate and concise; avoid repeating obvious code.

## Module headers

Each major module should include a top-level comment:

```ts
/**
 * @module
 * Summary of the module responsibility and boundaries.
 */
```

## Test file headers

Important test files should include a file overview with:
- What behavior the file protects
- Which testing strategy is used (unit, property-based, regression, mock-object)
- Why these tests are important for future changes

## Automated docs generation

Run from iliterate/:

```bash
npm run docs:build
```

Output is generated into:
- api-docs/

Open api-docs/index.html in a browser.
