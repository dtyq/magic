# @dtyq/browser-apm

Passive browser HTTP, resource, performance, page-view and uncaught-error monitoring for Volcengine, Aliyun and DataFlux. The application composition root creates one instance and owns initialization and context updates.

## Responsibilities

- No business `log/error/report/track` APIs or reporting to business log endpoints.
- No imports from application source, MobX, stores, business routes or release utilities; no interpretation of business response codes.
- HTTP monitoring never reads, clones or parses request or response bodies. Slow requests and HTTP status errors are annotations on the same event.
- Context accepts a user ID, an application session ID and a small set of string attributes. Replacing the context snapshot clears the previous identity on logout.
- User interaction tracking, session replay and business exception protocols are outside the package's scope.
- Explicit `console.error` calls and custom errors are excluded. DataFlux's native console errors are filtered by the adapter before sending.

## Usage

Internal payload masking lives in `src/privacy`: `types.ts` defines the configuration contract, `defaults.ts` contains the default rules, and `sensitive-masker.ts` handles recursive sanitization and JSON strings. Providers import this capability through the directory's `index.ts`; it is not part of the package's public API.

```ts
import { createBrowserApm, type BrowserApmConfig } from "@dtyq/browser-apm"

const apm = createBrowserApm()
const config: BrowserApmConfig = {
  provider: {
    type: "Volcengine",
    appId: "123456",
    token: "client-token",
    release: "1.2.3",
    env: "production",
  },
  telemetry: {
    remoteConfig: false,
    sampling: { unit: "event", rate: 1, events: { http: 0.5, resource: 0.1, error: 1 } },
    http: { slowThresholdMs: 1000, ignoreUrls: ["https://example.com/telemetry"] },
    errors: { dedupeWindowMs: 10000 },
  },
}

apm.updateContext({ userId: "user-1", sessionId: "app-session-1", attributes: { cluster: "one" } })
await apm.initialize(config)
apm.updateContext({ sessionId: "app-session-1", attributes: {} }) // logout
// Application shutdown: unsubscribe from stores first, then dispose.
apm.dispose()
```

Repeated `initialize` calls on the same instance share one promise, including failures; initialization is not retried implicitly. Context updates received before or during loading are retained and applied before collection starts. `dispose` is terminal, and SDK reinitialization should follow the application's page lifecycle. SDK loading is lazy; importing the package does not initialize monitoring.

## Configuration and compatibility

`resolveBrowserApmConfig` accepts the new `BrowserApmConfig` or legacy `{ strategy, options }` JSON. Monitoring is disabled when no provider is configured. Legacy SDK options are interpreted inside the package, not in application code. Business URL callbacks, business response codes, explicit custom events and replay are no longer used.

Sampling rates use ratios from 0 to 1; durations use milliseconds. Event sampling and session sampling have different semantics and cannot be substituted for one another. Explicit unsupported policies reject initialization rather than silently changing their meaning.

| Policy | Volcengine | Aliyun | DataFlux |
| --- | --- | --- | --- |
| Session sampling at 0.5 | 0.5 | 0.5 | Maps to 50 |
| Per-event sampling | Supported | Unsupported | Unsupported |
| Excluded HTTP URLs | Supported | Supported | Filters before send |
| HTTP/resource/error/performance capture switches | Supported | Supported | Equivalent mapping not implemented |
| Slow request threshold and error deduplication | Supported | Unsupported | Unsupported |

Volcengine defaults to 50% HTTP sampling, 10% resource sampling and 100% JavaScript/resource error sampling. Slow requests use a 1-second threshold, and repeated uncaught errors use a 10-second deduplication window. Each Fetch/XHR request produces at most one standard HTTP event before sampling. Cancelled requests are not treated as failures, and SSE requests are not marked as slow. Static resource monitoring excludes Fetch/XHR/beacon entries, CSS and APM telemetry endpoints. The application supplies its own reporting endpoints through `ignoreUrls`.

`sessionId` is an application correlation identifier propagated as `app_session_id`; native SDK sessions have provider-specific semantics. Aliyun and DataFlux do not expose a complete SDK teardown. Their adapters gate sending or switch to zero-rate sessions to prevent subsequent reports. Some SDK listeners may remain resident, and data already dispatched or entering the SDK's sending pipeline cannot be recalled.

## Application integration

Magic Web's `src/services/app/browser-apm` reads startup configuration, creates or reuses the application session, injects the release and synchronizes user, organization and cluster identifiers through one MobX reaction. The initial context synchronization precedes SDK startup, and logout clears user and organization fields. Open-source and enterprise AppService implementations share the same entry point. The application layer also owns scheduling and cleanup.

`src/infrastructure/logger` owns explicit business logging and self-hosted collection. Its application lifecycle is managed by `src/app/services/loggerService.ts`, independently of this package.

## Workspace resolution

The root `pnpm-workspace.yaml` and lockfile own installation. Application imports use `@dtyq/browser-apm` with a `workspace:*` dependency. Run `pnpm install` from the repository root; do not maintain a separate package lockfile.

Vite, Vitest and TypeScript enable the `magic-web-source` export condition for both development and production to resolve `src/index.ts` without building the package first. Default exports point to `dist`, so build the package before standalone use or publishing. The source condition is reserved for this repository; external consumers should use the default compiled exports. SDK versions come from declared peers and the shared lockfile, without a vendor-specific Vite path alias.

## Verification

The build separates module formats and publishes a single ESM declaration tree:

```text
dist/
  esm/
    index.js
    index.d.ts
    ... ESM chunks and type declarations
  cjs/
    index.cjs
    ... CommonJS chunks
```

The package's `import` and `module` entries point to `dist/esm/index.js`; `require` and `main` point to `dist/cjs/index.cjs`. Both the top-level `types` field and the `types` export point to `dist/esm/index.d.ts`. The repository-only `magic-web-source` export remains unchanged.

```sh
pnpm --dir packages/browser-apm test
pnpm --dir packages/browser-apm typecheck
pnpm --dir packages/browser-apm build
```

Tests cover HTTP sampling and uncaught-error collection with the actual SDK, configuration mapping, concurrent lifecycle operations and dependency boundaries. Application tests cover initial identity synchronization, account and cluster changes, clearing identity on logout, repeated initialization and subscription cleanup.
