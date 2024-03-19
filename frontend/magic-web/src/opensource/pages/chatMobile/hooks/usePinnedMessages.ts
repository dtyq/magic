import { useRef } from "react"
import { useBoolean } from "ahooks"

interface UsePinnedMessagesReturn {
	showPinnedMessages: boolean
	toggleShowPinnedMessages: () => void
	pinnedMessageListRef: React.RefObject<HTMLDivElement>
	pinnedMessageListHeight: number
}

function usePinnedMessages(pinnedMessageListLength: number): UsePinnedMessagesReturn {
	const [showPinnedMessages, { toggle: toggleShowPinnedMessages }] = useBoolean(true)
	const pinnedMessageListRef = useRef<HTMLDivElement>(null)
	const pinnedMessageListHeight = pinnedMessageListLength * 60

	return {
		showPinnedMessages,
		toggleShowPinnedMessages,
		pinnedMessageListRef,
		pinnedMessageListHeight,
	}
}

export default usePinnedMessages
