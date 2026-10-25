import type {
	ErrorRecoveryAction,
	ModelError,
	ModelErrorSubject,
} from "@/types/chat/conversation_message"

export interface ModelRecoveryMessage {
	messageId: string
	topicId: string
	taskId: string
	error: ModelError & { subject: ModelErrorSubject }
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value)
}

/** 历史／实时数据共用边界：未知原因可继续使用已知动作，未知动作不执行。 */
export function getModelRecoveryMessage(node: unknown): ModelRecoveryMessage | undefined {
	if (!isRecord(node) || node.role !== "assistant" || node.status !== "error") return
	const error = node.error
	if (!isRecord(error) || typeof error.code !== "string" || !error.code) return
	const subject = error.subject
	if (
		!isRecord(subject) ||
		subject.type !== "text_model" ||
		typeof subject.model_id !== "string" ||
		!subject.model_id.trim()
	)
		return
	if (!Array.isArray(error.actions)) return
	const actions: ErrorRecoveryAction[] = []
	for (const action of error.actions) {
		if (
			!isRecord(action) ||
			(action.type !== "switch_model_and_retry" && action.type !== "retry")
		)
			continue
		if (!actions.some((item) => item.type === action.type)) actions.push({ type: action.type })
	}
	if (!actions.length) return
	return {
		messageId: typeof node.super_message_id === "string" ? node.super_message_id : "",
		topicId: typeof node.topic_id === "string" ? node.topic_id : "",
		taskId: typeof node.task_id === "string" ? node.task_id : "",
		error: {
			code: error.code,
			subject: {
				type: "text_model",
				model_id: subject.model_id,
				model_name:
					typeof subject.model_name === "string" && subject.model_name.trim()
						? subject.model_name
						: undefined,
			},
			actions,
		},
	}
}
