type ChatConversationListListener = () => void

const listeners = new Set<ChatConversationListListener>()

/** Notify mounted conversation lists after a conversation is created outside their own controls. */
export function invalidateChatConversationList(): void {
	for (const listener of listeners) listener()
}

/** Subscribe to conversation changes and return a cleanup function for sidebar lists. */
export function subscribeChatConversationListInvalidation(
	listener: ChatConversationListListener,
): () => void {
	listeners.add(listener)
	return () => listeners.delete(listener)
}
