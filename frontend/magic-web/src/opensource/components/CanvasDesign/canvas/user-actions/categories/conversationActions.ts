import type { UserAction } from "../types"
import { getLoadedImageElements } from "../../utils/utils"

/**
 * 对话操作相关的用户动作（Magic 特定）
 */
export const conversationActions: UserAction[] = [
	{
		id: "conversation.add-to-current",
		category: "conversation",
		canExecute: (canvas) => {
			// 获取已加载的图片元素列表
			const imageElements = getLoadedImageElements(canvas)

			// 至少需要一个已加载的图片元素
			if (imageElements.length === 0) return false

			// 必须有 addToConversation 方法
			const methods = canvas.magicConfigManager.config?.methods
			return !!methods?.addToConversation
		},
		execute: async (canvas) => {
			const imageElements = getLoadedImageElements(canvas)
			if (imageElements.length === 0) return

			const methods = canvas.magicConfigManager.config?.methods

			if (methods?.addToConversation) {
				await methods.addToConversation(imageElements, false)
			}
		},
	},
	{
		id: "conversation.add-to-new",
		category: "conversation",
		canExecute: (canvas) => {
			// 获取已加载的图片元素列表
			const imageElements = getLoadedImageElements(canvas)

			// 至少需要一个已加载的图片元素
			if (imageElements.length === 0) return false

			// 必须有 addToConversation 方法
			const methods = canvas.magicConfigManager.config?.methods
			return !!methods?.addToConversation
		},
		execute: async (canvas) => {
			const imageElements = getLoadedImageElements(canvas)
			if (imageElements.length === 0) return

			const methods = canvas.magicConfigManager.config?.methods

			if (methods?.addToConversation) {
				await methods.addToConversation(imageElements, true)
			}
		},
	},
]
