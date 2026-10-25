import { useEffect } from "react"
import { TopicMode } from "../../Workspace/TopicMode"
import { registerConversationTopicModeOverride } from "@/pages/superMagic/services/conversationTopicModeOverride"

/**
 * The Claw editor keeps its model-picker mode as `default`, while every
 * outbound message (including queued messages) uses the MagiClaw pattern.
 * Register that surface fact for the shared queue acknowledgement listener.
 */
export function useClawConversationAnalytics(topicId?: string) {
	useEffect(() => {
		if (!topicId) return
		return registerConversationTopicModeOverride(topicId, TopicMode.MagiClaw)
	}, [topicId])
}
