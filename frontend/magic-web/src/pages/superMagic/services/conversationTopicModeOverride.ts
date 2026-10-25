/**
 * Registers a surface-owned outbound topic mode for transports whose send
 * acknowledgement contains IDs only. ClawPlayground uses this because its
 * editor intentionally exposes Default mode while outbound messages are MagiClaw.
 */
const topicModeOverrides = new Map<string, { mode: string; registrations: number }>()

export function registerConversationTopicModeOverride(topicId: string, mode: string) {
	if (!topicId) return () => undefined

	const current = topicModeOverrides.get(topicId)
	topicModeOverrides.set(topicId, {
		mode,
		registrations: current?.mode === mode ? current.registrations + 1 : 1,
	})
	return () => {
		const registered = topicModeOverrides.get(topicId)
		if (!registered || registered.mode !== mode) return
		if (registered.registrations > 1) {
			topicModeOverrides.set(topicId, {
				...registered,
				registrations: registered.registrations - 1,
			})
			return
		}
		topicModeOverrides.delete(topicId)
	}
}

export function getConversationTopicModeOverride(topicId?: string | null): string | undefined {
	if (!topicId) return undefined
	return topicModeOverrides.get(topicId)?.mode
}

/** Allows isolated tests to start with a fresh override map. */
export function resetConversationTopicModeOverridesForTests() {
	topicModeOverrides.clear()
}
