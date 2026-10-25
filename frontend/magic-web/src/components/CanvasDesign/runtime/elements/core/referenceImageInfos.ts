import type { UploadFileResponse } from "../../../public/magic-types"
import type { Canvas } from "../../core/Canvas"
import { getCanvasHostResourceReferenceIdentity } from "../../shared/path/canvasResourcePath"

function getReferenceIdentity(canvas: Canvas, info: Pick<UploadFileResponse, "path">): string {
	return getCanvasHostResourceReferenceIdentity(canvas, info.path)
}

export function appendReferenceImageInfos(
	canvas: Canvas,
	current: readonly UploadFileResponse[],
	incoming: readonly UploadFileResponse[],
): UploadFileResponse[] {
	const identities = new Set(current.map((info) => getReferenceIdentity(canvas, info)))
	const next = [...current]

	for (const info of incoming) {
		const identity = getReferenceIdentity(canvas, info)
		if (identities.has(identity)) continue
		identities.add(identity)
		canvas.imageResourceManager.loadResource(info.path)
		next.push(info)
	}

	return next
}

export function replaceReferenceImageInfos(
	canvas: Canvas,
	incoming: readonly UploadFileResponse[],
): UploadFileResponse[] {
	return appendReferenceImageInfos(canvas, [], incoming)
}

export function removeReferenceImageInfosByPath(
	canvas: Canvas,
	current: readonly UploadFileResponse[],
	path: string,
): UploadFileResponse[] {
	const removedIdentity = getCanvasHostResourceReferenceIdentity(canvas, path)
	return current.filter((info) => getReferenceIdentity(canvas, info) !== removedIdentity)
}
