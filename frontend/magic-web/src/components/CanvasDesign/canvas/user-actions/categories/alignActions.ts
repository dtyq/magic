import type { UserAction } from "../types"

/**
 * 对齐操作相关的用户动作
 */
export const alignActions: UserAction[] = [
	{
		id: "align.left",
		category: "align",
		canExecute: (canvas) => {
			// 非只读模式且有选中的元素
			if (canvas.readonly) return false
			const selectedIds = canvas.selectionManager.getSelectedIds()
			return selectedIds.length > 0
		},
		execute: (canvas) => {
			canvas.alignmentManager.align("left")
		},
	},
	{
		id: "align.horizontal-center",
		category: "align",
		canExecute: (canvas) => {
			// 非只读模式且有选中的元素
			if (canvas.readonly) return false
			const selectedIds = canvas.selectionManager.getSelectedIds()
			return selectedIds.length > 0
		},
		execute: (canvas) => {
			canvas.alignmentManager.align("horizontal-center")
		},
	},
	{
		id: "align.right",
		category: "align",
		canExecute: (canvas) => {
			// 非只读模式且有选中的元素
			if (canvas.readonly) return false
			const selectedIds = canvas.selectionManager.getSelectedIds()
			return selectedIds.length > 0
		},
		execute: (canvas) => {
			canvas.alignmentManager.align("right")
		},
	},
	{
		id: "align.top",
		category: "align",
		canExecute: (canvas) => {
			// 非只读模式且有选中的元素
			if (canvas.readonly) return false
			const selectedIds = canvas.selectionManager.getSelectedIds()
			return selectedIds.length > 0
		},
		execute: (canvas) => {
			canvas.alignmentManager.align("top")
		},
	},
	{
		id: "align.vertical-center",
		category: "align",
		canExecute: (canvas) => {
			// 非只读模式且有选中的元素
			if (canvas.readonly) return false
			const selectedIds = canvas.selectionManager.getSelectedIds()
			return selectedIds.length > 0
		},
		execute: (canvas) => {
			canvas.alignmentManager.align("vertical-center")
		},
	},
	{
		id: "align.bottom",
		category: "align",
		canExecute: (canvas) => {
			// 非只读模式且有选中的元素
			if (canvas.readonly) return false
			const selectedIds = canvas.selectionManager.getSelectedIds()
			return selectedIds.length > 0
		},
		execute: (canvas) => {
			canvas.alignmentManager.align("bottom")
		},
	},
]
