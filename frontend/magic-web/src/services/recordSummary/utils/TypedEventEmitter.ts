/**
 * Type-safe event emitter with support for multiple listeners
 * 类型安全的事件发射器，支持多个监听器
 *
 * @template EventMap - Event name to callback function mapping
 */

export class TypedEventEmitter<EventMap> {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	private listeners: Map<keyof EventMap, Set<(...args: any[]) => void>> = new Map()

	/**
	 * Logger function for error reporting
	 * 用于错误报告的日志函数
	 */
	private logError(message: string, error: unknown): void {
		if (typeof console !== "undefined" && console.error) {
			console.error(message, error)
		}
	}

	/**
	 * Register an event listener
	 * 注册事件监听器
	 *
	 * @param event - Event name
	 * @param listener - Callback function
	 * @returns Unsubscribe function
	 */
	on<K extends keyof EventMap>(event: K, listener: EventMap[K]): () => void {
		if (!this.listeners.has(event)) {
			this.listeners.set(event, new Set())
		}

		const listenerSet = this.listeners.get(event)
		if (listenerSet) {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			listenerSet.add(listener as (...args: any[]) => void)
		}

		// Return unsubscribe function
		return () => {
			const currentSet = this.listeners.get(event)
			if (currentSet) {
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				currentSet.delete(listener as (...args: any[]) => void)
				if (currentSet.size === 0) {
					this.listeners.delete(event)
				}
			}
		}
	}

	/**
	 * Emit an event to all registered listeners
	 * 向所有注册的监听器发射事件
	 *
	 * Error isolation: if one listener throws, others will still execute
	 * 错误隔离：如果一个监听器抛出错误，其他监听器仍会执行
	 *
	 * @param event - Event name
	 * @param args - Arguments to pass to listeners
	 */

	emit<K extends keyof EventMap>(
		event: K,
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		...args: EventMap[K] extends (...args: any[]) => any ? Parameters<EventMap[K]> : any[]
	): void {
		const listenerSet = this.listeners.get(event)
		if (!listenerSet || listenerSet.size === 0) {
			return
		}

		// Execute all listeners with error isolation
		listenerSet.forEach((listener) => {
			try {
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				listener(...(args as any[]))
			} catch (error) {
				this.logError(`Error in event listener for "${String(event)}"`, error)
			}
		})
	}

	/**
	 * Get the number of listeners for an event
	 * 获取事件的监听器数量
	 *
	 * @param event - Event name
	 * @returns Number of listeners
	 */
	listenerCount(event: keyof EventMap): number {
		return this.listeners.get(event)?.size || 0
	}
}
