# Widget SDK E2E

This standalone suite tests the published `magic-widget.js` bundle through an isolated host fixture. It does not import Magic Web application source code or depend on the SDK package manifest.

## Setup

```bash
corepack pnpm install
corepack pnpm exec playwright install chromium
cp .env.example .env
```

Set `WIDGET_E2E_APP_URL` to the running Magic Web deployment. Playwright loads `.env` automatically. Test identifiers are environment values and must be fictional in committed files.

The first run should use one smoke case and real, user-provided environment values. The normal contract suite runs headless. The fixture uses the SDK's private-deployment login flow; if the browser is not already authenticated, use the interactive auth setup helper once to complete login manually:

```bash
WIDGET_E2E_APP_URL="https://your-magic-web-host.example" \\
WIDGET_E2E_CREW_ID="your-test-crew" \\
WIDGET_E2E_DEPLOYMENT_CODE="your-test-deployment" \\
WIDGET_E2E_ORGANIZATION_CODE="your-test-organization" \\
corepack pnpm exec playwright test widget-contract.spec.ts \\
  --grep "renders all standard Header actions"
```

For repeated runs, configure `WIDGET_E2E_STORAGE_STATE` with a local Playwright storage-state JSON file. Keep that file outside Git and never place credentials in `.env.example` or test fixtures.

To create the state file interactively, set the real environment values in `.env`, then run:

```bash
corepack pnpm test:e2e:auth
```

The auth setup helper opens an interactive browser and pauses for manual login. Complete the login in the opened page, resume the Playwright inspector, and the state is written to `.auth/widget.json`; subsequent contract runs use that state headlessly.

## Run

```bash
corepack pnpm test:e2e
corepack pnpm test:e2e:ui
corepack pnpm test:e2e:report
```

Every contract test runs in headless Chromium, records video and trace for every test, and opens the HTML report after execution. `test:e2e:report` reopens the latest report without rerunning tests. The suite covers mount lifecycle, all host-owned Header callbacks and context, Header labels/visibility, layout/conversation/responsive/window configuration, readiness and preview-state events, runtime config updates, static and callback-driven global/scoped custom Mention search including superseded-query cancellation, plain and structured Mention input commands, structured `sendMessage` acknowledgement, and iframe stability. Without `WIDGET_E2E_APP_URL`, contract tests intentionally skip; with an invalid deployment or missing login, they fail at the application boundary so the environment can be corrected before continuing.

## Coverage boundary

- Contract tests are deterministic around the deployed SDK boundary: Header actions and callback context, inline/floating lifecycle, visibility and presentation configuration, capability serialization, close semantics, lifecycle/UI-state events, and plain/structured input commands.
- Agent business behavior is deliberately outside this suite. Message generation, topic creation results, actual file transfer, drag/drop and clipboard upload, voice capture, internet search, plugin execution, and backend permission behavior belong to Magic Web or backend integration tests.
- SDK methods such as `sendMessage` and `newConversation` are covered at the SDK Bridge/unit-test layer, where command envelopes, acknowledgements, lifecycle errors, and timeout behavior can be tested without repeating Agent product flows.
