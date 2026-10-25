# Magic Widget SDK

Magic Widget SDK is a browser UMD script for embedding Magic Web into an external site. After the script is loaded, the host page can call `window.MagicWidget.mount(...)` to display a floating message button. Clicking the button hides the button and opens a Magic Web page inside an iframe panel.

## Script URL

Use the SDK file served by the Magic Web deployment that should host the embedded iframe:

```html
<script src="https://your-magic-domain.com/sdk/magic-widget.js"></script>
```

The iframe origin is inferred from the script URL. For example, if the script is loaded from `https://your-magic-domain.com/sdk/magic-widget.js`, the iframe also opens on `https://your-magic-domain.com`.

The SDK does not accept an `appOrigin` option. The script URL selects the Magic Web origin, while `auth.deploymentCode` selects SaaS or a private deployment within that origin.

## Quick Start

Call `mount` after `document.body` is available:

```html
<script src="https://your-magic-domain.com/sdk/magic-widget.js"></script>
<script>
	window.MagicWidget.mount({
		page: {
			type: "crew",
			crewId: "crew-001",
		},
		auth: {
			loginStrategy: "phone_password",
			deploymentCode: "private-mock",
			organizationCode: "org-001",
		},
		config: {
			layout: "desktop",
			shell: { appSidebar: false },
			responsive: {
				mobileDetection: "device-and-viewport",
			},
			conversation: {
				projectFiles: false,
				topicHistory: true,
				previewMode: "switchable",
			},
		},
		modal: {
			title: "Magic Assistant",
			width: 480,
			height: 680,
		},
	})
</script>
```

If the script is loaded in `head` with `async`, or before `body` exists, defer the call:

```html
<script>
	window.addEventListener("DOMContentLoaded", function () {
		window.MagicWidget.mount({
			page: {
				type: "crew",
				crewId: "crew-001",
			},
		})
	})
</script>
```

## Runtime API

The UMD script exposes one global object:

```ts
window.MagicWidget
```

| Method            | Signature                                                      | Description                                                                                                       | Boundary                                                                                                                                   |
| ----------------- | -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `mount`           | `(options: MagicWidget.MountOptions) => void`                  | Creates the widget and displays the floating button. Calling `mount` again replaces the previous widget instance. | Must be called in a browser document after `document.body` exists.                                                                         |
| `open`            | `() => void`                                                   | Opens the panel programmatically. The floating button is hidden while the panel is open.                          | Must be called after `mount`; otherwise an error is thrown.                                                                                |
| `close`           | `() => void`                                                   | Closes the panel programmatically. The floating button is shown again after the close animation.                  | Safe to call when the panel is already closed.                                                                                             |
| `destroy`         | `() => void`                                                   | Removes the widget DOM, event listeners, timers, and current configuration.                                       | Call `mount` again before using `open`.                                                                                                    |
| `on`              | `on(event, listener)`                                          | Subscribes to config warnings, Agent readiness, preview state, and runtime events.                                | Each event has a distinct listener signature; see Event API below.                                                                         |
| `setInput`        | `(content: string \| InputContent) => Promise<void>`           | Replaces the Agent editor content and focuses it without sending.                                                 | Accepts non-empty text or validated text/Mention blocks; the number of `blocks` and the Mention length are unbounded — see Mention limits. |
| `appendInput`     | `(content: string \| InputContent) => Promise<void>`           | Appends text or Mention blocks to the current editor value without sending.                                       | Preserves the supplied block order; the number of `blocks` and the Mention length are unbounded — see Mention limits.                      |
| `clearInput`      | `() => Promise<void>`                                          | Clears the current editor without sending.                                                                        | Completion follows the iframe response.                                                                                                    |
| `getInput`        | `() => Promise<string>`                                        | Returns the current editor value as plain text.                                                                   | Completion follows the iframe response.                                                                                                    |
| `sendMessage`     | `(content?: string \| InputContent) => Promise<void>`          | Sends supplied content, or sends the current editor value when content is omitted.                                | Uses the existing editor send validation and conversation flow; structured content limits are in Mention limits.                           |
| `newConversation` | `() => Promise<void>`                                          | Creates and selects a new conversation, resolving after its editor becomes ready.                                 | Rejects if creation fails or the new editor does not become ready.                                                                         |
| `updateConfig`    | `(config: Partial<MagicWidget.WidgetConfig>) => Promise<void>` | Incrementally updates the current embedded-page configuration.                                                    | Does not change the URL, replace `iframe.src`, or reload the iframe.                                                                       |

The object also exposes `window.MagicWidget.version` for diagnostics.

### Event API

#### `config.warning`

```ts
on(event: "config.warning", listener: (warning: MagicWidget.ConfigWarning) => void): () => void
```

When `panel.customGroups` exceeds a count or UTF-8 JSON byte limit, the SDK filters overflow in configuration order, continues mounting or updating the Widget, and emits one aggregate warning. It also writes a `console.warn`; the host may use the event to show a toast, record a log, or report telemetry. Subscribe before `mount` to receive filtering diagnostics for initial configuration:

```js
const unsubscribeConfigWarning = window.MagicWidget.on("config.warning", (warning) => {
	if (warning.code === "CUSTOM_MENTION_FILTERED") {
		showHostWarning(warning.message, warning.details)
	}
})
```

`warning.details` includes removed group and item counts plus these reasons:

- `MAX_GROUPS`: only the first 50 groups are considered.
- `MAX_ITEMS_PER_GROUP`: only the first 1,000 candidates in each group are considered.
- `MAX_TOTAL_ITEMS`: at most 5,000 items are retained across groups in configuration order.
- `MAX_ITEM_BYTES`: an item whose UTF-8 JSON exceeds 32 KiB is removed.
- `MAX_PAYLOAD_BYTES`: the complete snapshot is retained in configuration order up to 2 MiB; items or groups that no longer fit are removed.

Count and byte overflow does not make `mount` throw or `updateConfig` reject, reload the iframe, or clear conversation state. Missing fields, duplicate IDs, built-in ID collisions, unknown fields, circular objects, and non-JSON-safe values remain structural errors: they still reject with `INVALID_CONFIG` without partially replacing the previous snapshot.

#### `message.stream.started`

```ts
on(event: "message.stream.started", listener: (event: MagicWidget.MessageStreamStartedEvent) => void): () => void
```

The SDK forwards the complete stream-start event when Magic Web accepts the first ordered chunk of a new stream generation:

```js
const unsubscribeStreamStarted = window.MagicWidget.on("message.stream.started", (event) => {
	// Show temporary host feedback without depending on Magic Web's internal payload shape.
	showHostStreamingState(event)
})
```

- A stream may start with metadata, reasoning, content, or tool-call data; Magic Web owns the current payload classification.
- A restart for the same correlation may create a new stream generation and another started event.
- The SDK only guarantees the event name. Magic Web owns `meta` and `payload`, so hosts should validate or narrow specific fields inside their own business boundary.

#### `toolCall.settled`

```ts
on(event: "toolCall.settled", listener: (event: MagicWidget.ToolCallSettledEvent) => void): () => void
```

The SDK forwards the complete event whenever Magic Web publishes a tool settlement:

```js
const unsubscribeTool = window.MagicWidget.on("toolCall.settled", (event) => {
	// Refresh host state without depending on Magic Web's internal payload shape.
	void refreshHostToolState(event)
})
```

- The SDK only guarantees the event name. Magic Web owns the fields inside `meta` and `payload`, so their structure is intentionally not fixed by the public types.
- The SDK does not interpret, trim, deduplicate, or reclassify tool events. It forwards exactly what Magic Web publishes.
- Hosts that consume the current data shape should validate or narrow `event.payload` inside their own business boundary.

#### `task.completed`

```ts
on(event: "task.completed", listener: (event: MagicWidget.TaskCompletedEvent) => void): () => void
```

The SDK forwards the complete event whenever Magic Web publishes a task completion:

```js
const unsubscribeTask = window.MagicWidget.on("task.completed", (event) => {
	// Refresh host state without depending on Magic Web's internal payload shape.
	void refreshHostTaskState(event)
})
```

The SDK does not define Magic Web's internal completion criteria or interpret result data. Event production and field contents follow Magic Web's current behavior.

These runtime events are best-effort browser notifications. They do not replay earlier events or guarantee delivery after Widget destruction, iframe reload, background scheduling, network loss, offline use, or execution on another device. Hosts may update temporary UI or trigger their own data refresh, but must not treat these events as durable business records. The SDK adds no current-topic filter; events actually emitted by Magic Web and observed by the iframe are forwarded directly.

#### `preview_fullscreen`

```ts
on(event: "preview_fullscreen", listener: (isFullscreen: boolean) => void): () => void
```

The SDK sends the host a complete boolean snapshot when Agent preview enters or exits fullscreen presentation:

- `true`: the preview is using fullscreen presentation.
- `false`: the preview has exited fullscreen presentation, or no preview is currently fullscreen.
- Immediately after subscription, the listener synchronously receives the current state. It is `false` before fullscreen is entered, allowing the host to apply its initial layout before the next paint.
- Later notifications are emitted only when the state changes. The state resets to `false` when the iframe reloads, the Widget is destroyed, or the fullscreen preview exits.
- The return value removes the listener. Call it when the host component unmounts or no longer needs the state.

This event only describes the Agent preview state. The SDK does not resize, portal, or restyle the Widget container. To cover the host viewport, update the host-owned container in response to the event:

```js
const container = document.querySelector("#agent-slot")

const unsubscribePreviewFullscreen = window.MagicWidget.on("preview_fullscreen", (isFullscreen) => {
	// Keep the host-owned container aligned with the complete SDK state snapshot.
	container.classList.toggle("agent-preview-fullscreen", isFullscreen)
})

window.MagicWidget.mount({
	page: { type: "crew", crewId: "crew-demo" },
	target: container,
})

// Keep this function and invoke it when the host component is cleaned up.
// unsubscribePreviewFullscreen()
```

```css
.agent-preview-fullscreen {
	position: fixed;
	inset: 0;
	z-index: 1000;
}
```

Subscribe before `mount` to cover the initial mount and later remount state transitions. Store and invoke each unsubscribe function separately when subscribing to multiple events.

#### `agent_ready`

```ts
on(event: "agent_ready", listener: () => void): () => void
```

`agent_ready` means the iframe has completed page initialization and editor event subscription, and the current topic's draft phase has settled. It is an informational state notification, not a required gate for ordinary commands. If the first host action must wait for it, subscribe before `mount` and unsubscribe after the first notification.

## Mount Options

```ts
namespace MagicWidget {
	type HeaderActionName =
		"fullscreen" | "pin" | "newTopic" | "history" | "share" | "more" | "close"

	interface HeaderActionContext {
		action: HeaderActionName
		topicId?: string
		topicName?: string
	}

	interface MountOptions {
		page: PageOptions
		auth?: AuthOptions
		config?: WidgetConfig
		iframe?: IframeOptions
		modal?: ModalOptions
		target?: HTMLElement
		headerActions?: Partial<
			Record<HeaderActionName, (context: HeaderActionContext) => void | Promise<void>>
		>
		/** Resolves host-owned candidates for a non-empty search; superseded calls are cancelled via `signal`. */
		customMentionSearch?: (context: {
			query: string
			scope: { type: "global" } | { type: "group"; groupId: string }
			signal: AbortSignal
		}) => Promise<Array<{ groupId: string; items: CustomMentionItem[] }>>
	}
}
```

### Inline mode

Pass a connected `HTMLElement` as `target` to render the iframe directly inside that container:

```js
const container = document.querySelector("#agent-slot")
window.MagicWidget.mount({
	page: { type: "crew", crewId: "crew-demo" },
	target: container,
})
window.MagicWidget.setInput("Summarize this fictional content")
window.MagicWidget.sendMessage("Process this fictional content now")
```

### Agent readiness and input maintenance

`agent_ready` means that page initialization and editor command subscriptions are complete, and that the current topic's draft phase has settled through restoration, an intentional skip, or failure fallback. It is an informational state notification, not an execution prerequisite enforced by the SDK or iframe bridge. Ordinary commands are sent after the iframe document loads and are not queued for `agent_ready`.

If the first host action must run after the existing topic draft has been handled, wait for one `agent_ready` event in host business logic. Subscribe before `mount` so the first event cannot be missed:

```js
const firstAgentReady = new Promise((resolve) => {
	const unsubscribe = window.MagicWidget.on("agent_ready", () => {
		unsubscribe()
		resolve()
	})
})

window.MagicWidget.mount({
	page: { type: "crew", crewId: "crew-demo" },
})

await firstAgentReady
await window.MagicWidget.setInput("Fictional task prefix")
await window.MagicWidget.appendInput(", continue processing")
const currentInput = await window.MagicWidget.getInput()
await window.MagicWidget.clearInput()
```

`getInput` returns plain text and does not expose TipTap or internal Mention JSON. `appendInput` never sends a message. `setInput` replaces the current editor value without deleting persisted draft history; subsequent draft persistence continues through the existing topic-scoped draft flow.

Structured input uses SDK-owned blocks rather than raw TipTap JSON:

```js
const input = {
	blocks: [
		{ type: "text", text: "Ask " },
		{
			type: "mention",
			mention: {
				type: "agent",
				data: {
					agent_id: "agent-mock-001",
					agent_name: "Agent Mock",
				},
			},
		},
		{ type: "text", text: " to review this fictional task." },
	],
}

await window.MagicWidget.setInput(input)
await window.MagicWidget.appendInput({
	blocks: [
		{
			type: "mention",
			mention: {
				type: "tool",
				data: { id: "tool-mock-001", name: "Tool Mock" },
			},
		},
	],
})
await window.MagicWidget.sendMessage()
```

Mention input uses one generic `{ type, data }` contract. Registered Magic Web kinds keep their existing validation, rendering, draft, and send behavior. The protocol also preserves unknown non-empty type strings as generic nodes without promising backend semantics. Raw TipTap JSON and empty `blocks` reject with `INVALID_INPUT`; `data` only needs to be an object that can cross the window boundary, and its nested fields are not recursively restricted. This entry point has no count or byte limit, and its `data` length is not subject to the 64 / 512 character caps of `config.panel.customGroups`; Mention limits compares both entry points.

The SDK-only `text` Mention requires non-empty `data.id`, `data.label`, and `data.text`. It renders as `@label` and remains structured in the editor and draft. The send snapshot uses reversible plain-text markers carrying `data.text` and the metadata needed for restoration, so refreshed messages can render the Mention again. It does not enter the Mention picker or structured Mention metadata:

```ts
await window.MagicWidget?.setInput({
	blocks: [
		{ type: "text", text: "Interpret " },
		{
			type: "mention",
			mention: {
				type: "text",
				data: {
					id: "chart-mock-001",
					label: "Sales Chart",
					text: "chart id: mock-chart; range: mock-range",
				},
			},
		},
	],
})
```

Passing content to `sendMessage` sends that content without replacing the current editor value. Omitting content runs the editor's normal send action for the current draft. SDK and iframe deployments must use the same protocol version for structured input.

### New conversation

`newConversation` creates a new topic for the current Crew. The iframe returns its response after the new topic transition completes, and the SDK resolves the Promise from that response:

```js
await window.MagicWidget.newConversation()
await window.MagicWidget.setInput("Fictional content in the new conversation")
await window.MagicWidget.sendMessage("Send fictional content in the new conversation")
```

The host must give the container a non-zero width and height. Inline mode has no floating button, mask, or close control outside the iframe and is expanded after `mount`. The standard header close button is controlled by `config.window.closable`, while `close()` always remains available for programmatic lifecycle control. The SDK is a single-instance API, so a later `mount` replaces the previous instance.

All input, send, conversation, and configuration methods return a Promise. They reject with an error containing `code` values such as `NOT_MOUNTED`, `INVALID_INPUT`, `INVALID_CONFIG`, `IFRAME_NOT_READY`, or `COMMAND_FAILED`. The SDK waits only for the iframe document to load during initial navigation or reload, not for `agent_ready`; command results follow the iframe response.

The iframe uses a versioned `postMessage` protocol restricted to the SDK-derived Magic origin and the bound iframe window. Do not send secrets or unnecessary business data. Dynamic content is available only to desktop inline Widget embeds; ordinary Magic Web pages and mobile layouts do not consume it.

### `config`

Controls the presentation of the SDK-embedded page without changing ordinary Magic Web pages:

```ts
namespace MagicWidget {
	type Layout = "desktop" | "mobile"

	interface WidgetConfig {
		layout?: Layout
		shell?: {
			appSidebar?: boolean
		}
		responsive?: {
			mobileDetection?: "viewport" | "device-and-viewport"
		}
		conversation?: {
			projectFiles?: boolean
			topicHistory?: boolean
			autoHire?: boolean
			previewMode?: "split" | "fullscreen" | "switchable"
		}
		header?: {
			visible?: boolean
			title?: string | { mode?: "static" | "hidden"; text?: string }
			topicName?: { mode?: "current" | "hidden" | "static"; text?: string }
			actions?: Partial<
				Record<
					"fullscreen" | "pin" | "newTopic" | "history" | "share" | "more" | "close",
					boolean
				>
			>
		}
		panel?: {
			projectFiles?: boolean
			uploadFiles?: boolean
			otherProjectFiles?: boolean
			digitalEmployees?: boolean
			microApps?: boolean
			workflows?: boolean
			connectors?: boolean
			skills?: boolean
			canvasElements?: boolean
			customGroups?: Array<{
				id: string
				label: string
				icon?: string
				iconUrl?: string
				items: Array<{
					id: string
					type: string
					text: string
					title?: string
					description?: string
					icon?: string
					iconUrl?: string
					data?: Record<string, unknown>
				}>
			}>
		}
		bottom?: {
			internetSearch?: { enabled?: boolean; buttonVisible?: boolean }
			plugin?: { enabled?: boolean; buttonVisible?: boolean }
			upload?: { enabled?: boolean; buttonVisible?: boolean }
			voice?: { enabled?: boolean; buttonVisible?: boolean }
			model?: { buttonVisible?: boolean }
		}
		window?: { closable?: boolean }
	}
}
```

| Field                        | Description                                                                                                                                                                             | Boundary                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `layout`                     | Selects the desktop or mobile Crew conversation content.                                                                                                                                | It does not replace the surrounding application shell. SDK embeds default to `mobile`; set `desktop` explicitly when needed.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `shell.appSidebar`           | Shows or hides the application sidebar.                                                                                                                                                 | Applied only to a valid SDK embed whose effective Crew layout is `desktop`; it does not affect mobile embedded layouts.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `responsive.mobileDetection` | Selects viewport-only or device-and-viewport mobile semantics.                                                                                                                          | SDK embeds default to `viewport` for compatibility with existing mobile hosts. Set `device-and-viewport` when narrow desktop iframes should retain desktop interactions.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `conversation.projectFiles`  | Shows or hides the desktop project-files panel.                                                                                                                                         | Applied only by the desktop Crew conversation layout.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `conversation.topicHistory`  | Enables or disables the desktop topic-history entry and panel.                                                                                                                          | Applied only by the desktop Crew conversation layout.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `conversation.autoHire`      | Automatically attempts to hire an unusable Crew member.                                                                                                                                 | Enabled by default only for valid SDK embeds; ordinary Magic Web Crew pages never auto-hire.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `conversation.previewMode`   | Selects `split`, `fullscreen`, or `switchable` presentation.                                                                                                                            | Desktop SDK embeds default to `switchable`; ordinary Magic Web pages keep their existing split layout.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `header.visible`             | Shows or hides the inline standard header.                                                                                                                                              | Applies to desktop inline only; the host may draw its own header when hidden.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `header.title` / `topicName` | Configures the first-line title and second-line topic text.                                                                                                                             | `title` may be a string or `{ mode: "static", text }`. `title: { mode: "hidden" }` hides only the first line; the topic name and actions stay, and the remaining topic name keeps its secondary style. Omitting `title` uses the default label; a blank string is rejected. `hidden` does not accept `text`, and `static` requires non-blank `text`. `topicName.mode` supports `current`, `hidden`, and `static`; current topic name is the default. |
| `header.actions`             | Controls visibility of each standard header action.                                                                                                                                     | Omitted actions stay visible; set an action to `false` to hide it. `fullscreen` and `pin` have no in-widget behavior: register the matching `headerActions` handler, or set that flag to `false`. Omitting them without a handler still renders the button, and the click does nothing. `header.visible=false` hides the whole header.                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `panel.*`                    | Controls each fixed root row in the `@` mention panel: project files, upload files, other project files, digital employees, flows, micro-apps, connectors, skills, and canvas elements. | Each field only affects the matching Mention row. Flow child rows such as agents and tools keep their existing behavior. Omitted values preserve current behavior.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `bottom.*`                   | Controls capability and button visibility for search, connector, upload, and voice, plus the model picker button.                                                                       | Bottom settings are independent from Mention rows. Disabling upload also blocks drag/drop, paste, and image paths; hiding only the button preserves capability. `internetSearch.enabled: false` hides the button and forces `enable_web_search` off on send. The model picker has button visibility only.                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `window.closable`            | Controls visibility of the close button inside the iframe standard header.                                                                                                              | `false` hides only the entry; the host can still call `close()`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `panel.customGroups`         | Adds named business groups to the end of the desktop inline `@` panel.                                                                                                                  | The complete snapshot is replaced by `mount`/`updateConfig`; group IDs are unique and cannot collide with built-in roots, item IDs are unique within each group, and empty groups are hidden. Maximum 50 groups, 1,000 items per group, 5,000 items in total, 32 KiB per item, and 2 MiB for the complete UTF-8 JSON payload; `id`/`type`/`icon` are capped at 64 characters and `label`/`text`/`title`/`description` at 512. Count or byte overflow is filtered in order and emits `config.warning` without interrupting rendering; oversized fields, structurally invalid, duplicate, or non-JSON-safe values reject with `INVALID_CONFIG` and keep the previous snapshot. Reserved built-in root IDs and both Mention entry points are compared in Mention limits. |

`split` keeps the expanded conversation and preview side by side. `fullscreen` shows only the preview in the current host-controlled Widget container and closes the preview when the user exits; it covers the host viewport only when the host resizes the Widget container accordingly. `switchable` keeps the preview inside the Widget layout, collapses the conversation when a new preview session starts, and lets the user expand or collapse the conversation without recreating the preview. Manual fullscreen remains available and returns to the previous conversation layout when the user exits. The controller keeps the same iframe mounted, so file tabs, playback state, editor content, and loaded preview data remain intact. A runtime configuration update affects the next preview activation and does not force the current layout to change.

`updateConfig` validates the partial object and merges declared fields into the current configuration. After the iframe has loaded, the SDK sends the resulting complete snapshot through the protected message channel. The Promise resolves after Magic Web accepts the snapshot. Runtime updates do not modify the URL, replace `iframe.src`, or reload the iframe:

```js
await window.MagicWidget.updateConfig({
	responsive: {
		mobileDetection: "device-and-viewport",
	},
	conversation: {
		projectFiles: true,
		topicHistory: false,
		autoHire: false,
		previewMode: "split",
	},
	header: { title: "Custom Assistant", topicName: { mode: "current" } },
	bottom: {
		upload: { enabled: false, buttonVisible: false },
		internetSearch: { enabled: true, buttonVisible: false },
	},
	window: { closable: false },
})
```

### Mention limits

<!-- These limits mirror CUSTOM_MENTION_LIMITS in packages/magic-widget-sdk/src/config.ts and MAGIC_WIDGET_CUSTOM_GROUP_LIMITS in src/providers/MagicWidgetProvider/custom-groups.ts; keep every README copy of these numbers in sync. -->

Mention has two separate entry points with different limits: `config.panel.customGroups` supplies the candidate items for the `@` panel, while `blocks[].mention` in `setInput` / `appendInput` / `sendMessage(content)` writes Mention nodes directly into the editor. The same-named `text` field obeys different caps on each entry point, so confirm the entry point before choosing values.

| Entry point                 | What it sets         | Applies to                 | Overflow behavior                                                                                                                                 | Error code       |
| --------------------------- | -------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| `config.panel.customGroups` | `@` panel candidates | Desktop inline Widget only | Count or byte overflow is filtered in order and emits `config.warning`; oversized fields or structurally invalid values reject the whole snapshot | `INVALID_CONFIG` |
| `blocks[].mention`          | Editor Mention nodes | Every layout               | No count limit and no byte limit                                                                                                                  | `INVALID_INPUT`  |

Field caps:

| Field                                      | `config.panel.customGroups`                                              | `blocks[].mention`                                                                               |
| ------------------------------------------ | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| `id` / `type`                              | Required and non-empty, at most 64 characters                            | No length limit                                                                                  |
| `icon`                                     | Optional TSIcon token, at most 64 characters                             | No length limit                                                                                  |
| `iconUrl`                                  | Optional HTTPS image URL, at most 2,048 characters                       | No length limit                                                                                  |
| `placement`                                | Optional `"start"` or `"end"` (default `"end"`); `"start"` puts the group before built-in categories | N/A                                                                                              |
| `label` / `text` / `title` / `description` | `text` is required and non-empty; each at most 512 characters            | With `type: "text"`, `data.id`, `data.label`, and `data.text` must be non-empty; no length limit |
| Item count                                 | At most 50 groups, 1,000 items per group, 5,000 items in total           | No limit on the number of `blocks`                                                               |
| Payload size                               | At most 32 KiB per item and 2 MiB for the complete snapshot (UTF-8 JSON) | No byte budget; values only need to survive structured cloning across the window boundary        |

Overflow on `config.panel.customGroups` falls into three categories that need different host handling:

| Category            | Trigger                                                                                                                                                                                        | Result                                                                                                                                                                                                                                                         |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Filtered in order   | More than 50 groups, 1,000 items in one group, 5,000 items in total, 32 KiB in one item, or 2 MiB in the complete snapshot                                                                     | Content that still fits is kept, one aggregated `config.warning` is emitted (`reasons` is `MAX_GROUPS`, `MAX_ITEMS_PER_GROUP`, `MAX_TOTAL_ITEMS`, `MAX_ITEM_BYTES`, or `MAX_PAYLOAD_BYTES`), and `mount` / `updateConfig` resolve without reloading the iframe |
| Rejected as a whole | Missing or empty fields, fields beyond 64 / 512 characters, duplicate group or item IDs, a group ID colliding with a built-in root, unknown fields, or non-plain-object / non-JSON-safe values | Rejects with a path-bearing `INVALID_CONFIG`, keeps the previous snapshot, and never partially replaces it                                                                                                                                                     |
| Send-time downgrade | A `text` Mention produced by clicking a custom group item                                                                                                                                      | Does not enter `extra.super_agent.mentions`; the backend writes it into the Agent prompt as plain text in the form `@<item.text>`, and the attached JSON stays rich-text metadata                                                                              |

These built-in root IDs are reserved, so a `config.panel.customGroups` group ID must not repeat one of them:

```
personal-drive
enterprise-drive
organization-drive
project-files
other-project-files
mcp-extensions
digital-employees
flows
agents
micro-apps
skills
tools
upload-files
canvas-elements
histories
tabs
```

Field semantics and host integration examples are in Custom Mention groups below; see Event API for subscribing to `config.warning`.

### Custom Mention groups

Custom Mention groups are delivered after the `config_ready` handshake, so they are deliberately omitted from the protected initial URL query. A desktop inline Widget shows each non-empty host-named group in the root list. By default (or with `placement: "end"`), custom groups appear after the built-in `@` entries; specifying `placement: "start"` places the group at the top before built-in categories (micro-apps, connectors, skills, etc.). Clicking an item immediately inserts a `text` Mention and closes the Mention panel. The Mention displays the item's short `title` (falling back to `text`), while the Agent prompt uses the complete `text`. The original group ID, item ID, type, and data stay in the rich-text Mention metadata; no new backend Mention protocol is introduced.

The initial list and group navigation always come from static `panel.customGroups`. When the user enters a non-empty search query, the optional `customMentionSearch` callback can resolve fresh candidates. The callback receives either `{ type: "global" }` or `{ type: "group", groupId }`; every returned result includes its owning static `groupId`. Static custom results and callback results are merged, keyed by `groupId` plus item `id`; when both sources contain the same identity, the callback result wins. Global results are then merged with built-in Mention results. Clearing the query restores the static list.

The Widget owns the search request lifecycle, so hosts do not need to implement their own sequencing. Input is debounced; starting a newer query, replacing the group or callback configuration, or unmounting the Widget cancels the in-flight callback through `signal`. A cancelled callback never reaches the panel: results that arrive after cancellation are discarded, so a slow earlier response cannot overwrite the newest one, and cancellation is not rendered as a failure — the panel keeps the results it already showed. Hosts only need to forward `signal` into their own data request so the underlying work stops early:

```js
customMentionSearch: async ({ query, scope, signal }) => {
	const response = await fetch(`/host-search?q=${encodeURIComponent(query)}`, { signal })
	const items = await response.json()
	return [{ groupId: scope.type === "group" ? scope.groupId : "business-charts", items }]
}
```

Forwarding `signal` is recommended rather than required: a host that ignores it keeps its own request running, and the Widget still discards the result. What a cancelled callback must not do is report the cancellation as a different error, such as a timeout or a network failure, because a failure that does not carry `AbortError` is treated as a real one and shows the retry state.

```js
window.MagicWidget.mount({
	page: { type: "crew", crewId: "crew-demo" },
	target: document.querySelector("#agent-slot"),
	config: {
		layout: "desktop",
		panel: {
			customGroups: [
				{
					id: "business-charts",
					label: "Business charts",
					items: [
						{
							id: "fixture-chart-a",
							type: "chart",
							title: "Chart A",
							text: "Static chart fixture",
						},
					],
				},
			],
		},
	},
	customMentionSearch: async ({ query, scope, signal }) => {
		const response = await fetch(`/host-search?q=${encodeURIComponent(query)}`, { signal })
		const items = await response.json()
		return [{ groupId: scope.type === "group" ? scope.groupId : "business-charts", items }]
	},
})
```

`text` must be self-contained: it is the only item field that the Agent can currently consume as stable semantic input. Put the business object name and the facts needed for analysis in `text`. `title` supplies the short list/chip label, `description` is list copy, and `data` remains rich-text Mention metadata for rendering and restoration. These fields do not enter `extra.super_agent.mentions` and do not become Agent-readable structured context.

```js
// Recommended: the Agent can answer a follow-up such as "Analyze it" from this text.
text: 'Business chart "Chart A"; period: sample quarter; metric: mock revenue; trend: up 12% quarter over quarter. Analyze the main changes.'

// Avoid: the Agent receives only this ambiguous label and cannot infer the chart data.
text: "Chart A"
```

```js
window.MagicWidget.mount({
	page: { type: "crew", crewId: "crew-demo" },
	target: document.querySelector("#agent-slot"),
	config: {
		layout: "desktop",
		panel: {
			customGroups: [
				{
					id: "business-charts",
					label: "Business charts",
					items: [
						{
							id: "fixture-chart-a",
							type: "chart",
							text: 'Business chart "Chart A"; period: sample quarter; metric: mock revenue; trend: up 12% quarter over quarter. Analyze the main changes.',
							title: "Chart A",
							data: { source: "fixture" },
						},
					],
				},
			],
		},
	},
})

await window.MagicWidget.updateConfig({
	panel: {
		customGroups: [
			{
				id: "business-charts",
				label: "Business charts",
				items: [
					{
						id: "fixture-chart-b",
						type: "chart",
						text: 'Business chart "Chart B"; period: sample month; metric: mock active users; trend: down 8%. Analyze likely causes.',
						title: "Chart B",
					},
				],
			},
		],
	},
})
```

#### Information carried when sending

After the user clicks an item, the editor immediately inserts a `text` Mention. For this configuration:

```js
{
	id: "chart-a",
	type: "chart",
	text: 'Business chart "Chart A"; period: sample quarter; metric: mock revenue; trend: up 12% quarter over quarter. Analyze the main changes.',
	title: "Chart A",
	data: { source: "host", metric: "revenue" },
}
```

the rich-text message sent by Magic Web contains a Mention node equivalent to:

```js
{
	type: "mention",
	attrs: {
		type: "text",
		label: 'Business chart "Chart A"; period: sample quarter; metric: mock revenue; trend: up 12% quarter over quarter. Analyze the main changes.',
		data: {
			source: "host",
			metric: "revenue",
			groupId: "business-charts",
			id: "chart-a",
			label: "Chart A",
			text: 'Business chart "Chart A"; period: sample quarter; metric: mock revenue; trend: up 12% quarter over quarter. Analyze the main changes.',
			type: "chart",
		},
	},
}
```

`groupId`, `id`, `label`, `text`, and the original item `type` are reserved fields generated by the Widget and override same-named fields from the item's `data`. `label` is derived from the trimmed `title`, or from `text` when `title` is absent or blank. Other JSON-safe `data` fields stay in the rich-text payload so the editor can render and restore the Mention. `title`, `description`, and `icon` are not copied under their original keys unless the host also puts them in `data`.

The Mention is deliberately excluded from `extra.super_agent.mentions`. It does not become a new backend structured-Mention type such as `chart`; the backend renders it into the Agent prompt as plain text in the form `@<item.text>`. The additional JSON remains rich-text metadata and must not be relied on as Agent-readable structured context until the backend protocol explicitly supports it.

`icon` is treated as a local safe token; the Widget never loads arbitrary URLs from an item. HTML and script-looking strings in `text`, descriptions, or `data` are rendered as text. Count and byte overflow uses the filtered complete snapshot; a structurally rejected update does not partially replace the previous list or reload the iframe.

Use `headerActions` to observe inline header actions after their built-in behavior completes. A callback cannot cancel that behavior. `newTopic` is reported after the topic is created, and `share`, `history`, and `more` are reported after their UI is triggered. `fullscreen` and `pin` have no in-widget behavior, so their callbacks run directly. `headerActionHandled: false` is only an ownership ack; the iframe does not fall back. Hide any host-owned action that has no handler. This example implements `pin` and `close`, so it hides `fullscreen`. `close` dismisses the Widget first and then runs `headerActions.close`; a rejection does not reopen it:

```js
window.MagicWidget.mount({
	page: { type: "crew", crewId: "crew-demo" },
	target: document.querySelector("#agent-slot"),
	config: {
		header: {
			actions: {
				fullscreen: false,
			},
		},
	},
	headerActions: {
		pin: async ({ topicId }) => {
			await hostWindowApi.pinAgent({ topicId })
		},
		close: async ({ topicId }) => {
			await hostWindowApi.afterCloseAgent({ topicId })
		},
	},
})
```

`layout` controls which Crew presentation is rendered, while `responsive.mobileDetection` controls device-sensitive interactions used by existing Magic Web components. SDK embeds default to `layout: "mobile"` and `mobileDetection: "viewport"` to preserve existing mobile host behavior. Hosts that need desktop presentation or desktop interactions inside a narrow PC iframe should explicitly set `layout: "desktop"` or `mobileDetection: "device-and-viewport"`. Device detection directly reuses Magic Web's existing `utils/devices.ts` `isMobile` result.

Initial configuration is encoded in an SDK-owned protected query parameter so the first frame can render the selected layout without a flash. This configuration only becomes active inside a real SDK iframe with matching protected embed metadata.

### `page`

Required. Selects the Magic Web page that the SDK may open. Free-form URLs and free-form routes are not accepted.

```ts
namespace MagicWidget {
	type PageOptions = CrewPageOptions

	interface CrewPageOptions {
		type: "crew"
		crewId: string
	}
}
```

| Page type | Required fields | Result                                               |
| --------- | --------------- | ---------------------------------------------------- |
| `crew`    | `crewId`        | Opens the crew conversation page for the given crew. |

Boundaries:

| Value                                  | Supported | Result                                                           |
| -------------------------------------- | --------- | ---------------------------------------------------------------- |
| `{ type: "crew", crewId: "crew-001" }` | Yes       | Opens the crew page on the script origin.                        |
| `{ type: "crew", crewId: "" }`         | No        | Empty crew IDs are rejected.                                     |
| `{ type: "freeform", ... }`            | No        | Unsupported page types are rejected by the public type contract. |
| `route` / `url`                        | No        | Free-form navigation is not part of the public API.              |

Currently, `page.type = "crew"` resolves to `/{clusterCode}/super/crew/{crewId}`. Without a deployment code it uses the SaaS route `/global/super/crew/{crewId}`; with `auth.deploymentCode` it uses the corresponding private deployment route.

### `auth`

```ts
namespace MagicWidget {
	interface AuthOptions {
		loginStrategy?: LoginStrategy
		deploymentCode?: string
		organizationCode?: string
	}
}
```

`loginStrategy` is forwarded to the iframe URL as the `login-strategy` query parameter. Magic Web can use this value on `/login` to select the corresponding login form.

`deploymentCode` selects the login environment before the Crew page is entered. Omitting it or passing an empty string uses SaaS; a non-empty value selects the corresponding private deployment. If that environment is not logged in, Magic Web reuses the existing login entry with the deployment code filled in. If an account for that environment already exists, the existing account-switch flow is reused.

Use `loginStrategy: "private_deployment"` with `deploymentCode` when the private-deployment code form must be shown. The target page still uses `/{deploymentCode}/...`, so an existing private-deployment session is never checked against SaaS permissions; if login is required, the same code is forwarded to prefill the form. `privateDeploymentCode` is not supported.

`organizationCode` is forwarded to the iframe URL as the `organizationCode` query parameter. After the user is authenticated, Magic Web can use this value to switch into the requested Magic organization before rendering the target page. Empty strings are ignored.

Environment selection happens before login and Crew rendering, while organization switching happens after the target environment is authenticated. Organization lookup is limited to accounts from that deployment and never crosses environments for a matching code. This version does not expose additional authentication-state events.

Built-in strategy values:

```ts
namespace MagicWidget {
	type LoginStrategy =
		| "phone_captcha"
		| "email"
		| "phone_password"
		| "DingTalk"
		| "DingTalkAvoid"
		| "wecom"
		| "Lark"
		| "wechat_official_account"
		| "redirect"
		| "private_deployment"
		| "apple_login"
		| "google_login"
		| "anta_login"
		| string
}
```

If `iframe.query` also contains `login-strategy` or `organizationCode`, the corresponding `auth` option takes precedence.

### `iframe`

```ts
namespace MagicWidget {
	interface IframeOptions {
		allow?: string
		sandbox?: string
		query?: Record<string, QueryValue>
	}

	type QueryValue =
		| string
		| number
		| boolean
		| null
		| undefined
		| Array<string | number | boolean | null | undefined>
}
```

| Option    | Description                                       | Boundary                                                                                                                                       |
| --------- | ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `allow`   | Sets the iframe `allow` attribute.                | Use the standard browser permission-policy syntax, such as `"clipboard-read; clipboard-write"`.                                                |
| `sandbox` | Sets the iframe `sandbox` attribute.              | If omitted, no `sandbox` attribute is set. A strict sandbox may block Magic Web features, so only configure it when the host page requires it. |
| `query`   | Appends extra query parameters to the iframe URL. | `null` and `undefined` values are ignored. Array values append the same key multiple times.                                                    |

SDK-owned options take precedence over duplicate keys in `iframe.query`, such as `auth.organizationCode` for `organizationCode`, `auth.loginStrategy` for `login-strategy`, and the protected initial Widget configuration query.

### `modal`

```ts
namespace MagicWidget {
	interface ModalOptions {
		title?: string
		width?: number | string
		height?: number | string
		classNames?: Partial<Record<ModalSlot, string>>
		styles?: Partial<Record<ModalSlot, Record<string, string | number | null | undefined>>>
	}
}
```

| Option       | Description                                                                          | Default / Boundary                                                                                                              |
| ------------ | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| `title`      | Panel header text. The same value is used as the iframe title.                       | Defaults to `"Magic"`.                                                                                                          |
| `width`      | Desktop panel width. A number is treated as pixels; a string is used as a CSS size.  | Defaults to `min(420px, calc(100vw - 32px))`. Ignored on mobile.                                                                |
| `height`     | Desktop panel height. A number is treated as pixels; a string is used as a CSS size. | Defaults to `min(680px, calc(100vh - 32px))`. Desktop has a built-in minimum panel height of `420px`. Ignored on mobile.        |
| `classNames` | Adds class names to specific modal slots.                                            | Adds class attributes only; for deterministic visual customization, prefer `styles`.                                            |
| `styles`     | Applies inline styles to specific modal slots.                                       | Supports camelCase CSS properties, kebab-case properties, and CSS custom properties. `null` and `undefined` values are ignored. |

Available modal slots:

| Slot        | Target                        |
| ----------- | ----------------------------- |
| `root`      | Widget root container.        |
| `layer`     | Fullscreen panel layer.       |
| `mask`      | Mobile mask behind the panel. |
| `container` | Panel container.              |
| `header`    | Panel header.                 |
| `title`     | Header title text.            |
| `close`     | Close button.                 |
| `body`      | Panel body around the iframe. |
| `iframe`    | Embedded iframe element.      |

Example:

```js
window.MagicWidget.mount({
	page: {
		type: "crew",
		crewId: "crew-001",
	},
	modal: {
		title: "Support",
		classNames: {
			container: "partner-widget-panel",
			header: "partner-widget-header",
		},
		styles: {
			mask: {
				backgroundColor: "rgba(15, 23, 42, 0.42)",
			},
			container: {
				boxShadow: "0 28px 80px rgba(15, 23, 42, 0.28)",
			},
			close: {
				color: "#334155",
			},
			iframe: {
				backgroundColor: "#ffffff",
			},
		},
	},
})
```

## Interaction Behavior

| Environment        | Behavior                                                                                                                                                                                                                      |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Desktop            | Displays a circular floating message button. Clicking it hides the button and opens a panel anchored over the button area. The panel can be dragged by its header and is kept inside the viewport when the window is resized. |
| Mobile, `<= 640px` | Opens as a bottom popover with a mask. The panel width is `100%`, height is `86vh`, bottom corners are square, and desktop `modal.width` / `modal.height` are ignored. Panel dragging is disabled.                            |

The floating button and the panel are mutually exclusive: only one is visible at a time. The panel can be closed by the close button, by clicking the mobile mask, by pressing `Escape`, or by calling `window.MagicWidget.close()`.

## Unsupported Mount Options

These options are not part of the public API:

```ts
appOrigin
clusterCode
organizationCode
route
trigger
url
zIndex
```

Use the script URL to select the Magic Web origin, `page` to select the supported target page, `auth.deploymentCode` to choose SaaS or a private deployment, `auth.loginStrategy: "private_deployment"` to prefill the private login form without changing the private target route, `auth.organizationCode` for post-login organization switching, and `modal` options for panel customization.
