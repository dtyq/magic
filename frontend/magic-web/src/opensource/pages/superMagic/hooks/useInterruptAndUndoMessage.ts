import { useEffect, useRef } from "react"
import type { MutableRefObject } from "react"
import { useMemoizedFn } from "ahooks"
import { useTranslation } from "react-i18next"
import pubsub, { PubSubEvents } from "@/opensource/utils/pubsub"
import { SuperMagicApi } from "@/opensource/apis"
import { superMagicStore } from "@/opensource/pages/superMagic/stores"
import type { Topic } from "../pages/Workspace/types"
import { useSendInterruptMessage } from "./useSendInterruptMessage"
import magicToast from "@/opensource/components/base/MagicToaster/utils"

interface UseInterruptAndUndoMessageProps {
	selectedTopic: Topic | null
	messages: MutableRefObject<any[]> | any[]
	userInfo: { user_id: string } | null
}

/**
 * Hook for handling interrupt and undo message functionality
 * Subscribes to PubSubEvents.Interrupt_And_Undo_Message event
 */
export function useInterruptAndUndoMessage({
	selectedTopic,
	messages,
	userInfo,
}: UseInterruptAndUndoMessageProps) {
	const { t } = useTranslation("super")

	// Use useSendInterruptMessage hook internally
	useSendInterruptMessage({ selectedTopic, userInfo })

	// Convert array to ref if needed
	const messagesRef = useRef<any[]>([])
	if (Array.isArray(messages)) {
		messagesRef.current = messages
	} else {
		messagesRef.current = messages.current
	}

	const handleInterruptAndUndoMessage = useMemoizedFn(
		async (topicId: string, messageId: string) => {
			// If topic id doesn't match, skip processing
			if (selectedTopic?.id !== topicId) return

			const currentMessageList = messagesRef.current
			if (currentMessageList.length === 0) return

			try {
				const lastMessage = currentMessageList[currentMessageList.length - 1]
				const node = superMagicStore.getMessageNode(lastMessage?.app_message_id)
				if (!["suspended", "finished"].includes(node?.status)) {
					// Call through pubsub to trigger useSendInterruptMessage handler
					await new Promise<void>((resolve) => {
						pubsub.publish("send_interrupt_message", resolve)
					})
				}
				await SuperMagicApi.undoMessage({
					topic_id: topicId,
					message_id: messageId,
				})
				magicToast.success(t("warningCard.undoMessageSuccess"))
				pubsub.publish(PubSubEvents.Show_Revoked_Messages)
				pubsub.publish(PubSubEvents.Update_Attachments)
				pubsub.publish(PubSubEvents.Refresh_Topic_Messages)
			} catch (error) {
				console.error("终止并撤销消息失败:", error)
			}
		},
	)

	useEffect(() => {
		// Interrupt and undo message - send interrupt message first, then undo message
		pubsub.subscribe(PubSubEvents.Interrupt_And_Undo_Message, handleInterruptAndUndoMessage)

		return () => {
			pubsub.unsubscribe(
				PubSubEvents.Interrupt_And_Undo_Message,
				handleInterruptAndUndoMessage,
			)
		}
	}, [handleInterruptAndUndoMessage])
}
