import { BotApi } from "@/opensource/apis"
import type { Bot } from "@/opensource/types/bot"
import type { PromptCard as PromptCardType } from "@/opensource/pages/explore/components/PromptCard/types"
import { AssistantData } from "@/opensource/pages/exploreMobile/types"
import magicToast from "@/opensource/components/base/MagicToaster/utils"

interface AddFriendParams {
	cardData: PromptCardType
	addAgent: boolean
	isNavigate: boolean
}

interface AddFriendResult {
	success: boolean
	userId?: string
	error?: string
}

class ExplorePageService {
	constructor() {}

	/**
	 * Add friend and optionally navigate to conversation
	 */
	async addFriend(params: AddFriendParams): Promise<AddFriendResult> {
		const { cardData, addAgent } = params

		if (!cardData.id) {
			return {
				success: false,
				error: "Card ID is required",
			}
		}

		try {
			if (addAgent) {
				const res = await BotApi.registerAndAddFriend(cardData.id)
				magicToast.success("添加成功")

				return {
					success: true,
					userId: res.user_id,
				}
			}

			return {
				success: true,
				userId: cardData.user_id,
			}
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : "添加失败"
			magicToast.error(errorMessage)

			return {
				success: false,
				error: errorMessage,
			}
		}
	}

	/**
	 * Find card by ID from both market and org bot lists
	 */
	findCardById(
		id: string,
		marketBots: Bot.BotItem[],
		orgBots: Bot.OrgBotItem[],
	): PromptCardType | undefined {
		return orgBots.find((item) => item.id === id) ?? marketBots.find((item) => item.id === id)
	}

	/**
	 * Update card data after adding friend
	 */
	updateCardAfterAddFriend(currentCard: AssistantData, userId: string): AssistantData {
		return {
			...currentCard,
			created_info: {
				...currentCard?.created_info,
				user_id: userId,
			},
			user_id: userId,
			is_add: true,
		}
	}

	/**
	 * Get assistant data (legacy method for backward compatibility)
	 */
	async getAssistantData() {
		// This method can be removed if not used elsewhere
		const response = await fetch("/api/explore/assistant")
		return response.json()
	}
}

export default new ExplorePageService()
