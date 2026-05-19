import type { UserAction } from "../types"
import { getLoadedFileElements, getLoadedImageElements } from "../../utils/utils"
import type { DownloadImageOptions, CanvasImageSourceDimensions } from "../../../types.magic"

async function getDownloadImageOptions(
	canvas: Parameters<NonNullable<UserAction["execute"]>>[0],
): Promise<DownloadImageOptions | undefined> {
	const imageElements = getLoadedImageElements(canvas)
	const entries = await Promise.all(
		imageElements.map(async (imageElement) => {
			if (!imageElement.id || !imageElement.src) return null

			const resource = await canvas.imageResourceManager
				.getResource(imageElement.src)
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

/**
 * 下载操作相关的用户动作（Magic 特定）
 */
export const downloadActions: UserAction[] = [
	{
		id: "download.image",
		category: "download",
		canExecute: (canvas) => {
			const fileElements = getLoadedFileElements(canvas)
			if (fileElements.length === 0) return false
			const methods = canvas.magicConfigManager.config?.methods
			return !!methods?.downloadFiles
		},
		execute: async (canvas) => {
			const fileElements = getLoadedFileElements(canvas)
			if (fileElements.length === 0) return
			const methods = canvas.magicConfigManager.config?.methods
			if (!methods?.downloadFiles) return
			const options = await getDownloadImageOptions(canvas)
			await methods.downloadFiles(fileElements, false, false, options)
		},
	},
	{
		id: "download.image-no-watermark",
		category: "download",
		canExecute: (canvas) => {
			const fileElements = getLoadedFileElements(canvas)
			if (fileElements.length === 0) return false
			const imageElements = getLoadedImageElements(canvas)
			if (imageElements.length !== fileElements.length) return false
			const methods = canvas.magicConfigManager.config?.methods
			return !!methods?.downloadFiles
		},
		execute: async (canvas) => {
			const imageElements = getLoadedImageElements(canvas)
			if (imageElements.length === 0) return
			const fileElements = getLoadedFileElements(canvas)
			if (imageElements.length !== fileElements.length) return
			const methods = canvas.magicConfigManager.config?.methods
			if (!methods?.downloadFiles) return
			const options = await getDownloadImageOptions(canvas)
			await methods.downloadFiles(imageElements, true, false, options)
		},
	},
]
