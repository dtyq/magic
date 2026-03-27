import { useMemo } from "react"
import type { MessageListContextState } from "@/pages/superMagic/components/MessageList/context"
import type { Topic } from "@/pages/superMagic/pages/Workspace/types"

interface UseClawPlaygroundMessageListContextValueParams {
	setSelectedTopic: (topic: Topic) => void
}

/** Shared MessageListProvider value for Claw playground (desktop + mobile). */
export function useClawPlaygroundMessageListContextValue(
	params: UseClawPlaygroundMessageListContextValueParams,
): MessageListContextState {
	const { setSelectedTopic } = params
	return useMemo(
		() => ({
			allowRevoke: false,
			allowUserMessageCopy: true,
			allowScheduleTaskCreate: false,
			allowMessageTooltip: true,
			allowConversationCopy: false,
			allowCreateNewTopic: false,
			onTopicSwitch: setSelectedTopic,
		}),
		[setSelectedTopic],
	)
}
