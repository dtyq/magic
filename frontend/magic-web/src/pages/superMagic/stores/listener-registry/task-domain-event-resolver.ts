import type { TaskCompletedStatus, TaskDomainEventPayload } from "./task-domain-event-registry"
import type { TopicMessageListenerPayload } from "./topic-message-listener-registry"

// 任务完成更适合基于明确的终态消息事件判断，而不是仅依赖 status。
// 其中 after_main_agent_run 表示主任务执行结束，agent_suspended 表示任务被中止。
const TERMINAL_TASK_EVENTS = new Set(["after_main_agent_run", "agent_suspended"])
const COMPLETED_TASK_STATUSES = new Set<TaskCompletedStatus>(["error", "finished", "suspended"])

interface TaskMessageNode {
	event?: string
	status?: string
}

export function resolveTaskDomainEvent<TMessage, TMessageNode = unknown>(
	payload: TopicMessageListenerPayload<TMessage, TMessageNode>,
): null | TaskDomainEventPayload<TMessage, TMessageNode> {
	const node = payload.messageNode as TaskMessageNode | undefined
	const event = node?.event
	const status = node?.status
	const message = payload.message as { type?: string }

	if (message.type !== "general_agent_card") return null
	if (!event || !TERMINAL_TASK_EVENTS.has(event)) return null

	// 中止场景由专门事件直接表达，优先映射为 suspended。
	if (event === "agent_suspended") {
		return {
			type: "task_completed",
			topicId: payload.topicId,
			status: "suspended",
			message: payload.message,
			messageNode: payload.messageNode,
		}
	}

	// after_main_agent_run 仍需结合 status 区分 finished / error 等终态。
	if (!status || !COMPLETED_TASK_STATUSES.has(status as TaskCompletedStatus)) return null

	return {
		type: "task_completed",
		topicId: payload.topicId,
		status: status as TaskCompletedStatus,
		message: payload.message,
		messageNode: payload.messageNode,
	}
}
