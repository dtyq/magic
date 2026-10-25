import type {
	CanvasElementClipboardFile,
	CanvasElementClipboardFileMetadata,
	CanvasElementClipboardPayload,
} from "./CanvasElementClipboard"
import { validateAndFilterCanvasFiles } from "../../shared/ids"
import { isCanvasClipboardPayloadWithinLimits } from "./clipboardLimits"

export const CANVAS_DESIGN_CLIPBOARD_BUNDLE_MIME_TYPE =
	"web application/x-canvas-design-clipboard-bundle"

const CANVAS_DESIGN_CLIPBOARD_BUNDLE_SOURCE = "canvas-design"
const CANVAS_DESIGN_CLIPBOARD_BUNDLE_VERSION = 2
const CANVAS_DESIGN_CLIPBOARD_BUNDLE_MAGIC = "CDCB"
const CANVAS_DESIGN_CLIPBOARD_BUNDLE_PREFIX_BYTES = 9
const MAX_CANVAS_DESIGN_CLIPBOARD_BUNDLE_BYTES = 200 * 1024 * 1024
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

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null
}

type CanvasClipboardFileRole = CanvasElementClipboardFileMetadata["role"]

function getBundleFileRole(value: Record<string, unknown>): CanvasClipboardFileRole | null {
	const role = value.role ?? value.fileRole
	return role === "element-media" || role === "canvas-export" || role === "generation-resource"
		? role
		: null
}

function normalizeClipboardMimeType(value: string): string {
	return value.trim().toLowerCase()
}

function isBundleFileMetadata(value: unknown): value is CanvasElementClipboardFileMetadata {
	const role = isRecord(value) ? getBundleFileRole(value) : null
	if (
		!isRecord(value) ||
		typeof value.id !== "string" ||
		typeof value.elementId !== "string" ||
		typeof value.filename !== "string" ||
		typeof value.mimeType !== "string" ||
		typeof value.fileSize !== "number" ||
		!Number.isSafeInteger(value.fileSize) ||
		value.fileSize < 0 ||
		role === null
	) {
		return false
	}
	if (value.resourcePath !== undefined && typeof value.resourcePath !== "string") return false
	if (value.resourceIdentity !== undefined && typeof value.resourceIdentity !== "string") {
		return false
	}
	for (const key of ["sourceProjectId", "sourceFileId", "projectPath"] as const) {
		if (value[key] !== undefined && typeof value[key] !== "string") return false
	}
	if (
		value.resourceAliases !== undefined &&
		(!Array.isArray(value.resourceAliases) ||
			!value.resourceAliases.every((alias) => typeof alias === "string"))
	) {
		return false
	}
	if (value.sourceRef !== undefined) {
		if (!isRecord(value.sourceRef)) return false
		if (value.sourceRef.src !== undefined && typeof value.sourceRef.src !== "string")
			return false
		if (value.sourceRef.ossUrl !== undefined && typeof value.sourceRef.ossUrl !== "string") {
			return false
		}
		if (
			value.sourceRef.expiresAt !== undefined &&
			typeof value.sourceRef.expiresAt !== "string"
		) {
			return false
		}
	}
	return true
}

function normalizeBundleFileMetadata(
	value: CanvasElementClipboardFileMetadata,
): CanvasElementClipboardFileMetadata {
	const role = getBundleFileRole(value as unknown as Record<string, unknown>)
	return {
		...value,
		role: role as CanvasClipboardFileRole,
	}
}

function normalizeBundleHeader(
	header: CanvasDesignClipboardBundleHeader,
): CanvasDesignClipboardBundleHeader {
	return {
		...header,
		payload: {
			...header.payload,
			files: header.payload.files.map(normalizeBundleFileMetadata),
		},
		files: header.files.map((file) => ({
			...normalizeBundleFileMetadata(file),
			byteOffset: file.byteOffset,
			byteLength: file.byteLength,
		})),
	}
}

function isBundlePayload(value: unknown): value is CanvasElementClipboardPayload {
	return (
		isRecord(value) &&
		value.source === "canvas-design" &&
		value.version === 1 &&
		(value.operation === "copy-elements" || value.operation === "copy-as-png") &&
		(value.sourceCanvasId === undefined || typeof value.sourceCanvasId === "string") &&
		(value.sourceProjectId === undefined || typeof value.sourceProjectId === "string") &&
		Array.isArray(value.elements) &&
		Array.isArray(value.files) &&
		isCanvasClipboardPayloadWithinLimits({
			elements: value.elements,
			files: value.files,
			connections: value.connections,
		}) &&
		value.files.every(isBundleFileMetadata)
	)
}

function isBundleHeader(value: unknown): value is CanvasDesignClipboardBundleHeader {
	return (
		isRecord(value) &&
		value.source === CANVAS_DESIGN_CLIPBOARD_BUNDLE_SOURCE &&
		value.version === CANVAS_DESIGN_CLIPBOARD_BUNDLE_VERSION &&
		isBundlePayload(value.payload) &&
		Array.isArray(value.files) &&
		value.files.every(
			(file) =>
				isRecord(file) &&
				isBundleFileMetadata(file) &&
				typeof file.byteOffset === "number" &&
				Number.isSafeInteger(file.byteOffset) &&
				file.byteOffset >= 0 &&
				typeof file.byteLength === "number" &&
				Number.isSafeInteger(file.byteLength) &&
				file.byteLength >= 0,
		)
	)
}

function areBundleFileMetadataEquivalent(
	left: CanvasElementClipboardFileMetadata,
	right: CanvasElementClipboardFileMetadata,
): boolean {
	const leftRole = getBundleFileRole(left as unknown as Record<string, unknown>)
	const rightRole = getBundleFileRole(right as unknown as Record<string, unknown>)
	return (
		left.id === right.id &&
		left.elementId === right.elementId &&
		left.filename === right.filename &&
		normalizeClipboardMimeType(left.mimeType) === normalizeClipboardMimeType(right.mimeType) &&
		left.fileSize === right.fileSize &&
		leftRole === rightRole &&
		left.resourcePath === right.resourcePath &&
		left.resourceIdentity === right.resourceIdentity &&
		left.sourceProjectId === right.sourceProjectId &&
		left.sourceFileId === right.sourceFileId &&
		left.projectPath === right.projectPath &&
		JSON.stringify(left.resourceAliases ?? []) ===
			JSON.stringify(right.resourceAliases ?? []) &&
		JSON.stringify(left.sourceRef ?? {}) === JSON.stringify(right.sourceRef ?? {})
	)
}

function validateBundleFileMetadataConsistency(header: CanvasDesignClipboardBundleHeader): boolean {
	const payloadById = new Map<string, CanvasElementClipboardFileMetadata>()
	for (const metadata of header.payload.files) {
		if (payloadById.has(metadata.id)) return false
		payloadById.set(metadata.id, metadata)
	}

	const headerIds = new Set<string>()
	for (const metadata of header.files) {
		if (headerIds.has(metadata.id)) return false
		headerIds.add(metadata.id)
		const payloadMetadata = payloadById.get(metadata.id)
		if (!payloadMetadata || !areBundleFileMetadataEquivalent(metadata, payloadMetadata)) {
			return false
		}
	}

	return true
}

function getMagicBytes(): Uint8Array {
	return new TextEncoder().encode(CANVAS_DESIGN_CLIPBOARD_BUNDLE_MAGIC)
}

function readMagic(bytes: Uint8Array): string {
	return new TextDecoder().decode(bytes.slice(0, 4))
}

/**
 * Blob#arrayBuffer is missing in a few supported WebView / test runtimes even
 * though Blob itself is available. Keep bundle parsing independent from that
 * optional convenience method and fall back to the standards-based
 * FileReader path when needed.
 */
async function readBlobArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
	const arrayBuffer = (blob as Blob & { arrayBuffer?: () => Promise<ArrayBuffer> }).arrayBuffer
	if (typeof arrayBuffer === "function") {
		return arrayBuffer.call(blob)
	}

	if (typeof FileReader !== "undefined") {
		return new Promise<ArrayBuffer>((resolve, reject) => {
			const reader = new FileReader()
			reader.onerror = () =>
				reject(reader.error ?? new Error("Failed to read clipboard blob"))
			reader.onabort = () => reject(new Error("Clipboard blob read aborted"))
			reader.onload = () => {
				if (reader.result instanceof ArrayBuffer) {
					resolve(reader.result)
					return
				}
				reject(new Error("Clipboard blob did not produce an ArrayBuffer"))
			}
			reader.readAsArrayBuffer(blob)
		})
	}

	throw new Error("Blob arrayBuffer API is unavailable")
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
		const normalizedType = normalizeClipboardMimeType(type)
		if (BASELINE_CLIPBOARD_MIME_TYPES.has(normalizedType)) {
			return true
		}

		if (typeof ClipboardItem === "undefined" || typeof ClipboardItem.supports !== "function") {
			return false
		}

		try {
			return ClipboardItem.supports(type) || ClipboardItem.supports(normalizedType)
		} catch {
			return false
		}
	}

	public static async read(
		options?: CanvasDesignClipboardOptions,
	): Promise<ClipboardItem[] | null> {
		const read =
			options?.read ??
			(typeof navigator !== "undefined" && navigator.clipboard?.read
				? navigator.clipboard.read.bind(navigator.clipboard)
				: undefined)
		if (!read) {
			return null
		}

		try {
			const items = await read()
			return items
		} catch {
			return null
		}
	}

	public static readEventFilesSnapshot(clipboardEvent?: ClipboardEvent): File[] {
		if (!clipboardEvent?.clipboardData) {
			return []
		}

		const clipboardItems = Array.from(clipboardEvent.clipboardData.items ?? [])
		const files = Array.from(clipboardEvent.clipboardData.files ?? [])
		const validFiles = validateAndFilterCanvasFiles(files)
		if (validFiles.length > 0) {
			return validFiles
		}

		if (!clipboardEvent.clipboardData.items) {
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
		return validItemFiles
	}

	/**
	 * Reads every native file exposed by a paste event without applying Canvas
	 * media validation. Message editors support documents as well as media and
	 * must preserve their existing ordinary-file upload behavior; the private
	 * canvas controller continues to use readEventFilesSnapshot above so private
	 * protocol matching never consumes unrelated document files.
	 */
	public static readAllEventFilesSnapshot(clipboardEvent?: ClipboardEvent): File[] {
		if (!clipboardEvent?.clipboardData) return []
		const files = Array.from(clipboardEvent.clipboardData.files ?? [])
		if (files.length > 0) return files
		return Array.from(clipboardEvent.clipboardData.items ?? [])
			.filter((item) => item.kind === "file")
			.map((item) => item.getAsFile())
			.filter((file): file is File => Boolean(file))
	}

	public static async readText(options?: CanvasDesignClipboardOptions): Promise<string> {
		const readText =
			options?.readText ??
			(typeof navigator !== "undefined" && navigator.clipboard?.readText
				? navigator.clipboard.readText.bind(navigator.clipboard)
				: undefined)
		if (!readText) {
			return ""
		}

		try {
			const text = await readText()
			return text
		} catch {
			return ""
		}
	}

	public static async readFilenameOnlyText(
		options?: CanvasDesignClipboardOptions,
	): Promise<string | null> {
		const text = await this.readText(options)
		if (!looksLikeClipboardFileNameOnlyText(text)) {
			return null
		}

		return text
	}

	public static async write(
		items: ClipboardItem[],
		options?: CanvasDesignClipboardOptions,
	): Promise<void> {
		const write =
			options?.write ??
			(typeof navigator !== "undefined" && navigator.clipboard?.write
				? navigator.clipboard.write.bind(navigator.clipboard)
				: undefined)
		if (!write) {
			const error = new Error("Clipboard write API is unavailable")
			throw error
		}

		await write(items)
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
		return bundleBlob
	}

	public static async parseBundleBlob(
		blob: Blob,
	): Promise<CanvasDesignClipboardReadBundleResult> {
		if (blob.size > MAX_CANVAS_DESIGN_CLIPBOARD_BUNDLE_BYTES) {
			throw new Error("CanvasDesign clipboard bundle exceeds size limit")
		}
		const buffer = await readBlobArrayBuffer(blob)
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
		const parsedHeader: unknown = JSON.parse(headerJson)
		if (!isBundleHeader(parsedHeader)) {
			throw new Error("Invalid CanvasDesign clipboard bundle header")
		}
		if (!validateBundleFileMetadataConsistency(parsedHeader)) {
			throw new Error("Invalid CanvasDesign clipboard bundle file metadata")
		}
		const header = normalizeBundleHeader(parsedHeader)

		const ranges = header.files
			.map((metadata) => ({
				id: metadata.id,
				start: metadata.byteOffset,
				end: metadata.byteOffset + metadata.byteLength,
			}))
			.sort((a, b) => a.start - b.start)
		let previousEnd = 0
		for (const range of ranges) {
			const metadata = header.files.find((file) => file.id === range.id)
			if (
				!Number.isSafeInteger(range.start) ||
				!Number.isSafeInteger(range.end) ||
				range.start < 0 ||
				range.end < range.start ||
				range.end > buffer.byteLength - fileBytesStart ||
				range.start < previousEnd ||
				(metadata?.fileSize !== undefined &&
					metadata.fileSize > 0 &&
					metadata.fileSize !== range.end - range.start)
			) {
				throw new Error(`Invalid CanvasDesign clipboard bundle file range: ${range.id}`)
			}
			previousEnd = range.end
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

		return {
			payload: header.payload,
			files,
		}
	}

	public static createBundleItem(options: {
		bundleBlob: Blob
		native?: CanvasDesignClipboardNativeExposure
	}): ClipboardItem {
		const supportsBundle = this.supports(CANVAS_DESIGN_CLIPBOARD_BUNDLE_MIME_TYPE)
		const supportsNative = Boolean(options.native && this.supports(options.native.mimeType))
		if (!supportsBundle && !supportsNative) {
			throw new Error("CanvasDesign clipboard bundle MIME is not supported by this browser")
		}

		const itemData: Record<string, Blob> = {}
		if (supportsBundle) {
			itemData[CANVAS_DESIGN_CLIPBOARD_BUNDLE_MIME_TYPE] = options.bundleBlob
		}
		if (options.native && supportsNative) {
			itemData[normalizeClipboardMimeType(options.native.mimeType)] = options.native.blob
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

		await this.write([item], options.clipboard)
	}

	public static async readBundle(
		options?: CanvasDesignClipboardOptions,
	): Promise<CanvasDesignClipboardReadBundleResult | null> {
		const items = await this.read(options)
		return this.readBundleFromItems(items)
	}

	/** 从已读取的 ClipboardItem 快照解析 bundle，避免重复调用 Clipboard API。 */
	public static async readBundleFromItems(
		items: ClipboardItem[] | null,
	): Promise<CanvasDesignClipboardReadBundleResult | null> {
		const bundleItem = items?.find((item) =>
			item.types.some(
				(type) =>
					normalizeClipboardMimeType(type) === CANVAS_DESIGN_CLIPBOARD_BUNDLE_MIME_TYPE,
			),
		)
		if (!bundleItem) {
			return null
		}

		const bundleType = bundleItem.types.find(
			(type) => normalizeClipboardMimeType(type) === CANVAS_DESIGN_CLIPBOARD_BUNDLE_MIME_TYPE,
		)
		if (!bundleType) return null
		const bundleBlob = await bundleItem.getType(bundleType)
		const result = await this.parseBundleBlob(bundleBlob)
		return result
	}
}
