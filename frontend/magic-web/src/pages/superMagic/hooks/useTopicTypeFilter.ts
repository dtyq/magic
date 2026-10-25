import { useState } from "react"
import type { TopicTypeFilterValue } from "../utils/topicTypeFilter"

/** Reset synchronously on project navigation so another project's filter is never requested. */
export function useTopicTypeFilter(projectId?: string) {
	const [state, setState] = useState<{ projectId?: string; value: TopicTypeFilterValue }>({
		projectId,
		value: "all",
	})
	if (state.projectId !== projectId) setState({ projectId, value: "all" })
	const value = state.projectId === projectId ? state.value : "all"
	return [value, (next: TopicTypeFilterValue) => setState({ projectId, value: next })] as const
}
