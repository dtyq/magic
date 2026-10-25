type EventHandler<Payload> = (payload: Payload) => void

/**
 * Minimal synchronous, in-process event bus.
 *
 * The event map is the source of truth for the one-to-one event/payload
 * relationship. Transport, persistence, replay, and business side effects
 * intentionally stay outside this primitive.
 */
export class EventBus<Events extends Record<string, unknown>> {
	/**
	 * `never` is used only at this heterogeneous storage boundary: a handler
	 * registered for one event must never be callable through another event key.
	 * The public generic methods restore the event-specific payload type.
	 */
	private listeners = new Map<keyof Events, Set<EventHandler<never>>>()

	on<K extends keyof Events>(event: K, handler: EventHandler<Events[K]>): () => void {
		const handlers = this.listeners.get(event) ?? new Set<EventHandler<never>>()
		const storedHandler = handler as EventHandler<never>
		handlers.add(storedHandler)
		this.listeners.set(event, handlers)

		return () => {
			handlers.delete(storedHandler)
			if (handlers.size === 0) this.listeners.delete(event)
		}
	}

	emit<K extends keyof Events>(event: K, payload: Events[K]): void {
		const handlers = this.listeners.get(event)
		if (!handlers) return

		for (const handler of [...handlers]) {
			handler(payload as never)
		}
	}

	once<K extends keyof Events>(event: K, handler: EventHandler<Events[K]>): () => void {
		let unsubscribe = () => {}
		const onceHandler = (payload: Events[K]) => {
			unsubscribe()
			handler(payload)
		}
		unsubscribe = this.on(event, onceHandler)
		return unsubscribe
	}
}
