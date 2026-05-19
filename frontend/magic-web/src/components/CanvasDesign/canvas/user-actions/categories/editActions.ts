import type { UserAction, EditActionOptions } from "../types"
import { ElementTypeEnum } from "../../types"

/**
 * 编辑操作相关的用户动作
 */
export const editActions: UserAction[] = [
	{
		id: "edit.copy",
		category: "edit",
		canExecute: (canvas) => {
			// 必须有选中的元素
			const selectedIds = canvas.selectionManager.getSelectedIds()
			return selectedIds.length > 0
		},
		execute: (canvas) => {
			canvas.clipboardManager.copy()
		},
	},
	{
		id: "edit.copy-png",
		category: "edit",
		canExecute: (canvas) => {
			const selectedIds = canvas.selectionManager.getSelectedIds()
			if (selectedIds.length === 0) return false
			// 检查是否所有选中元素都支持PNG导出
			const selectedElements = selectedIds.map((id) => {
				const element = canvas.elementManager.getElementData(id)
				return {
					id,
					type: element?.type ?? null,
				}
			})
			const allowed = selectedElements.every((element) => {
				return (
					element.type === ElementTypeEnum.Image ||
					// 视频导出 PNG 时只渲染当前封面图，不处理视频文件本体。
					element.type === ElementTypeEnum.Video ||
					element.type === ElementTypeEnum.Frame ||
					element.type === ElementTypeEnum.Text
				)
			})
			return allowed
		},
		execute: async (canvas) => {
			const selectedIds = canvas.selectionManager.getSelectedIds()
			if (selectedIds.length > 0) {
				await canvas.clipboardManager.copyElementsAsPNG(selectedIds)
			}
		},
	},
	{
		id: "edit.paste",
		category: "edit",
		canExecute: (canvas) => {
			// 非只读模式下可以粘贴
			return !canvas.readonly
		},
		execute: async (canvas, options?: EditActionOptions) => {
			// 两条入口都会走到这里：
			// 1. Ctrl/Cmd+V：options.clipboardEvent 存在，可读取同步 paste event 的文件字节。
			// 2. 菜单粘贴：只有 pastePosition，没有 clipboardEvent，只能走 Clipboard API read()。
			const position = options?.pastePosition
			const clipboardEvent = options?.clipboardEvent
			const pasteSource = options?.pasteSource ?? (clipboardEvent ? "keyboard" : "menu")
			await canvas.clipboardManager.paste(clipboardEvent, position, pasteSource)
		},
	} satisfies UserAction<"edit.paste", EditActionOptions>,
	{
		id: "edit.delete",
		category: "edit",
		canExecute: (canvas) => {
			// 非只读模式且有选中的元素
			if (canvas.readonly) return false

			const selectedIds = canvas.selectionManager.getSelectedIds()
			if (selectedIds.length === 0) return false

			// 检查是否有可删除的元素
			const deletableElementIds = selectedIds.filter((id) => {
				const elementData = canvas.elementManager.getElementData(id)
				return canvas.permissionManager.canDelete(elementData)
			})

			return deletableElementIds.length > 0
		},
		execute: (canvas) => {
			canvas.deleteSelectedElements()
		},
	},
	{
		id: "edit.undo",
		category: "edit",
		canExecute: (canvas) => {
			// 非只读模式且有可撤销的历史
			if (canvas.readonly) return false
			if (canvas.textEditingManager.isEditing()) {
				return canvas.textEditingManager.canUndo()
			}
			return canvas.historyManager.canUndo()
		},
		execute: (canvas) => {
			if (canvas.textEditingManager.isEditing()) {
				canvas.textEditingManager.undo()
				return
			}
			canvas.historyManager.undo()
		},
	},
	{
		id: "edit.redo",
		category: "edit",
		canExecute: (canvas) => {
			// 非只读模式且有可重做的历史
			if (canvas.readonly) return false
			if (canvas.textEditingManager.isEditing()) {
				return canvas.textEditingManager.canRedo()
			}
			return canvas.historyManager.canRedo()
		},
		execute: (canvas) => {
			if (canvas.textEditingManager.isEditing()) {
				canvas.textEditingManager.redo()
				return
			}
			canvas.historyManager.redo()
		},
	},
]
