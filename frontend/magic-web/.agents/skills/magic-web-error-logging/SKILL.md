---
name: magic-web-error-logging
description: Enforce Magic Web structured business error logging when adding, changing, migrating, or reviewing `logger.error` calls in `src`, `enterprise/src`, or `customer/src`, including catch blocks, callbacks, ErrorBoundaries, workers, WebSocket/storage flows, and logger adapters. Use to choose `eventKey/errorKind/error/message/context`, preserve historical diagnostics, prevent unsafe payloads, and verify the JS probe plus `/log-report` behavior.
---

# Magic Web Error Logging

Apply the current structured error protocol without changing the business workflow or losing diagnostic evidence.

## Source Of Truth

Read the current implementation before changing logging behavior:

- `src/infrastructure/logger/types.ts` and `src/infrastructure/logger/record/createRecord.ts`
- `src/infrastructure/logger/index.ts` and `src/infrastructure/logger/internal.ts`
- `src/infrastructure/logger/delivery/queue.ts` and `src/infrastructure/logger/delivery/transport.ts`
- `packages/logger/src/providers/volcengine/error.ts`
- the callback, wrapper, or adapter type at the actual call site

When source layers are involved, inspect `src`, `enterprise/src`, and `customer/src`; follow the active overlay instead of assuming `src` is the only implementation.

Read [references/contract.md](references/contract.md) when deciding field behavior, Provider visibility, serialization, or sensitive-data boundaries. Read [references/examples.md](references/examples.md) when migrating legacy calls, handling callbacks, or reviewing a proposed log change.

## Required Workflow

1. Identify the logger before editing.
    - Confirm it is the unified Logger exported by `src/infrastructure/logger`, not `console`, a third-party callback logger, Bridge logger, test double, or unrelated object with an `error` method.
    - Do not convert unsupported logger APIs to the structured contract.
2. Inspect the complete business context.
    - Read the catch/callback signature and its type definition.
    - Read wrapper methods such as `createLogContext`, PPT/recording adapters, and message-context builders.
    - Compare the historical call and all its arguments before changing anything.
3. Map the data into the structured fields.
    - Put the stable failure scenario in `eventKey`.
    - Choose the narrowest existing `errorKind` supported by evidence.
    - Put the original thrown/rejected/callback error value in top-level `error`.
    - Preserve the historical readable description in `message`.
    - Move remaining bounded diagnostic values into `context` with meaningful keys.
4. Audit information preservation.
    - Verify every historical argument is still represented unless it is explicitly unsafe, duplicated by top-level `error`, or an unbounded object.
    - Do not simplify merely because the new structure looks cleaner.
5. Add a short comment only when the mapping is not self-evident.
    - Explain callback argument mapping, retained raw evidence with a size limit, or why sensitive/unbounded data is excluded.
    - Do not narrate obvious assignments.
6. Run focused verification and review the diff specifically for diagnostic loss.

## Required Shape

Use one structured object:

```ts
logger.error({
	eventKey: "stable_failure_event",
	errorKind: "network",
	error,
	message: "Historical or stable business error description",
	context: {
		operation: "load",
	},
})
```

`eventKey` and `errorKind` are required non-empty strings. `error`, `message`, and `context` are optional only when the business scenario genuinely has no corresponding value.

Never pass `namespace`, `eventId`, `release`, or `captureSource`; the Logger supplies them. Do not add a new business logging method or change `POST /log-report`.

## Field Rules

### `eventKey`

- Use lowercase `snake_case`.
- Describe one stable failure scenario, normally ending in `_failed`, `_timeout`, `_unsupported`, `_missing`, `_exhausted`, or `_anomaly`.
- Keep dynamic IDs, messages, status values, and retry counts out of the key.
- Reuse an existing key only when the failures should form the same problem family.
- Avoid mechanical duplication such as `upload_batch_batch_upload_failed`.

### `errorKind`

Prefer the current vocabulary:

```text
network storage render permission worker lifecycle timeout
invalid_state quota parse database unknown
```

Use `unknown` when evidence does not support a narrower category. Do not infer categories from arbitrary error text.

### `error`

- Preserve the original `Error` object whenever available.
- Preserve non-Error rejection/callback values at top level instead of converting them to a generic string.
- Do not construct a new `Error` in business code only for logging.
- Do not pass only `error.message` when the original object exists.
- Do not duplicate `message` and `stack` in `context`; the bottom layer handles a real `Error`.

### `message`

- Preserve the historical message unless a deliberate, reviewed wording change is required.
- Use it for the stable business description, not for dynamic object serialization.
- Do not remove dynamic diagnostic text unless the same information remains in `error` or named `context` fields.
- Remember that a real `Error` controls the fire-probe exception message; the self-hosted record preserves both fields independently.

### `context`

- Preserve bounded diagnostic fields with semantic names.
- Preserve common context builders such as recording/session state; call them without re-inserting the top-level `error` or `message` when those fields are already separate.
- Preserve raw evidence when it is necessary to reproduce parsing or protocol failures, using an explicit existing or justified size limit.
- Keep callback classifications such as `errorType` in context while placing the actual error value in top-level `error`.
- Do not place credentials, tokens, secrets, policies, signatures, complete business bodies, full attachment collections, circular objects, DOM/SDK instances, or other unbounded values in context.
- Do not remove URLs, hrefs, filenames, or business fields merely because they might be sensitive; first determine their diagnostic value and actual sensitivity. Apply the narrowest justified masking or bound.

## Scope Discipline

- Change only the logging call and the smallest required adapter type.
- Do not introduce unrelated sanitizers, data transforms, helper rewrites, or business behavior changes.
- Preserve established wrapper formatting, prefixes, operation data, slide/message/session fields, and other historical diagnostics.
- For a callback, use its declared parameter order. Do not guess with `args.find(...)` when a typed `Error` parameter exists.
- For an adapter, accept and forward `StructuredErrorInput`; enrich only the adapter-owned context and do not rewrite caller fields.

## Review Mode

When reviewing logging changes, prioritize findings in this order:

1. Original `Error` or non-Error failure value was dropped or replaced.
2. Historical message/context/href/raw evidence was removed without a justified boundary.
3. Callback parameters were mapped incorrectly.
4. Credentials, complete bodies, or unbounded objects were introduced.
5. `eventKey` is dynamic, ambiguous, duplicated, or semantically misleading.
6. `errorKind` is unsupported by the actual failure.
7. Unrelated business code changed during a logging-only task.
8. Required explanatory comments or focused tests are missing.

Treat wording-only changes as acceptable when no diagnostic information is lost.

## Verification

Perform checks proportional to the change:

```bash
rg -n "logger\.error" <touched-files>
corepack pnpm exec vitest run --config ./vitest.config.ts <focused-tests>
git diff --check
```

Also verify manually:

- the call is a single valid structured object;
- historical arguments are accounted for;
- real Error values remain top-level;
- context is bounded and serializable;
- no business code changed unintentionally;
- source and enterprise overlays remain consistent where applicable.

## Done Criteria

Complete only when the new call is structurally valid, preserves all justified historical diagnostics, excludes only clearly unsafe or unbounded data, keeps business behavior unchanged, and passes focused verification.
