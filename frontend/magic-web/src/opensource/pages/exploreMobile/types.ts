import { Bot } from "@/opensource/types/bot"

export type AssistantData = Bot.OrgBotItem | Bot.BotItem

export type AssistantColumn = AssistantData[]

export type AssistantGridData = AssistantColumn[]

// New type for flat array data
export type AssistantFlatData = AssistantData[]

// Component Props
export interface ExplorePageMobileProps {
	onViewAll?: () => void
	onAssistantClick?: (assistantId: string) => void
}
