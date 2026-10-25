import type { CanvasAssetImportResult } from "../../../../runtime/resources/asset/CanvasAssetImportManager"
import type { UploadFileResponse } from "../../../../public/magic-types"
import type { ImageEditorConfig, ImageReferenceSlotInfo } from "./useImageEditorConfig"

type ImageAssetSelectionHandlers = Pick<ImageEditorConfig["handlers"], "replaceReferenceFileAt">

/**
 * 将一次素材库确认按返回顺序写入图片参考图列表。
 *
 * `currentReferenceFileCount` 只统计图片 Content 中的手动参考图；关联媒体
 * 也会展示在 SourceList，却不属于图片参考图数组，不能占用后续写入索引。
 */
export function applyImportedAssetsToImageSlots(options: {
	slot: ImageReferenceSlotInfo
	imported: CanvasAssetImportResult[]
	currentReferenceFileCount: number
	handlers: ImageAssetSelectionHandlers
}): void {
	const { slot, imported, currentReferenceFileCount, handlers } = options
	// Linked-media entries are rendered after the manual reference array and
	// therefore have a slot index that is larger than the array we mutate. They
	// cannot be replaced through this image-content API; treat them like the
	// empty append slot so a multi-select confirmation never overwrites its own
	// first imported item on the second iteration.
	const replacesManualSlot = Boolean(
		slot.path && slot.slotIndex >= 0 && slot.slotIndex < currentReferenceFileCount,
	)
	const firstSlotIndex = replacesManualSlot ? slot.slotIndex : currentReferenceFileCount

	for (const [index, result] of imported.entries()) {
		const slotIndex =
			index === 0
				? firstSlotIndex
				: currentReferenceFileCount + index - (replacesManualSlot ? 1 : 0)
		const fileInfo: UploadFileResponse = {
			path: result.workspacePath,
			src: result.workspacePath,
			fileName: result.fileName,
		}

		handlers.replaceReferenceFileAt(slotIndex, fileInfo, {
			ensurePromptMention: true,
			retainReferenceSlot: index < imported.length - 1,
		})
	}
}
