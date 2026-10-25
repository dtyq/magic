import {
	ElementTypeEnum,
	type ImageElement as ImageElementData,
	type ImageElementContent,
} from "../../document/types"
import type { Canvas } from "../../core/Canvas"
import { ImageBatchPollingManager } from "./ImageBatchPollingManager"
import { isBatchImageGenerationTaskMeta } from "../image/imageGenerationTaskMeta"
import { shouldContinueGenerationPolling } from "./generationPollingUtils"
import { collectElementsByType } from "../../shared/ids"
import { getImageContents } from "../../document/elementContent"

interface BatchPollingGroup {
	imageId: string
	items: Array<{ elementId: string; outputIndex: number; contentId: string }>
}

export function resumeImageBatchPollingManagers(canvas: Canvas): void {
	const imageElements = collectElementsByType(
		canvas.elementManager.getAllElements(),
		ElementTypeEnum.Image,
	) as ImageElementData[]
	const groups = new Map<string, BatchPollingGroup>()
	const seenTaskKeys = new Set<string>()

	imageElements.forEach((element) => {
		// Batch submissions can live in a non-active Content while the user views another result.
		// Restore every Content so those tasks retain a polling owner after document hydration.
		getImageContents(element).forEach((content) => {
			if (!shouldResumeBatchPolling(content)) return

			const meta = content.imageGenerationTaskMeta
			if (!isBatchImageGenerationTaskMeta(meta)) return

			const taskKey = `${meta.image_id}:${meta.output_index}`
			if (seenTaskKeys.has(taskKey)) return
			seenTaskKeys.add(taskKey)

			const group =
				groups.get(meta.image_id) ??
				({
					imageId: meta.image_id,
					items: [],
				} satisfies BatchPollingGroup)

			group.items.push({
				elementId: element.id,
				outputIndex: meta.output_index,
				contentId: content.contentId,
			})
			groups.set(meta.image_id, group)
		})
	})

	groups.forEach((group) => {
		const orderedItems = group.items.slice().sort((a, b) => a.outputIndex - b.outputIndex)
		if (orderedItems.length === 0) return

		const elementIds = orderedItems.map((item) => item.elementId)
		const outputIndexes = orderedItems.map((item) => item.outputIndex)
		const contentIds = orderedItems.map((item) => item.contentId)

		const activeManager = canvas.imageBatchPollingRegistry.get(group.imageId)
		// 如果已经存在轮询管理器，则同步元素 ID 和输出索引
		if (activeManager) {
			activeManager.syncElementIds(elementIds, outputIndexes, contentIds)
			return
		}

		const batchPollingManager = new ImageBatchPollingManager({
			canvas,
			imageId: group.imageId,
			elementIds,
			outputIndexes,
			contentIds,
			registry: canvas.imageBatchPollingRegistry,
		})
		void batchPollingManager.start()
	})
}

function shouldResumeBatchPolling(content: ImageElementContent): boolean {
	if (content.src) return false
	if (content.status !== undefined && !shouldContinueGenerationPolling(content.status)) {
		return false
	}

	return true
}
