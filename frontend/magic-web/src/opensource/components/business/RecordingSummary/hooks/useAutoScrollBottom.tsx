import { useMemoizedFn, useUpdateEffect } from "ahooks"
import { last } from "lodash-es"
import { useEffect, useMemo, useState } from "react"
import { VoiceResultUtterance } from "@/opensource/components/business/VoiceInput/services/VoiceClient/types"

function useAutoScrollBottom({
	message,
	enable = true,
	offset = 100,
	messagesRef,
}: {
	message: VoiceResultUtterance[]
	enable: boolean
	offset?: number
	messagesRef: React.RefObject<HTMLDivElement> | null
}) {
	const [userScrollToBottom, setUserScrollToBottom] = useState(false)

	const onScroll = useMemoizedFn((e: React.UIEvent<HTMLDivElement>) => {
		setUserScrollToBottom(
			e.currentTarget.scrollTop <
				e.currentTarget.scrollHeight - e.currentTarget.clientHeight - offset,
		)
	})

	const scrollToBottom = useMemoizedFn((force = false) => {
		if (!enable) return
		if (messagesRef?.current && (!userScrollToBottom || force)) {
			messagesRef.current.scrollTo({
				top: messagesRef.current.scrollHeight,
				behavior: "smooth",
			})
		}
	})

	const lastMessage = last(message)?.text ?? ""
	const lastMessageLine = useMemo(() => {
		const textCount = window.innerWidth / 14
		return lastMessage.length % textCount
	}, [lastMessage])

	useUpdateEffect(() => {
		if (enable) {
			scrollToBottom()
		}
	}, [message.length, lastMessageLine])

	useEffect(() => {
		if (enable) {
			scrollToBottom()
		}
	}, [enable])

	return {
		messagesRef,
		onScroll,
		scrollToBottom,
		isAtBottom: !userScrollToBottom,
	}
}

export default useAutoScrollBottom
