import type { ImageDiscardActionOptions, UserAction } from "../types"
import type { Canvas } from "../../core/Canvas"
import { ElementTypeEnum, type ElementUpdatePatch } from "../../document/types"
import { isContentGenerationPending, updateImageContent } from "../../document/elementContent"

function prepareImageDiscardUpdates(
	canvas: Canvas,
	options?: ImageDiscardActionOptions,
): Array<{ id: string; data: ElementUpdatePatch }> | null {
	if (!options || !options.targets.length || !canvas.permissionManager.can("document.write")) {
		return null
	}
	const updates: Array<{ id: string; data: ElementUpdatePatch }> = []
	const seen = new Set<string>()
	for (const target of options.targets) {
		const element = canvas.elementManager.getElementData(target.elementId)
		if (
			!element ||
			element.type !== ElementTypeEnum.Image ||
			canvas.permissionManager.isLocked(element) ||
			canvas.getEffectiveContentId(element.id) !== target.contentId ||
			seen.has(element.id)
		)
			return null
		seen.add(element.id)
		const content = element.contents.find((item) => item.contentId === target.contentId)
		if (
			!content?.src ||
			isContentGenerationPending(content) ||
			canvas.generationRuntimeManager.hasActiveGeneration(element.id, target.contentId)
		)
			return null
		if ((content.discarded === true) === options.discarded) continue
		const next = updateImageContent(element, target.contentId, { discarded: options.discarded })
		updates.push({ id: element.id, data: { contents: next.contents } })
	}
	return updates
}

/**
 * 元素状态操作相关的用户动作
 */
export const elementActions: UserAction[] = [
	{
		id: "image.set-discarded",
		category: "element",
		canExecute: (canvas, options) =>
			prepareImageDiscardUpdates(canvas, options as ImageDiscardActionOptions | undefined) !==
			null,
		execute: (canvas, options) => {
			// 整批先校验再写入；例如两张图片中一张已换版本时，两张都不修改。
			const updates = prepareImageDiscardUpdates(
				canvas,
				options as ImageDiscardActionOptions | undefined,
			)
			if (!updates?.length) return
			canvas.historyManager.runTransaction(() => canvas.elementManager.batchUpdate(updates))
		},
	},
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
			if (!canvas.permissionManager.can("document.write")) return false
			const selectedIds = canvas.selectionManager.getSelectedIds()
			return selectedIds.length > 0
		},
		execute: (canvas) => {
			canvas.autoToggleElementsLock()
		},
	},
]
