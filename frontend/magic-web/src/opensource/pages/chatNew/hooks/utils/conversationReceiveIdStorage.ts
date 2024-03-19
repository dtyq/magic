const AgentIdKey = "agent_id"
const UserIdKey = "user_id"

/**
 * Persist agent/user ids from URL to sessionStorage and clean URL
 */
function recordConversationReceiveIdInSessionStorage() {
	const url = new URL(window.location.href)
	const { searchParams } = url
	const agentId = searchParams.get(AgentIdKey)
	if (agentId) {
		window.sessionStorage.setItem(AgentIdKey, agentId)
		searchParams.delete(AgentIdKey)
	}
	const userId = searchParams.get(UserIdKey)
	if (userId) {
		window.sessionStorage.setItem(UserIdKey, userId)
		searchParams.delete(UserIdKey)
	}

	if (agentId || userId) {
		window.history.replaceState({}, "", url.toString())
	}
}

export { AgentIdKey, UserIdKey, recordConversationReceiveIdInSessionStorage }
