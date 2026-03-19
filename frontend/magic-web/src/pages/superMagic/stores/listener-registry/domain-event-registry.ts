export interface DomainEventPayloadBase {
	type: string
}

export interface RegisterDomainEventListenerParams<TEvent extends DomainEventPayloadBase> {
	callback: (payload: TEvent) => void
	matcher?: (payload: TEvent) => boolean
}

interface DomainEventListener<TEvent extends DomainEventPayloadBase> {
	callback: (payload: TEvent) => void
	matcher?: (payload: TEvent) => boolean
}

interface DomainEventRegistry<TEvent extends DomainEventPayloadBase> {
	register: (params: RegisterDomainEventListenerParams<TEvent>) => () => void
	emit: (payload: TEvent) => void
}

export function createDomainEventRegistry<
	TEvent extends DomainEventPayloadBase,
>(): DomainEventRegistry<TEvent> {
	const listeners = new Set<DomainEventListener<TEvent>>()

	function register({ callback, matcher }: RegisterDomainEventListenerParams<TEvent>) {
		const listener = {
			callback,
			matcher,
		}

		listeners.add(listener)

		return () => {
			listeners.delete(listener)
		}
	}

	function emit(payload: TEvent) {
		if (!listeners.size) return

		listeners.forEach((listener) => {
			try {
				if (listener.matcher && !listener.matcher(payload)) return
				listener.callback(payload)
			} catch (error) {
				console.error("Error in domain event listener", error)
			}
		})
	}

	return {
		register,
		emit,
	}
}
