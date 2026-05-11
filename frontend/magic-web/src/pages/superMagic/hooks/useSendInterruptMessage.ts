import { useEffect } from "react"
import { useDebounceFn, useMemoizedFn } from "ahooks"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import type { Topic } from "../pages/Workspace/types"
import {
	sendSuperMagicInterruptMessage,
	SUPER_MAGIC_INTERRUPT_DEBOUNCE_MS,
} from "../services/sendSuperMagicInterruptMessage"

interface UseSendInterruptMessageProps {
	selectedTopic: Topic | null
	userInfo: { user_id: string } | null
}

/**
 * Hook for sending interrupt message
 * Subscribes to "send_interrupt_message" pubsub event
 */
export function useSendInterruptMessage({ selectedTopic, userInfo }: UseSendInterruptMessageProps) {
	const handleSendInterruptMessageCore = useMemoizedFn(async (callback?: () => void) => {
		try {
			await sendSuperMagicInterruptMessage({
				selectedTopic,
				userId: userInfo?.user_id,
			})
		} finally {
			callback?.()
		}
	})

	const { run: handleSendInterruptMessage } = useDebounceFn(handleSendInterruptMessageCore, {
		wait: SUPER_MAGIC_INTERRUPT_DEBOUNCE_MS,
		leading: true,
		trailing: false,
	})

	useEffect(() => {
		pubsub.subscribe(PubSubEvents.Send_Interrupt_Message, handleSendInterruptMessage)
		return () => {
			pubsub.unsubscribe(PubSubEvents.Send_Interrupt_Message, handleSendInterruptMessage)
		}
	}, [handleSendInterruptMessage])

	return handleSendInterruptMessage
}
