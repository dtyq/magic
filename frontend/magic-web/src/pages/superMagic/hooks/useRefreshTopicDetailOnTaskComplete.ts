import { useEffect, useRef } from "react"
import { SuperMagicApi } from "@/apis"
import { superMagicStore } from "@/pages/superMagic/stores"
import type { Topic } from "../pages/Workspace/types"

interface UseRefreshTopicDetailOnTaskCompleteParams {
	selectedTopic: Topic | null
	onTopicDetailLoaded: (topic: Topic) => void
}

export function useRefreshTopicDetailOnTaskComplete({
	selectedTopic,
	onTopicDetailLoaded,
}: UseRefreshTopicDetailOnTaskCompleteParams) {
	const refreshTaskRef = useRef<null | Promise<void>>(null)
	const pendingRefreshRef = useRef(false)
	const lastHandledEventKeyRef = useRef<null | string>(null)
	const selectedTopicRef = useRef<Topic | null>(selectedTopic)

	selectedTopicRef.current = selectedTopic

	useEffect(() => {
		if (!selectedTopic?.id || !selectedTopic.chat_topic_id) return

		let isActive = true
		lastHandledEventKeyRef.current = null
		pendingRefreshRef.current = false

		const triggerRefresh = () => {
			if (!isActive) return

			// 终态消息可能短时间内连续到达，这里做串行刷新，避免重复并发拉取详情。
			if (refreshTaskRef.current) {
				pendingRefreshRef.current = true
				return
			}

			const currentTopic = selectedTopicRef.current
			if (!currentTopic?.id) return

			refreshTaskRef.current = SuperMagicApi.getTopicDetail(
				{ id: currentTopic.id },
				{ enableErrorMessagePrompt: false },
			)
				.then((topicDetail) => {
					if (!isActive || !topicDetail) return
					if (selectedTopicRef.current?.id !== topicDetail.id) return

					onTopicDetailLoaded(topicDetail)
				})
				.catch((error) => {
					console.error("Failed to refresh topic detail after task completion", error)
				})
				.finally(() => {
					refreshTaskRef.current = null

					if (!isActive || !pendingRefreshRef.current) return

					pendingRefreshRef.current = false
					triggerRefresh()
				})
		}

		const unregister = superMagicStore.registerDomainEventListener({
			matcher: (payload) =>
				payload.type === "task_completed" &&
				payload.topicId === selectedTopic.chat_topic_id,
			callback: (payload) => {
				if (payload.type !== "task_completed") return

				const { message, status } = payload
				// 同一条终态消息只处理一次，避免刷新用量时重复请求。
				const eventKey = `${message.app_message_id}:${message.seq_id}:${status}`
				if (lastHandledEventKeyRef.current === eventKey) return

				lastHandledEventKeyRef.current = eventKey
				triggerRefresh()
			},
		})

		return () => {
			isActive = false
			pendingRefreshRef.current = false
			unregister()
		}
	}, [onTopicDetailLoaded, selectedTopic?.chat_topic_id, selectedTopic?.id])
}
