import { ElementTypeEnum } from "../../document/types"
import type { FrameCreateActionOptions, UserAction } from "../types"

/**
 * 画框操作相关的用户动作
 */
export const frameActions: UserAction[] = [
	{
		id: "frame.create",
		category: "frame",
		canExecute: (canvas) => {
			// 非只读模式
			if (!canvas.permissionManager.can("document.write")) return false

			// 必须有选中的元素
			const selectedIds = canvas.selectionManager.getSelectedIds()
			if (selectedIds.length === 0) return false

			if (canvas.permissionManager.isAnySelectedElementLocked()) return false

			// 获取选中的元素
			const selectedElements = selectedIds
				.map((id) => canvas.elementManager.getElementData(id))
				.filter((el) => el !== undefined)

			// Frame/Group 都是容器；当前画布不支持把容器嵌套进新的 Frame。
			const hasContainer = selectedElements.some(
				(el) => el.type === ElementTypeEnum.Frame || el.type === ElementTypeEnum.Group,
			)
			if (hasContainer) return false

			// 不能已经在 Frame 内
			const isParentFrame = selectedElements.some((el) => {
				const parentId = canvas.elementManager.findParentIdForElement(el.id)
				if (!parentId) return false
				const parent = canvas.elementManager.getElementData(parentId)
				return (
					parent?.type === ElementTypeEnum.Frame || parent?.type === ElementTypeEnum.Group
				)
			})

			return !isParentFrame
		},
		execute: (canvas, options?: FrameCreateActionOptions) => {
			if (options?.boundsExpansion === undefined) {
				canvas.frameManager.createFrame()
				return
			}
			canvas.frameManager.createFrame(options.boundsExpansion)
		},
	} satisfies UserAction<"frame.create", FrameCreateActionOptions>,
	{
		id: "frame.remove",
		category: "frame",
		canExecute: (canvas) => {
			// 非只读模式
			if (!canvas.permissionManager.can("document.delete")) return false

			// 必须只选中一个元素
			const selectedIds = canvas.selectionManager.getSelectedIds()
			if (selectedIds.length !== 1) return false

			const element = canvas.elementManager.getElementData(selectedIds[0])
			if (!element || element.type !== ElementTypeEnum.Frame) return false
			return canvas.permissionManager.canRemoveFrame(element)
		},
		execute: (canvas) => {
			canvas.frameManager.removeFrame()
		},
	},
]
