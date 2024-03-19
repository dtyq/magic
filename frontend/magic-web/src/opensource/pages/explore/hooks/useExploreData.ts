import { useEffect } from "react"
import { useMemoizedFn } from "ahooks"
import { botStore } from "@/opensource/stores/bot"
import type { Bot } from "@/opensource/types/bot"
import type { PromptCard as PromptCardType } from "../components/PromptCard/types"
import ExplorePageService from "@/opensource/services/explore/ExplorePageService"

interface UseExploreDataReturn {
	marketBots: Bot.BotItem[]
	orgBots: Bot.OrgBotItem[]
	orgBotLoading: boolean
	handleClickCard: (id: string) => PromptCardType | undefined
	handleAddFriend: (
		cardData: PromptCardType,
		addAgent: boolean,
		isNavigate: boolean,
	) => Promise<{
		success: boolean
		userId?: string
		error?: string
	}>
}

/**
 * Custom hook for managing explore page data and interactions
 */
export function useExploreData(): UseExploreDataReturn {
	// Fetch data on mount
	useEffect(() => {
		botStore.fetchMarketBotList()
		botStore.fetchOrgBotList({ page: 1, pageSize: 100 })
	}, [])

	// Get data from store
	const marketBots = botStore.marketBotList?.list ?? []
	const orgBots = botStore.orgBotList?.list ?? []
	const orgBotLoading = botStore.orgBotListLoading

	// Memoized card click handler
	const handleClickCard = useMemoizedFn((id: string) => {
		return ExplorePageService.findCardById(id, marketBots, orgBots)
	})

	// Memoized add friend handler
	const handleAddFriend = useMemoizedFn(
		async (cardData: PromptCardType, addAgent: boolean, isNavigate: boolean) => {
			return ExplorePageService.addFriend({
				cardData,
				addAgent,
				isNavigate,
			})
		},
	)

	return {
		marketBots,
		orgBots,
		orgBotLoading,
		handleClickCard,
		handleAddFriend,
	}
}
