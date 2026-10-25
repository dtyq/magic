/**
 * Structured-clone friendly media inputs understood by the streaming PptxGenJS fork.
 * Large resources stay as Blob/URL/OPFS descriptors; only small compatibility inputs
 * may use an inline ArrayBuffer descriptor.
 */
export const MAX_INLINE_MEDIA_BYTES = 8 * 1024 * 1024

export type MediaMetadataOrigin = "explicit" | "inferred" | "response"

export interface MediaSourceDescriptorBase {
	kind: "opfs" | "blob" | "url" | "bytes" | "path"
	key: string
	contentType: string
	extn: string
	metadataOrigin?: MediaMetadataOrigin
}

export interface OpfsMediaSourceDescriptor extends MediaSourceDescriptorBase {
	kind: "opfs"
	sessionId: string
	path: string
	size: number
}

export interface BlobMediaSourceDescriptor extends MediaSourceDescriptorBase {
	kind: "blob"
	blob: Blob
	size: number
}

export interface UrlMediaSourceDescriptor extends MediaSourceDescriptorBase {
	kind: "url"
	url: string
	size?: number
}

export interface BytesMediaSourceDescriptor extends MediaSourceDescriptorBase {
	kind: "bytes"
	data: ArrayBuffer
}

export interface PathMediaSourceDescriptor extends MediaSourceDescriptorBase {
	kind: "path"
	path: string
	size?: number
}

export type MediaSourceDescriptor =
	| OpfsMediaSourceDescriptor
	| BlobMediaSourceDescriptor
	| UrlMediaSourceDescriptor
	| BytesMediaSourceDescriptor
	| PathMediaSourceDescriptor

/**
 * Rebind a descriptor to an explicit business identity without touching its
 * underlying Blob, ArrayBuffer, URL, or OPFS path.  This is used when the
 * parser has a `data-original-path` marker but a caller supplied the source
 * object before normalization.
 */
export function withMediaSourceKey(
	source: MediaSourceDescriptor,
	key: string | undefined,
): MediaSourceDescriptor {
	const normalizedKey = key?.trim()
	if (!normalizedKey || normalizedKey === source.key) return source
	return { ...source, key: normalizedKey }
}

interface NormalizeMediaDescriptorOptions {
	contentType?: string
	extn?: string
	key?: string
	metadataOrigin?: MediaMetadataOrigin
}

/**
 * Normalize existing URL/data-URL inputs without fetching their full payload.
 * Caller-provided data URLs are decoded once into a bounded ArrayBuffer descriptor and are
 * intentionally capped: multi-GB exports must use Blob/URL/OPFS descriptors instead of base64.
 */
export function createMediaSourceDescriptor(
	src: string,
	options: NormalizeMediaDescriptorOptions = {},
): MediaSourceDescriptor {
	const value = src.trim()
	if (!value) throw new TypeError("Media source must not be empty")

	if (value.startsWith("data:")) {
		const decoded = dataUrlToArrayBuffer(value)
		if (decoded.data.byteLength > MAX_INLINE_MEDIA_BYTES) {
			throw new RangeError(
				`Inline media is ${decoded.data.byteLength} bytes; use a Blob, URL, or OPFS descriptor above ${MAX_INLINE_MEDIA_BYTES} bytes.`,
			)
		}
		const contentType = options.contentType || decoded.contentType || "application/octet-stream"
		return {
			kind: "bytes",
			data: decoded.data,
			key:
				options.key ||
				`data:${contentType}:${decoded.data.byteLength}:${hashString(value.slice(0, 4096))}`,
			contentType,
			extn: normalizeExtension(options.extn || extensionFromContentType(contentType)),
			metadataOrigin: "explicit",
		}
	}

	const metadata = normalizeDescriptorMetadata(value, options)
	if (isFetchableUrl(value)) {
		return {
			kind: "url",
			url: value,
			key: options.key || `url:${value}`,
			contentType: metadata.contentType,
			extn: metadata.extn,
			metadataOrigin: metadata.origin,
		}
	}

	return {
		kind: "path",
		path: value,
		key: options.key || `path:${value}`,
		contentType: metadata.contentType,
		extn: metadata.extn,
		metadataOrigin: metadata.origin,
	}
}

/**
 * Normalize a string source through the public asynchronous API.
 *
 * The parser uses the synchronous constructor above so the HTML → IR stage can emit
 * descriptor-only nodes without a second legacy string field. Callers that already
 * depend on the Promise-shaped API can continue to await this wrapper.
 */
export async function normalizeMediaSourceDescriptor(
	src: string,
	options: NormalizeMediaDescriptorOptions = {},
): Promise<MediaSourceDescriptor> {
	return createMediaSourceDescriptor(src, options)
}

export function bytesMediaSourceDescriptor(input: {
	data: ArrayBuffer
	contentType: string
	extn?: string
	key?: string
}): BytesMediaSourceDescriptor {
	if (input.data.byteLength > MAX_INLINE_MEDIA_BYTES) {
		throw new RangeError(
			`Inline media is ${input.data.byteLength} bytes; stage it as Blob/OPFS instead of transferring an ArrayBuffer.`,
		)
	}
	return createBytesDescriptor(input)
}

/**
 * Convert caller-owned bytes into the descriptor protocol without exposing a
 * legacy node-level byte field. Small payloads remain transferable ArrayBuffers;
 * larger payloads become Blob descriptors so the Worker boundary does not copy
 * or transfer an oversized inline buffer.
 */
export function mediaSourceDescriptorFromBytes(input: {
	data: ArrayBuffer
	contentType: string
	extn?: string
	key?: string
}): BytesMediaSourceDescriptor | BlobMediaSourceDescriptor {
	if (input.data.byteLength <= MAX_INLINE_MEDIA_BYTES) return createBytesDescriptor(input)
	const contentType = input.contentType || "application/octet-stream"
	const extn = normalizeExtension(input.extn || extensionFromContentType(contentType))
	const key = input.key || defaultBytesSourceKey(input.data, contentType)
	return {
		kind: "blob",
		blob: new Blob([input.data], { type: contentType }),
		size: input.data.byteLength,
		key,
		contentType,
		extn,
		metadataOrigin: "explicit",
	}
}

function createBytesDescriptor(input: {
	data: ArrayBuffer
	contentType: string
	extn?: string
	key?: string
}): BytesMediaSourceDescriptor {
	const contentType = input.contentType || "application/octet-stream"
	return {
		kind: "bytes",
		data: input.data,
		key:
			input.key ||
				defaultBytesSourceKey(input.data, contentType),
		contentType,
		extn: normalizeExtension(input.extn || extensionFromContentType(contentType)),
		metadataOrigin: "explicit",
	}
}

function defaultBytesSourceKey(data: ArrayBuffer, contentType: string): string {
	return `bytes:${contentType}:${data.byteLength}:${hashBytes(new Uint8Array(data, 0, Math.min(data.byteLength, 4096)))}`
}

function normalizeDescriptorMetadata(
	value: string,
	options: NormalizeMediaDescriptorOptions,
): { contentType: string; extn: string; origin: MediaMetadataOrigin } {
	const hasContentType = Boolean(options.contentType?.trim())
	const hasExtension = Boolean(options.extn?.trim())
	const origin =
		options.metadataOrigin ?? (hasContentType || hasExtension ? "explicit" : "inferred")

	if (hasContentType) {
		const contentType = options.contentType as string
		return {
			contentType,
			extn: normalizeExtension(
				hasExtension ? (options.extn as string) : extensionFromContentType(contentType),
			),
			origin,
		}
	}
	if (hasExtension) {
		const extn = normalizeExtension(options.extn as string)
		return { contentType: contentTypeFromExtension(extn), extn, origin }
	}

	const contentType = contentTypeFromPath(value)
	return {
		contentType,
		extn: normalizeExtension(extensionFromPath(value) || extensionFromContentType(contentType)),
		origin,
	}
}

export function descriptorTransferables(source?: MediaSourceDescriptor): Transferable[] {
	return source?.kind === "bytes" ? [source.data] : []
}

function dataUrlToArrayBuffer(dataUrl: string): { data: ArrayBuffer; contentType: string } {
	const commaIndex = dataUrl.indexOf(",")
	if (commaIndex < 0) throw new TypeError("Invalid data URL")
	const metadata = dataUrl.slice(5, commaIndex)
	const payload = dataUrl.slice(commaIndex + 1)
	const contentType = metadata.split(";", 1)[0] || "application/octet-stream"
	const isBase64 = metadata
		.split(";")
		.slice(1)
		.some((part) => part.toLowerCase() === "base64")

	if (!isBase64) {
		// Decoding a percent-encoded data URL creates a full temporary string before Blob can
		// report its byte size. Reject an over-sized encoded payload first so a low-memory device
		// never materializes an obviously invalid inline source. This is intentionally conservative:
		// callers that need larger media should pass a Blob, URL, or OPFS descriptor.
		if (payload.length > MAX_INLINE_MEDIA_BYTES) {
			throw new RangeError(
				`Inline media payload is ${payload.length} encoded characters; use a Blob, URL, or OPFS descriptor above ${MAX_INLINE_MEDIA_BYTES} bytes.`,
			)
		}
		const bytes = new TextEncoder().encode(decodeURIComponent(payload))
		return { data: bytes.buffer, contentType }
	}
	const estimatedBytes = Math.floor((payload.replace(/\s+/g, "").length * 3) / 4)
	if (estimatedBytes > MAX_INLINE_MEDIA_BYTES) {
		throw new RangeError(
			`Inline media is approximately ${estimatedBytes} bytes; use a Blob, URL, or OPFS descriptor instead.`,
		)
	}
	const binary = atob(payload.replace(/\s+/g, ""))
	const bytes = new Uint8Array(binary.length)
	for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
	return { data: bytes.buffer, contentType }
}

function isFetchableUrl(value: string): boolean {
	return /^(?:https?:|blob:)/i.test(value)
}

function extensionFromPath(value: string): string | undefined {
	const cleanPath = value.split(/[?#]/, 1)[0]
	const match = cleanPath.match(/\.([a-z0-9]{1,10})$/i)
	return match?.[1]
}

function contentTypeFromPath(value: string): string {
	return contentTypeFromExtension(extensionFromPath(value))
}

function contentTypeFromExtension(extension?: string): string {
	switch (extension?.replace(/^\./, "").toLowerCase()) {
		case "png":
			return "image/png"
		case "jpg":
		case "jpeg":
			return "image/jpeg"
		case "gif":
			return "image/gif"
		case "svg":
			return "image/svg+xml"
		case "webp":
			return "image/webp"
		case "mp4":
		case "m4v":
			return "video/mp4"
		case "mov":
			return "video/quicktime"
		case "webm":
			return "video/webm"
		case "mp3":
			return "audio/mpeg"
		case "m4a":
			return "audio/mp4"
		case "wav":
			return "audio/wav"
		case "ogg":
		case "oga":
			return "audio/ogg"
		default:
			return "application/octet-stream"
	}
}

function extensionFromContentType(contentType: string): string {
	const normalized = contentType.split(";", 1)[0].toLowerCase()
	switch (normalized) {
		case "application/octet-stream":
			return "bin"
		case "image/jpeg":
		case "image/jpg":
			return "jpg"
		case "image/svg+xml":
			return "svg"
		case "video/quicktime":
			return "mov"
		case "audio/mpeg":
			return "mp3"
		case "audio/mp4":
			return "m4a"
		default:
			return normalized.split("/", 2)[1]?.replace(/^x-/, "") || "bin"
	}
}

function normalizeExtension(extn: string): string {
	return extn.replace(/^\./, "").toLowerCase() || "bin"
}

function hashString(value: string): string {
	let hash = 2166136261
	for (let index = 0; index < value.length; index += 1) {
		hash ^= value.charCodeAt(index)
		hash = Math.imul(hash, 16777619)
	}
	return (hash >>> 0).toString(16)
}

function hashBytes(value: Uint8Array): string {
	let hash = 2166136261
	for (const byte of value) {
		hash ^= byte
		hash = Math.imul(hash, 16777619)
	}
	return (hash >>> 0).toString(16)
}
