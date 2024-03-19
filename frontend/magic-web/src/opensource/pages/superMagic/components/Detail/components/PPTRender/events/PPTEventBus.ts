type EventCallback<T = any> = (data: T) => void

/**
 * PPT Event Bus - Publish/Subscribe pattern for PPT component communication
 * Allows decoupled communication between components without prop drilling
 */
class PPTEventBus {
	private events: Map<string, Set<EventCallback>> = new Map()

	/**
	 * Subscribe to an event
	 * @param event Event name
	 * @param callback Callback function
	 * @returns Unsubscribe function
	 */
	on<T = any>(event: string, callback: EventCallback<T>): () => void {
		if (!this.events.has(event)) {
			this.events.set(event, new Set())
		}

		const callbacks = this.events.get(event)!
		callbacks.add(callback)

		// Return unsubscribe function
		return () => {
			callbacks.delete(callback)
			if (callbacks.size === 0) {
				this.events.delete(event)
			}
		}
	}

	/**
	 * Subscribe to an event (one-time only)
	 * @param event Event name
	 * @param callback Callback function
	 * @returns Unsubscribe function
	 */
	once<T = any>(event: string, callback: EventCallback<T>): () => void {
		const wrappedCallback: EventCallback<T> = (data) => {
			callback(data)
			unsubscribe()
		}
		const unsubscribe = this.on(event, wrappedCallback)
		return unsubscribe
	}

	/**
	 * Publish an event
	 * @param event Event name
	 * @param data Event data
	 */
	emit<T = any>(event: string, data?: T): void {
		const callbacks = this.events.get(event)
		if (callbacks) {
			callbacks.forEach((callback) => {
				try {
					callback(data)
				} catch (error) {
					console.error(`Error in event handler for "${event}":`, error)
				}
			})
		}
	}

	/**
	 * Unsubscribe all callbacks for an event
	 * @param event Event name
	 */
	off(event: string): void {
		this.events.delete(event)
	}

	/**
	 * Clear all event subscriptions
	 */
	clear(): void {
		this.events.clear()
	}

	/**
	 * Get number of subscribers for an event
	 * @param event Event name
	 * @returns Number of subscribers
	 */
	getSubscriberCount(event: string): number {
		return this.events.get(event)?.size || 0
	}
}

// Factory function to create new event bus instances
export function createPPTEventBus(): PPTEventBus {
	return new PPTEventBus()
}

// Export class
export { PPTEventBus }

// Event types for type safety
export const PPT_EVENTS = {
	DOWNLOAD: "ppt:download",
	FULLSCREEN_TOGGLE: "ppt:fullscreen:toggle",
	FULLSCREEN_STATE_CHANGE: "ppt:fullscreen:state:change",
} as const

export type PPTEventType = (typeof PPT_EVENTS)[keyof typeof PPT_EVENTS]

// Event payload types
export interface DownloadEventPayload {
	fileId: string
	fileVersion?: number
	type?: "file" | "pdf" | "ppt"
}

export interface FullscreenStateChangePayload {
	isFullscreen: boolean
}
