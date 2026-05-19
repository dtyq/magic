/**
 * MessageProxy
 *
 * Intercepts all postMessage traffic between iframe and parent window.
 * Records both outgoing (iframe → parent) and incoming (parent → iframe)
 * messages with their full payload for debugging in the Messages tab.
 *
 * Excludes DevTools-internal messages to avoid infinite loops.
 */

export type MessageDirection = "outgoing" | "incoming"

export interface MessageEntry {
	id: string
	direction: MessageDirection
	/** The message type (event.data.type) if available */
	type: string
	/** The full message payload */
	payload: unknown
	timestamp: number
	/** Origin of the message for incoming */
	origin?: string
}

type MessageEntryListener = (entry: MessageEntry) => void

const MAX_ENTRIES = 500

/** DevTools message type prefix — excluded to avoid feedback loops */
const DEVTOOLS_PREFIX = "MAGIC_DEVTOOLS_"

export class MessageProxy {
	private enabled = false
	private entries: MessageEntry[] = []
	private listener: MessageEntryListener | null = null
	private originalPostMessage: typeof window.parent.postMessage | null = null
	private incomingHandler: ((event: MessageEvent) => void) | null = null

	enable(): void {
		if (this.enabled) return
		this.enabled = true
		this.patchOutgoing()
		this.listenIncoming()
	}

	disable(): void {
		if (!this.enabled) return
		this.enabled = false
		this.restoreOutgoing()
		this.removeIncomingListener()
	}

	destroy(): void {
		this.disable()
		this.entries = []
	}

	onEntry(listener: MessageEntryListener): void {
		this.listener = listener
	}

	getEntries(): MessageEntry[] {
		return [...this.entries]
	}

	clear(): void {
		this.entries = []
	}

	// ─── Outgoing (iframe → parent) ──────────────────────────────────────

	private patchOutgoing(): void {
		// Only patch if we're in an iframe
		if (window === window.parent) return

		// In cross-origin iframes we cannot access window.parent.postMessage
		// directly. Instead, wrap the *iframe's own* postMessage so that any
		// call from user code to `window.parent.postMessage(...)` still goes
		// through the real API, but we intercept calls that the iframe itself
		// makes (which is the pattern used by iframe code:
		// `window.parent.postMessage(msg, "*")`).
		//
		// Strategy: patch `window.postMessage` on the *current* window (the
		// iframe) to detect when the iframe calls `postMessage` targeting
		// its parent by wrapping the native method. We ALSO install a thin
		// proxy-based wrapper around `window.parent` so that property access
		// to `window.parent.postMessage(...)` can be intercepted safely.

		const nativePostMessage = window.postMessage.bind(window)
		const recordMessage = this.recordMessage.bind(this)

		// 1. Wrap window.postMessage — user code that calls
		//    `window.parent.postMessage(msg, origin)` from inside the same
		//    origin will actually resolve `window.parent` first, which in a
		//    cross-origin scenario throws. Most generated iframe code uses
		//    `parent.postMessage(...)` or `window.parent.postMessage(...)`.
		//    We therefore create a Proxy for `window.parent` that intercepts
		//    the `postMessage` property.

		try {
			const realParent = window.parent
			const parentProxy = new Proxy(realParent, {
				get(target, prop, receiver) {
					if (prop === "postMessage") {
						return function (
							message: unknown,
							targetOriginOrOptions?: string | WindowPostMessageOptions,
							transfer?: Transferable[],
						) {
							recordMessage("outgoing", message)
							// Use the original native postMessage via the real parent
							if (typeof targetOriginOrOptions === "string") {
								target.postMessage(message, targetOriginOrOptions, transfer)
							} else {
								target.postMessage(
									message,
									targetOriginOrOptions as WindowPostMessageOptions,
								)
							}
						}
					}
					// For all other properties, return the real value.
					// We use Reflect.get so that getters on Window still work.
					try {
						return Reflect.get(target, prop, receiver)
					} catch {
						// Cross-origin access to other properties may throw; that's fine.
						return undefined
					}
				},
			})

			Object.defineProperty(window, "parent", {
				get: () => parentProxy,
				configurable: true,
			})

			// Store restore info
			this.originalPostMessage =
				nativePostMessage as unknown as typeof window.parent.postMessage
		} catch {
			// If Proxy or defineProperty fails (very restrictive env), skip
			// outgoing interception silently.
		}
	}

	private restoreOutgoing(): void {
		if (this.originalPostMessage) {
			// Remove our proxy by deleting the overridden getter, which
			// restores the native `window.parent` property.
			try {
				// biome-ignore lint/performance/noDelete: need to restore native descriptor
				delete (window as { parent?: Window["parent"] }).parent
			} catch {
				// If we can't delete, the environment is restrictive; leave as-is.
			}
			this.originalPostMessage = null
		}
	}

	// ─── Incoming (parent → iframe) ──────────────────────────────────────

	private listenIncoming(): void {
		this.incomingHandler = (event: MessageEvent) => {
			// Only record messages from parent
			if (event.source !== window.parent) return
			this.recordMessage("incoming", event.data, event.origin)
		}
		window.addEventListener("message", this.incomingHandler)
	}

	private removeIncomingListener(): void {
		if (this.incomingHandler) {
			window.removeEventListener("message", this.incomingHandler)
			this.incomingHandler = null
		}
	}

	// ─── Recording ───────────────────────────────────────────────────────

	private recordMessage(direction: MessageDirection, data: unknown, origin?: string): void {
		// Skip DevTools internal messages to avoid feedback loops
		const msgType = this.extractType(data)
		if (msgType.startsWith(DEVTOOLS_PREFIX)) return

		const entry: MessageEntry = {
			id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
			direction,
			type: msgType,
			payload: this.safeClone(data),
			timestamp: Date.now(),
			origin,
		}

		this.pushEntry(entry)
	}

	private extractType(data: unknown): string {
		if (data && typeof data === "object" && "type" in data) {
			return String((data as Record<string, unknown>).type)
		}
		return "(untyped)"
	}

	private safeClone(data: unknown): unknown {
		try {
			return JSON.parse(JSON.stringify(data))
		} catch {
			return String(data)
		}
	}

	private pushEntry(entry: MessageEntry): void {
		this.entries.push(entry)
		if (this.entries.length > MAX_ENTRIES) {
			this.entries = this.entries.slice(-MAX_ENTRIES)
		}
		this.listener?.(entry)
	}
}
