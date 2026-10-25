export type EventCallback<T> = (data: T) => void

/**
 * 进程内基础事件发布订阅实现。
 *
 * 领域层可以通过 `EventBus<Payload>` 约束事件 payload；不传泛型时保持
 * 现有调用方的兼容性。
 */
class EventBus<T = any> {
	private eventMap = new Map<string, Set<EventCallback<T>>>()

	on(event: string, callback: EventCallback<T>): () => void {
		const callbacks = this.eventMap.get(event) ?? new Set<EventCallback<T>>()
		callbacks.add(callback)
		this.eventMap.set(event, callbacks)

		return () => this.off(event, callback)
	}

	off(event: string, callback?: EventCallback<T>): this {
		if (!callback) {
			this.eventMap.delete(event)
			return this
		}

		const callbacks = this.eventMap.get(event)
		callbacks?.delete(callback)
		if (callbacks?.size === 0) this.eventMap.delete(event)
		return this
	}

	once(event: string, callback: EventCallback<T>): () => void {
		const onceCallback: EventCallback<T> = (data) => {
			this.off(event, onceCallback)
			callback(data)
		}

		return this.on(event, onceCallback)
	}

	emit(event: string, data: T): boolean {
		const callbacks = this.eventMap.get(event)
		if (!callbacks?.size) return false

		for (const callback of [...callbacks]) {
			callback(data)
		}
		return true
	}
}

export default EventBus
