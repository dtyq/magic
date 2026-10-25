# @dtyq/html-sandbox

`@dtyq/html-sandbox` provides a browser runtime and a self-contained HTML shell for rendering untrusted or generated HTML inside an iframe. It is designed for editor, inspector, DevTools, and host-bridge workflows where the host page communicates with the sandbox through `postMessage`.

## What It Contains

- Runtime core for iframe editing and inspection.
- Runtime plugin registry for host bridge APIs.
- Structured runtime logger for DevTools collection.
- A standalone `index.html` shell for cross-origin iframe rendering.
- Development server for local sandbox debugging.

The package does not contain application-specific APIs. Product APIs such as `window.Magic.*` should live in the host application and be injected into the rendered document before user HTML scripts run.

## Build Targets

This package supports two build directions.

### 1. Self-Contained HTML

Build a deployable single-file sandbox shell:

```bash
pnpm --dir packages/html-sandbox build:html
```

The output is:

```text
packages/html-sandbox/dist/index.html
```

By default, `build:html` bundles `packages/html-sandbox/src/auto-start.ts` and inlines it into an executable script in `index.html`, so the shell runtime starts as soon as the HTML file opens.

Applications can pass their own runtime composition entry:

```bash
pnpm --dir packages/html-sandbox build:html -- --runtime-entry <relative-or-absolute-entry>
```

That entry can import `@dtyq/html-sandbox` for custom shells. Do not import application APIs into the shell entry when the HTML template must remain product-agnostic; inject those APIs into the document passed through `setContent`.

### 2. NPM Package

Build the reusable package modules and TypeScript declarations:

```bash
pnpm --dir packages/html-sandbox build:npm
```

The output is emitted to `packages/html-sandbox/dist`.

Public API (one import entry):

```ts
import {
	startIframeRuntime,
	BaseRuntimeBridgeApiPlugin,
	registerRuntimePlugins,
	getParentOrigin,
	isSafeHref,
	type RuntimePluginClass,
} from "@dtyq/html-sandbox"
```

Importing the package does not start the iframe runtime. Call
`startIframeRuntime()` explicitly in a custom shell; the built-in shell uses
`auto-start.ts`. Existing runtime and utility subpaths remain available for
backward compatibility. `index.html` is a separate HTML asset.

The app and tests use the `magic-web-source` export condition to resolve all
package entries to source. Add new public APIs to `src/index.ts` without adding
consumer aliases or TypeScript path mappings.

## Application Composition

The runtime and application APIs are intentionally decoupled. The shell exposes runtime APIs on `window.MagicHtmlSandboxRuntime` when it opens. The host application should prepend application API preludes to the HTML sent via `setContent`; those preludes can call `registerRuntimePlugins(...)`, and late registration installs immediately after the shell runtime has started.

## Development

Start the local sandbox server:

```bash
pnpm --dir packages/html-sandbox dev
```

The server listens on port `4173` and serves:

- `/index.html` - sandbox shell.
- `/iframe-runtime.js` - runtime bundle generated from the configured runtime entry.
- `/packages/*` - local proxy for host static package assets.
- `/proxy?url=...` - simple resource proxy for iframe content.

## Scripts

```bash
pnpm --dir packages/html-sandbox build
pnpm --dir packages/html-sandbox build:html
pnpm --dir packages/html-sandbox build:lib
pnpm --dir packages/html-sandbox build:npm
pnpm --dir packages/html-sandbox typecheck
pnpm --dir packages/html-sandbox test
pnpm --dir packages/html-sandbox dev
```

## Environment

- `MAGIC_HTML_SANDBOX_RUNTIME_ENTRY` - optional runtime entry used by the development server and HTML build.
- `HTML_SANDBOX_RUNTIME_ENTRY` - equivalent runtime entry alias.
- `HTML_SANDBOX_PORT` - optional development server port. Defaults to `4173`.
- `RENDER_SITE_FORCE_HTTP=true` - force the local server to use HTTP even when certificates exist.

## License

Apache-2.0
