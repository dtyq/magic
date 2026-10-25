import {
	CANVAS_ELEMENT_CLIPBOARD_MIME_TYPE,
	CanvasElementClipboard,
	type CanvasElementClipboardFile,
	type CanvasElementClipboardFileMetadata,
} from "./CanvasElementClipboard"
import {
	CanvasDesignClipboard,
	CANVAS_DESIGN_CLIPBOARD_BUNDLE_MIME_TYPE,
} from "./CanvasDesignClipboard"
import { ElementTypeEnum, type LayerElement } from "../../document/types"
import { isContentGenerationPending } from "../../document/elementContent"
import {
	CanvasClipboardAssetResolver,
	type CanvasClipboardAssetResolverOptions,
	type CanvasClipboardAssetSourceRef,
	type MaterializeCanvasClipboardAsset,
} from "./CanvasClipboardAssetResolver"
import {
	hasMessageClipboardData,
	hasMessageClipboardMimeType,
	readMessageClipboardContent,
	readMessageClipboardAssets,
	type CanvasClipboardMessagePart,
} from "./CanvasMessageClipboard"

export type CanvasClipboardMediaType = "image" | "video" | "audio"

export interface CanvasClipboardAsset {
	key: string
	type: CanvasClipboardMediaType
	mimeType?: string
	fileName: string
	sourceCanvasId?: string
	sourceProjectId?: string
	sourceElementId?: string
	contentId?: string
	sourceFileId?: string
	resourceIdentity?: string
	projectPath?: string
	sourcePath?: string
	sourceRef?: CanvasClipboardAssetSourceRef
	file?: File
	origin: "canvas-element" | "canvas-export" | "message-reference" | "external-file"
	/** Resolved target reference; absent means the asset must use `file`. */
	reference?: CanvasClipboardResolvedReference
}

export interface CanvasClipboardResolvedReference {
	kind: "current-canvas" | "project"
	path: string
	fileId?: string
	projectPath?: string
	resourceIdentity: string
	fileName: string
	/** 服务端复制已成功，但目标画布附件快照尚未确认该路径。 */
	awaitingAttachmentConfirmation?: boolean
}

type InternalCanvasClipboardAsset = CanvasClipboardAsset & {
	/** Alternate source spellings used only for duplicate detection. */
	resourceAliases?: string[]
}

export interface CanvasClipboardTarget {
	control: "image-editor" | "video-editor" | "message-editor"
	acceptedTypes: CanvasClipboardMediaType[]
	projectId?: string
	canvasId?: string
	hasProjectContext?: boolean
	/**
	 * Some browsers expose Canvas' native media representation as `Files` and
	 * hide the private MIME from the synchronous paste event. MessageEditor can
	 * opt into reading the private bundle first, while retaining native files as
	 * the fallback when the Clipboard API is unavailable or the bundle is absent.
	 */
	preferPrivateBundleWithNativeFallback?: boolean
	maxCount?: number
	maxCountByType?: Partial<Record<CanvasClipboardMediaType, number>>
	/**
	 * Stable resource identities already present in the target editor. Existing
	 * references are allowed through count limits so a repeated paste can add a
	 * second mention without starting another transfer/upload.
	 */
	existingResourceKeys?: string[]
	/** Preserve MessageEditor text and media in the original rich-text order. */
	messagePasteMode?: "rich-text-with-media" | "media-only"
	sessionId: string
}

export interface CanvasClipboardPasteResult {
	handled: boolean
	accepted: CanvasClipboardAsset[]
	skipped: Array<{ reason: string; fileName?: string }>
	failed: Array<{ reason: string; fileName?: string }>
}

export interface CanvasClipboardTextSnapshot {
	text: string
	html: string
}

export interface CanvasClipboardPasteControllerOptions extends CanvasClipboardAssetResolverOptions {
	read?: () => Promise<ClipboardItem[]>
	readText?: () => Promise<string>
	resolveReference?: (input: {
		asset: CanvasClipboardAsset
		target: CanvasClipboardTarget
	}) => Promise<CanvasClipboardResolvedReference | null>
}

type CanvasClipboardHostReferenceResolver = (input: {
	sourceProjectId?: string
	sourceCanvasId?: string
	sourceFileId?: string
	resourceIdentity?: string
	sourcePath?: string
	projectPath?: string
	fileName?: string
	targetProjectId?: string
	targetCanvasId?: string
	target: "canvas-editor" | "message-editor"
}) => Promise<CanvasClipboardResolvedReference | null>

export interface CanvasClipboardPasteCallbacks {
	onAsset?: (asset: CanvasClipboardAsset) => void | Promise<void>
	/**
	 * Handles a native external file after a private bundle probe. The text and
	 * HTML values are captured during the paste event because DataTransfer data
	 * is not guaranteed to remain readable after the event returns.
	 */
	onExternalFile?: (
		asset: CanvasClipboardAsset,
		clipboard: CanvasClipboardTextSnapshot,
	) => void | Promise<void>
	/**
	 * Called as soon as rich-text parts are capacity-filtered. Asset parts may still
	 * lack `file` / `reference` while host resolve/materialize runs in parallel.
	 */
	onMessageParts?: (parts: CanvasClipboardMessagePart[]) => void | Promise<void>
	/** Fired once each unresolved message asset finishes resolve/materialize (or fails). */
	onMessageAssetResolved?: (
		occurrenceKey: string,
		asset: CanvasClipboardAsset | null,
	) => void | Promise<void>
	onComplete?: (result: CanvasClipboardPasteResult) => void | Promise<void>
	/** Always runs after paste processing, including when the session becomes stale. */
	onSettled?: (result: CanvasClipboardPasteResult) => void | Promise<void>
	isSessionCurrent?: (sessionId: string) => boolean
}

const handledEvents = new WeakSet<Event>()
const eventPromises = new WeakMap<Event, Promise<CanvasClipboardPasteResult>>()

/**
 * Claims a native paste event before an editor starts its own upload path.
 *
 * Paste handlers are mounted on nested editor surfaces, so ordinary native
 * files need the same event-level guard as the private canvas protocol. The
 * claim is intentionally synchronous and does not prevent default behavior;
 * callers decide that after inspecting the clipboard snapshot.
 */
export function claimCanvasClipboardPasteEvent(event: Event): boolean {
	if (handledEvents.has(event)) return false
	handledEvents.add(event)
	return true
}

export function isCanvasClipboardPasteEventClaimed(event: Event): boolean {
	return handledEvents.has(event)
}

function isMediaType(value: string): value is CanvasClipboardMediaType {
	return value === "image" || value === "video" || value === "audio"
}

function mediaTypeFromMime(mimeType: string, fileName = ""): CanvasClipboardMediaType | null {
	const normalized = mimeType.toLowerCase()
	if (normalized.startsWith("image/")) return "image"
	if (normalized.startsWith("video/")) return "video"
	if (normalized.startsWith("audio/")) return "audio"
	const extension = fileName.split(".").pop()?.toLowerCase()
	if (extension && /^(png|jpe?g|gif|webp|bmp|avif|heic|heif|svg)$/.test(extension)) return "image"
	if (extension && /^(mp4|mov|webm|avi|mkv|m4v)$/.test(extension)) return "video"
	if (extension && /^(mp3|wav|ogg|m4a|aac|flac)$/.test(extension)) return "audio"
	return null
}

function defaultFileName(type: CanvasClipboardMediaType, index: number): string {
	const extension = type === "image" ? "png" : type === "video" ? "mp4" : "mp3"
	return `canvas-clipboard-${index + 1}.${extension}`
}

function asCanvasElement(value: unknown): value is LayerElement {
	return Boolean(
		value && typeof value === "object" && typeof (value as LayerElement).id === "string",
	)
}

function isMediaElement(element: LayerElement): boolean {
	return (
		element.type === ElementTypeEnum.Image ||
		element.type === ElementTypeEnum.Video ||
		element.type === ElementTypeEnum.Audio
	)
}

function mediaTypeFromElement(element: LayerElement): CanvasClipboardMediaType | null {
	if (element.type === ElementTypeEnum.Image) return "image"
	if (element.type === ElementTypeEnum.Video) return "video"
	if (element.type === ElementTypeEnum.Audio) return "audio"
	return null
}

type ClipboardContentSnapshot = {
	contentId?: string
	src?: string
	status?: string
	isTemporary?: boolean
} & Record<string, unknown>

function getStrictActiveContent(element: LayerElement): ClipboardContentSnapshot | undefined {
	const activeContentId = (element as LayerElement & { activeContentId?: unknown })
		.activeContentId
	if (typeof activeContentId !== "string" || activeContentId.length === 0) return undefined
	const contents = (element as LayerElement & { contents?: unknown }).contents
	if (!Array.isArray(contents)) return undefined
	const activeContent = contents.find((content) =>
		Boolean(
			content &&
			typeof content === "object" &&
			(content as { contentId?: unknown }).contentId === activeContentId,
		),
	)
	if (!activeContent || typeof activeContent !== "object") return undefined
	const snapshot = activeContent as unknown as Record<string, unknown>
	if (snapshot.contentId !== activeContentId || typeof snapshot.src !== "string") {
		return undefined
	}
	if (snapshot.status !== undefined && typeof snapshot.status !== "string") return undefined
	if (snapshot.isTemporary !== undefined && typeof snapshot.isTemporary !== "boolean") {
		return undefined
	}
	return snapshot as ClipboardContentSnapshot
}

function normalizeFileName(
	fileName: string | undefined,
	type: CanvasClipboardMediaType,
	index: number,
): string {
	const value = fileName?.trim()
	return value ? value.replace(/[\\/:*?"<>|]+/g, "-") : defaultFileName(type, index)
}

function getFileNameFromSource(source: string): string | undefined {
	const withoutQuery = source.split(/[?#]/, 1)[0]?.replace(/\\/g, "/")
	const encodedName = withoutQuery?.split("/").filter(Boolean).pop()
	if (!encodedName) return undefined
	try {
		return decodeURIComponent(encodedName)
	} catch {
		return encodedName
	}
}

function hasPrivateMimeType(types: readonly string[]): boolean {
	const normalizedTypes = new Set(types.map((type) => type.trim().toLowerCase()))
	return (
		normalizedTypes.has(CANVAS_DESIGN_CLIPBOARD_BUNDLE_MIME_TYPE) ||
		normalizedTypes.has(CANVAS_ELEMENT_CLIPBOARD_MIME_TYPE)
	)
}

/**
 * Detects the private canvas MIME from both ClipboardEvent.types and
 * ClipboardItem.type. A few WebView implementations omit custom formats from
 * `types` while still exposing them on `items`, so controls must use this
 * shared detector before deciding whether to hand the event to native paste.
 */
export function hasCanvasClipboardMimeType(
	eventOrTypes?: ClipboardEvent | readonly string[],
): boolean {
	if (!eventOrTypes) return false
	if (Array.isArray(eventOrTypes)) return hasPrivateMimeType(eventOrTypes)
	return hasPrivateMimeType(getEventTypes(eventOrTypes as ClipboardEvent))
}

export { hasMessageClipboardData, hasMessageClipboardMimeType }

function hasTextOrHtml(types: readonly string[]): boolean {
	return types.some((type) => {
		const normalized = type.trim().toLowerCase()
		return normalized === "text/plain" || normalized === "text/html"
	})
}

/**
 * Shared text/HTML detector for controls that must leave native editor paste
 * behavior untouched. Clipboard MIME casing is not guaranteed in WebViews.
 */
export function hasCanvasClipboardTextOrHtml(
	eventOrTypes?: ClipboardEvent | readonly string[],
): boolean {
	if (!eventOrTypes) return false
	return hasTextOrHtml(
		Array.isArray(eventOrTypes) ? eventOrTypes : getEventTypes(eventOrTypes as ClipboardEvent),
	)
}

function getEventTypes(event?: ClipboardEvent): string[] {
	if (!event?.clipboardData) return []
	const types = new Set<string>(Array.from(event.clipboardData.types ?? []))
	for (const item of Array.from(event.clipboardData.items ?? [])) {
		if (typeof item.type === "string" && item.type) types.add(item.type)
	}
	return Array.from(types)
}

function getClipboardTextSnapshot(event?: ClipboardEvent): CanvasClipboardTextSnapshot {
	const clipboardData = event?.clipboardData
	if (!clipboardData) return { text: "", html: "" }
	const read = (type: string): string => {
		try {
			return clipboardData.getData(type)
		} catch {
			return ""
		}
	}
	return {
		text: read("text/plain"),
		html: read("text/html"),
	}
}

function hasNativeFileData(event?: ClipboardEvent): boolean {
	if (!event?.clipboardData) return false
	if (event.clipboardData.files?.length) return true
	return Array.from(event.clipboardData.items ?? []).some((item) => item.kind === "file")
}

function normalizeClipboardSource(value: string): string {
	const trimmed = value.trim()
	if (!trimmed) return ""
	if (/^(?:https?:|asset:|blob:|data:)/i.test(trimmed)) {
		return trimmed.replace(/\\/g, "/")
	}
	return trimmed.replace(/\\/g, "/").replace(/\/+/g, "/")
}

export function collectExistingClipboardResourceKeys(
	values: Array<string | undefined | null>,
): string[] {
	return Array.from(
		new Set(
			values
				.filter((value): value is string => Boolean(value?.trim()))
				.map(normalizeClipboardSource),
		),
	)
}

function getSourceKey(asset: Omit<InternalCanvasClipboardAsset, "key">): string {
	const fallbackSource = asset.sourceElementId || asset.fileName
	return [
		asset.sourceCanvasId ?? "",
		normalizeClipboardSource(
			asset.resourceIdentity ||
				asset.sourcePath ||
				asset.sourceRef?.src ||
				asset.sourceRef?.ossUrl ||
				fallbackSource,
		),
	].join("\0")
}

function getAssetDedupKeys(asset: InternalCanvasClipboardAsset): string[] {
	if (asset.origin === "external-file") return [asset.key]
	const sourceCanvasId = asset.sourceCanvasId ?? ""
	const resourceSources = [
		asset.resourceIdentity,
		asset.sourcePath,
		asset.sourceRef?.src,
		asset.sourceRef?.ossUrl,
		...(asset.resourceAliases ?? []),
	].filter((value): value is string => Boolean(value?.trim()))
	const sources = resourceSources.length ? resourceSources : [asset.sourceElementId || asset.key]
	return Array.from(
		new Set(sources.map((source) => `${sourceCanvasId}\0${normalizeClipboardSource(source)}`)),
	)
}

function getAssetReferenceKeys(asset: InternalCanvasClipboardAsset): string[] {
	return [
		asset.resourceIdentity,
		asset.sourceFileId,
		asset.projectPath,
		asset.sourcePath,
		asset.sourceRef?.src,
		asset.sourceRef?.ossUrl,
		...(asset.resourceAliases ?? []),
	]
		.filter((value): value is string => Boolean(value?.trim()))
		.map(normalizeClipboardSource)
}

function isExistingClipboardReference(
	asset: InternalCanvasClipboardAsset,
	existingResourceKeys: Set<string>,
): boolean {
	if (asset.origin !== "canvas-element" && asset.origin !== "message-reference") {
		return false
	}
	return (
		getAssetReferenceKeys(asset).some((key) => existingResourceKeys.has(key)) ||
		getAssetDedupKeys(asset).some((key) =>
			existingResourceKeys.has(normalizeClipboardSource(key)),
		)
	)
}

function metadataForElement(
	metadata: CanvasElementClipboardFileMetadata[],
	element: LayerElement,
	activeSource?: string,
): CanvasElementClipboardFileMetadata | undefined {
	const candidates = metadata.filter(
		(item) => item.role === "element-media" && item.elementId === element.id,
	)
	if (candidates.length <= 1) return candidates[0]
	return (
		candidates.find((item) => {
			if (!activeSource) return false
			return (
				item.resourceAliases?.includes(activeSource) || item.sourceRef?.src === activeSource
			)
		}) ?? candidates[0]
	)
}

function collectCanvasElementAssets(options: {
	elements: LayerElement[]
	canvasId?: string
	projectId?: string
	files: CanvasElementClipboardFile[]
	fileMetadata: CanvasElementClipboardFileMetadata[]
}): InternalCanvasClipboardAsset[] {
	const fileById = new Map(options.files.map((entry) => [entry.metadata.id, entry]))
	const assets: InternalCanvasClipboardAsset[] = []
	let index = 0

	const stack = options.elements
		.filter(asCanvasElement)
		.slice()
		.reverse()
		.map((element) => ({ element }))
	const visited = new Set<string>()
	while (stack.length > 0) {
		const current = stack.pop()
		if (!current) continue
		const { element } = current
		if (visited.has(element.id)) continue
		visited.add(element.id)
		if ((element as LayerElement & { isTemporary?: boolean }).isTemporary) continue
		if (isMediaElement(element)) {
			const type = mediaTypeFromElement(element)
			const activeContent = getStrictActiveContent(element)
			const status = activeContent?.status?.toLowerCase()
			if (
				type &&
				activeContent?.src &&
				!activeContent.isTemporary &&
				status !== "failed" &&
				status !== "pending" &&
				status !== "processing" &&
				!isContentGenerationPending(activeContent as never)
			) {
				const metadata = metadataForElement(
					options.fileMetadata,
					element,
					activeContent.src,
				)
				const inlineFile = metadata ? fileById.get(metadata.id)?.file : undefined
				const elementName = (element as LayerElement & { name?: unknown }).name
				const asset: Omit<InternalCanvasClipboardAsset, "key"> = {
					type,
					mimeType: metadata?.mimeType,
					fileName: normalizeFileName(
						metadata?.filename ||
							getFileNameFromSource(activeContent.src) ||
							(typeof elementName === "string" ? elementName : undefined),
						type,
						index,
					),
					sourceCanvasId: options.canvasId,
					sourceProjectId: metadata?.sourceProjectId ?? options.projectId,
					sourceElementId: element.id,
					contentId: activeContent.contentId,
					sourceFileId: metadata?.sourceFileId,
					resourceIdentity: metadata?.resourceIdentity,
					projectPath: metadata?.projectPath,
					resourceAliases: metadata?.resourceAliases,
					sourcePath: activeContent.src,
					sourceRef: metadata?.sourceRef ?? { src: activeContent.src },
					file: inlineFile,
					origin: "canvas-element",
				}
				assets.push({ ...asset, key: getSourceKey(asset) })
				index += 1
			}
		}

		if ("children" in element && Array.isArray(element.children)) {
			for (let childIndex = element.children.length - 1; childIndex >= 0; childIndex -= 1) {
				const child = element.children[childIndex]
				if (asCanvasElement(child)) stack.push({ element: child })
			}
		}
	}
	return assets
}

function collectCanvasExportAssets(options: {
	canvasId?: string
	projectId?: string
	files: CanvasElementClipboardFile[]
	fileMetadata: CanvasElementClipboardFileMetadata[]
}): InternalCanvasClipboardAsset[] {
	const fileById = new Map(options.files.map((entry) => [entry.metadata.id, entry]))
	return options.fileMetadata
		.filter((metadata) => metadata.role === "canvas-export")
		.map((metadata, index) => {
			// The export operation is explicitly a PNG-style raster copy. Even a
			// malformed metadata MIME must not turn it into a video/audio attachment.
			const type: CanvasClipboardMediaType = "image"
			const mimeType = metadata.mimeType.toLowerCase().startsWith("image/")
				? metadata.mimeType
				: "image/png"
			const asset: Omit<InternalCanvasClipboardAsset, "key"> = {
				type,
				mimeType,
				fileName: normalizeFileName(metadata.filename, type, index),
				sourceCanvasId: options.canvasId,
				sourceProjectId: metadata.sourceProjectId ?? options.projectId,
				sourceElementId: metadata.elementId,
				sourceFileId: metadata.sourceFileId,
				resourceIdentity: metadata.resourceIdentity,
				projectPath: metadata.projectPath,
				resourceAliases: metadata.resourceAliases,
				sourcePath: metadata.sourceRef?.src,
				sourceRef: metadata.sourceRef,
				file: fileById.get(metadata.id)?.file,
				origin: "canvas-export",
			}
			return { ...asset, key: getSourceKey(asset) }
		})
}

function collectExternalAssets(files: File[]): InternalCanvasClipboardAsset[] {
	return files.flatMap((file, index) => {
		const type = mediaTypeFromMime(file.type, file.name)
		return type
			? [
					{
						key: `external\0${file.name}\0${file.size}\0${file.lastModified}\0${file.type}`,
						type,
						mimeType: file.type,
						fileName: file.name || defaultFileName(type, index),
						file,
						origin: "external-file" as const,
					},
				]
			: []
	})
}

/**
 * Some browsers expose private clipboard metadata through navigator.clipboard
 * but expose the actual bytes only on the synchronous ClipboardEvent. Merge
 * those snapshots by protocol file order without ever treating hidden
 * generation-resource entries as attachments.
 */
function mergeEventFilesIntoPrivateFiles(options: {
	files: CanvasElementClipboardFile[]
	metadata: CanvasElementClipboardFileMetadata[]
	eventFiles: File[]
}): CanvasElementClipboardFile[] {
	if (options.eventFiles.length === 0) return options.files

	const existingIds = new Set(options.files.map(({ metadata }) => metadata.id))
	const eventFiles = CanvasElementClipboard.createFilesFromEventFiles(
		options.eventFiles,
		options.metadata,
	)
	if (eventFiles.length === 0) return options.files

	return [...options.files, ...eventFiles.filter(({ metadata }) => !existingIds.has(metadata.id))]
}

export class CanvasClipboardPasteController {
	private readonly options: CanvasClipboardPasteControllerOptions

	private readonly resolver: CanvasClipboardAssetResolver

	private readonly referenceCache = new Map<
		string,
		Promise<CanvasClipboardResolvedReference | null>
	>()

	constructor(options: CanvasClipboardPasteControllerOptions = {}) {
		this.options = options
		this.resolver = new CanvasClipboardAssetResolver(options)
	}

	public clearCache(): void {
		this.resolver.clear()
		this.referenceCache.clear()
	}

	private resolveReference(
		asset: CanvasClipboardAsset,
		target: CanvasClipboardTarget,
	): Promise<CanvasClipboardResolvedReference | null> {
		if (!this.options.resolveReference) {
			return Promise.resolve(null)
		}
		const identity =
			asset.resourceIdentity ||
			asset.sourceFileId ||
			asset.projectPath ||
			asset.sourcePath ||
			asset.key
		const key = [
			target.control,
			target.projectId ?? "",
			target.canvasId ?? "",
			asset.sourceProjectId ?? "",
			asset.sourceCanvasId ?? "",
			identity,
		].join("\0")
		const existing = this.referenceCache.get(key)
		if (existing) {
			return existing
		}
		const promise = this.options
			.resolveReference({ asset, target })
			.catch(() => null)
			.then((reference) => {
				if (!reference && this.referenceCache.get(key) === promise) {
					this.referenceCache.delete(key)
				}
				return reference
			})
		this.referenceCache.set(key, promise)
		return promise
	}

	public async paste(
		event: ClipboardEvent | undefined,
		target: CanvasClipboardTarget,
		callbacks: CanvasClipboardPasteCallbacks = {},
	): Promise<CanvasClipboardPasteResult> {
		if (event) {
			const eventTypes = getEventTypes(event)
			const messageClipboard = hasMessageClipboardData(event)
			const shouldPreferPrivateBundle =
				target.preferPrivateBundleWithNativeFallback === true && hasNativeFileData(event)
			const shouldSynchronouslyHandleMessage =
				messageClipboard && target.messagePasteMode === "rich-text-with-media"
			if (
				!hasPrivateMimeType(eventTypes) &&
				!messageClipboard &&
				(hasNativeFileData(event) || hasTextOrHtml(eventTypes)) &&
				!shouldPreferPrivateBundle
			) {
				return Promise.resolve({ handled: false, accepted: [], skipped: [], failed: [] })
			}
			const existingPromise = eventPromises.get(event)
			if (existingPromise) return existingPromise
			if (!claimCanvasClipboardPasteEvent(event)) {
				return Promise.resolve({ handled: true, accepted: [], skipped: [], failed: [] })
			}
			if (
				hasPrivateMimeType(eventTypes) ||
				shouldSynchronouslyHandleMessage ||
				shouldPreferPrivateBundle
			) {
				event.preventDefault()
				event.stopPropagation()
			}
		}

		const promise = this.pasteUncached(event, target, callbacks)
		if (event) {
			eventPromises.set(event, promise)
		}
		return promise
	}

	private async pasteUncached(
		event: ClipboardEvent | undefined,
		target: CanvasClipboardTarget,
		callbacks: CanvasClipboardPasteCallbacks,
	): Promise<CanvasClipboardPasteResult> {
		const eventFiles = CanvasDesignClipboard.readEventFilesSnapshot(event)
		const eventTypes = getEventTypes(event)
		const privateMime = hasPrivateMimeType(eventTypes)
		const messageMime = hasMessageClipboardMimeType(eventTypes)
		const messageClipboard = hasMessageClipboardData(event)
		const messageContent =
			!privateMime && target.messagePasteMode === "rich-text-with-media"
				? readMessageClipboardContent(event)
				: { recognized: false, parts: [] as CanvasClipboardMessagePart[] }
		const hasFiles = eventFiles.length > 0
		const shouldPreferPrivateBundle =
			target.preferPrivateBundleWithNativeFallback === true && hasFiles
		const clipboardText = getClipboardTextSnapshot(event)

		if (!privateMime && !messageClipboard && hasFiles && !shouldPreferPrivateBundle) {
			return { handled: false, accepted: [], skipped: [], failed: [] }
		}

		if (
			!privateMime &&
			!messageClipboard &&
			hasTextOrHtml(eventTypes) &&
			!shouldPreferPrivateBundle
		) {
			return { handled: false, accepted: [], skipped: [], failed: [] }
		}

		let items: ClipboardItem[] | null = null
		if (
			privateMime ||
			shouldPreferPrivateBundle ||
			(!messageMime && !messageClipboard && !hasFiles && !hasTextOrHtml(eventTypes))
		) {
			items = await this.readClipboardItems()
		}

		let rawAssets: InternalCanvasClipboardAsset[] = []
		let privatePayloadRecognized = false
		let messagePayloadRecognized = messageContent.recognized
		let privateReadError: unknown
		const skipped: CanvasClipboardPasteResult["skipped"] = []
		const failed: CanvasClipboardPasteResult["failed"] = []

		try {
			const bundle = await CanvasDesignClipboard.readBundleFromItems(items)
			if (bundle) {
				privatePayloadRecognized = true
				const files = mergeEventFilesIntoPrivateFiles({
					files: bundle.files,
					metadata: bundle.payload.files,
					eventFiles,
				})
				rawAssets =
					bundle.payload.operation === "copy-as-png"
						? collectCanvasExportAssets({
								canvasId: bundle.payload.sourceCanvasId,
								projectId: bundle.payload.sourceProjectId,
								files,
								fileMetadata: bundle.payload.files,
							})
						: collectCanvasElementAssets({
								elements: bundle.payload.elements,
								canvasId: bundle.payload.sourceCanvasId,
								projectId: bundle.payload.sourceProjectId,
								files,
								fileMetadata: bundle.payload.files,
							})
			} else if (items) {
				const legacy = await CanvasElementClipboard.readFromClipboardItems(items)
				if (legacy) {
					privatePayloadRecognized = true
					const files = mergeEventFilesIntoPrivateFiles({
						files: legacy.files,
						metadata: legacy.payload.files,
						eventFiles,
					})
					rawAssets =
						legacy.payload.operation === "copy-as-png"
							? collectCanvasExportAssets({
									canvasId: legacy.payload.sourceCanvasId,
									projectId: legacy.payload.sourceProjectId,
									files,
									fileMetadata: legacy.payload.files,
								})
							: collectCanvasElementAssets({
									elements: legacy.payload.elements,
									canvasId: legacy.payload.sourceCanvasId,
									projectId: legacy.payload.sourceProjectId,
									files,
									fileMetadata: legacy.payload.files,
								})
				}
			}
		} catch (error) {
			privateReadError = error
		}

		if (!privatePayloadRecognized && !messagePayloadRecognized) {
			const messagePayload = readMessageClipboardAssets(event)
			messagePayloadRecognized = messagePayload.recognized
			rawAssets = messagePayload.assets.map((asset) => ({
				...asset,
				key: getSourceKey(asset),
			}))
		}

		if (messagePayloadRecognized && target.messagePasteMode === "rich-text-with-media") {
			return this.processMessageClipboardPaste(target, callbacks, messageContent.parts)
		}

		// The synchronous paste event is authoritative for native files. Only read
		// media MIME entries from ClipboardItem when no private payload was parsed;
		// otherwise generation-resource blobs could be reintroduced as attachments.
		if (rawAssets.length === 0) {
			const fallbackFiles =
				!privatePayloadRecognized && eventFiles.length > 0
					? eventFiles
					: !privateMime && !privatePayloadRecognized && items
						? await this.readExternalFiles(items)
						: []
			if (fallbackFiles.length > 0) {
				rawAssets = collectExternalAssets(fallbackFiles)
			}
		}
		if (privateReadError && !privatePayloadRecognized && rawAssets.length === 0) {
			failed.push({
				reason:
					privateReadError instanceof Error
						? privateReadError.message
						: "clipboard-read-failed",
			})
		}

		if (privateMime && !items && rawAssets.length === 0) {
			failed.push({ reason: "clipboard-read-unavailable" })
		}
		// For a MIME-less clipboard read, defer claiming the browser default until
		// an actual private payload or external media was found. Unknown/empty
		// clipboard contents must remain a no-op for the host editor.
		if (
			!privateMime &&
			!shouldPreferPrivateBundle &&
			(privatePayloadRecognized ||
				(messagePayloadRecognized && rawAssets.length > 0) ||
				rawAssets.length > 0)
		) {
			event?.preventDefault()
			event?.stopPropagation()
		}

		const deduped = new Set<string>()
		const existingResourceKeys = new Set(
			(target.existingResourceKeys ?? []).map(normalizeClipboardSource),
		)
		const accepted: CanvasClipboardAsset[] = []
		const counts: Partial<Record<CanvasClipboardMediaType, number>> = {}
		for (const rawAsset of rawAssets) {
			if (!isMediaType(rawAsset.type) || !target.acceptedTypes.includes(rawAsset.type)) {
				skipped.push({ reason: "unsupported-type", fileName: rawAsset.fileName })
				continue
			}
			const dedupKeys = getAssetDedupKeys(rawAsset)
			const isExistingReference = isExistingClipboardReference(rawAsset, existingResourceKeys)
			if (dedupKeys.some((key) => deduped.has(key))) {
				skipped.push({ reason: "duplicate", fileName: rawAsset.fileName })
				continue
			}
			const currentTypeCount = counts[rawAsset.type] ?? 0
			const typeLimit = target.maxCountByType?.[rawAsset.type]
			if (!isExistingReference && typeLimit !== undefined && currentTypeCount >= typeLimit) {
				skipped.push({ reason: "type-limit", fileName: rawAsset.fileName })
				continue
			}
			if (
				!isExistingReference &&
				target.maxCount !== undefined &&
				accepted.length >= target.maxCount
			) {
				skipped.push({ reason: "total-limit", fileName: rawAsset.fileName })
				continue
			}
			const reference =
				rawAsset.origin === "canvas-element" || rawAsset.origin === "message-reference"
					? await this.resolveReference(rawAsset, target)
					: null
			const file = reference
				? undefined
				: await (async () => {
						const materialized = await this.resolver.materializeAsset({
							...rawAsset,
							mimeType: rawAsset.mimeType
								?.toLowerCase()
								.startsWith(`${rawAsset.type}/`)
								? rawAsset.mimeType
								: rawAsset.file?.type?.toLowerCase().startsWith(`${rawAsset.type}/`)
									? rawAsset.file.type
									: `${rawAsset.type}/octet-stream`,
						})
						return materialized
					})()
			if (!file && !reference) {
				failed.push({ reason: "resource-materialize-failed", fileName: rawAsset.fileName })
				continue
			}
			if (callbacks.isSessionCurrent?.(target.sessionId) === false) break
			const resolvedFile = file ?? undefined
			const asset = {
				...rawAsset,
				...(resolvedFile ? { file: resolvedFile } : {}),
				reference: reference ?? undefined,
				fileName: resolvedFile?.name || reference?.fileName || rawAsset.fileName,
			}
			try {
				if (asset.origin === "external-file" && callbacks.onExternalFile) {
					await callbacks.onExternalFile(asset, clipboardText)
				} else {
					await callbacks.onAsset?.(asset)
				}
			} catch (error) {
				failed.push({
					reason: error instanceof Error ? error.message : "asset-submit-failed",
					fileName: rawAsset.fileName,
				})
				continue
			}
			if (callbacks.isSessionCurrent?.(target.sessionId) === false) break
			dedupKeys.forEach((key) => deduped.add(key))
			accepted.push(asset)
			counts[asset.type] = currentTypeCount + 1
		}

		const result: CanvasClipboardPasteResult = {
			handled:
				privateMime || privatePayloadRecognized || accepted.length > 0 || failed.length > 0,
			accepted,
			skipped,
			failed,
		}
		try {
			if (callbacks.isSessionCurrent?.(target.sessionId) !== false) {
				await callbacks.onComplete?.(result)
			}
		} finally {
			await callbacks.onSettled?.(result)
		}
		return result
	}

	private async processMessageClipboardPaste(
		target: CanvasClipboardTarget,
		callbacks: CanvasClipboardPasteCallbacks,
		parts: CanvasClipboardMessagePart[],
	): Promise<CanvasClipboardPasteResult> {
		const orderedParts: CanvasClipboardMessagePart[] = []
		const accepted: CanvasClipboardAsset[] = []
		const skipped: CanvasClipboardPasteResult["skipped"] = []
		const failed: CanvasClipboardPasteResult["failed"] = []
		const existingResourceKeys = new Set(
			(target.existingResourceKeys ?? []).map(normalizeClipboardSource),
		)
		const resourcePromises = new Map<
			string,
			Promise<CanvasClipboardResolvedReference | File | null>
		>()
		const counts: Partial<Record<CanvasClipboardMediaType, number>> = {}
		const pendingResolutions: Array<{
			occurrenceKey: string
			rawAsset: InternalCanvasClipboardAsset
			promise: Promise<CanvasClipboardResolvedReference | File | null>
		}> = []

		for (const part of parts) {
			if (part.kind === "text") {
				orderedParts.push(part)
				continue
			}

			const rawAsset: InternalCanvasClipboardAsset = {
				...part.asset,
				key: `${getSourceKey(part.asset)}\0${part.occurrenceKey}`,
			}
			const currentTypeCount = counts[rawAsset.type] ?? 0
			const typeLimit = target.maxCountByType?.[rawAsset.type]
			const isExistingReference = isExistingClipboardReference(rawAsset, existingResourceKeys)
			const overTypeLimit =
				!isExistingReference && typeLimit !== undefined && currentTypeCount >= typeLimit
			const overTotalLimit =
				!isExistingReference &&
				target.maxCount !== undefined &&
				accepted.length >= target.maxCount

			if (!isMediaType(rawAsset.type) || !target.acceptedTypes.includes(rawAsset.type)) {
				skipped.push({ reason: "unsupported-type", fileName: rawAsset.fileName })
				if (part.fallbackText) orderedParts.push({ kind: "text", text: part.fallbackText })
				continue
			}
			if (overTypeLimit || overTotalLimit) {
				skipped.push({
					reason: overTypeLimit ? "type-limit" : "total-limit",
					fileName: rawAsset.fileName,
				})
				if (part.fallbackText) orderedParts.push({ kind: "text", text: part.fallbackText })
				continue
			}

			// Already-resolved assets (rare) keep their file/reference; otherwise insert
			// unresolved placeholders immediately and resolve in parallel below.
			if (rawAsset.file || rawAsset.reference) {
				orderedParts.push({ ...part, asset: rawAsset })
				accepted.push(rawAsset)
				counts[rawAsset.type] = currentTypeCount + 1
				continue
			}

			const resourceKey = getSourceKey(rawAsset)
			let resolvedResource = resourcePromises.get(resourceKey)
			if (!resolvedResource) {
				resolvedResource = (async () => {
					const reference = await this.resolveReference(rawAsset, target)
					if (reference) return reference
					const materialized = await this.resolver.materializeAsset({
						...rawAsset,
						mimeType: rawAsset.mimeType?.toLowerCase().startsWith(`${rawAsset.type}/`)
							? rawAsset.mimeType
							: `${rawAsset.type}/octet-stream`,
					})
					return materialized
				})()
				resourcePromises.set(resourceKey, resolvedResource)
			}

			orderedParts.push({ ...part, asset: rawAsset })
			accepted.push(rawAsset)
			counts[rawAsset.type] = currentTypeCount + 1
			pendingResolutions.push({
				occurrenceKey: part.occurrenceKey,
				rawAsset,
				promise: resolvedResource,
			})
		}

		const result: CanvasClipboardPasteResult = {
			handled: true,
			accepted,
			skipped,
			failed,
		}
		try {
			if (callbacks.isSessionCurrent?.(target.sessionId) !== false) {
				try {
					if (callbacks.onMessageParts) {
						await callbacks.onMessageParts(orderedParts)
						await Promise.all(
							pendingResolutions.map(async (pending) => {
								const resolved = await pending.promise
								if (callbacks.isSessionCurrent?.(target.sessionId) === false) return
								if (!resolved) {
									failed.push({
										reason: "resource-materialize-failed",
										fileName: pending.rawAsset.fileName,
									})
									const acceptedIndex = accepted.findIndex(
										(item) => item.key === pending.rawAsset.key,
									)
									if (acceptedIndex >= 0) accepted.splice(acceptedIndex, 1)
									await callbacks.onMessageAssetResolved?.(
										pending.occurrenceKey,
										null,
									)
									return
								}
								const asset: CanvasClipboardAsset =
									typeof File !== "undefined" && resolved instanceof File
										? {
												...pending.rawAsset,
												file: resolved,
												fileName:
													resolved.name || pending.rawAsset.fileName,
											}
										: {
												...pending.rawAsset,
												reference: resolved,
												fileName:
													resolved.fileName || pending.rawAsset.fileName,
											}
								const index = accepted.findIndex(
									(item) => item.key === pending.rawAsset.key,
								)
								if (index >= 0) accepted[index] = asset
								await callbacks.onMessageAssetResolved?.(
									pending.occurrenceKey,
									asset,
								)
							}),
						)
					} else {
						// Legacy consumers without onMessageParts still wait for resolve.
						for (const pending of pendingResolutions) {
							const resolved = await pending.promise
							if (callbacks.isSessionCurrent?.(target.sessionId) === false) break
							if (!resolved) {
								failed.push({
									reason: "resource-materialize-failed",
									fileName: pending.rawAsset.fileName,
								})
								const acceptedIndex = accepted.findIndex(
									(item) => item.key === pending.rawAsset.key,
								)
								if (acceptedIndex >= 0) accepted.splice(acceptedIndex, 1)
								continue
							}
							const asset: CanvasClipboardAsset =
								typeof File !== "undefined" && resolved instanceof File
									? {
											...pending.rawAsset,
											file: resolved,
											fileName: resolved.name || pending.rawAsset.fileName,
										}
									: {
											...pending.rawAsset,
											reference: resolved,
											fileName:
												resolved.fileName || pending.rawAsset.fileName,
										}
							const index = accepted.findIndex(
								(item) => item.key === pending.rawAsset.key,
							)
							if (index >= 0) accepted[index] = asset
							await callbacks.onAsset?.(asset)
						}
					}
				} catch (error) {
					result.failed.push({
						reason: error instanceof Error ? error.message : "message-submit-failed",
					})
				}
				await callbacks.onComplete?.(result)
			}
		} finally {
			await callbacks.onSettled?.(result)
		}
		return result
	}

	private async readClipboardItems(): Promise<ClipboardItem[] | null> {
		return CanvasDesignClipboard.read({ read: this.options.read })
	}

	private async readExternalFiles(items: ClipboardItem[]): Promise<File[]> {
		const files: File[] = []
		for (const item of items) {
			const file = await CanvasElementClipboard.readExternalFileItem(item)
			if (file) files.push(file)
		}
		return files
	}
}

export function createCanvasClipboardPasteController(
	options: CanvasClipboardPasteControllerOptions = {},
): CanvasClipboardPasteController {
	return new CanvasClipboardPasteController(options)
}

export function createCanvasClipboardPasteControllerFromMethods(methods?: {
	clipboard?: { read?: () => Promise<ClipboardItem[]>; readText?: () => Promise<string> }
	materializeCanvasClipboardAsset?: MaterializeCanvasClipboardAsset
	resolveCanvasClipboardReference?: CanvasClipboardHostReferenceResolver
}): CanvasClipboardPasteController {
	const hostResolver = methods?.resolveCanvasClipboardReference
	return new CanvasClipboardPasteController({
		read: methods?.clipboard?.read,
		readText: methods?.clipboard?.readText,
		materialize: methods?.materializeCanvasClipboardAsset,
		resolveReference: hostResolver
			? async ({ asset, target }) =>
					hostResolver({
						sourceProjectId: asset.sourceProjectId,
						sourceCanvasId: asset.sourceCanvasId,
						sourceFileId: asset.sourceFileId,
						resourceIdentity: asset.resourceIdentity,
						sourcePath: asset.sourcePath,
						projectPath: asset.projectPath,
						fileName: asset.fileName,
						targetProjectId: target.projectId,
						targetCanvasId: target.canvasId,
						target:
							target.control === "message-editor"
								? "message-editor"
								: "canvas-editor",
					})
			: undefined,
	})
}

type CanvasClipboardPasteHostMethods = {
	clipboard?: { read?: () => Promise<ClipboardItem[]>; readText?: () => Promise<string> }
	materializeCanvasClipboardAsset?: MaterializeCanvasClipboardAsset
	/** @deprecated Remote URL materialization is host-owned; this is ignored. */
	getFileInfo?: CanvasClipboardAssetResolverOptions["getFileInfo"]
	resolveCanvasClipboardReference?: CanvasClipboardHostReferenceResolver
}

const defaultHostKey = {}
const controllersByHost = new WeakMap<object, CanvasClipboardPasteController>()
const hostRegistrations = new Map<CanvasClipboardPasteController, { key: object; count: number }>()
let defaultController: CanvasClipboardPasteController | null = null

function getHostKey(methods?: CanvasClipboardPasteHostMethods): object {
	return methods && typeof methods === "object" ? methods : defaultHostKey
}

function getOrCreateHostController(
	methods?: CanvasClipboardPasteHostMethods,
): CanvasClipboardPasteController {
	const key = getHostKey(methods)
	const existing = controllersByHost.get(key)
	if (existing) return existing
	const controller = createCanvasClipboardPasteControllerFromMethods(methods)
	controllersByHost.set(key, controller)
	hostRegistrations.set(controller, { key, count: 0 })
	return controller
}

export function configureCanvasClipboardPasteHost(
	methods?: CanvasClipboardPasteHostMethods,
): CanvasClipboardPasteController {
	const controller = getOrCreateHostController(methods)
	const registration = hostRegistrations.get(controller)
	if (registration) registration.count += 1
	if (!defaultController) defaultController = controller
	return controller
}

/** Drop resource materialization promises when the host project/session changes. */
export function clearCanvasClipboardPasteControllerCache(): void {
	for (const controller of hostRegistrations.keys()) controller.clearCache()
}

export function releaseCanvasClipboardPasteHost(controller: CanvasClipboardPasteController): void {
	const registration = hostRegistrations.get(controller)
	if (!registration) return
	registration.count = Math.max(0, registration.count - 1)
	if (registration.count > 0) return
	controller.clearCache()
	hostRegistrations.delete(controller)
	controllersByHost.delete(registration.key)
	if (defaultController !== controller) return
	defaultController = hostRegistrations.keys().next().value ?? null
}

export function getCanvasClipboardPasteController(
	methods?: CanvasClipboardPasteHostMethods,
): CanvasClipboardPasteController {
	if (methods) return getOrCreateHostController(methods)
	if (defaultController) return defaultController
	return getOrCreateHostController()
}

export type { MaterializeCanvasClipboardAsset }
