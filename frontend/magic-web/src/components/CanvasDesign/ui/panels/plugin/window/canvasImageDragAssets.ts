import type { Canvas } from "../../../../runtime/core/Canvas"
import { ElementTypeEnum, type ImageElement } from "../../../../runtime/document/types"
import { getActiveImageContent } from "../../../../runtime/document/elementContent"
import { pickPluginFiles, resolvePluginFileByPath } from "../assets/fileAssets"
import type { PluginFileAsset } from "./types"

const PNG_MIME_TYPE = "image/png"
const DRAG_RESOLVE_CONCURRENCY = 3

/** 根据画布图片名称生成插件侧上传时使用的 PNG 文件名 */
function getPngFilename(element: ImageElement): string {
	const name = element.name?.trim() || "canvas-image"
	const sanitized = name.replace(/[\\/:*?"<>|]+/g, "-")
	return sanitized.toLowerCase().endsWith(".png") ? sanitized : `${sanitized}.png`
}

function getEffectiveImageContent(canvas: Canvas, element: ImageElement) {
	return (
		(canvas.getEffectiveContent?.(element.id) as
			| ReturnType<typeof getActiveImageContent>
			| undefined) ?? getActiveImageContent(element)
	)
}

/** 判断图片在画布上是否存在需要重新渲染的视觉修改 */
function hasVisualImageModification(canvas: Canvas, element: ImageElement): boolean {
	return Boolean(getEffectiveImageContent(canvas, element).crop)
}

/** 获取画布图片元素的显示尺寸 */
function getCanvasImageDisplayDimensions(
	element: ImageElement,
): { width: number; height: number } | undefined {
	const width = element.width
	const height = element.height
	if (
		typeof width === "number" &&
		typeof height === "number" &&
		Number.isFinite(width) &&
		Number.isFinite(height) &&
		width > 0 &&
		height > 0
	) {
		return { width, height }
	}
	return undefined
}

/** 批量解析图片元素，使用并发控制 */
async function resolveInBatches<T>(
	items: T[],
	worker: (item: T) => Promise<PluginFileAsset>,
	concurrency: number,
): Promise<PluginFileAsset[]> {
	const results: PluginFileAsset[] = []
	for (let index = 0; index < items.length; index += concurrency) {
		const chunk = items.slice(index, index + concurrency)
		const resolvedChunk = await Promise.all(chunk.map(worker))
		results.push(...resolvedChunk)
	}
	return results
}

/**
 * 把图片元素按画布当前视觉效果导出成插件可识别的文件资产。
 *
 * 裁剪效果只存在于画布元素上，不能直接复用原始图片文件。
 */
async function exportImageElementAsAsset(
	canvas: Canvas,
	element: ImageElement,
): Promise<PluginFileAsset> {
	const exportResult = await canvas.clipboardManager.exportElementsAsPNGBlob([element.id], {
		preferOriginalSingleImage: false,
	})
	if (!exportResult) {
		throw new Error("Failed to export image element.")
	}

	const file = new File([exportResult.blob], exportResult.filename || getPngFilename(element), {
		type: PNG_MIME_TYPE,
	})
	const [asset] = await pickPluginFiles(canvas, [file], { type: "image", maxCount: 1 })
	if (!asset) {
		throw new Error("Failed to upload exported image.")
	}
	const displayDimensions = getCanvasImageDisplayDimensions(element)
	return {
		...asset,
		width: displayDimensions?.width ?? asset.width,
		height: displayDimensions?.height ?? asset.height,
		// 重新导出的 PNG 已经是新文件，仍要保留原始画布元素 id 用于后续贴源放置。
		sourceElementId: element.id,
	}
}

/**
 * 将画布图片元素解析为插件文件资产。
 * 未被裁剪的图片直接复用原始资源；存在裁剪时重新导出 PNG，
 * 保证插件拿到的是用户当前在画布上看到的结果。
 */
async function resolveImageElementAsAsset(
	canvas: Canvas,
	element: ImageElement,
): Promise<PluginFileAsset> {
	const active = getEffectiveImageContent(canvas, element)
	if (!active.src) {
		throw new Error("Image element source is empty.")
	}

	if (hasVisualImageModification(canvas, element)) {
		return exportImageElementAsAsset(canvas, element)
	}

	const displayDimensions = getCanvasImageDisplayDimensions(element)
	const asset = await resolvePluginFileByPath(canvas, active.src, {
		type: "image",
		fileName: element.name,
		skipImageDimensions: true,
	})
	return {
		...asset,
		width: displayDimensions?.width ?? asset.width,
		height: displayDimensions?.height ?? asset.height,
		// 即使直接复用原图资源，也要带上来源元素 id，避免只靠 src 匹配时丢失画布位置。
		sourceElementId: element.id,
	}
}

/** 批量解析外部拖拽中的图片元素，非图片元素会直接视为非法拖拽数据 */
export async function resolveCanvasImageDragAssets(
	canvas: Canvas,
	elementIds: string[],
): Promise<PluginFileAsset[]> {
	const elements = elementIds.map((elementId) => canvas.elementManager.getElementData(elementId))
	const imageElements = elements.filter(
		(element): element is ImageElement =>
			Boolean(element) &&
			element?.type === ElementTypeEnum.Image &&
			Boolean(getEffectiveImageContent(canvas, element).src),
	)

	if (imageElements.length !== elementIds.length) {
		throw new Error("Only image elements can be dropped into plugins.")
	}

	// return Promise.all(imageElements.map((element) => resolveImageElementAsAsset(canvas, element)))
	return resolveInBatches(
		imageElements,
		(element) => resolveImageElementAsAsset(canvas, element),
		DRAG_RESOLVE_CONCURRENCY,
	)
}
