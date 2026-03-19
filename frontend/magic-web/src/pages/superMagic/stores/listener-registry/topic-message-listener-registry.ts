export interface TopicMessageListenerPayload<TMessage, TMessageNode = unknown> {
	topicId: string
	message: TMessage
	messageNode: TMessageNode
	stage: "arrived"
}

export interface RegisterTopicMessageListenerParams<TMessage, TMessageNode = unknown> {
	topicId: string
	callback: (payload: TopicMessageListenerPayload<TMessage, TMessageNode>) => void
	matcher?: (payload: TopicMessageListenerPayload<TMessage, TMessageNode>) => boolean
}

interface TopicMessageListener<TMessage, TMessageNode = unknown> {
	callback: (payload: TopicMessageListenerPayload<TMessage, TMessageNode>) => void
	matcher?: (payload: TopicMessageListenerPayload<TMessage, TMessageNode>) => boolean
}

interface TopicMessageListenerRegistry<TMessage, TMessageNode = unknown> {
	register: (params: RegisterTopicMessageListenerParams<TMessage, TMessageNode>) => () => void
	emit: (payload: TopicMessageListenerPayload<TMessage, TMessageNode>) => void
	clearTopic: (topicId: string) => void
	listenerCount: (topicId: string) => number
}

export function createTopicMessageListenerRegistry<
	TMessage,
	TMessageNode = unknown,
>(): TopicMessageListenerRegistry<TMessage, TMessageNode> {
	const listeners = new Map<string, Set<TopicMessageListener<TMessage, TMessageNode>>>()

	function deleteListener(
		topicId: string,
		listener: TopicMessageListener<TMessage, TMessageNode>,
	) {
		const topicListeners = listeners.get(topicId)
		if (!topicListeners) return

		topicListeners.delete(listener)
		if (topicListeners.size === 0) {
			listeners.delete(topicId)
		}
	}

	function register({
		topicId,
		callback,
		matcher,
	}: RegisterTopicMessageListenerParams<TMessage, TMessageNode>) {
		if (!listeners.has(topicId)) {
			listeners.set(topicId, new Set())
		}

		const listener = {
			callback,
			matcher,
		}

		listeners.get(topicId)?.add(listener)

		return () => {
			deleteListener(topicId, listener)
		}
	}

	function emit(payload: TopicMessageListenerPayload<TMessage, TMessageNode>) {
		const topicListeners = listeners.get(payload.topicId)

		if (!topicListeners?.size) return

		topicListeners.forEach((listener) => {
			try {
				if (listener.matcher && !listener.matcher(payload)) return
				listener.callback(payload)
			} catch (error) {
				console.error("Error in topic message listener", error)
			}
		})
	}

	function clearTopic(topicId: string) {
		listeners.delete(topicId)
	}

	function listenerCount(topicId: string) {
		return listeners.get(topicId)?.size || 0
	}

	return {
		register,
		emit,
		clearTopic,
		listenerCount,
	}
}
