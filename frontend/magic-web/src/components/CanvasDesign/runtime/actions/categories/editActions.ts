import type {
	UserAction,
	EditActionOptions,
	DuplicateActionOptions,
	DeleteImageFileActionOptions,
} from "../types"
import { ElementTypeEnum } from "../../document/types"
import { selectionContainsReplacingMedia } from "../mediaReplacementGuards"
import { canDeleteSelectedImageFile, executeDeleteImageFile } from "../imageFileDeletion"

/**
 * 编辑操作相关的用户动作
 */
export const editActions: UserAction[] = [
	{
		id: "edit.duplicate",
		category: "edit",
		canExecute: (canvas, options?: DuplicateActionOptions) =>
			canvas.clipboardManager.canDuplicate(options?.elementIds),
		execute: async (canvas, options?: DuplicateActionOptions) => {
			await canvas.clipboardManager.duplicate(options?.elementIds)
		},
	} satisfies UserAction<"edit.duplicate", DuplicateActionOptions>,
	{
		id: "edit.copy",
		category: "edit",
		canExecute: (canvas) => {
			if (!canvas.permissionManager.can("sideEffect.copy")) return false
			// 必须有选中的元素
			const selectedIds = canvas.selectionManager.getSelectedIds()
			return selectedIds.length > 0
		},
		execute: (canvas) => {
			if (!canvas.permissionManager.can("sideEffect.copy")) return
			canvas.clipboardManager.copy()
		},
	},
	{
		id: "edit.copy-png",
		category: "edit",
		canExecute: (canvas) => {
			if (!canvas.permissionManager.can("sideEffect.copy")) return false
			const selectedIds = canvas.selectionManager.getSelectedIds()
			if (selectedIds.length === 0) return false
			if (selectionContainsReplacingMedia(canvas)) return false
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
			if (!canvas.permissionManager.can("sideEffect.copy")) return
			const selectedIds = canvas.selectionManager.getSelectedIds()
			if (selectedIds.length > 0 && !selectionContainsReplacingMedia(canvas)) {
				await canvas.clipboardManager.copyElementsAsPNG(selectedIds)
			}
		},
	},
	{
		id: "edit.paste",
		category: "edit",
		canExecute: (canvas) => {
			// 非只读模式下可以粘贴
			return canvas.permissionManager.can("document.write")
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
			if (!canvas.permissionManager.can("document.delete")) return false
			if (canvas.connectionManager.hasSelectedConnection()) return true

			// 非只读模式且有选中的元素
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
			canvas.deleteSelection()
		},
	},
	{
		id: "edit.delete-image-file",
		category: "edit",
		canExecute: (canvas, options?: DeleteImageFileActionOptions) =>
			canDeleteSelectedImageFile(canvas, options),
		execute: (canvas, options?: DeleteImageFileActionOptions) => {
			executeDeleteImageFile(canvas, options)
		},
	} satisfies UserAction<"edit.delete-image-file", DeleteImageFileActionOptions>,
	{
		id: "edit.undo",
		category: "edit",
		canExecute: (canvas) => {
			// 非只读模式且有可撤销的历史
			if (!canvas.permissionManager.can("document.write")) return false
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
			if (!canvas.permissionManager.can("document.write")) return false
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
