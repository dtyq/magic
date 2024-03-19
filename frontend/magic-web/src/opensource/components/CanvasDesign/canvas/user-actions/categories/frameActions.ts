import { ElementTypeEnum } from "../../types"
import type { UserAction } from "../types"

/**
 * 画框操作相关的用户动作
 */
export const frameActions: UserAction[] = [
	{
		id: "frame.create",
		category: "frame",
		canExecute: (canvas) => {
			// 非只读模式
			if (canvas.readonly) return false

			// 必须有选中的元素
			const selectedIds = canvas.selectionManager.getSelectedIds()
			if (selectedIds.length === 0) return false

			// 获取选中的元素
			const selectedElements = selectedIds
				.map((id) => canvas.elementManager.getElementData(id))
				.filter((el) => el !== undefined)

			// 不能包含 Frame
			const hasFrame = selectedElements.some((el) => el.type === ElementTypeEnum.Frame)
			if (hasFrame) return false

			// 不能已经在 Frame 内
			const isParentFrame = selectedElements.some((el) => {
				const parentId = canvas.elementManager.findParentIdForElement(el.id)
				if (!parentId) return false
				const parent = canvas.elementManager.getElementData(parentId)
				return parent?.type === ElementTypeEnum.Frame
			})

			return !isParentFrame
		},
		execute: (canvas) => {
			canvas.frameManager.createFrame()
		},
	},
	{
		id: "frame.remove",
		category: "frame",
		canExecute: (canvas) => {
			// 非只读模式
			if (canvas.readonly) return false

			// 必须只选中一个元素
			const selectedIds = canvas.selectionManager.getSelectedIds()
			if (selectedIds.length !== 1) return false

			// 该元素必须是 Frame
			const element = canvas.elementManager.getElementData(selectedIds[0])
			return element?.type === ElementTypeEnum.Frame
		},
		execute: (canvas) => {
			canvas.frameManager.removeFrame()
		},
	},
]
