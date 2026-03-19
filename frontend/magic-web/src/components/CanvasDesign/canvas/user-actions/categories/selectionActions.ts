import type { UserAction } from "../types"

/**
 * 选择操作相关的用户动作
 */
export const selectionActions: UserAction[] = [
	{
		id: "selection.select-all",
		category: "selection",
		canExecute: (canvas) => {
			// 非只读模式且有元素可选
			if (canvas.readonly) return false
			const allElements = canvas.elementManager.getAllElements()
			return allElements.length > 0
		},
		execute: (canvas) => {
			const allElements = canvas.elementManager.getAllElements()
			const allElementIds = allElements.map((element) => element.id)
			if (allElementIds.length > 0) {
				canvas.selectionManager.selectMultiple(allElementIds)
			}
		},
	},
]
