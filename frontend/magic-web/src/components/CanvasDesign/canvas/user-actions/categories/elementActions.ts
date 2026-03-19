import type { UserAction } from "../types"

/**
 * 元素状态操作相关的用户动作
 */
export const elementActions: UserAction[] = [
	{
		id: "element.toggle-visible",
		category: "element",
		canExecute: (canvas) => {
			// 必须有选中的元素
			const selectedIds = canvas.selectionManager.getSelectedIds()
			return selectedIds.length > 0
		},
		execute: (canvas) => {
			canvas.autoToggleElementsVisibility()
		},
	},
	{
		id: "element.toggle-lock",
		category: "element",
		canExecute: (canvas) => {
			// 非只读模式且有选中的元素
			if (canvas.readonly) return false
			const selectedIds = canvas.selectionManager.getSelectedIds()
			return selectedIds.length > 0
		},
		execute: (canvas) => {
			canvas.autoToggleElementsLock()
		},
	},
]
