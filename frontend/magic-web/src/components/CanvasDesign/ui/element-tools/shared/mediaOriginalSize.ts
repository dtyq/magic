import type { Canvas } from "../../../runtime/core/Canvas"
import { ElementTypeEnum } from "../../../runtime/document/types"

export type MediaElementType = typeof ElementTypeEnum.Image | typeof ElementTypeEnum.Video

export interface MediaDimensions {
	width: number
	height: number
}

export async function getMediaDimensions(
	canvas: Canvas,
	mediaType: MediaElementType,
	src: string,
): Promise<MediaDimensions | null> {
	const resource =
		mediaType === ElementTypeEnum.Image
			? await canvas.imageResourceManager.getResource(src, { variant: "preview" })
			: await canvas.videoResourceManager.getPreviewResource(src)
	const width =
		mediaType === ElementTypeEnum.Image
			? (resource?.imageInfo?.naturalWidth ?? 0)
			: (resource?.metadata?.videoWidth ?? 0)
	const height =
		mediaType === ElementTypeEnum.Image
			? (resource?.imageInfo?.naturalHeight ?? 0)
			: (resource?.metadata?.videoHeight ?? 0)
	return width > 0 && height > 0 ? { width, height } : null
}

export function calculateMediaOriginalSize(
	elementWidth: number,
	elementHeight: number,
	mediaWidth: number,
	mediaHeight: number,
): MediaDimensions | null {
	const longestEdge = Math.max(elementWidth, elementHeight)
	if (longestEdge <= 0 || mediaWidth <= 0 || mediaHeight <= 0) return null

	if (mediaWidth >= mediaHeight) {
		return {
			width: longestEdge,
			height: Math.max(1, Math.round((longestEdge * mediaHeight) / mediaWidth)),
		}
	}
	return {
		width: Math.max(1, Math.round((longestEdge * mediaWidth) / mediaHeight)),
		height: longestEdge,
	}
}
