import type { DownloadActionOptions, UserAction } from "../types"
import { getSelectedFileElements, getSelectedImageElements } from "../../shared/ids"
import type { DownloadImageOptions, CanvasImageSourceDimensions } from "../../../public/magic-types"
import { getActiveContent, getActiveImageContent } from "../../document/elementContent"
import { ElementTypeEnum, type CanvasFileElement, type LayerElement } from "../../document/types"
import { getCanvasElementChildren } from "../../document/elementIndex"
import { containsReplacingMedia } from "../mediaReplacementGuards"

function hasReadyMediaSource(
	canvas: Parameters<NonNullable<UserAction["execute"]>>[0],
	fileElements: ReturnType<typeof getSelectedFileElements>,
): boolean {
	return fileElements.some((element) => {
		const effectiveContent =
			typeof canvas.getEffectiveContent === "function"
				? (canvas.getEffectiveContent(element.id) as { src?: string } | undefined)
				: element.type === "image"
					? getActiveImageContent(element)
					: getActiveContent(element)
		const src = effectiveContent?.src
		return typeof src === "string" && src.trim().length > 0
	})
}

function getContentViewElements(
	canvas: Parameters<NonNullable<UserAction["execute"]>>[0],
	elements: ReturnType<typeof getSelectedFileElements>,
) {
	return elements.map((element) =>
		typeof canvas.getElementForContentView === "function"
			? canvas.getElementForContentView(element)
			: element,
	)
}

async function getDownloadImageOptions(
	canvas: Parameters<NonNullable<UserAction["execute"]>>[0],
	imageElements = getSelectedImageElements(canvas),
): Promise<DownloadImageOptions | undefined> {
	const entries = await Promise.all(
		imageElements.map(async (imageElement) => {
			const src = (
				typeof canvas.getEffectiveContent === "function"
					? (canvas.getEffectiveContent(imageElement.id) as { src?: string } | undefined)
					: getActiveImageContent(imageElement)
			)?.src
			if (!imageElement.id || !src) return null

			const resource = await canvas.imageResourceManager
				.getResource(src, { variant: "preview" })
				.catch(() => null)
			const naturalWidth = resource?.imageInfo?.naturalWidth ?? 0
			const naturalHeight = resource?.imageInfo?.naturalHeight ?? 0

			if (naturalWidth <= 0 || naturalHeight <= 0) return null

			const sourceDimensions: CanvasImageSourceDimensions = {
				width: naturalWidth,
				height: naturalHeight,
			}

			return [imageElement.id, sourceDimensions] as const
		}),
	)

	const validEntries = entries.filter(
		(entry): entry is readonly [string, CanvasImageSourceDimensions] => entry !== null,
	)

	if (validEntries.length === 0) return undefined

	return {
		sourceDimensionsByElementId: Object.fromEntries(validEntries),
	}
}

function getFrameFileElements(
	canvas: Parameters<NonNullable<UserAction["execute"]>>[0],
): CanvasFileElement[] {
	const selectedIds = canvas.selectionManager.getSelectedIds()
	if (selectedIds.length !== 1) return []

	const frame = canvas.elementManager.getElementData(selectedIds[0])
	if (!frame || frame.type !== ElementTypeEnum.Frame) return []

	const fileElements: CanvasFileElement[] = []
	const visitedIds = new Set<string>()
	const visit = (element: LayerElement) => {
		if (
			(element.type === ElementTypeEnum.Image ||
				element.type === ElementTypeEnum.Video ||
				element.type === ElementTypeEnum.Audio) &&
			!visitedIds.has(element.id)
		) {
			visitedIds.add(element.id)
			fileElements.push(element)
		}

		getCanvasElementChildren(element)?.forEach(visit)
	}

	frame.children?.forEach(visit)
	return fileElements
}

/**
 * 下载操作相关的用户动作（Magic 特定）
 */
export const downloadActions: UserAction[] = [
	{
		id: "download.text",
		category: "download",
		canExecute: (canvas) => {
			if (!canvas.permissionManager.can("sideEffect.download")) return false
			const selectedIds = canvas.selectionManager.getSelectedIds()
			if (selectedIds.length !== 1) return false
			const element = canvas.elementManager.getElementData(selectedIds[0])
			return element?.type === ElementTypeEnum.Text
		},
		execute: async (canvas) => {
			if (!canvas.permissionManager.can("sideEffect.download")) return
			const selectedIds = canvas.selectionManager.getSelectedIds()
			if (selectedIds.length !== 1) return
			const element = canvas.elementManager.getElementData(selectedIds[0])
			if (element?.type !== ElementTypeEnum.Text) return
			await canvas.clipboardManager.downloadElementsAsPNG(selectedIds)
		},
	},
	{
		id: "download.image",
		category: "download",
		canExecute: (canvas) => {
			if (!canvas.permissionManager.canDownloadFiles()) return false
			const fileElements = getSelectedFileElements(canvas)
			if (fileElements.length === 0 || !hasReadyMediaSource(canvas, fileElements))
				return false
			if (containsReplacingMedia(canvas, fileElements)) return false
			const methods = canvas.magicConfigManager.config?.methods
			return !!methods?.downloadFiles
		},
		execute: async (canvas, actionOptions?: DownloadActionOptions) => {
			if (!canvas.permissionManager.canDownloadFiles()) return
			const fileElements = getSelectedFileElements(canvas)
			if (fileElements.length === 0 || !hasReadyMediaSource(canvas, fileElements)) return
			if (containsReplacingMedia(canvas, fileElements)) return
			const methods = canvas.magicConfigManager.config?.methods
			if (!methods?.downloadFiles) return
			const options = {
				...(await getDownloadImageOptions(canvas)),
				downloadMode: actionOptions?.downloadMode ?? "default",
			}
			await methods.downloadFiles(
				getContentViewElements(canvas, fileElements),
				false,
				false,
				options,
			)
		},
	},
	{
		id: "download.image-no-watermark",
		category: "download",
		canExecute: (canvas) => {
			if (!canvas.permissionManager.canDownloadFiles()) return false
			const fileElements = getSelectedFileElements(canvas)
			if (fileElements.length === 0 || !hasReadyMediaSource(canvas, fileElements))
				return false
			if (containsReplacingMedia(canvas, fileElements)) return false
			const imageElements = getSelectedImageElements(canvas)
			if (imageElements.length !== fileElements.length) return false
			const methods = canvas.magicConfigManager.config?.methods
			return !!methods?.downloadFiles
		},
		execute: async (canvas) => {
			if (!canvas.permissionManager.canDownloadFiles()) return
			const imageElements = getSelectedImageElements(canvas)
			if (imageElements.length === 0 || !hasReadyMediaSource(canvas, imageElements)) return
			if (containsReplacingMedia(canvas, imageElements)) return
			const fileElements = getSelectedFileElements(canvas)
			if (imageElements.length !== fileElements.length) return
			const methods = canvas.magicConfigManager.config?.methods
			if (!methods?.downloadFiles) return
			const options = await getDownloadImageOptions(canvas)
			await methods.downloadFiles(
				getContentViewElements(canvas, imageElements),
				true,
				false,
				options,
			)
		},
	},
	{
		id: "download.frame",
		category: "download",
		canExecute: (canvas) => {
			if (!canvas.permissionManager.canDownloadFiles()) return false
			const fileElements = getFrameFileElements(canvas)
			if (fileElements.length === 0 || !hasReadyMediaSource(canvas, fileElements))
				return false
			if (containsReplacingMedia(canvas, fileElements)) return false
			const methods = canvas.magicConfigManager.config?.methods
			return !!methods?.downloadFiles
		},
		execute: async (canvas, actionOptions?: DownloadActionOptions) => {
			if (!canvas.permissionManager.canDownloadFiles()) return
			const fileElements = getFrameFileElements(canvas)
			if (fileElements.length === 0 || !hasReadyMediaSource(canvas, fileElements)) return
			if (containsReplacingMedia(canvas, fileElements)) return
			const methods = canvas.magicConfigManager.config?.methods
			if (!methods?.downloadFiles) return

			const imageElements = fileElements.filter(
				(element) => element.type === ElementTypeEnum.Image,
			)
			const options = {
				...(await getDownloadImageOptions(canvas, imageElements)),
				downloadMode: actionOptions?.downloadMode ?? "default",
			}
			await methods.downloadFiles(
				getContentViewElements(canvas, fileElements),
				false,
				false,
				options,
			)
		},
	},
]
