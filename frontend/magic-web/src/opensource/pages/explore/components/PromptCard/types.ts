import type { Bot } from "@/opensource/types/bot"
import type { PromptSection } from "../PromptSection/types"
import { OperationTypes } from "@/opensource/pages/flow/components/AuthControlButton/types"

export type AvatarCard = {
	id?: string
	icon?: string
	title: string
	description: string
	nickname?: string
	user_operation?: OperationTypes
}

export type PromptCard = Bot.BotItem | Bot.OrgBotItem

export interface PromptTabs {
	key: string
	tab: string
}

export type PromptCardWithType = PromptCard & { type?: PromptSection["type"] }
