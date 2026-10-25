import {
	createImageOrientationMetadata,
	parseJpegExifOrientation,
	type ImageOrientationMetadata,
} from "./imageOrientation"

export interface ImageHeaderDimensions {
	width: number
	height: number
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
const JPEG_HEADER_SCAN_INITIAL_BYTES = 64 * 1024
const JPEG_HEADER_SCAN_MAX_BYTES = 1024 * 1024

function hasBytes(view: DataView, offset: number, byteLength: number): boolean {
	return offset >= 0 && offset + byteLength <= view.byteLength
}

function isPositiveDimension(width: number, height: number): boolean {
	return Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0
}

function dimensionsOrNull(width: number, height: number): ImageHeaderDimensions | null {
	if (!isPositiveDimension(width, height)) return null
	return { width, height }
}

function matchesBytes(view: DataView, offset: number, bytes: readonly number[]): boolean {
	if (!hasBytes(view, offset, bytes.length)) return false
	return bytes.every((byte, index) => view.getUint8(offset + index) === byte)
}

function readUint24LittleEndian(view: DataView, offset: number): number {
	return (
		view.getUint8(offset) | (view.getUint8(offset + 1) << 8) | (view.getUint8(offset + 2) << 16)
	)
}

function parsePngDimensions(view: DataView): ImageHeaderDimensions | null {
	if (!matchesBytes(view, 0, PNG_SIGNATURE) || !hasBytes(view, 16, 8)) return null
	return dimensionsOrNull(view.getUint32(16, false), view.getUint32(20, false))
}

function parseGifDimensions(view: DataView): ImageHeaderDimensions | null {
	if (!hasBytes(view, 0, 10)) return null
	const signature = String.fromCharCode(
		view.getUint8(0),
		view.getUint8(1),
		view.getUint8(2),
		view.getUint8(3),
		view.getUint8(4),
		view.getUint8(5),
	)
	if (signature !== "GIF87a" && signature !== "GIF89a") return null
	return dimensionsOrNull(view.getUint16(6, true), view.getUint16(8, true))
}

function parseBmpDimensions(view: DataView): ImageHeaderDimensions | null {
	if (!hasBytes(view, 0, 26) || view.getUint8(0) !== 0x42 || view.getUint8(1) !== 0x4d) {
		return null
	}
	return dimensionsOrNull(view.getInt32(18, true), Math.abs(view.getInt32(22, true)))
}

function parseIcoDimensions(view: DataView): ImageHeaderDimensions | null {
	if (!hasBytes(view, 0, 8)) return null
	if (view.getUint16(0, true) !== 0) return null
	const type = view.getUint16(2, true)
	if (type !== 1 && type !== 2) return null
	if (view.getUint16(4, true) < 1) return null
	const width = view.getUint8(6) || 256
	const height = view.getUint8(7) || 256
	return dimensionsOrNull(width, height)
}

function parseVp8xDimensions(view: DataView, payloadOffset: number): ImageHeaderDimensions | null {
	if (!hasBytes(view, payloadOffset, 10)) return null
	const width = readUint24LittleEndian(view, payloadOffset + 4) + 1
	const height = readUint24LittleEndian(view, payloadOffset + 7) + 1
	return dimensionsOrNull(width, height)
}

function parseVp8Dimensions(view: DataView, payloadOffset: number): ImageHeaderDimensions | null {
	if (!hasBytes(view, payloadOffset, 10)) return null
	if (
		view.getUint8(payloadOffset + 3) !== 0x9d ||
		view.getUint8(payloadOffset + 4) !== 0x01 ||
		view.getUint8(payloadOffset + 5) !== 0x2a
	) {
		return null
	}
	const width = view.getUint16(payloadOffset + 6, true) & 0x3fff
	const height = view.getUint16(payloadOffset + 8, true) & 0x3fff
	return dimensionsOrNull(width, height)
}

function parseVp8lDimensions(view: DataView, payloadOffset: number): ImageHeaderDimensions | null {
	if (!hasBytes(view, payloadOffset, 5) || view.getUint8(payloadOffset) !== 0x2f) return null
	const bits =
		view.getUint8(payloadOffset + 1) |
		(view.getUint8(payloadOffset + 2) << 8) |
		(view.getUint8(payloadOffset + 3) << 16) |
		(view.getUint8(payloadOffset + 4) << 24)
	const width = (bits & 0x3fff) + 1
	const height = ((bits >>> 14) & 0x3fff) + 1
	return dimensionsOrNull(width, height)
}

function parseWebpDimensions(view: DataView): ImageHeaderDimensions | null {
	if (!hasBytes(view, 0, 20)) return null
	const riff = String.fromCharCode(
		view.getUint8(0),
		view.getUint8(1),
		view.getUint8(2),
		view.getUint8(3),
	)
	const webp = String.fromCharCode(
		view.getUint8(8),
		view.getUint8(9),
		view.getUint8(10),
		view.getUint8(11),
	)
	if (riff !== "RIFF" || webp !== "WEBP") return null

	let chunkOffset = 12
	while (hasBytes(view, chunkOffset, 8)) {
		const chunkType = String.fromCharCode(
			view.getUint8(chunkOffset),
			view.getUint8(chunkOffset + 1),
			view.getUint8(chunkOffset + 2),
			view.getUint8(chunkOffset + 3),
		)
		const chunkSize = view.getUint32(chunkOffset + 4, true)
		const payloadOffset = chunkOffset + 8
		if (!hasBytes(view, payloadOffset, chunkSize)) return null

		switch (chunkType) {
			case "VP8X":
				return parseVp8xDimensions(view, payloadOffset)
			case "VP8 ":
				return parseVp8Dimensions(view, payloadOffset)
			case "VP8L":
				return parseVp8lDimensions(view, payloadOffset)
			default:
				chunkOffset = payloadOffset + chunkSize + (chunkSize % 2)
		}
	}
	return null
}

const JPEG_SOF_MARKERS = new Set([
	0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
])

function isStandaloneJpegMarker(marker: number): boolean {
	return marker === 0x01 || (marker >= 0xd0 && marker <= 0xd9)
}

function parseJpegDimensions(view: DataView): ImageHeaderDimensions | null {
	if (!hasBytes(view, 0, 4) || view.getUint8(0) !== 0xff || view.getUint8(1) !== 0xd8) {
		return null
	}

	let offset = 2
	while (offset < view.byteLength) {
		while (offset < view.byteLength && view.getUint8(offset) !== 0xff) {
			offset += 1
		}
		while (offset < view.byteLength && view.getUint8(offset) === 0xff) {
			offset += 1
		}
		if (offset >= view.byteLength) return null

		const marker = view.getUint8(offset)
		offset += 1
		if (isStandaloneJpegMarker(marker)) continue
		if (!hasBytes(view, offset, 2)) return null

		const segmentLength = view.getUint16(offset, false)
		if (segmentLength < 2) return null
		const payloadOffset = offset + 2
		const payloadLength = segmentLength - 2
		if (!hasBytes(view, payloadOffset, payloadLength)) return null

		if (JPEG_SOF_MARKERS.has(marker)) {
			if (payloadLength < 5) return null
			return dimensionsOrNull(
				view.getUint16(payloadOffset + 3, false),
				view.getUint16(payloadOffset + 1, false),
			)
		}
		offset = payloadOffset + payloadLength
	}
	return null
}

export function parseImageDimensionsFromHeader(buffer: ArrayBuffer): ImageHeaderDimensions | null {
	const view = new DataView(buffer)
	return (
		parsePngDimensions(view) ??
		parseJpegDimensions(view) ??
		parseWebpDimensions(view) ??
		parseGifDimensions(view) ??
		parseBmpDimensions(view) ??
		parseIcoDimensions(view)
	)
}

export function parseImageMetadataFromHeader(buffer: ArrayBuffer): ImageOrientationMetadata | null {
	const view = new DataView(buffer)
	const jpegDimensions = parseJpegDimensions(view)
	if (jpegDimensions) {
		return createImageOrientationMetadata(
			jpegDimensions.width,
			jpegDimensions.height,
			parseJpegExifOrientation(buffer),
		)
	}
	const dimensions =
		parsePngDimensions(view) ??
		parseWebpDimensions(view) ??
		parseGifDimensions(view) ??
		parseBmpDimensions(view) ??
		parseIcoDimensions(view)
	if (!dimensions) return null
	return createImageOrientationMetadata(dimensions.width, dimensions.height)
}

function readBlobAsArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
	if (typeof blob.arrayBuffer === "function") {
		return blob.arrayBuffer()
	}
	return new Promise((resolve, reject) => {
		const reader = new FileReader()
		reader.onload = () => resolve(reader.result as ArrayBuffer)
		reader.onerror = reject
		reader.readAsArrayBuffer(blob)
	})
}

export async function parseImageDimensionsFromBlobHeader(
	blob: Blob,
): Promise<ImageHeaderDimensions | null> {
	if (blob.size <= 0) return null

	let bytesToRead = Math.min(blob.size, JPEG_HEADER_SCAN_INITIAL_BYTES)
	while (bytesToRead <= Math.min(blob.size, JPEG_HEADER_SCAN_MAX_BYTES)) {
		const dimensions = parseImageDimensionsFromHeader(
			await readBlobAsArrayBuffer(blob.slice(0, bytesToRead)),
		)
		if (dimensions) return dimensions
		if (bytesToRead >= blob.size || bytesToRead >= JPEG_HEADER_SCAN_MAX_BYTES) break
		bytesToRead = Math.min(blob.size, JPEG_HEADER_SCAN_MAX_BYTES, bytesToRead * 2)
	}
	return null
}

export async function parseImageMetadataFromBlobHeader(
	blob: Blob,
): Promise<ImageOrientationMetadata | null> {
	if (blob.size <= 0) return null

	let bytesToRead = Math.min(blob.size, JPEG_HEADER_SCAN_INITIAL_BYTES)
	while (bytesToRead <= Math.min(blob.size, JPEG_HEADER_SCAN_MAX_BYTES)) {
		const metadata = parseImageMetadataFromHeader(
			await readBlobAsArrayBuffer(blob.slice(0, bytesToRead)),
		)
		if (metadata) return metadata
		if (bytesToRead >= blob.size || bytesToRead >= JPEG_HEADER_SCAN_MAX_BYTES) break
		bytesToRead = Math.min(blob.size, JPEG_HEADER_SCAN_MAX_BYTES, bytesToRead * 2)
	}
	return null
}
