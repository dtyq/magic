import type { JSONContent } from "@tiptap/react"
import { useEffect, useRef, useSyncExternalStore } from "react"
import chatWebSocket from "@/apis/clients/chatWebSocket"
import type { ModelItem } from "@/pages/superMagic/components/MessageEditor/types"
import type { SendMessageOptions } from "@/pages/superMagic/components/MessagePanel/types"
import { TopicMode } from "@/pages/superMagic/pages/Workspace/types"

function subscribeChatWebSocketReady(onStoreChange: () => void) {
	const handleOpen = () => onStoreChange()
	const handleClose = () => onStoreChange()
	chatWebSocket.on("open", handleOpen)
	chatWebSocket.on("close", handleClose)
	return () => {
		chatWebSocket.off("open", handleOpen)
		chatWebSocket.off("close", handleClose)
	}
}

function getChatWebSocketConnectedSnapshot() {
	return chatWebSocket.isConnected
}

function getChatWebSocketConnectedServerSnapshot() {
	return false
}

/** True when chat WS is OPEN; chat() needs this for apiSend. */
function useChatWebSocketConnected() {
	return useSyncExternalStore(
		subscribeChatWebSocketReady,
		getChatWebSocketConnectedSnapshot,
		getChatWebSocketConnectedServerSnapshot,
	)
}

interface UseAutoSendInitialClawMessageParams {
	selectedTopicId?: string
	agentCode?: string
	isMessagesReady: boolean
	isModelLoading: boolean
	messageCount: number
	selectedModel: ModelItem | null
	onAutoSend: (payload: AutoSendInitialClawMessagePayload) => void
}

export interface AutoSendInitialClawMessagePayload {
	jsonContent: JSONContent
	options: SendMessageOptions
}

function buildMagiClawInitialSendPayload({
	agentCode,
	selectedModel,
}: {
	agentCode?: string
	selectedModel: ModelItem
}): AutoSendInitialClawMessagePayload {
	return {
		jsonContent: INITIAL_CLAW_MESSAGE,
		options: {
			extra: {
				super_agent: {
					mentions: [],
					chat_mode: "normal",
					topic_pattern: TopicMode.MagiClaw,
					enable_web_search: false,
					...(agentCode && { agent_code: agentCode }),
					model: {
						model_id: selectedModel.model_id,
					},
				},
			},
		},
	}
}

const INITIAL_CLAW_MESSAGE: JSONContent = {
	type: "doc",
	content: [
		{
			type: "paragraph",
			content: [
				{
					type: "text",
					text: "Hi~",
				},
			],
		},
	],
}

export function useAutoSendInitialClawMessage({
	selectedTopicId,
	agentCode,
	isMessagesReady,
	isModelLoading,
	messageCount,
	selectedModel,
	onAutoSend,
}: UseAutoSendInitialClawMessageParams) {
	const autoSentTopicIdsRef = useRef<Set<string>>(new Set())
	const isChatWebSocketConnected = useChatWebSocketConnected()

	useEffect(() => {
		if (!selectedTopicId) return
		if (!agentCode) return
		if (!isMessagesReady) return
		if (isModelLoading) return
		if (messageCount > 0) return
		if (!selectedModel) return
		// Wait for WS; apiSend races connect() with 3s timeout otherwise
		if (!isChatWebSocketConnected) return
		if (autoSentTopicIdsRef.current.has(selectedTopicId)) return

		autoSentTopicIdsRef.current.add(selectedTopicId)
		setTimeout(() =>
			onAutoSend(
				buildMagiClawInitialSendPayload({
					agentCode,
					selectedModel,
				}),
			),
		)
	}, [
		agentCode,
		isChatWebSocketConnected,
		isMessagesReady,
		isModelLoading,
		messageCount,
		onAutoSend,
		selectedModel,
		selectedTopicId,
	])
}
