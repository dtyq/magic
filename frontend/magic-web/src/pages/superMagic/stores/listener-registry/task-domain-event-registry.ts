export type TaskCompletedStatus = "error" | "finished" | "suspended"

export interface TaskDomainEventPayload<TMessage, TMessageNode = unknown> {
	type: "task_completed"
	topicId: string
	status: TaskCompletedStatus
	message: TMessage
	messageNode: TMessageNode
}
