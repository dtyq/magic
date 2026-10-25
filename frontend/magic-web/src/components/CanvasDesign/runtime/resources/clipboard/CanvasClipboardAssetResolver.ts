export interface CanvasClipboardAssetSourceRef {
	src?: string
	ossUrl?: string
	expiresAt?: string
}

export interface MaterializeCanvasClipboardAssetInput {
	sourceCanvasId?: string
	resourceIdentity?: string
	sourcePath?: string
	sourceRef?: CanvasClipboardAssetSourceRef
	fileName: string
	mimeType: string
}

export type MaterializeCanvasClipboardAsset = (
	input: MaterializeCanvasClipboardAssetInput,
) => Promise<File | null>

export interface CanvasClipboardAssetResolverOptions {
	materialize?: MaterializeCanvasClipboardAsset
	/** @deprecated Remote URL materialization is host-owned; this is ignored. */
	getFileInfo?: (
		path: string,
		options?: { useImageProcess?: boolean; forceRefresh?: boolean },
	) => Promise<{ src?: string; fileName?: string; expires_at?: string } | null | undefined>
	/** Guard against accidentally accepting an unbounded clipboard payload. */
	maxBytes?: number
}

const DEFAULT_MAX_BYTES = 200 * 1024 * 1024

function normalizeMimeType(mimeType: string): string {
	return mimeType.trim().toLowerCase() || "application/octet-stream"
}

function inferMimeType(fileName: string, fallback = "application/octet-stream"): string {
	const extension = fileName.split(".").pop()?.toLowerCase()
	const byExtension: Record<string, string> = {
		jpg: "image/jpeg",
		jpeg: "image/jpeg",
		png: "image/png",
		gif: "image/gif",
		webp: "image/webp",
		bmp: "image/bmp",
		avif: "image/avif",
		heic: "image/heic",
		heif: "image/heif",
		mp4: "video/mp4",
		mov: "video/quicktime",
		webm: "video/webm",
		avi: "video/x-msvideo",
		mkv: "video/x-matroska",
		mp3: "audio/mpeg",
		wav: "audio/wav",
		ogg: "audio/ogg",
		m4a: "audio/mp4",
		aac: "audio/aac",
	}
	return byExtension[extension ?? ""] ?? fallback
}

function normalizeAttachmentMimeType(mimeType: string, fileName: string): string {
	const normalized = normalizeMimeType(mimeType)
	if (normalized === "application/octet-stream" || normalized.endsWith("/octet-stream")) {
		return inferMimeType(fileName, normalized)
	}
	return normalized
}

function isSupportedMediaMimeType(mimeType: string): boolean {
	return /^(image|video|audio)\//i.test(mimeType)
}

function hasCompatibleMediaFamily(expected: string, actual: string): boolean {
	const expectedFamily = expected.split("/", 1)[0]
	const actualFamily = actual.split("/", 1)[0]
	return !isSupportedMediaMimeType(expected) || expectedFamily === actualFamily
}

function normalizeMaterializedFile(options: {
	file: File
	expectedMimeType: string
	fallbackFileName: string
	maxBytes: number
}): File | null {
	const { file, expectedMimeType, fallbackFileName, maxBytes } = options
	const fileName = file.name.trim() || fallbackFileName
	const mimeType = normalizeAttachmentMimeType(file.type || expectedMimeType, fileName)
	if (
		file.size <= 0 ||
		file.size > maxBytes ||
		!isSupportedMediaMimeType(mimeType) ||
		!hasCompatibleMediaFamily(normalizeMimeType(expectedMimeType), mimeType)
	) {
		return null
	}
	if (file.name === fileName && normalizeMimeType(file.type) === mimeType) return file
	return new File([file], fileName, {
		type: mimeType,
		lastModified: file.lastModified,
	})
}

function normalizeResourceKey(value: string): string {
	const trimmed = value.trim()
	if (/^(?:https?:|asset:|blob:|data:)/i.test(trimmed)) {
		return trimmed.replace(/\\/g, "/")
	}
	return trimmed.replace(/\\/g, "/").replace(/\/+/g, "/")
}

/**
 * Materializes a canvas clipboard asset into a File.
 *
 * The host callback is authoritative: it can enforce project/workspace
 * permissions and refresh expiring URLs. Remote references are rejected when
 * the host does not provide that callback.
 */
export class CanvasClipboardAssetResolver {
	private readonly inFlight = new Map<string, Promise<File | null>>()

	private readonly materialize?: MaterializeCanvasClipboardAsset

	private readonly maxBytes: number

	constructor(options: CanvasClipboardAssetResolverOptions = {}) {
		this.materialize = options.materialize
		this.maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES
	}

	public clear(): void {
		this.inFlight.clear()
	}

	public materializeAsset(input: {
		file?: File
		sourceCanvasId?: string
		resourceIdentity?: string
		sourcePath?: string
		sourceRef?: CanvasClipboardAssetSourceRef
		fileName: string
		mimeType: string
	}): Promise<File | null> {
		if (input.file) {
			const normalizedFile = normalizeMaterializedFile({
				file: input.file,
				expectedMimeType: input.mimeType,
				fallbackFileName: input.fileName,
				maxBytes: this.maxBytes,
			})
			if (normalizedFile) return Promise.resolve(normalizedFile)
		}

		const key = this.getKey(input)
		if (key) {
			const existing = this.inFlight.get(key)
			if (existing) return existing
		}

		const promise = this.materializeUncached(input).finally(() => {
			if (!key) return
			// Keep the promise through the current event-loop turn. Rich clipboard
			// reads may complete on separate browser tasks (notably WebView
			// FileReader), and two consumers handling the same paste batch should
			// still share one materialization. This is not a durable Blob/File cache;
			// the entry is released immediately on the next macrotask.
			const release = () => {
				if (this.inFlight.get(key) === promise) this.inFlight.delete(key)
			}
			if (typeof setTimeout === "function") setTimeout(release, 0)
			else release()
		})
		if (key) this.inFlight.set(key, promise)
		return promise
	}

	private getKey(input: {
		sourceCanvasId?: string
		resourceIdentity?: string
		sourcePath?: string
		sourceRef?: CanvasClipboardAssetSourceRef
		fileName: string
		mimeType: string
	}): string | undefined {
		const source =
			input.resourceIdentity?.trim() ||
			input.sourcePath?.trim() ||
			input.sourceRef?.src?.trim() ||
			input.sourceRef?.ossUrl?.trim()
		if (!source) return undefined
		return [input.sourceCanvasId?.trim() ?? "", normalizeResourceKey(source)].join("\0")
	}

	private async materializeUncached(input: {
		sourceCanvasId?: string
		resourceIdentity?: string
		sourcePath?: string
		sourceRef?: CanvasClipboardAssetSourceRef
		fileName: string
		mimeType: string
	}): Promise<File | null> {
		const mimeType = normalizeAttachmentMimeType(
			input.mimeType || inferMimeType(input.fileName),
			input.fileName,
		)
		if (!isSupportedMediaMimeType(mimeType)) return null

		if (this.materialize) {
			try {
				const file = await this.materialize({ ...input, mimeType })
				return file
					? normalizeMaterializedFile({
							file,
							expectedMimeType: mimeType,
							fallbackFileName: input.fileName,
							maxBytes: this.maxBytes,
						})
					: null
			} catch {
				return null
			}
		}

		// Remote clipboard references must go through the host callback, which is
		// responsible for authorization, URL refresh, and cross-project transfer.
		// Never fetch an untrusted URL directly from the browser with ambient state.
		return null
	}
}
