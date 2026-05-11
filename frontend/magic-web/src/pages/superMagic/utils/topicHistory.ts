import type { Topic, TaskStatus } from "@/pages/superMagic/pages/Workspace/types"

export const TOPIC_HISTORY_PAGE_SIZE = 999

export function resolveTopicTaskStatus(topic: Topic): TaskStatus {
	return (topic.task_status || topic.status || "waiting") as TaskStatus
}

export function normalizeTopicHistoryItem(topic: Topic): Topic {
	return {
		...topic,
		task_status: resolveTopicTaskStatus(topic),
		status: resolveTopicTaskStatus(topic),
		is_pinned: Boolean(topic.is_pinned),
		is_archived: Boolean(topic.is_archived),
		has_unread: Boolean(topic.has_unread),
		pinned_at: topic.pinned_at ?? null,
		last_read_at: topic.last_read_at ?? null,
		last_read_message_id: topic.last_read_message_id ?? null,
	}
}
