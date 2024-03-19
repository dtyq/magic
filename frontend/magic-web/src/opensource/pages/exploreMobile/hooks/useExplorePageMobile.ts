import { useMemoizedFn } from "ahooks"
import { useState } from "react"

// Types
import type { AssistantData } from "../types"

// Constants
import { useExploreData } from "../../explore/hooks/useExploreData"
import useAssistant from "../../explore/hooks/useAssistant"

// Services
import ExplorePageService from "@/opensource/services/explore/ExplorePageService"

/**
 * useExplorePageMobile - 探索页面主要逻辑 Hook
 *
 * @param props - 组件属性
 * @returns 页面状态和处理函数
 */
export function useExplorePageMobile() {
	const [selectedAssistant, setSelectedAssistant] = useState<AssistantData>()
	const { orgBots, orgBotLoading, handleClickCard, handleAddFriend } = useExploreData()
	const { navigateConversation } = useAssistant()

	// Handlers
	const handleViewAll = useMemoizedFn(() => {
		// Navigate to full assistant list
		console.log("Navigate to view all assistants")
	})

	const handleAssistantClick = useMemoizedFn((assistantId: string) => {
		setSelectedAssistant(orgBots.find((assistant) => assistant.id === assistantId))
	})

	const handleAddAssistant = useMemoizedFn(
		async (assistant: AssistantData, addAgent: boolean, isNavigate: boolean) => {
			const result = await handleAddFriend(assistant, addAgent, isNavigate)

			if (result.success && result.userId) {
				// Navigate to conversation if requested
				if (isNavigate) {
					navigateConversation(result.userId)
				} else if (addAgent) {
					// Update current card state
					setSelectedAssistant((prev) =>
						ExplorePageService.updateCardAfterAddFriend(prev!, result.userId!),
					)
				}
			}
		},
	)

	const handleStartConversation = useMemoizedFn((assistantId: string) => {
		navigateConversation(assistantId)
	})

	const handleCloseAssistantPopup = useMemoizedFn(() => {
		setSelectedAssistant(undefined)
	})

	return {
		selectedAssistant,
		orgBots,
		orgBotLoading,

		// Handlers
		handlers: {
			handleViewAll,
			handleAssistantClick,
			handleAddAssistant,
			handleStartConversation,
			handleCloseAssistantPopup,
			handleClickCard,
			handleAddFriend,
		},
	}
}
