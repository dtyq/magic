import type {
	CanvasElementClipboardFile,
	CanvasElementClipboardFileMetadata,
	CanvasElementClipboardPayload,
} from "./CanvasElementClipboard"
import { logCanvasElementClipboard } from "./CanvasElementClipboardLogger"
import { validateAndFilterCanvasFiles } from "./utils"

export const CANVAS_DESIGN_CLIPBOARD_BUNDLE_MIME_TYPE =
	"web application/x-canvas-design-clipboard-bundle"

const CANVAS_DESIGN_CLIPBOARD_BUNDLE_SOURCE = "canvas-design"
const CANVAS_DESIGN_CLIPBOARD_BUNDLE_VERSION = 2
const CANVAS_DESIGN_CLIPBOARD_BUNDLE_MAGIC = "CDCB"
const CANVAS_DESIGN_CLIPBOARD_BUNDLE_PREFIX_BYTES = 9
const BASELINE_CLIPBOARD_MIME_TYPES = new Set([
	"text/plain",
	"text/html",
	"image/png",
	"text/uri-list",
])

export interface CanvasDesignClipboardOptions {
	/** Host-provided rich clipboard writer; falls back to navigator.clipboard.write. */
	write?: (items: ClipboardItem[]) => Promise<void>
	/** Host-provided rich clipboard reader; falls back to navigator.clipboard.read. */
	read?: () => Promise<ClipboardItem[]>
	/** Host-provided text clipboard reader; used by higher layers for compatibility hints. */
	readText?: () => Promise<string>
}

export interface CanvasDesignClipboardNativeExposure {
	mimeType: string
	blob: Blob
}

export interface CanvasDesignClipboardBundleFile {
	metadata: CanvasElementClipboardFileMetadata
	blob: Blob
}

export interface CanvasDesignClipboardWriteBundleOptions {
	payload: CanvasElementClipboardPayload
	files: CanvasDesignClipboardBundleFile[]
	native?: CanvasDesignClipboardNativeExposure
	clipboard?: CanvasDesignClipboardOptions
}

export interface CanvasDesignClipboardReadBundleResult {
	payload: CanvasElementClipboardPayload
	files: CanvasElementClipboardFile[]
}

interface CanvasDesignClipboardBundleFileHeader extends CanvasElementClipboardFileMetadata {
	byteOffset: number
	byteLength: number
}

interface CanvasDesignClipboardBundleHeader {
	source: typeof CANVAS_DESIGN_CLIPBOARD_BUNDLE_SOURCE
	version: typeof CANVAS_DESIGN_CLIPBOARD_BUNDLE_VERSION
	payload: CanvasElementClipboardPayload
	files: CanvasDesignClipboardBundleFileHeader[]
}

function getClipboardItemTypes(items: ClipboardItem[]): string[][] {
	return items.map((item) => Array.from(item.types))
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null
}

function isBundleHeader(value: unknown): value is CanvasDesignClipboardBundleHeader {
	return (
		isRecord(value) &&
		value.source === CANVAS_DESIGN_CLIPBOARD_BUNDLE_SOURCE &&
		value.version === CANVAS_DESIGN_CLIPBOARD_BUNDLE_VERSION &&
		isRecord(value.payload) &&
		Array.isArray(value.files) &&
		value.files.every(
			(file) =>
				isRecord(file) &&
				typeof file.id === "string" &&
				typeof file.elementId === "string" &&
				typeof file.filename === "string" &&
				typeof file.mimeType === "string" &&
				typeof file.fileSize === "number" &&
				typeof file.byteOffset === "number" &&
				typeof file.byteLength === "number",
		)
	)
}

function getMagicBytes(): Uint8Array {
	return new TextEncoder().encode(CANVAS_DESIGN_CLIPBOARD_BUNDLE_MAGIC)
}

function readMagic(bytes: Uint8Array): string {
	return new TextDecoder().decode(bytes.slice(0, 4))
}

function looksLikeClipboardFileNameOnlyText(text: string): boolean {
	const trimmed = text.trim()
	if (!trimmed || trimmed.startsWith("{") || trimmed.startsWith("[")) {
		return false
	}
	return /\.(jpg|jpeg|png|gif|webp|bmp|svg|ico|mp4|mov|webm|avi|mkv)$/i.test(trimmed)
}

/**
 * CanvasDesign internal browser clipboard adapter.
 *
 * This class is the only layer that talks to host-provided clipboard methods or
 * native browser Clipboard APIs. Protocol code can stay focused on payload
 * schema and parsing rules while browser compatibility is centralized here.
 */
export class CanvasDesignClipboard {
	public static supports(type: string): boolean {
		if (BASELINE_CLIPBOARD_MIME_TYPES.has(type)) {
			return true
		}

		if (typeof ClipboardItem === "undefined" || typeof ClipboardItem.supports !== "function") {
			return false
		}

		return ClipboardItem.supports(type)
	}

	public static async read(
		options?: CanvasDesignClipboardOptions,
		logScope = "clipboard-read",
	): Promise<ClipboardItem[] | null> {
		const read =
			options?.read ??
			(typeof navigator !== "undefined" && navigator.clipboard?.read
				? navigator.clipboard.read.bind(navigator.clipboard)
				: undefined)
		if (!read) {
			logCanvasElementClipboard(`${logScope}:skip-no-read-api`)
			return null
		}

		try {
			const items = await read()
			logCanvasElementClipboard(`${logScope}:items`, {
				itemCount: items.length,
				itemTypes: getClipboardItemTypes(items),
			})
			return items
		} catch (error) {
			logCanvasElementClipboard(`${logScope}:error`, {
				message: error instanceof Error ? error.message : String(error),
			})
			return null
		}
	}

	public static readEventFilesSnapshot(
		clipboardEvent?: ClipboardEvent,
		logScope = "clipboard-event",
	): File[] {
		if (!clipboardEvent?.clipboardData) {
			logCanvasElementClipboard(`${logScope}:skip-no-event`)
			return []
		}

		const clipboardTypes = Array.from(clipboardEvent.clipboardData.types ?? [])
		const clipboardItems = Array.from(clipboardEvent.clipboardData.items ?? [])
		const files = Array.from(clipboardEvent.clipboardData.files ?? [])
		const validFiles = validateAndFilterCanvasFiles(files)
		if (validFiles.length > 0) {
			logCanvasElementClipboard(`${logScope}:files-list`, {
				clipboardTypes,
				rawFileCount: files.length,
				fileCount: validFiles.length,
				fileMimeTypes: validFiles.map((file) => file.type),
				rawFiles: files.map((file) => ({ fileContent: file })),
				files: validFiles.map((file) => ({ fileContent: file })),
			})
			return validFiles
		}

		if (!clipboardEvent.clipboardData.items) {
			logCanvasElementClipboard(`${logScope}:empty-no-items`, {
				clipboardTypes,
				rawFileCount: files.length,
			})
			return []
		}

		const itemFiles: File[] = []
		for (const item of clipboardItems) {
			if (item.kind !== "file") {
				continue
			}

			const file = item.getAsFile()
			if (file) {
				itemFiles.push(file)
			}
		}

		const validItemFiles = validateAndFilterCanvasFiles(itemFiles)
		logCanvasElementClipboard(`${logScope}:items`, {
			clipboardTypes,
			clipboardItems: clipboardItems.map((item) => ({
				kind: item.kind,
				type: item.type,
			})),
			rawFileCount: files.length,
			rawItemFileCount: itemFiles.length,
			validFileCount: validItemFiles.length,
			fileMimeTypes: validItemFiles.map((file) => file.type),
			rawFiles: itemFiles.map((file) => ({ fileContent: file })),
			files: validItemFiles.map((file) => ({ fileContent: file })),
		})
		return validItemFiles
	}

	public static async readText(
		options?: CanvasDesignClipboardOptions,
		logScope = "clipboard-text",
	): Promise<string> {
		const readText =
			options?.readText ??
			(typeof navigator !== "undefined" && navigator.clipboard?.readText
				? navigator.clipboard.readText.bind(navigator.clipboard)
				: undefined)
		if (!readText) {
			logCanvasElementClipboard(`${logScope}:skip-no-read-text-api`)
			return ""
		}

		try {
			const text = await readText()
			logCanvasElementClipboard(`${logScope}:read`, {
				textLength: text.length,
				preview: text.trim().slice(0, 80),
			})
			return text
		} catch (error) {
			logCanvasElementClipboard(`${logScope}:error`, {
				message: error instanceof Error ? error.message : String(error),
			})
			return ""
		}
	}

	public static async readFilenameOnlyText(
		options?: CanvasDesignClipboardOptions,
		logScope = "clipboard-filename-text",
	): Promise<string | null> {
		const text = await this.readText(options, logScope)
		if (!looksLikeClipboardFileNameOnlyText(text)) {
			return null
		}

		logCanvasElementClipboard(`${logScope}:hit`, {
			textLength: text.length,
			preview: text.trim().slice(0, 80),
		})
		return text
	}

	public static async write(
		items: ClipboardItem[],
		options?: CanvasDesignClipboardOptions,
		logScope = "clipboard-write",
	): Promise<void> {
		const write =
			options?.write ??
			(typeof navigator !== "undefined" && navigator.clipboard?.write
				? navigator.clipboard.write.bind(navigator.clipboard)
				: undefined)
		if (!write) {
			const error = new Error("Clipboard write API is unavailable")
			logCanvasElementClipboard(`${logScope}:skip-no-write-api`, {
				message: error.message,
				itemCount: items.length,
				itemTypes: getClipboardItemTypes(items),
			})
			throw error
		}

		logCanvasElementClipboard(`${logScope}:start`, {
			itemCount: items.length,
			itemTypes: getClipboardItemTypes(items),
		})

		try {
			await write(items)
			logCanvasElementClipboard(`${logScope}:success`, {
				itemCount: items.length,
				itemTypes: getClipboardItemTypes(items),
			})
		} catch (error) {
			logCanvasElementClipboard(`${logScope}:error`, {
				message: error instanceof Error ? error.message : String(error),
				error,
				itemCount: items.length,
				itemTypes: getClipboardItemTypes(items),
			})
			throw error
		}
	}

	public static createBundleBlob(options: {
		payload: CanvasElementClipboardPayload
		files: CanvasDesignClipboardBundleFile[]
	}): Blob {
		let byteOffset = 0
		const fileHeaders = options.files.map(({ metadata, blob }) => {
			const fileHeader: CanvasDesignClipboardBundleFileHeader = {
				...metadata,
				byteOffset,
				byteLength: blob.size,
			}
			byteOffset += blob.size
			return fileHeader
		})
		const header: CanvasDesignClipboardBundleHeader = {
			source: CANVAS_DESIGN_CLIPBOARD_BUNDLE_SOURCE,
			version: CANVAS_DESIGN_CLIPBOARD_BUNDLE_VERSION,
			payload: options.payload,
			files: fileHeaders,
		}
		const headerBytes = new TextEncoder().encode(JSON.stringify(header))
		const prefix = new Uint8Array(CANVAS_DESIGN_CLIPBOARD_BUNDLE_PREFIX_BYTES)
		prefix.set(getMagicBytes(), 0)
		prefix[4] = CANVAS_DESIGN_CLIPBOARD_BUNDLE_VERSION
		new DataView(prefix.buffer).setUint32(5, headerBytes.byteLength)

		const bundleBlob = new Blob(
			[prefix, headerBytes, ...options.files.map(({ blob }) => blob)],
			{
				type: CANVAS_DESIGN_CLIPBOARD_BUNDLE_MIME_TYPE,
			},
		)
		logCanvasElementClipboard("bundle:create", {
			elementCount: options.payload.elements.length,
			fileCount: options.files.length,
			fileMimeTypes: options.files.map(({ metadata }) => metadata.mimeType),
			headerByteLength: headerBytes.byteLength,
			bundleSize: bundleBlob.size,
		})
		return bundleBlob
	}

	public static async parseBundleBlob(
		blob: Blob,
	): Promise<CanvasDesignClipboardReadBundleResult> {
		const buffer = await blob.arrayBuffer()
		if (buffer.byteLength < CANVAS_DESIGN_CLIPBOARD_BUNDLE_PREFIX_BYTES) {
			throw new Error("CanvasDesign clipboard bundle is too small")
		}

		const bytes = new Uint8Array(buffer)
		const magic = readMagic(bytes)
		if (magic !== CANVAS_DESIGN_CLIPBOARD_BUNDLE_MAGIC) {
			throw new Error("CanvasDesign clipboard bundle magic mismatch")
		}

		const version = bytes[4]
		if (version !== CANVAS_DESIGN_CLIPBOARD_BUNDLE_VERSION) {
			throw new Error(`Unsupported CanvasDesign clipboard bundle version: ${version}`)
		}

		const headerByteLength = new DataView(buffer).getUint32(5)
		const headerStart = CANVAS_DESIGN_CLIPBOARD_BUNDLE_PREFIX_BYTES
		const fileBytesStart = headerStart + headerByteLength
		if (fileBytesStart > buffer.byteLength) {
			throw new Error("CanvasDesign clipboard bundle header exceeds blob size")
		}

		const headerJson = new TextDecoder().decode(bytes.slice(headerStart, fileBytesStart))
		const header: unknown = JSON.parse(headerJson)
		if (!isBundleHeader(header)) {
			throw new Error("Invalid CanvasDesign clipboard bundle header")
		}

		const files = header.files.map((metadata) => {
			const fileStart = fileBytesStart + metadata.byteOffset
			const fileEnd = fileStart + metadata.byteLength
			if (
				metadata.byteOffset < 0 ||
				metadata.byteLength < 0 ||
				fileStart < fileBytesStart ||
				fileEnd > buffer.byteLength
			) {
				throw new Error(`Invalid CanvasDesign clipboard bundle file range: ${metadata.id}`)
			}

			const file = new File(
				[blob.slice(fileStart, fileEnd, metadata.mimeType)],
				metadata.filename,
				{
					type: metadata.mimeType,
				},
			)
			const { byteOffset: _byteOffset, byteLength: _byteLength, ...fileMetadata } = metadata
			void _byteOffset
			void _byteLength
			return {
				metadata: fileMetadata,
				file,
			}
		})

		logCanvasElementClipboard("bundle:parse", {
			elementCount: header.payload.elements.length,
			fileCount: files.length,
			fileMimeTypes: files.map(({ metadata }) => metadata.mimeType),
			bundleSize: blob.size,
		})
		return {
			payload: header.payload,
			files,
		}
	}

	public static createBundleItem(options: {
		bundleBlob: Blob
		native?: CanvasDesignClipboardNativeExposure
	}): ClipboardItem {
		if (!this.supports(CANVAS_DESIGN_CLIPBOARD_BUNDLE_MIME_TYPE)) {
			throw new Error("CanvasDesign clipboard bundle MIME is not supported by this browser")
		}

		const itemData: Record<string, Blob> = {
			[CANVAS_DESIGN_CLIPBOARD_BUNDLE_MIME_TYPE]: options.bundleBlob,
		}
		if (options.native) {
			if (this.supports(options.native.mimeType)) {
				itemData[options.native.mimeType] = options.native.blob
			} else {
				logCanvasElementClipboard("bundle:native-skip-unsupported", {
					nativeMimeType: options.native.mimeType,
				})
			}
		}

		return new ClipboardItem(itemData)
	}

	public static async writeBundle(
		options: CanvasDesignClipboardWriteBundleOptions,
	): Promise<void> {
		const bundleBlob = this.createBundleBlob({
			payload: options.payload,
			files: options.files,
		})
		const item = this.createBundleItem({
			bundleBlob,
			native: options.native,
		})
		logCanvasElementClipboard("write-bundle:start", {
			itemTypes: Array.from(item.types),
			elementCount: options.payload.elements.length,
			fileCount: options.files.length,
			fileMimeTypes: options.files.map(({ metadata }) => metadata.mimeType),
			hasNativeExposure: Boolean(options.native),
			nativeMimeType: options.native?.mimeType,
			bundleSize: bundleBlob.size,
		})

		await this.write([item], options.clipboard, "write-bundle")
	}

	public static async readBundle(
		options?: CanvasDesignClipboardOptions,
	): Promise<CanvasDesignClipboardReadBundleResult | null> {
		const items = await this.read(options, "read-bundle")
		const bundleItem = items?.find((item) =>
			item.types.includes(CANVAS_DESIGN_CLIPBOARD_BUNDLE_MIME_TYPE),
		)
		if (!bundleItem) {
			logCanvasElementClipboard("read-bundle:miss", {
				itemCount: items?.length ?? 0,
				itemTypes: items ? getClipboardItemTypes(items) : [],
			})
			return null
		}

		try {
			const bundleBlob = await bundleItem.getType(CANVAS_DESIGN_CLIPBOARD_BUNDLE_MIME_TYPE)
			const result = await this.parseBundleBlob(bundleBlob)
			logCanvasElementClipboard("read-bundle:success", {
				elementCount: result.payload.elements.length,
				fileCount: result.files.length,
				fileMimeTypes: result.files.map(({ metadata }) => metadata.mimeType),
			})
			return result
		} catch (error) {
			logCanvasElementClipboard("read-bundle:error", {
				message: error instanceof Error ? error.message : String(error),
				error,
			})
			throw error
		}
	}
}
