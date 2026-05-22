import { useCallback } from "react"

import {
	buildMobileFeedbackPrefill,
	useMobileFeedbackSheet,
} from "@/layouts/BaseLayoutMobile/components/MobileSettings/feedback-prefill"
import type { ProjectListItem, Topic } from "@/pages/superMagic/pages/Workspace/types"
import { resolveConversationTopicName } from "@/pages/superMagicMobile/feedback/resolve-conversation-topic-name"

interface UseConversationFeedbackSheetParams {
	selectedTopic: Topic | null
	selectedProject: ProjectListItem | null
}

/**
 * Conversation entry: thin wrapper over generic mobile feedback sheet + conversation prefill scenario.
 */
export function useConversationFeedbackSheet(params: UseConversationFeedbackSheetParams) {
	const { selectedTopic, selectedProject } = params

	const buildPrefill = useCallback(() => {
		if (!selectedTopic || !selectedProject) return undefined
		return buildMobileFeedbackPrefill({
			scenario: "conversation",
			context: {
				topicId: selectedTopic.id,
				topicName: resolveConversationTopicName(selectedTopic, selectedProject),
			},
		})
	}, [selectedProject, selectedTopic])

	const canOpen = useCallback(
		() => Boolean(selectedTopic && selectedProject),
		[selectedProject, selectedTopic],
	)

	const { feedbackSheetOpen, feedbackPrefill, openFeedbackSheet, closeFeedbackSheet } =
		useMobileFeedbackSheet({ buildPrefill, canOpen })

	return {
		feedbackSheetOpen,
		feedbackPrefill,
		openConversationFeedback: openFeedbackSheet,
		closeConversationFeedback: closeFeedbackSheet,
	}
}
