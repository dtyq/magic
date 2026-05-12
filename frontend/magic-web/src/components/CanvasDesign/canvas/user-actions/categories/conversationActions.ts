import type { UserAction } from "../types"
import { getLoadedFileElements } from "../../utils/utils"

/**
 * 对话操作相关的用户动作（Magic 特定）
 */
export const conversationActions: UserAction[] = [
	{
		id: "conversation.add-to-current",
		category: "conversation",
		canExecute: (canvas) => {
			if (
				canvas.magicConfigManager.config?.permissions?.elementMenuConversationActions ===
				false
			)
				return false
			const fileElements = getLoadedFileElements(canvas)
			if (fileElements.length === 0) return false
			const methods = canvas.magicConfigManager.config?.methods
			return !!methods?.addToConversation
		},
		execute: async (canvas) => {
			const fileElements = getLoadedFileElements(canvas)
			if (fileElements.length === 0) return
			const methods = canvas.magicConfigManager.config?.methods
			if (methods?.addToConversation) {
				await methods.addToConversation(fileElements, false)
			}
		},
	},
	{
		id: "conversation.add-to-new",
		category: "conversation",
		canExecute: (canvas) => {
			if (
				canvas.magicConfigManager.config?.permissions?.elementMenuConversationActions ===
				false
			)
				return false
			const fileElements = getLoadedFileElements(canvas)
			if (fileElements.length === 0) return false
			const methods = canvas.magicConfigManager.config?.methods
			return !!methods?.addToConversation
		},
		execute: async (canvas) => {
			const fileElements = getLoadedFileElements(canvas)
			if (fileElements.length === 0) return
			const methods = canvas.magicConfigManager.config?.methods
			if (methods?.addToConversation) {
				await methods.addToConversation(fileElements, true)
			}
		},
	},
]
