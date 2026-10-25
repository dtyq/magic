import {
	isWidgetProtocolMessage,
	WIDGET_PROTOCOL,
	WIDGET_PROTOCOL_VERSION,
	type WidgetCommandName,
	type WidgetCommandMessage,
	type WidgetConfigMessage,
	type WidgetMentionSearchMessage,
	type WidgetResponseMessage,
} from "./protocol"
import type { MagicWidget } from "./types"

const DEFAULT_IFRAME_LOAD_TIMEOUT_MS = 10_000
const DEFAULT_COMMAND_TIMEOUT_MS = 10_000
const NEW_CONVERSATION_COMMAND_TIMEOUT_MS = 30_000

type WidgetCommandResult = WidgetResponseMessage["result"]
type WidgetRequestMessage = WidgetCommandMessage | WidgetConfigMessage

interface PendingRequest {
	resolve: (result?: WidgetCommandResult) => void
	reject: (error: Error) => void
	timer: number
}

/** Rejects malformed host results before they cross back into the iframe editor. */
function isCustomMentionSearchResult(
	value: unknown,
): value is MagicWidget.CustomMentionSearchResult[] {
	return (
		Array.isArray(value) &&
		value.every((result) => {
			if (!result || typeof result !== "object" || Array.isArray(result)) return false
			const record = result as Record<string, unknown>
			return (
				typeof record.groupId === "string" &&
				Array.isArray(record.items) &&
				(record.items as unknown[]).every((item) => {
					if (!item || typeof item !== "object" || Array.isArray(item)) return false
					const itemRecord = item as Record<string, unknown>
					return (
						typeof itemRecord.id === "string" &&
						typeof itemRecord.type === "string" &&
						typeof itemRecord.text === "string"
					)
				})
			)
		})
	)
}

/** Creates a public error with a stable machine-readable SDK code. */
export function createWidgetCommandError(
	code: MagicWidget.CommandErrorCode,
	message: string,
): MagicWidget.CommandError {
	const error = new Error(message) as MagicWidget.CommandError
	error.code = code
	return error
}

/** Preserves iframe-provided public error codes while falling back for unknown protocol values. */
function isCommandErrorCode(value: unknown): value is MagicWidget.CommandErrorCode {
	return (
		value === "NOT_MOUNTED" ||
		value === "INVALID_INPUT" ||
		value === "INVALID_CONFIG" ||
		value === "IFRAME_NOT_READY" ||
		value === "COMMAND_FAILED" ||
		value === "DESTROYED"
	)
}

/** Generates identifiers without exposing host business data in protocol metadata. */
export function createWidgetId(prefix: string): string {
	const randomValue =
		typeof crypto !== "undefined" && "randomUUID" in crypto
			? crypto.randomUUID()
			: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
	return `${prefix}-${randomValue}`
}

/** Coordinates READY handshakes, public ready events, and request/response commands. */
export class WidgetBridge {
	private ready = false
	private iframeLoaded = false
	private configReady = false
	private destroyed = false
	private loadWaiters = new Set<{
		resolve: () => void
		reject: (error: Error) => void
		timer: number
	}>()
	private pendingRequests = new Map<string, PendingRequest>()
	private agentReadyListeners = new Set<() => void>()
	private configReadyListeners = new Set<() => void>()
	private previewFullscreenListeners = new Set<(isFullscreen: boolean) => void>()
	private runtimeEventListeners = new Set<(event: MagicWidget.RuntimeEvent) => void>()

	constructor(
		private readonly iframe: HTMLIFrameElement,
		private readonly targetOrigin: string,
		private readonly instanceId: string,
		private readonly headerActions: Partial<
			Record<MagicWidget.HeaderActionName, MagicWidget.HeaderActionHandler>
		> = {},
		private readonly customMentionSearch?: MagicWidget.CustomMentionSearchHandler,
	) {
		window.addEventListener("message", this.handleMessage)
		this.iframe.addEventListener("load", this.handleIframeLoad)
	}

	private readonly mentionSearchControllers = new Map<string, AbortController>()

	/** Resolves one iframe search request through the host callback without blocking editor commands. */
	private handleMentionSearch = async (message: WidgetMentionSearchMessage): Promise<void> => {
		if (!this.customMentionSearch) {
			this.iframe.contentWindow?.postMessage(
				{
					protocol: WIDGET_PROTOCOL,
					version: WIDGET_PROTOCOL_VERSION,
					instanceId: this.instanceId,
					requestId: message.requestId,
					type: "response",
					ok: false,
					error: {
						code: "MENTION_SEARCH_UNAVAILABLE",
						message: "Custom Mention search is not configured",
					},
				},
				this.targetOrigin,
			)
			return
		}

		const controller = new AbortController()
		this.mentionSearchControllers.set(message.requestId, controller)
		try {
			const results = await this.customMentionSearch({
				query: message.query,
				scope: message.scope,
				signal: controller.signal,
			})
			if (controller.signal.aborted || this.destroyed) return
			if (!isCustomMentionSearchResult(results)) {
				throw new Error("Custom Mention search returned an invalid result")
			}
			this.iframe.contentWindow?.postMessage(
				{
					protocol: WIDGET_PROTOCOL,
					version: WIDGET_PROTOCOL_VERSION,
					instanceId: this.instanceId,
					requestId: message.requestId,
					type: "response",
					ok: true,
					result: { customMentionSearch: results },
				},
				this.targetOrigin,
			)
		} catch (error) {
			if (controller.signal.aborted || this.destroyed) return
			this.iframe.contentWindow?.postMessage(
				{
					protocol: WIDGET_PROTOCOL,
					version: WIDGET_PROTOCOL_VERSION,
					instanceId: this.instanceId,
					requestId: message.requestId,
					type: "response",
					ok: false,
					error: {
						code: "MENTION_SEARCH_FAILED",
						message:
							error instanceof Error ? error.message : "Custom Mention search failed",
					},
				},
				this.targetOrigin,
			)
		} finally {
			this.mentionSearchControllers.delete(message.requestId)
		}
	}

	/** Cancels the host callback associated with an iframe search request. */
	private cancelMentionSearch = (requestId: string): void => {
		this.mentionSearchControllers.get(requestId)?.abort()
		this.mentionSearchControllers.delete(requestId)
	}

	/** Runs a host header handler and reports whether the host owned that action. The iframe does not fall back. */
	private handleHeaderAction = async (message: {
		requestId: string
		action: MagicWidget.HeaderActionName
		context?: MagicWidget.HeaderActionContext
	}) => {
		const handler = this.headerActions[message.action]
		if (!handler) {
			this.iframe.contentWindow?.postMessage(
				{
					protocol: WIDGET_PROTOCOL,
					version: WIDGET_PROTOCOL_VERSION,
					instanceId: this.instanceId,
					requestId: message.requestId,
					type: "response",
					ok: true,
					result: { headerActionHandled: false },
				},
				this.targetOrigin,
			)
			return
		}

		try {
			await handler(message.context ?? { action: message.action })
			this.iframe.contentWindow?.postMessage(
				{
					protocol: WIDGET_PROTOCOL,
					version: WIDGET_PROTOCOL_VERSION,
					instanceId: this.instanceId,
					requestId: message.requestId,
					type: "response",
					ok: true,
					result: { headerActionHandled: true },
				},
				this.targetOrigin,
			)
		} catch (error) {
			this.iframe.contentWindow?.postMessage(
				{
					protocol: WIDGET_PROTOCOL,
					version: WIDGET_PROTOCOL_VERSION,
					instanceId: this.instanceId,
					requestId: message.requestId,
					type: "response",
					ok: false,
					error: {
						code: "HEADER_ACTION_FAILED",
						message: error instanceof Error ? error.message : "Header action failed",
					},
				},
				this.targetOrigin,
			)
		}
	}

	/** Reports whether the iframe has announced that its agent editor is ready. */
	isReady(): boolean {
		return this.ready && !this.destroyed
	}

	/** Registers one listener for the public agent_ready lifecycle event. */
	onAgentReady(listener: () => void): () => void {
		this.agentReadyListeners.add(listener)
		return () => this.agentReadyListeners.delete(listener)
	}

	/** Registers a listener used by the controller after the iframe configuration channel is ready. */
	onConfigReady(listener: () => void): () => void {
		this.configReadyListeners.add(listener)
		return () => this.configReadyListeners.delete(listener)
	}

	/** Registers an internal listener for validated preview fullscreen state snapshots. */
	onPreviewFullscreenChange(listener: (isFullscreen: boolean) => void): () => void {
		this.previewFullscreenListeners.add(listener)
		return () => this.previewFullscreenListeners.delete(listener)
	}

	/** Registers an internal listener for validated runtime result events. */
	onRuntimeEvent(listener: (event: MagicWidget.RuntimeEvent) => void): () => void {
		this.runtimeEventListeners.add(listener)
		return () => this.runtimeEventListeners.delete(listener)
	}

	/** Reports whether the current iframe document can receive protocol requests. */
	isIframeLoaded(): boolean {
		return this.iframeLoaded && !this.destroyed
	}

	/** Marks a reloaded iframe as unavailable until it announces READY again. */
	reset(): void {
		this.resetTransport()
	}

	/** Records agent readiness and optionally emits the public lifecycle event. */
	private markReady(notifyListeners: boolean): void {
		this.ready = true
		if (!notifyListeners) return
		this.agentReadyListeners.forEach((listener) => {
			try {
				listener()
			} catch (error) {
				console.error("Magic widget agent_ready listener failed", error)
			}
		})
	}

	/** Marks the iframe transport unavailable before a new document starts loading. */
	private resetTransport = (): void => {
		this.iframeLoaded = false
		this.configReady = false
		this.ready = false
	}

	/** Releases transport waiters once the iframe document can receive commands. */
	private handleIframeLoad = (): void => {
		// A new iframe document cannot still own the previous document's fullscreen preview.
		this.notifyPreviewFullscreen(false)
		this.iframeLoaded = true
		// The embedded React effect can announce config_ready before the parent observes iframe load.
		// Preserve that handshake so the later load event cannot discard a valid listener signal.
		this.ready = false
		this.loadWaiters.forEach((waiter) => {
			window.clearTimeout(waiter.timer)
			waiter.resolve()
		})
		this.loadWaiters.clear()
	}

	/** Delivers a complete fullscreen state snapshot to host layout controllers. */
	private notifyPreviewFullscreen(isFullscreen: boolean): void {
		this.previewFullscreenListeners.forEach((listener) => {
			try {
				listener(isFullscreen)
			} catch (error) {
				console.error("Magic widget preview fullscreen listener failed", error)
			}
		})
	}

	/** Delivers one validated result event without allowing a listener failure to stop peers. */
	private notifyRuntimeEvent(event: MagicWidget.RuntimeEvent): void {
		this.runtimeEventListeners.forEach((listener) => {
			try {
				listener(event)
			} catch (error) {
				console.error(`Magic widget ${event.type} listener failed`, error)
			}
		})
	}

	/** Marks the configuration listener ready and releases queued configuration updates. */
	private markConfigReady(): void {
		this.configReady = true
		this.configReadyWaiters.forEach((waiter) => {
			window.clearTimeout(waiter.timer)
			waiter.resolve()
		})
		this.configReadyWaiters.clear()
		this.configReadyListeners.forEach((listener) => {
			try {
				listener()
			} catch (error) {
				console.error("Magic widget config-ready listener failed", error)
			}
		})
	}

	private configReadyWaiters = new Set<{
		resolve: () => void
		reject: (error: Error) => void
		timer: number
	}>()

	/** Waits until Magic Web has installed the validated configuration message listener. */
	private waitUntilConfigReady(): Promise<void> {
		if (this.destroyed) {
			return Promise.reject(
				createWidgetCommandError("DESTROYED", "Magic widget was destroyed"),
			)
		}
		if (this.configReady) return Promise.resolve()

		return new Promise((resolve, reject) => {
			const waiter = { resolve, reject, timer: 0 }
			waiter.timer = window.setTimeout(() => {
				this.configReadyWaiters.delete(waiter)
				reject(
					createWidgetCommandError(
						"IFRAME_NOT_READY",
						"Magic widget configuration channel did not become ready",
					),
				)
			}, DEFAULT_IFRAME_LOAD_TIMEOUT_MS)
			this.configReadyWaiters.add(waiter)
		})
	}

	/** Waits only for iframe transport readiness, keeping agent_ready informational. */
	private waitUntilIframeLoaded(): Promise<void> {
		if (this.destroyed) {
			return Promise.reject(
				createWidgetCommandError("DESTROYED", "Magic widget was destroyed"),
			)
		}
		if (this.iframeLoaded) return Promise.resolve()

		return new Promise((resolve, reject) => {
			const waiter = { resolve, reject, timer: 0 }
			waiter.timer = window.setTimeout(() => {
				this.loadWaiters.delete(waiter)
				reject(
					createWidgetCommandError(
						"IFRAME_NOT_READY",
						"Magic widget iframe did not finish loading",
					),
				)
			}, DEFAULT_IFRAME_LOAD_TIMEOUT_MS)
			this.loadWaiters.add(waiter)
		})
	}

	/** Sends one correlated protocol request after the iframe transport becomes available. */
	private async sendRequest(
		createMessage: (requestId: string) => WidgetRequestMessage,
		timeoutMs: number,
	): Promise<WidgetCommandResult> {
		await this.waitUntilIframeLoaded()
		if (!this.iframe.contentWindow) {
			throw createWidgetCommandError("IFRAME_NOT_READY", "Magic widget iframe is unavailable")
		}

		const requestId = createWidgetId("request")
		const message = createMessage(requestId)

		return new Promise((resolve, reject) => {
			const timer = window.setTimeout(() => {
				this.pendingRequests.delete(requestId)
				reject(createWidgetCommandError("COMMAND_FAILED", "Magic widget command timed out"))
			}, timeoutMs)
			this.pendingRequests.set(requestId, { resolve, reject, timer })
			this.iframe.contentWindow?.postMessage(message, this.targetOrigin)
		})
	}

	/** Sends a validated command and resolves only after the iframe acknowledges it. */
	async send(
		command: WidgetCommandName,
		payload?: WidgetCommandMessage["payload"],
	): Promise<WidgetCommandResult> {
		const timeoutMs =
			command === "newConversation"
				? NEW_CONVERSATION_COMMAND_TIMEOUT_MS
				: DEFAULT_COMMAND_TIMEOUT_MS
		return this.sendRequest(
			(requestId) => ({
				protocol: WIDGET_PROTOCOL,
				version: WIDGET_PROTOCOL_VERSION,
				instanceId: this.instanceId,
				requestId,
				type: "command",
				command,
				...(payload ? { payload } : {}),
			}),
			timeoutMs,
		)
	}

	/** Sends a complete configuration snapshot and returns any provider-side filtering diagnostic. */
	async sendConfig(
		config: MagicWidget.WidgetConfig,
	): Promise<MagicWidget.ConfigWarning | undefined> {
		await this.waitUntilConfigReady()
		const result = await this.sendRequest(
			(requestId) => ({
				protocol: WIDGET_PROTOCOL,
				version: WIDGET_PROTOCOL_VERSION,
				instanceId: this.instanceId,
				requestId,
				type: "config",
				config,
			}),
			DEFAULT_COMMAND_TIMEOUT_MS,
		)
		return result?.configWarning
	}

	/** Accepts messages only from the bound iframe, origin, protocol, and instance. */
	private handleMessage = (event: MessageEvent): void => {
		if (
			this.destroyed ||
			event.origin !== this.targetOrigin ||
			event.source !== this.iframe.contentWindow ||
			!isWidgetProtocolMessage(event.data) ||
			event.data.instanceId !== this.instanceId
		) {
			return
		}
		if (event.data.type === "header_action") {
			void this.handleHeaderAction(event.data)
			return
		}
		if (event.data.type === "mention_search") {
			void this.handleMentionSearch(event.data)
			return
		}
		if (event.data.type === "mention_search_cancel") {
			this.cancelMentionSearch(event.data.requestId)
			return
		}

		if (event.data.type === "ready") {
			this.markReady(true)
			return
		}
		if (event.data.type === "config_ready") {
			this.markConfigReady()
			return
		}
		if (event.data.type === "ui_state") {
			if (
				event.data.state &&
				typeof event.data.state === "object" &&
				typeof event.data.state.previewFullscreen === "boolean"
			) {
				this.notifyPreviewFullscreen(event.data.state.previewFullscreen)
			}
			return
		}
		if (event.data.type === "event") {
			this.notifyRuntimeEvent(event.data.event)
			return
		}

		if (event.data.type !== "response") return
		const pending = this.pendingRequests.get(event.data.requestId)
		if (!pending) return
		if (event.data.ok) {
			window.clearTimeout(pending.timer)
			this.pendingRequests.delete(event.data.requestId)
			pending.resolve(event.data.result)
			return
		}

		window.clearTimeout(pending.timer)
		this.pendingRequests.delete(event.data.requestId)
		pending.reject(
			createWidgetCommandError(
				isCommandErrorCode(event.data.error?.code)
					? event.data.error.code
					: "COMMAND_FAILED",
				event.data.error?.message ?? "Magic widget command failed",
			),
		)
	}

	/** Removes listeners and rejects all work owned by this instance. */
	destroy(): void {
		if (this.destroyed) return
		this.destroyed = true
		window.removeEventListener("message", this.handleMessage)
		this.iframe.removeEventListener("load", this.handleIframeLoad)
		const error = createWidgetCommandError("DESTROYED", "Magic widget was destroyed")
		this.loadWaiters.forEach((waiter) => {
			window.clearTimeout(waiter.timer)
			waiter.reject(error)
		})
		this.loadWaiters.clear()
		this.configReadyWaiters.forEach((waiter) => {
			window.clearTimeout(waiter.timer)
			waiter.reject(createWidgetCommandError("DESTROYED", "Magic widget was destroyed"))
		})
		this.configReadyWaiters.clear()
		this.pendingRequests.forEach((pending) => {
			window.clearTimeout(pending.timer)
			pending.reject(error)
		})
		this.pendingRequests.clear()
		this.agentReadyListeners.clear()
		this.configReadyListeners.clear()
		this.previewFullscreenListeners.clear()
		this.runtimeEventListeners.clear()
		this.mentionSearchControllers.forEach((controller) => controller.abort())
		this.mentionSearchControllers.clear()
	}
}
