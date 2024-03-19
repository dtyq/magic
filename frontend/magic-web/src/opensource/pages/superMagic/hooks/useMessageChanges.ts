import { useEffect, useMemo, useRef } from "react"

export function useMessageChanges(messages: any[]) {
	const prevMessagesRef = useRef<any[]>([])

	const newMessages = useMemo(() => {
		if (!messages || messages.length === 0) return []

		const prevMessages = prevMessagesRef.current
		const currentMessages = messages

		// 计算新增的消息
		return currentMessages.slice(prevMessages.length)
	}, [messages.length])

	const hasMemoryUpdateMessage = useMemo(() => {
		return newMessages.some((message) => {
			// 添加安全检查，确保 message 和 message.tool 存在
			if (!message || !message.tool) return false
			return ["create_memory", "update_memory", "delete_memory"].includes(message.tool.name)
		})
	}, [newMessages])

	// 更新 ref 中的消息状态
	useEffect(() => {
		prevMessagesRef.current = messages
	}, [messages.length])

	return {
		newMessages,
		hasMemoryUpdateMessage,
	}
}
