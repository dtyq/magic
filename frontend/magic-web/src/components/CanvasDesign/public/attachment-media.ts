import type { CanvasAssetMediaType } from "./magic-types"

const CANVAS_ATTACHMENT_MEDIA_TYPES = new Set<CanvasAssetMediaType>(["image", "video", "audio"])

/** Whether an attachment media type can be represented by a Canvas media element. */
export function isCanvasAttachmentMediaType(value: unknown): value is CanvasAssetMediaType {
	return (
		typeof value === "string" &&
		CANVAS_ATTACHMENT_MEDIA_TYPES.has(value as CanvasAssetMediaType)
	)
}
