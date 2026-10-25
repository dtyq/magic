import type { Canvas } from "../core/Canvas"
import { GenerationStatus } from "../../public/magic-types"
import {
	getImageContents,
	isImageElementContent,
	updateImageContent,
} from "../document/elementContent"

/**
 * 把画布上仍在生成的图片 Content 收敛为 `terminated`。
 *
 * 终止态只改 Content 状态、保留节点和 `imageGenerationTaskMeta`，这样重试仍能拿到
 * 上一轮的生成上下文。元素已删除时 `getElementData` 返回 undefined，静默跳过。
 *
 * @returns 被置为终止态的元素 id，供调用方判断是否需要触发保存。
 */
export function terminateGeneratingImages(canvas: Canvas): string[] {
	const terminatedElementIds: string[] = []

	for (const elementId of canvas.elementManager.getAllElementIds()) {
		const element = canvas.elementManager.getElementData(elementId)
		if (!isImageElementContent(element)) continue

		const pendingContentIds = getImageContents(element)
			.filter(
				(content) =>
					content.status === GenerationStatus.Pending ||
					content.status === GenerationStatus.Processing,
			)
			.map((content) => content.contentId)
		if (pendingContentIds.length === 0) continue

		const next = pendingContentIds.reduce(
			(acc, contentId) =>
				updateImageContent(acc, contentId, {
					status: GenerationStatus.Terminated,
					errorMessage: undefined,
				}),
			element,
		)

		canvas.elementManager.update(
			elementId,
			{ contents: next.contents },
			{ silent: false, historyPolicy: "exclude" },
		)
		terminatedElementIds.push(elementId)
	}

	return terminatedElementIds
}
