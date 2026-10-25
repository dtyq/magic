import type { UserAction } from "../types"
import { getLoadedFileElements } from "../../shared/ids"
import { containsReplacingMedia } from "../mediaReplacementGuards"

function getContentViewElements(
	canvas: Parameters<NonNullable<UserAction["execute"]>>[0],
	elements: ReturnType<typeof getLoadedFileElements>,
) {
	return elements.map((element) =>
		typeof canvas.getElementForContentView === "function"
			? canvas.getElementForContentView(element)
			: element,
	)
}

/**
 * 对话操作相关的用户动作（Magic 特定）
 */
export const conversationActions: UserAction[] = [
	{
		id: "conversation.add-to-current",
		category: "conversation",
		canExecute: (canvas) => {
			if (!canvas.permissionManager.canAddSelectedMediaToConversation()) return false
			const fileElements = getLoadedFileElements(canvas)
			if (fileElements.length === 0) return false
			if (containsReplacingMedia(canvas, fileElements)) return false
			const methods = canvas.magicConfigManager.config?.methods
			return !!methods?.addToConversation
		},
		execute: async (canvas) => {
			if (!canvas.permissionManager.canAddSelectedMediaToConversation()) return
			const fileElements = getLoadedFileElements(canvas)
			if (fileElements.length === 0) return
			if (containsReplacingMedia(canvas, fileElements)) return
			const methods = canvas.magicConfigManager.config?.methods
			if (methods?.addToConversation) {
				await methods.addToConversation(getContentViewElements(canvas, fileElements), false)
			}
		},
	},
	{
		id: "conversation.add-to-new",
		category: "conversation",
		canExecute: (canvas) => {
			if (!canvas.permissionManager.canAddSelectedMediaToConversation()) return false
			const fileElements = getLoadedFileElements(canvas)
			if (fileElements.length === 0) return false
			if (containsReplacingMedia(canvas, fileElements)) return false
			const methods = canvas.magicConfigManager.config?.methods
			return !!methods?.addToConversation
		},
		execute: async (canvas) => {
			if (!canvas.permissionManager.canAddSelectedMediaToConversation()) return
			const fileElements = getLoadedFileElements(canvas)
			if (fileElements.length === 0) return
			if (containsReplacingMedia(canvas, fileElements)) return
			const methods = canvas.magicConfigManager.config?.methods
			if (methods?.addToConversation) {
				await methods.addToConversation(getContentViewElements(canvas, fileElements), true)
			}
		},
	},
]
