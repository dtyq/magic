import { afterEach, describe, expect, it, vi } from "vitest"
import {
	parseImageDimensionsFromBlobHeader,
	parseImageDimensionsFromHeader,
	parseImageMetadataFromBlobHeader,
	parseImageMetadataFromHeader,
} from "../image/imageHeaderDimensions"
import {
	applyImageExifOrientationTransform,
	getOrientedImageDimensions,
} from "../image/imageOrientation"
import { createOrientedImageBitmapFromBlob } from "../image/imageSourceUtils"

function toArrayBuffer(bytes: number[]): ArrayBuffer {
	const array = new Uint8Array(bytes)
	return array.buffer.slice(array.byteOffset, array.byteOffset + array.byteLength)
}

function ascii(value: string): number[] {
	return Array.from(value).map((char) => char.charCodeAt(0))
}

function uint16be(value: number): number[] {
	return [(value >> 8) & 0xff, value & 0xff]
}

function uint16le(value: number): number[] {
	return [value & 0xff, (value >> 8) & 0xff]
}

function uint24le(value: number): number[] {
	return [value & 0xff, (value >> 8) & 0xff, (value >> 16) & 0xff]
}

function uint32be(value: number): number[] {
	return [(value >> 24) & 0xff, (value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff]
}

function uint32le(value: number): number[] {
	return [value & 0xff, (value >> 8) & 0xff, (value >> 16) & 0xff, (value >> 24) & 0xff]
}

function createJpegWithExifOrientation(orientation: number, littleEndian = true): number[] {
	const uint16 = littleEndian ? uint16le : uint16be
	const uint32 = littleEndian ? uint32le : uint32be
	const exifPayload = [
		...ascii("Exif\0\0"),
		...ascii(littleEndian ? "II" : "MM"),
		...uint16(42),
		...uint32(8),
		...uint16(1),
		...uint16(0x0112),
		...uint16(3),
		...uint32(1),
		...uint16(orientation),
		0,
		0,
		0,
	]
	const sofPayload = [
		0x08,
		...uint16be(4284),
		...uint16be(5712),
		0x03,
		0x01,
		0x11,
		0x00,
		0x02,
		0x11,
		0x00,
		0x03,
		0x11,
		0x00,
	]
	return [
		0xff,
		0xd8,
		0xff,
		0xe1,
		...uint16be(exifPayload.length + 2),
		...exifPayload,
		0xff,
		0xc0,
		...uint16be(sofPayload.length + 2),
		...sofPayload,
	]
}

describe("image header dimension parsing", () => {
	afterEach(() => {
		vi.restoreAllMocks()
		vi.unstubAllGlobals()
	})
	it("reads PNG dimensions from IHDR without decoding pixels", () => {
		const png = [
			0x89,
			0x50,
			0x4e,
			0x47,
			0x0d,
			0x0a,
			0x1a,
			0x0a,
			...uint32be(13),
			...ascii("IHDR"),
			...uint32be(640),
			...uint32be(360),
		]

		expect(parseImageDimensionsFromHeader(toArrayBuffer(png))).toEqual({
			width: 640,
			height: 360,
		})
	})

	it("reads JPEG dimensions from SOF markers after metadata segments", () => {
		const app0Payload = new Array(14).fill(0)
		const jpeg = [
			0xff,
			0xd8,
			0xff,
			0xe0,
			...uint16be(16),
			...app0Payload,
			0xff,
			0xc0,
			...uint16be(17),
			0x08,
			...uint16be(768),
			...uint16be(1024),
			0x03,
			0x01,
			0x11,
			0x00,
			0x02,
			0x11,
			0x00,
			0x03,
			0x11,
			0x00,
		]

		expect(parseImageDimensionsFromHeader(toArrayBuffer(jpeg))).toEqual({
			width: 1024,
			height: 768,
		})
	})

	it("applies JPEG Exif orientation to the display dimensions", () => {
		const jpeg = toArrayBuffer(createJpegWithExifOrientation(6))
		const metadata = parseImageMetadataFromHeader(jpeg)

		expect(metadata).toEqual({
			width: 4284,
			height: 5712,
			orientation: 6,
			encodedWidth: 5712,
			encodedHeight: 4284,
		})
		expect(parseImageDimensionsFromHeader(jpeg)).toEqual({
			width: 5712,
			height: 4284,
		})
	})

	it("parses big-endian TIFF orientation", () => {
		expect(
			parseImageMetadataFromHeader(toArrayBuffer(createJpegWithExifOrientation(8, false))),
		).toEqual({
			width: 4284,
			height: 5712,
			orientation: 8,
			encodedWidth: 5712,
			encodedHeight: 4284,
		})
	})

	it.each([
		[2, 5712, 4284, [-1, 0, 0, 1, 5712, 0]],
		[3, 5712, 4284, [-1, 0, 0, -1, 5712, 4284]],
		[4, 5712, 4284, [1, 0, 0, -1, 0, 4284]],
		[6, 4284, 5712, [0, 1, -1, 0, 4284, 0]],
	] as const)(
		"normalizes unresized Orientation %s independently of decoder behavior",
		async (orientation, displayWidth, displayHeight, expectedTransform) => {
			const close = vi.fn()
			const rawBitmap = { width: 5712, height: 4284, close } as unknown as ImageBitmap
			const normalizedBitmap = {
				width: displayWidth,
				height: displayHeight,
				close: vi.fn(),
			} as unknown as ImageBitmap
			const createBitmap = vi
				.fn()
				.mockResolvedValueOnce(rawBitmap)
				.mockResolvedValueOnce(normalizedBitmap)
			vi.stubGlobal("createImageBitmap", createBitmap)
			const transform = vi.fn()
			const drawImage = vi.fn()
			vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
				transform,
				drawImage,
			} as unknown as CanvasRenderingContext2D)

			const sourceBlob = new Blob(
				[toArrayBuffer(createJpegWithExifOrientation(orientation))],
				{ type: "image/jpeg" },
			)
			await expect(createOrientedImageBitmapFromBlob(sourceBlob)).resolves.toBe(
				normalizedBitmap,
			)
			const decodedBlob = createBitmap.mock.calls[0][0] as Blob
			expect(decodedBlob).not.toBe(sourceBlob)
			await expect(parseImageMetadataFromBlobHeader(decodedBlob)).resolves.toMatchObject({
				orientation: 1,
			})
			expect(createBitmap).toHaveBeenNthCalledWith(1, decodedBlob, {
				imageOrientation: "from-image",
			})
			expect(transform).toHaveBeenCalledWith(...expectedTransform)
			expect(drawImage).toHaveBeenCalledWith(rawBitmap, 0, 0)
			expect(close).toHaveBeenCalledTimes(1)
		},
	)

	it.each([
		[2, 384, 288, 384, 288, [-1, 0, 0, 1, 384, 0]],
		[3, 384, 288, 384, 288, [-1, 0, 0, -1, 384, 288]],
		[4, 384, 288, 384, 288, [1, 0, 0, -1, 0, 288]],
		[5, 288, 384, 384, 288, [0, 1, 1, 0, 0, 0]],
		[6, 288, 384, 384, 288, [0, 1, -1, 0, 288, 0]],
		[7, 288, 384, 384, 288, [0, -1, -1, 0, 288, 384]],
		[8, 288, 384, 384, 288, [0, -1, 1, 0, 0, 384]],
	] as const)(
		"normalizes resized Orientation %s without decoding the full image",
		async (
			orientation,
			displayWidth,
			displayHeight,
			encodedWidth,
			encodedHeight,
			expectedTransform,
		) => {
			const rawBitmap = {
				width: encodedWidth,
				height: encodedHeight,
				close: vi.fn(),
			} as unknown as ImageBitmap
			const normalizedBitmap = {
				width: displayWidth,
				height: displayHeight,
				close: vi.fn(),
			} as unknown as ImageBitmap
			const createBitmap = vi
				.fn()
				.mockResolvedValueOnce(rawBitmap)
				.mockResolvedValueOnce(normalizedBitmap)
			vi.stubGlobal("createImageBitmap", createBitmap)
			const transform = vi.fn()
			const drawImage = vi.fn()
			vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
				transform,
				drawImage,
			} as unknown as CanvasRenderingContext2D)

			const sourceBlob = new Blob(
				[toArrayBuffer(createJpegWithExifOrientation(orientation, orientation !== 8))],
				{ type: "image/jpeg" },
			)
			await expect(
				createOrientedImageBitmapFromBlob(sourceBlob, {
					resizeWidth: displayWidth,
					resizeHeight: displayHeight,
					resizeQuality: "high",
				}),
			).resolves.toBe(normalizedBitmap)

			const decodedBlob = createBitmap.mock.calls[0][0] as Blob
			const decodeOptions = createBitmap.mock.calls[0][1]
			const orientationCanvas = createBitmap.mock.calls[1][0] as HTMLCanvasElement
			expect(decodedBlob).not.toBe(sourceBlob)
			await expect(parseImageMetadataFromBlobHeader(decodedBlob)).resolves.toMatchObject({
				orientation: 1,
			})
			expect(decodeOptions).toEqual({
				resizeWidth: encodedWidth,
				resizeHeight: encodedHeight,
				resizeQuality: "high",
				imageOrientation: "from-image",
			})
			expect(orientationCanvas.width).toBe(displayWidth)
			expect(orientationCanvas.height).toBe(displayHeight)
			expect(transform).toHaveBeenCalledWith(...expectedTransform)
			expect(drawImage).toHaveBeenCalledWith(rawBitmap, 0, 0)
			expect(rawBitmap.close).toHaveBeenCalledTimes(1)
		},
	)

	it("maps a display-only resizeWidth into encoded coordinates", async () => {
		const rawBitmap = { width: 384, height: 288, close: vi.fn() } as unknown as ImageBitmap
		const normalizedBitmap = {
			width: 288,
			height: 384,
			close: vi.fn(),
		} as unknown as ImageBitmap
		const createBitmap = vi
			.fn()
			.mockResolvedValueOnce(rawBitmap)
			.mockResolvedValueOnce(normalizedBitmap)
		vi.stubGlobal("createImageBitmap", createBitmap)
		vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
			transform: vi.fn(),
			drawImage: vi.fn(),
		} as unknown as CanvasRenderingContext2D)

		const blob = new Blob([toArrayBuffer(createJpegWithExifOrientation(6))], {
			type: "image/jpeg",
		})
		await createOrientedImageBitmapFromBlob(blob, {
			resizeWidth: 288,
			resizeQuality: "high",
		})

		expect(createBitmap.mock.calls[0][1]).toEqual({
			resizeWidth: 384,
			resizeHeight: 288,
			resizeQuality: "high",
			imageOrientation: "from-image",
		})
	})

	it("keeps Orientation 1 on the direct resized decode path", async () => {
		const bitmap = { width: 384, height: 288, close: vi.fn() } as unknown as ImageBitmap
		const createBitmap = vi.fn().mockResolvedValue(bitmap)
		vi.stubGlobal("createImageBitmap", createBitmap)
		const blob = new Blob([toArrayBuffer(createJpegWithExifOrientation(1))], {
			type: "image/jpeg",
		})

		await expect(
			createOrientedImageBitmapFromBlob(blob, {
				resizeWidth: 384,
				resizeHeight: 288,
			}),
		).resolves.toBe(bitmap)
		expect(createBitmap).toHaveBeenCalledOnce()
		expect(createBitmap).toHaveBeenCalledWith(blob, {
			resizeWidth: 384,
			resizeHeight: 288,
			imageOrientation: "from-image",
		})
	})

	it.each([
		[1, { width: 5712, height: 4284 }],
		[2, { width: 5712, height: 4284 }],
		[3, { width: 5712, height: 4284 }],
		[4, { width: 5712, height: 4284 }],
		[5, { width: 4284, height: 5712 }],
		[6, { width: 4284, height: 5712 }],
		[7, { width: 4284, height: 5712 }],
		[8, { width: 4284, height: 5712 }],
	] as const)("computes display dimensions for Orientation %s", (orientation, expected) => {
		expect(getOrientedImageDimensions(5712, 4284, orientation)).toEqual(expected)
	})

	it.each([
		[2, [-1, 0, 0, 1, 5712, 0]],
		[3, [-1, 0, 0, -1, 5712, 4284]],
		[4, [1, 0, 0, -1, 0, 4284]],
		[5, [0, 1, 1, 0, 0, 0]],
		[6, [0, 1, -1, 0, 4284, 0]],
		[7, [0, -1, -1, 0, 4284, 5712]],
		[8, [0, -1, 1, 0, 0, 5712]],
	] as const)("preserves the transform for mirrored Orientation %s", (orientation, expected) => {
		const calls: number[][] = []
		applyImageExifOrientationTransform(
			{ transform: (...args) => calls.push(args) },
			orientation,
			5712,
			4284,
		)
		expect(calls).toEqual([expected])
	})

	it("keeps all eight Exif orientations valid and defaults malformed metadata", () => {
		for (const orientation of [1, 2, 3, 4, 5, 6, 7, 8]) {
			const metadata = parseImageMetadataFromHeader(
				toArrayBuffer(createJpegWithExifOrientation(orientation)),
			)
			expect(metadata?.orientation).toBe(orientation)
		}

		const malformed = createJpegWithExifOrientation(9)
		expect(parseImageMetadataFromHeader(toArrayBuffer(malformed))?.orientation).toBe(1)
	})

	it("reads WebP VP8X dimensions from RIFF chunks", () => {
		const width = 1200
		const height = 675
		const webp = [
			...ascii("RIFF"),
			...uint32le(30),
			...ascii("WEBP"),
			...ascii("VP8X"),
			...uint32le(10),
			0x00,
			0x00,
			0x00,
			0x00,
			...uint24le(width - 1),
			...uint24le(height - 1),
		]

		expect(parseImageDimensionsFromHeader(toArrayBuffer(webp))).toEqual({
			width,
			height,
		})
	})

	it("reads GIF dimensions and returns null for unknown headers", async () => {
		const gif = [...ascii("GIF89a"), ...uint16le(320), ...uint16le(200)]

		await expect(
			parseImageDimensionsFromBlobHeader(
				new Blob([toArrayBuffer(gif)], { type: "image/gif" }),
			),
		).resolves.toEqual({
			width: 320,
			height: 200,
		})
		expect(parseImageDimensionsFromHeader(toArrayBuffer([0x00, 0x01, 0x02]))).toBeNull()
	})
})
