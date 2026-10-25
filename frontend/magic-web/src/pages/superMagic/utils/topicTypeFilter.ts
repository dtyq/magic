/** "all" represents the union of both visible topic categories. */
export type TopicTypeFilterValue = "all" | "topic" | "scheduled_task"

export function toggleTopicType(
	value: TopicTypeFilterValue,
	option: TopicTypeFilterValue,
): TopicTypeFilterValue {
	if (option === "all" || value === option) return "all"
	return value === "all" ? (option === "topic" ? "scheduled_task" : "topic") : "all"
}
