import type { ResourceLoadError } from "../api/options"
import type { PPTImageNode, PPTNode } from "../ir/node"
import { detectImageContentType, validateImageBlobResponse } from "../media/image-response"
import {
	mediaSourceDescriptorFromBytes,
	type MediaSourceDescriptor,
} from "../media/source-descriptor"
import { throwIfAborted } from "../sandbox/abort"

type ResourceErrorReporter = (error: ResourceLoadError) => void

/**
 * Normalize image payloads before the compatibility Blob exporter hands them to PptxGenJS.
 *
 * Some image CDNs keep a `.png` URL while applying a WebP transform in the response body. The
 * streaming enterprise worker detects and re-encodes that payload, but the legacy main-thread
 * route has no worker materialization phase. Read the payload here so a WebP can never be
 * packaged as `image/png`, which Windows PowerPoint rejects.
 */
export async function materializeLegacyPptImageNodes(
	nodes: PPTNode[],
	signal?: AbortSignal,
	onResourceError?: ResourceErrorReporter,
): Promise<void> {
	for (const node of nodes) {
		if (node.type !== "image" || !node.source) continue
		try {
			await materializeLegacyPptImageNode(node, signal)
		} catch (error) {
			onResourceError?.({
				url: node.assetKey?.slice(0, 200) || "image",
				kind: "image",
				reason: "load-error",
			})
			throw error
		}
	}
}

async function materializeLegacyPptImageNode(
	node: PPTImageNode,
	signal?: AbortSignal,
): Promise<void> {
	const source = node.source
	if (!source) throw new TypeError("Image node must provide a source descriptor")
	const blob = await loadLegacyImageBlob(source, signal)
	throwIfAborted(signal)
	const actualMime = detectImageContentType(
		new Uint8Array(await blob.slice(0, 512).arrayBuffer()),
	)
	if (!actualMime)
		throw new TypeError(`Unsupported image payload: ${node.assetKey || source.key}`)

	if (actualMime === "image/webp") {
		const png = await convertWebpToPng(blob, signal)
		node.source = mediaSourceDescriptorFromBytes({
			data: png,
			contentType: "image/png",
			extn: "png",
			key: node.assetKey || source.key,
		})
		return
	}

	const declaredMime = normalizeMime(source.contentType)
	const declaredExtn = source.extn.toLowerCase()
	const expectedExtn = extensionFromMime(actualMime)
	if (declaredMime !== actualMime || declaredExtn !== expectedExtn) {
		node.source = mediaSourceDescriptorFromBytes({
			data: await blob.arrayBuffer(),
			contentType: actualMime,
			extn: expectedExtn,
			key: node.assetKey || source.key,
		})
	}
}

async function loadLegacyImageBlob(
	source: MediaSourceDescriptor,
	signal?: AbortSignal,
): Promise<Blob> {
	throwIfAborted(signal)
	if (source.kind === "bytes") {
		return validateImageBlobResponse(
			new Blob([source.data], { type: source.contentType }),
			source.key,
			source.contentType,
		)
	}
	if (source.kind === "blob") {
		return validateImageBlobResponse(source.blob, source.key, source.contentType)
	}
	if (source.kind === "opfs") {
		throw new Error("OPFS image sources are not supported by the legacy exporter")
	}

	const url = source.kind === "url" ? source.url : source.path
	const response = await fetch(url, {
		credentials: "same-origin",
		mode: "cors",
		signal,
	})
	if (!response.ok) throw new Error(`Image fetch failed: ${response.status}`)
	return validateImageBlobResponse(
		await response.blob(),
		url,
		response.headers.get("content-type") || source.contentType,
		source.contentType,
	)
}

async function convertWebpToPng(blob: Blob, signal?: AbortSignal): Promise<ArrayBuffer> {
	throwIfAborted(signal)
	if (typeof createImageBitmap === "function") {
		const bitmap = await createImageBitmap(blob)
		try {
			const canvas = createCanvas(bitmap.width, bitmap.height)
			const context = canvas.getContext("2d") as
				| CanvasRenderingContext2D
				| OffscreenCanvasRenderingContext2D
				| null
			if (!context) throw new Error("Canvas 2D context is unavailable")
			context.drawImage(bitmap, 0, 0)
			return await canvasToPng(canvas, signal)
		} finally {
			bitmap.close()
		}
	}

	if (typeof document === "undefined" || typeof URL === "undefined") {
		throw new Error("WebP decoding is unavailable in this browser")
	}
	const url = URL.createObjectURL(blob)
	try {
		const image = await loadImage(url)
		const canvas = createCanvas(
			image.naturalWidth || image.width,
			image.naturalHeight || image.height,
		)
		const context = canvas.getContext("2d") as
			| CanvasRenderingContext2D
			| OffscreenCanvasRenderingContext2D
			| null
		if (!context) throw new Error("Canvas 2D context is unavailable")
		context.drawImage(image, 0, 0)
		return await canvasToPng(canvas, signal)
	} finally {
		URL.revokeObjectURL(url)
	}
}

function createCanvas(width: number, height: number): OffscreenCanvas | HTMLCanvasElement {
	if (typeof OffscreenCanvas === "function") return new OffscreenCanvas(width, height)
	if (typeof document !== "undefined") {
		const canvas = document.createElement("canvas")
		canvas.width = width
		canvas.height = height
		return canvas
	}
	throw new Error("Canvas is unavailable in this browser")
}

async function canvasToPng(
	canvas: OffscreenCanvas | HTMLCanvasElement,
	signal?: AbortSignal,
): Promise<ArrayBuffer> {
	throwIfAborted(signal)
	let blob: Blob
	if (typeof OffscreenCanvas !== "undefined" && canvas instanceof OffscreenCanvas) {
		blob = await canvas.convertToBlob({ type: "image/png" })
	} else {
		blob = await new Promise<Blob>((resolve, reject) => {
			;(canvas as HTMLCanvasElement).toBlob(
				(value: Blob | null) =>
					value ? resolve(value) : reject(new Error("Canvas encoding failed")),
				"image/png",
			)
		})
	}
	throwIfAborted(signal)
	return blob.arrayBuffer()
}

function loadImage(url: string): Promise<HTMLImageElement> {
	return new Promise((resolve, reject) => {
		const image = new Image()
		image.onload = () => resolve(image)
		image.onerror = () => reject(new Error("WebP image decoding failed"))
		image.src = url
	})
}

function normalizeMime(value: string): string {
	return value.split(";", 1)[0]?.trim().toLowerCase() || ""
}

function extensionFromMime(mime: string): string {
	switch (mime) {
		case "image/jpeg":
			return "jpg"
		case "image/png":
			return "png"
		case "image/gif":
			return "gif"
		case "image/svg+xml":
			return "svg"
		case "image/webp":
			return "webp"
		default:
			return "bin"
	}
}
