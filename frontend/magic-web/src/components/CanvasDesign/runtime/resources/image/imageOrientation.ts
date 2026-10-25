export type ImageExifOrientation = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8

export interface OrientedImageDimensions {
	width: number
	height: number
}

export interface ImageOrientationMetadata extends OrientedImageDimensions {
	orientation: ImageExifOrientation
	encodedWidth: number
	encodedHeight: number
}

export const DEFAULT_IMAGE_EXIF_ORIENTATION: ImageExifOrientation = 1

const JPEG_HEADER_SCAN_INITIAL_BYTES = 64 * 1024
const JPEG_HEADER_SCAN_MAX_BYTES = 1024 * 1024

interface JpegExifOrientationEntry {
	orientation: ImageExifOrientation
	valueOffset: number
	littleEndian: boolean
}

function isValidOrientation(value: number): value is ImageExifOrientation {
	return Number.isInteger(value) && value >= 1 && value <= 8
}

export function normalizeImageExifOrientation(value: number | undefined): ImageExifOrientation {
	return value !== undefined && isValidOrientation(value) ? value : DEFAULT_IMAGE_EXIF_ORIENTATION
}

export function getOrientedImageDimensions(
	encodedWidth: number,
	encodedHeight: number,
	orientation: ImageExifOrientation = DEFAULT_IMAGE_EXIF_ORIENTATION,
): OrientedImageDimensions {
	const normalizedOrientation = normalizeImageExifOrientation(orientation)
	const swapsDimensions = normalizedOrientation >= 5 && normalizedOrientation <= 8
	return swapsDimensions
		? { width: encodedHeight, height: encodedWidth }
		: { width: encodedWidth, height: encodedHeight }
}

export function createImageOrientationMetadata(
	encodedWidth: number,
	encodedHeight: number,
	orientation?: number,
): ImageOrientationMetadata {
	const normalizedOrientation = normalizeImageExifOrientation(orientation)
	const oriented = getOrientedImageDimensions(encodedWidth, encodedHeight, normalizedOrientation)
	return {
		...oriented,
		orientation: normalizedOrientation,
		encodedWidth,
		encodedHeight,
	}
}

/**
 * JPEG/HEIC 转出的 JPEG 可能携带 EXIF Orientation。ImageBitmap 与 Canvas
 * 的统一入口都使用这个选项，使解码结果直接处于画布展示坐标系。
 */
export const IMAGE_BITMAP_ORIENTATION_OPTIONS: ImageBitmapOptions = {
	imageOrientation: "from-image",
}

interface ImageOrientationTransformContext {
	transform(a: number, b: number, c: number, d: number, e: number, f: number): void
}

export function applyImageExifOrientationTransform(
	context: ImageOrientationTransformContext,
	orientation: ImageExifOrientation,
	encodedWidth: number,
	encodedHeight: number,
): void {
	switch (normalizeImageExifOrientation(orientation)) {
		case 2:
			context.transform(-1, 0, 0, 1, encodedWidth, 0)
			break
		case 3:
			context.transform(-1, 0, 0, -1, encodedWidth, encodedHeight)
			break
		case 4:
			context.transform(1, 0, 0, -1, 0, encodedHeight)
			break
		case 5:
			context.transform(0, 1, 1, 0, 0, 0)
			break
		case 6:
			context.transform(0, 1, -1, 0, encodedHeight, 0)
			break
		case 7:
			context.transform(0, -1, -1, 0, encodedHeight, encodedWidth)
			break
		case 8:
			context.transform(0, -1, 1, 0, 0, encodedWidth)
			break
		default:
			break
	}
}

function hasBytes(view: DataView, offset: number, length: number): boolean {
	return offset >= 0 && length >= 0 && offset + length <= view.byteLength
}

function readUint16(view: DataView, offset: number, littleEndian: boolean): number | null {
	return hasBytes(view, offset, 2) ? view.getUint16(offset, littleEndian) : null
}

function readUint32(view: DataView, offset: number, littleEndian: boolean): number | null {
	return hasBytes(view, offset, 4) ? view.getUint32(offset, littleEndian) : null
}

function readBlobAsArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
	if (typeof blob.arrayBuffer === "function") return blob.arrayBuffer()
	return new Promise((resolve, reject) => {
		const reader = new FileReader()
		reader.onload = () => resolve(reader.result as ArrayBuffer)
		reader.onerror = reject
		reader.readAsArrayBuffer(blob)
	})
}

function findJpegExifOrientationEntry(buffer: ArrayBuffer): JpegExifOrientationEntry | null {
	const view = new DataView(buffer)
	if (!hasBytes(view, 0, 4) || view.getUint16(0, false) !== 0xffd8) {
		return null
	}

	let offset = 2
	while (hasBytes(view, offset, 2)) {
		while (hasBytes(view, offset, 1) && view.getUint8(offset) !== 0xff) offset += 1
		while (hasBytes(view, offset, 1) && view.getUint8(offset) === 0xff) offset += 1
		if (!hasBytes(view, offset, 1)) break

		const marker = view.getUint8(offset)
		offset += 1
		if (marker === 0xda || marker === 0xd9) break
		if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue
		const segmentLength = readUint16(view, offset, false)
		if (segmentLength === null || segmentLength < 2) break
		const payloadOffset = offset + 2
		const payloadLength = segmentLength - 2
		if (!hasBytes(view, payloadOffset, payloadLength)) break

		if (
			marker === 0xe1 &&
			payloadLength >= 8 &&
			view.getUint8(payloadOffset) === 0x45 &&
			view.getUint8(payloadOffset + 1) === 0x78 &&
			view.getUint8(payloadOffset + 2) === 0x69 &&
			view.getUint8(payloadOffset + 3) === 0x66 &&
			view.getUint8(payloadOffset + 4) === 0x00 &&
			view.getUint8(payloadOffset + 5) === 0x00
		) {
			const tiffOffset = payloadOffset + 6
			if (!hasBytes(view, tiffOffset, 8)) return null
			const byteOrder = view.getUint16(tiffOffset, false)
			const littleEndian = byteOrder === 0x4949
			if (!littleEndian && byteOrder !== 0x4d4d) return null
			if (readUint16(view, tiffOffset + 2, littleEndian) !== 42) {
				return null
			}
			const ifdOffset = readUint32(view, tiffOffset + 4, littleEndian)
			if (ifdOffset === null) return null
			const ifd = tiffOffset + ifdOffset
			const entryCount = readUint16(view, ifd, littleEndian)
			if (entryCount === null) return null
			for (let index = 0; index < entryCount; index += 1) {
				const entry = ifd + 2 + index * 12
				if (!hasBytes(view, entry, 12)) return null
				if (readUint16(view, entry, littleEndian) !== 0x0112) continue
				if (readUint16(view, entry + 2, littleEndian) !== 3) {
					return null
				}
				if (readUint32(view, entry + 4, littleEndian) !== 1) {
					return null
				}
				const value = readUint16(view, entry + 8, littleEndian)
				if (value === null || !isValidOrientation(value)) return null
				return {
					orientation: value,
					valueOffset: entry + 8,
					littleEndian,
				}
			}
		}

		offset = payloadOffset + payloadLength
	}

	return null
}

/**
 * 从 JPEG APP1/Exif/TIFF IFD 中读取 Orientation。所有异常输入均按 1 处理。
 */
export function parseJpegExifOrientation(buffer: ArrayBuffer): ImageExifOrientation {
	return findJpegExifOrientationEntry(buffer)?.orientation ?? DEFAULT_IMAGE_EXIF_ORIENTATION
}

/**
 * 只复制 JPEG 头部并将 Exif Orientation 改为 1，像素数据仍通过 Blob slice 复用。
 * 这让 resized decode 先在编码坐标系缩小，再由 Canvas 确定性地应用方向，
 * 避免为了生成 low/preview 先解码整张大图。
 */
export async function createJpegBlobWithNeutralizedExifOrientation(
	blob: Blob,
): Promise<Blob | null> {
	if (blob.size <= 0) return null

	let bytesToRead = Math.min(blob.size, JPEG_HEADER_SCAN_INITIAL_BYTES)
	while (bytesToRead <= Math.min(blob.size, JPEG_HEADER_SCAN_MAX_BYTES)) {
		const header = await readBlobAsArrayBuffer(blob.slice(0, bytesToRead))
		const entry = findJpegExifOrientationEntry(header)
		if (entry) {
			if (entry.orientation === DEFAULT_IMAGE_EXIF_ORIENTATION) return blob
			const patchedHeader = header.slice(0)
			new DataView(patchedHeader).setUint16(
				entry.valueOffset,
				DEFAULT_IMAGE_EXIF_ORIENTATION,
				entry.littleEndian,
			)
			return new Blob([patchedHeader, blob.slice(bytesToRead)], { type: blob.type })
		}
		if (bytesToRead >= blob.size || bytesToRead >= JPEG_HEADER_SCAN_MAX_BYTES) break
		bytesToRead = Math.min(blob.size, JPEG_HEADER_SCAN_MAX_BYTES, bytesToRead * 2)
	}

	return null
}
