import type { Topic } from "@/pages/superMagic/pages/Workspace/types"

export function sortTopicsWithPinnedFirst(topics: Topic[]) {
	return [...topics].sort((topicA, topicB) => {
		if (Boolean(topicA.is_pinned) !== Boolean(topicB.is_pinned)) {
			return topicA.is_pinned ? -1 : 1
		}

		const sortValueA = topicA.is_pinned
			? topicA.pinned_at || topicA.updated_at
			: topicA.updated_at
		const sortValueB = topicB.is_pinned
			? topicB.pinned_at || topicB.updated_at
			: topicB.updated_at

		return new Date(sortValueB || 0).getTime() - new Date(sortValueA || 0).getTime()
	})
}
