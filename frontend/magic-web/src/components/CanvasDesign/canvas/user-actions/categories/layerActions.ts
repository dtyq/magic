import type { UserAction } from "../types"

/**
 * 层级操作相关的用户动作
 */
export const layerActions: UserAction[] = [
	{
		id: "layer.move-up",
		category: "layer",
		canExecute: (canvas) => {
			// 非只读模式且有选中的元素
			if (canvas.readonly) return false
			const selectedIds = canvas.selectionManager.getSelectedIds()
			return selectedIds.length > 0
		},
		execute: (canvas) => {
			const selectedIds = canvas.selectionManager.getSelectedIds()
			canvas.elementManager.zIndexManager.batchMoveUp(selectedIds)
		},
	},
	{
		id: "layer.move-down",
		category: "layer",
		canExecute: (canvas) => {
			// 非只读模式且有选中的元素
			if (canvas.readonly) return false
			const selectedIds = canvas.selectionManager.getSelectedIds()
			return selectedIds.length > 0
		},
		execute: (canvas) => {
			const selectedIds = canvas.selectionManager.getSelectedIds()
			canvas.elementManager.zIndexManager.batchMoveDown(selectedIds)
		},
	},
	{
		id: "layer.move-to-top",
		category: "layer",
		canExecute: (canvas) => {
			// 非只读模式且有选中的元素
			if (canvas.readonly) return false
			const selectedIds = canvas.selectionManager.getSelectedIds()
			return selectedIds.length > 0
		},
		execute: (canvas) => {
			const selectedIds = canvas.selectionManager.getSelectedIds()
			canvas.elementManager.zIndexManager.batchMoveToTop(selectedIds)
		},
	},
	{
		id: "layer.move-to-bottom",
		category: "layer",
		canExecute: (canvas) => {
			// 非只读模式且有选中的元素
			if (canvas.readonly) return false
			const selectedIds = canvas.selectionManager.getSelectedIds()
			return selectedIds.length > 0
		},
		execute: (canvas) => {
			const selectedIds = canvas.selectionManager.getSelectedIds()
			canvas.elementManager.zIndexManager.batchMoveToBottom(selectedIds)
		},
	},
]
