import { useEffect } from "react"
import { useMemoizedFn } from "ahooks"
import pubsub from "@/utils/pubsub"
import type { Topic } from "../pages/Workspace/types"
import { sendSuperMagicInterruptMessage } from "../services/sendSuperMagicInterruptMessage"

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
			await sendSuperMagicInterruptMessage({
				selectedTopic,
				userId: userInfo?.user_id,
			})
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
