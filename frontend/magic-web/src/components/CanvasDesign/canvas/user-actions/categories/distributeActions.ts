import type { UserAction } from "../types"

/**
 * 分布操作相关的用户动作
 */
export const distributeActions: UserAction[] = [
	{
		id: "distribute.horizontal",
		category: "distribute",
		canExecute: (canvas) => {
			// 非只读模式且有选中的元素
			if (canvas.readonly) return false
			const selectedIds = canvas.selectionManager.getSelectedIds()
			return selectedIds.length > 0
		},
		execute: (canvas) => {
			canvas.alignmentManager.distribute("horizontal-spacing")
		},
	},
	{
		id: "distribute.vertical",
		category: "distribute",
		canExecute: (canvas) => {
			// 非只读模式且有选中的元素
			if (canvas.readonly) return false
			const selectedIds = canvas.selectionManager.getSelectedIds()
			return selectedIds.length > 0
		},
		execute: (canvas) => {
			canvas.alignmentManager.distribute("vertical-spacing")
		},
	},
	{
		id: "distribute.auto-layout",
		category: "distribute",
		canExecute: (canvas) => {
			// 非只读模式且有选中的元素
			if (canvas.readonly) return false
			const selectedIds = canvas.selectionManager.getSelectedIds()
			return selectedIds.length > 0
		},
		execute: (canvas) => {
			canvas.alignmentManager.distribute("auto-layout")
		},
	},
]
