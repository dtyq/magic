import { ChatApi } from "@/apis"
import { EventType } from "@/types/chat"
import type { Topic } from "../pages/Workspace/types"

/** Debounce for interrupt taps (matches legacy pub/sub UX). */
export const SUPER_MAGIC_INTERRUPT_DEBOUNCE_MS = 3000

function generateUniqueId(): string {
	const timestamp = Date.now().toString(36)
	const randomPart = Math.random().toString(36).substring(2, 15)
	return `${timestamp}-${randomPart}`
}

export interface SendSuperMagicInterruptMessageParams {
	selectedTopic: Topic | null
	userId: string | null | undefined
}

/** Sends super_magic_instruction interrupt via chat API. */
export async function sendSuperMagicInterruptMessage(
	params: SendSuperMagicInterruptMessageParams,
): Promise<void> {
	const { selectedTopic, userId } = params
	try {
		if (!selectedTopic?.chat_conversation_id || !selectedTopic?.id || !userId) {
			console.error("缺少必要信息，无法发送终止消息")
			return
		}

		const timestamp = Date.now()
		const messageId = generateUniqueId()

		const interruptChatPayload = {
			message: {
				type: "super_magic_instruction",
				super_magic_instruction: {
					content: "终止任务",
					instructs: [{ value: "interrupt" }],
					attachments: [],
				},
				send_timestamp: timestamp,
				send_time: timestamp,
				sender_id: userId,
				app_message_id: messageId,
				message_id: messageId,
				topic_id: selectedTopic.chat_topic_id,
			},
			conversation_id: selectedTopic.chat_conversation_id,
		}
		// ChatApi typing omits super_magic_instruction message shape
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		await ChatApi.chat(EventType.Intermediate, interruptChatPayload as any)
	} catch (error) {
		console.error("发送终止消息失败:", error)
	}
}
