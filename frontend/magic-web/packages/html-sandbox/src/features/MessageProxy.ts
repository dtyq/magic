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
	private originalParentDescriptor: PropertyDescriptor | undefined
	private parentPatched = false
	private incomingHandler: ((event: MessageEvent) => void) | null = null
	private realParentWindow: Window | null = null

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

		const recordMessage = this.recordMessage.bind(this)

		try {
			// Preserve an existing sandbox bridge instead of assuming `window.parent`
			// is the browser-native descriptor. Inspector messages depend on that bridge.
			const originalParentDescriptor = Object.getOwnPropertyDescriptor(window, "parent")
			const realParent = window.parent
			this.realParentWindow = realParent
			const parentProxy = new Proxy(realParent, {
				get(target, prop) {
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
					// Native Window getters require the real Window as their receiver.
					try {
						return Reflect.get(target, prop, target)
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

			this.originalParentDescriptor = originalParentDescriptor
			this.parentPatched = true
		} catch {
			// If Proxy or defineProperty fails (very restrictive env), skip
			// outgoing interception silently.
		}
	}

	private restoreOutgoing(): void {
		if (!this.parentPatched) return

		try {
			if (this.originalParentDescriptor) {
				Object.defineProperty(window, "parent", this.originalParentDescriptor)
			} else {
				// No original own descriptor: remove the temporary override so the
				// browser-provided inherited `window.parent` property becomes visible again.
				// biome-ignore lint/performance/noDelete: need to restore native descriptor
				delete (window as { parent?: Window["parent"] }).parent
			}
		} catch {
			// If restoration fails, leave the current bridge untouched.
		} finally {
			this.originalParentDescriptor = undefined
			this.parentPatched = false
			this.realParentWindow = null
		}
	}

	// ─── Incoming (parent → iframe) ──────────────────────────────────────

	private listenIncoming(): void {
		this.incomingHandler = (event: MessageEvent) => {
			// Only record messages from parent
			if (this.realParentWindow && event.source !== this.realParentWindow) return
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
