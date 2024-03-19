import { useEffect } from "react"
import { useMemoizedFn } from "ahooks"
import { ChatApi } from "@/opensource/apis"
import { EventType } from "@/opensource/types/chat"
import pubsub from "@/opensource/utils/pubsub"
import type { Topic } from "../pages/Workspace/types"

/**
 * Generate a unique ID using timestamp and random number
 */
function generateUniqueId(): string {
	const timestamp = Date.now().toString(36)
	const randomPart = Math.random().toString(36).substring(2, 15)
	return `${timestamp}-${randomPart}`
}

interface UseSendInterruptMessageProps {
	selectedTopic: Topic | null
	userInfo: { user_id: string } | null
}

/**
 * Hook for sending interrupt message
 * Subscribes to "send_interrupt_message" pubsub event
 */
export function useSendInterruptMessage({ selectedTopic, userInfo }: UseSendInterruptMessageProps) {
	const handleSendInterruptMessage = useMemoizedFn(async (callback?: () => void) => {
		try {
			if (!selectedTopic?.chat_conversation_id || !selectedTopic?.id || !userInfo?.user_id) {
				console.error("缺少必要信息，无法发送终止消息")
				return
			}

			const timestamp = Date.now()
			const messageId = generateUniqueId()

			await ChatApi.chat(EventType.Intermediate, {
				message: {
					type: "super_magic_instruction" as any,
					super_magic_instruction: {
						content: "终止任务",
						instructs: [{ value: "interrupt" }],
						attachments: [],
					},
					send_timestamp: timestamp,
					send_time: timestamp,
					sender_id: userInfo.user_id,
					app_message_id: messageId,
					message_id: messageId,
					topic_id: selectedTopic.chat_topic_id,
				} as any,
				conversation_id: selectedTopic.chat_conversation_id,
			})
		} catch (error) {
			console.error("发送终止消息失败:", error)
		} finally {
			callback?.()
		}
	})

	useEffect(() => {
		// Send interrupt message
		pubsub.subscribe("send_interrupt_message", handleSendInterruptMessage)
		return () => {
			pubsub.unsubscribe("send_interrupt_message", handleSendInterruptMessage)
		}
	}, [handleSendInterruptMessage])

	return handleSendInterruptMessage
}
