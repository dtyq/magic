import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useSyncExternalStore,
	type ReactNode,
} from "react"
import { IMAGE_EXTENSIONS } from "@/constants/file"
import { resolveSafePreviewUrl } from "@/pages/superMagic/components/Detail/components/FilesViewer/components/previewUrl"
import { getPreviewFileUrlWatermarkSignature } from "@/utils/aiWatermarkPreviewFileUrlMode"
import { getAiWatermarkPreferenceUserKey } from "@/utils/aiWatermarkPreferenceCache"
import type { AttachmentItem } from "../hooks/types"
import { useFileApi, type FileApi } from "@/pages/superMagic/fileAccess/fileApi"
import {
	cancelProjectFileImagePreviewRequest,
	deleteProjectFileImagePreviewCacheItem,
	getProjectFileImagePreviewCacheItem,
	isProjectFileImagePreviewDirectUrlUsable,
	PROJECT_FILE_IMAGE_PREVIEW_RENDITION_KEY,
	requestProjectFileImagePreview,
	requestProjectFileImagePreviewBatch,
	seedProjectFileImagePreviewDirectUrls,
} from "./projectFileImagePreviewCoordinator"

type PreviewStatus = "idle" | "loading" | "loaded" | "error" | "unavailable"

export interface ProjectFileImagePreviewSource {
	item: AttachmentItem
	fileId: string
	cacheKey: string
	fileName: string
	directThumbnailUrl?: string
	directThumbnailExpiresAt?: string
	fileVersion?: number
	updatedAt?: string
	resourceVersion?: string
}

interface PreviewState {
	status: PreviewStatus
	url?: string
}

interface ProjectFileImagePreviewManager {
	ensurePreview: (source: ProjectFileImagePreviewSource) => void
	getPreviewState: (source: ProjectFileImagePreviewSource) => PreviewState
	getPreviewSnapshot: (source: ProjectFileImagePreviewSource) => string
	markPreviewImageError: (source: ProjectFileImagePreviewSource) => void
	subscribePreview: (cacheKey: string, listener: () => void) => () => void
	setMountedItems: (items: AttachmentItem[]) => void
	setPreviewVisible: (source: ProjectFileImagePreviewSource, visible: boolean) => void
}

const imageExtSet = new Set(IMAGE_EXTENSIONS.map((ext) => normalizeFileExtension(ext)))
const THUMBNAIL_BATCH_DELAY_MS = 32
const THUMBNAIL_BATCH_SIZE = 50
const EMPTY_PREVIEW_STATE: PreviewState = { status: "idle" }
const PREVIEW_CACHE_RESOURCE_FIELD_NAMES = [
	"id",
	"updated_at",
	"updatedAt",
	"modified_at",
	"modify_time",
	"version",
	"file_version",
	"resource_version",
	"resourceVersion",
	"file_key",
	"file_size",
	"content_length",
	"size",
	"md5",
	"etag",
	"hash",
	"checksum",
	"topic_id",
	"project_id",
]

const ProjectFileImagePreviewContext = createContext<ProjectFileImagePreviewManager | null>(null)

function normalizeFileExtension(fileExtension?: string | null): string {
	return fileExtension?.replace(/^\./, "").toLowerCase() || ""
}

function pickScalarField(item: AttachmentItem, fieldName: string): string {
	const value = item[fieldName]
	if (typeof value === "string") return value.trim()
	if (typeof value === "number") return String(value)
	return ""
}

function pickStringUrlField(item: AttachmentItem, fieldName: string): string {
	const value = item[fieldName]
	if (typeof value !== "string") return ""
	const trimmed = value.trim()
	return trimmed ? resolveSafePreviewUrl(trimmed) || "" : ""
}

function getAttachmentFileId(item: AttachmentItem): string {
	const fileId = item.file_id
	if (typeof fileId === "string") return fileId
	if (fileId == null) return ""
	return String(fileId)
}

function getFileNameExtension(fileName?: string): string {
	if (!fileName) return ""
	const normalizedName = fileName.split("?")[0]?.split("#")[0] || ""
	const dotIndex = normalizedName.lastIndexOf(".")
	if (dotIndex < 0 || dotIndex === normalizedName.length - 1) return ""
	return normalizedName.slice(dotIndex + 1)
}

function resolveProjectFileImageExtension(item: AttachmentItem): string {
	return (
		normalizeFileExtension(item.file_extension) ||
		normalizeFileExtension(getFileNameExtension(item.file_name)) ||
		normalizeFileExtension(getFileNameExtension(item.display_filename)) ||
		normalizeFileExtension(getFileNameExtension(item.filename)) ||
		normalizeFileExtension(getFileNameExtension(item.name))
	)
}

function resolveDirectThumbnailUrl(item: AttachmentItem): string {
	return pickStringUrlField(item, "thumbnail_url") || pickStringUrlField(item, "preview_url")
}

function resolveDirectThumbnailExpiresAt(item: AttachmentItem): string | undefined {
	const value = item.expires_at ?? item.expiresAt
	return typeof value === "string" && value.trim() ? value.trim() : undefined
}

function resolveAttachmentFileVersion(item: AttachmentItem): number | undefined {
	const value = item.file_version
	if (typeof value === "number" && Number.isFinite(value)) return value
	if (typeof value === "string" && value.trim() !== "") {
		const parsed = Number(value)
		return Number.isFinite(parsed) ? parsed : undefined
	}
	return undefined
}

function resolveAttachmentUpdatedAt(item: AttachmentItem): string | undefined {
	const value = item.updated_at ?? item.updatedAt ?? item.modified_at ?? item.modify_time
	return typeof value === "string" && value.trim() ? value.trim() : undefined
}

function resolveAttachmentResourceVersion(item: AttachmentItem): string | undefined {
	const explicit = item.resource_version ?? item.resourceVersion ?? item.version
	if (explicit !== undefined && explicit !== null && String(explicit).trim() !== "") {
		return String(explicit)
	}
	return undefined
}

function seedDirectPreviewSourceIfNeeded(
	source: ProjectFileImagePreviewSource,
	fileApi: Pick<FileApi, "identityKey" | "requestSharedMediaUrls">,
): void {
	if (!source.directThumbnailUrl) return
	seedProjectFileImagePreviewDirectUrls([source], { fileApi })
}

function getAttachmentDisplayNameFallback(item: AttachmentItem): string {
	return item.display_filename || item.file_name || item.filename || item.name || ""
}

export function resolveProjectFileImagePreviewSource(
	item: AttachmentItem,
): ProjectFileImagePreviewSource | null {
	if (item.is_directory) return null

	const extension = resolveProjectFileImageExtension(item)
	if (!extension || !imageExtSet.has(extension)) return null

	const fileId = getAttachmentFileId(item)
	const directThumbnailUrl = resolveDirectThumbnailUrl(item)
	if (!fileId && !directThumbnailUrl) return null

	const fileName = getAttachmentDisplayNameFallback(item)
	const updatedAt = resolveAttachmentUpdatedAt(item)
	const cacheKey = [
		fileId,
		extension,
		fileName,
		...PREVIEW_CACHE_RESOURCE_FIELD_NAMES.map((fieldName) => pickScalarField(item, fieldName)),
		directThumbnailUrl,
		pickStringUrlField(item, "file_url"),
		pickStringUrlField(item, "url"),
		PROJECT_FILE_IMAGE_PREVIEW_RENDITION_KEY,
		getPreviewFileUrlWatermarkSignature(),
		getAiWatermarkPreferenceUserKey(),
	].join("|")

	return {
		item,
		fileId,
		cacheKey,
		fileName,
		directThumbnailUrl: directThumbnailUrl || undefined,
		directThumbnailExpiresAt: directThumbnailUrl
			? resolveDirectThumbnailExpiresAt(item)
			: undefined,
		fileVersion: resolveAttachmentFileVersion(item),
		updatedAt,
		resourceVersion: resolveAttachmentResourceVersion(item),
	}
}

function getCachedPreviewUrl(source: ProjectFileImagePreviewSource): string | undefined {
	return getProjectFileImagePreviewCacheItem(source)?.url
}

function collectCurrentPreviewKeys(items: AttachmentItem[]): Set<string> {
	const keys = new Set<string>()

	const visit = (nodes: AttachmentItem[]) => {
		for (const node of nodes) {
			const source = resolveProjectFileImagePreviewSource(node)
			if (source) keys.add(source.cacheKey)
			if (node.children?.length) visit(node.children)
		}
	}

	visit(items)
	return keys
}

function shouldRequestPreview(
	source: ProjectFileImagePreviewSource,
	states: ReadonlyMap<string, PreviewState>,
	pendingKeys: { has(cacheKey: string): boolean },
	imageErrorRetryAttemptedKeys?: ReadonlySet<string>,
) {
	if (!source.fileId) return false
	if (isProjectFileImagePreviewDirectUrlUsable(source)) return false
	if (getCachedPreviewUrl(source)) return false
	if (pendingKeys.has(source.cacheKey)) return false

	const state = states.get(source.cacheKey)
	// After one image-error forceRefresh, keep the terminal error and do not auto-retry.
	if (state?.status === "error" && imageErrorRetryAttemptedKeys?.has(source.cacheKey)) {
		return false
	}
	return !state || state.status === "idle" || state.status === "error"
}

export function useProjectFileImagePreviewManager({
	attachments,
}: {
	attachments: AttachmentItem[]
}): ProjectFileImagePreviewManager {
	const mountedSourcesRef = useRef<ProjectFileImagePreviewSource[]>([])
	const mountedSourceKeysRef = useRef<Set<string>>(new Set())
	const visibleSourcesRef = useRef<
		Map<string, { source: ProjectFileImagePreviewSource; count: number }>
	>(new Map())
	const mountedSourcesFingerprintRef = useRef("")
	const pendingKeysRef = useRef<Map<string, number>>(new Map())
	const thumbnailQueueRef = useRef<Map<string, ProjectFileImagePreviewSource>>(new Map())
	const thumbnailFlushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
	const previewStatesRef = useRef<Map<string, PreviewState>>(new Map())
	const previewListenersRef = useRef<Map<string, Set<() => void>>>(new Map())
	const disposedRef = useRef(false)
	// One forceRefresh per cacheKey after <img> onError; broken URLs otherwise loop forever.
	const imageErrorRetryAttemptedKeysRef = useRef<Set<string>>(new Set())
	// Boundary identity: thumbnail requests must carry the ambient share token so
	// share-page previews are not emptied by the leaf guard.
	const fileApi = useFileApi()

	const currentPreviewKeys = useMemo(() => collectCurrentPreviewKeys(attachments), [attachments])

	const isSourceAdmitted = useCallback((cacheKey: string) => {
		return mountedSourceKeysRef.current.has(cacheKey) || visibleSourcesRef.current.has(cacheKey)
	}, [])
	const releasePendingPreviewRequest = useCallback((cacheKey: string) => {
		if (!pendingKeysRef.current.delete(cacheKey)) return
		cancelProjectFileImagePreviewRequest(cacheKey)
	}, [])
	const notifyPreviewKeys = useCallback((cacheKeys: Iterable<string>) => {
		for (const cacheKey of cacheKeys) {
			for (const listener of previewListenersRef.current.get(cacheKey) || []) {
				listener()
			}
		}
	}, [])
	const applyPreviewStateChanges = useCallback(
		(changes: Array<[cacheKey: string, state: PreviewState | undefined]>) => {
			const changedKeys: string[] = []
			for (const [cacheKey, nextState] of changes) {
				const currentState = previewStatesRef.current.get(cacheKey)
				if (
					currentState?.status === nextState?.status &&
					currentState?.url === nextState?.url
				) {
					continue
				}

				if (nextState) previewStatesRef.current.set(cacheKey, nextState)
				else previewStatesRef.current.delete(cacheKey)
				changedKeys.push(cacheKey)
			}

			notifyPreviewKeys(changedKeys)
		},
		[notifyPreviewKeys],
	)
	const hydrateCachedPreview = useCallback(
		(source: ProjectFileImagePreviewSource) => {
			if (!getProjectFileImagePreviewCacheItem(source, { fileApi })) return false

			notifyPreviewKeys([source.cacheKey])
			return true
		},
		[notifyPreviewKeys, fileApi],
	)
	const getPreviewState = useCallback((source: ProjectFileImagePreviewSource): PreviewState => {
		const state = previewStatesRef.current.get(source.cacheKey)
		if (state) return state

		const cachedPreviewUrl = getCachedPreviewUrl(source)
		if (cachedPreviewUrl) return { status: "loaded", url: cachedPreviewUrl }

		if (isProjectFileImagePreviewDirectUrlUsable(source)) {
			return { status: "loaded", url: source.directThumbnailUrl }
		}

		return EMPTY_PREVIEW_STATE
	}, [])
	const getPreviewSnapshot = useCallback(
		(source: ProjectFileImagePreviewSource) => {
			const state = getPreviewState(source)
			return `${state.status}\0${state.url || ""}`
		},
		[getPreviewState],
	)
	const subscribePreview = useCallback((cacheKey: string, listener: () => void) => {
		let listeners = previewListenersRef.current.get(cacheKey)
		if (!listeners) {
			listeners = new Set()
			previewListenersRef.current.set(cacheKey, listeners)
		}
		listeners.add(listener)

		return () => {
			listeners?.delete(listener)
			if (listeners?.size === 0) previewListenersRef.current.delete(cacheKey)
		}
	}, [])

	const requestPreviewSources = useCallback(
		(
			sources: ProjectFileImagePreviewSource[],
			options?: {
				prebatched?: boolean
				forceRefresh?: boolean
				allowAttachmentListUrl?: boolean
			},
		) => {
			const requestSources = sources.filter((source) => source.fileId)
			if (requestSources.length === 0) return

			const pendingKeys = pendingKeysRef.current
			const isStrictRefresh =
				Boolean(options?.forceRefresh) || options?.allowAttachmentListUrl === false
			const nextPendingSources = requestSources.filter((source) => {
				const alreadyPending = pendingKeys.has(source.cacheKey)
				// Strict refresh must still reach the coordinator so it can chain
				// behind an in-flight normal exchange instead of being dropped.
				if (alreadyPending && !isStrictRefresh) return false
				if (!options?.forceRefresh && getCachedPreviewUrl(source)) return false
				pendingKeys.set(source.cacheKey, (pendingKeys.get(source.cacheKey) ?? 0) + 1)
				return true
			})
			if (nextPendingSources.length === 0) return

			applyPreviewStateChanges(
				nextPendingSources.map((source) => [source.cacheKey, { status: "loading" }]),
			)

			const requestOptions = {
				...options,
				fileApi,
			}
			const request = options?.prebatched
				? requestProjectFileImagePreviewBatch(nextPendingSources, requestOptions)
				: Promise.all(
						nextPendingSources.map((source) =>
							requestProjectFileImagePreview(source, requestOptions),
						),
					)

			void request
				.then((results) => {
					if (disposedRef.current) return
					applyPreviewStateChanges(
						nextPendingSources.map<[string, PreviewState | undefined]>(
							(source, index) => {
								const result = results[index]
								if (
									!result ||
									result.status === "cancelled" ||
									!isSourceAdmitted(source.cacheKey)
								) {
									return [source.cacheKey, undefined]
								}

								if (result.status === "unavailable") {
									return [source.cacheKey, { status: "unavailable" }]
								}
								if (result.status === "failed") {
									return [source.cacheKey, { status: "error" }]
								}
								return [source.cacheKey, undefined]
							},
						),
					)
				})
				.catch(() => {
					if (disposedRef.current) return
					applyPreviewStateChanges(
						nextPendingSources.map<[string, PreviewState | undefined]>((source) => [
							source.cacheKey,
							isSourceAdmitted(source.cacheKey) ? { status: "error" } : undefined,
						]),
					)
				})
				.finally(() => {
					for (const source of nextPendingSources) {
						const nextCount = (pendingKeys.get(source.cacheKey) ?? 1) - 1
						if (nextCount <= 0) pendingKeys.delete(source.cacheKey)
						else pendingKeys.set(source.cacheKey, nextCount)
					}
				})
		},
		[applyPreviewStateChanges, isSourceAdmitted, fileApi],
	)

	const flushThumbnailQueue = useCallback(() => {
		thumbnailFlushTimerRef.current = null

		const queuedSources: ProjectFileImagePreviewSource[] = []
		for (const [cacheKey, source] of thumbnailQueueRef.current) {
			thumbnailQueueRef.current.delete(cacheKey)
			if (isSourceAdmitted(cacheKey)) queuedSources.push(source)
			if (queuedSources.length >= THUMBNAIL_BATCH_SIZE) break
		}

		if (queuedSources.length > 0) {
			requestPreviewSources(queuedSources, { prebatched: true })
		}

		if (thumbnailQueueRef.current.size > 0) {
			thumbnailFlushTimerRef.current = setTimeout(
				flushThumbnailQueue,
				THUMBNAIL_BATCH_DELAY_MS,
			)
		}
	}, [isSourceAdmitted, requestPreviewSources])

	const scheduleThumbnailFlush = useCallback(() => {
		if (thumbnailFlushTimerRef.current) return
		thumbnailFlushTimerRef.current = setTimeout(flushThumbnailQueue, THUMBNAIL_BATCH_DELAY_MS)
	}, [flushThumbnailQueue])

	const enqueueThumbnailSources = useCallback(
		(sources: ProjectFileImagePreviewSource[]) => {
			let queued = false
			for (const source of sources) {
				if (isProjectFileImagePreviewDirectUrlUsable(source) || !source.fileId) continue
				if (thumbnailQueueRef.current.has(source.cacheKey)) continue
				thumbnailQueueRef.current.set(source.cacheKey, source)
				queued = true
			}
			if (queued) scheduleThumbnailFlush()
		},
		[scheduleThumbnailFlush],
	)

	const setMountedItems = useCallback(
		(items: AttachmentItem[]) => {
			const sourcesByKey = new Map<string, ProjectFileImagePreviewSource>()
			for (const item of items) {
				const source = resolveProjectFileImagePreviewSource(item)
				if (source) sourcesByKey.set(source.cacheKey, source)
			}

			const sources = Array.from(sourcesByKey.values())
			const fingerprint = sources.map((source) => source.cacheKey).join("\n")
			if (mountedSourcesFingerprintRef.current === fingerprint) return

			const previousMountedKeys = mountedSourceKeysRef.current
			mountedSourcesRef.current = sources
			mountedSourceKeysRef.current = new Set(sourcesByKey.keys())
			mountedSourcesFingerprintRef.current = fingerprint
			for (const cacheKey of thumbnailQueueRef.current.keys()) {
				if (
					!mountedSourceKeysRef.current.has(cacheKey) &&
					!visibleSourcesRef.current.has(cacheKey)
				) {
					thumbnailQueueRef.current.delete(cacheKey)
					releasePendingPreviewRequest(cacheKey)
				}
			}
			for (const cacheKey of previousMountedKeys) {
				if (
					!mountedSourceKeysRef.current.has(cacheKey) &&
					!visibleSourcesRef.current.has(cacheKey) &&
					pendingKeysRef.current.has(cacheKey)
				) {
					releasePendingPreviewRequest(cacheKey)
				}
			}

			const requestableSources = sources.filter((source) => {
				if (hydrateCachedPreview(source)) return false
				return shouldRequestPreview(
					source,
					previewStatesRef.current,
					pendingKeysRef.current,
					imageErrorRetryAttemptedKeysRef.current,
				)
			})
			if (requestableSources.length > 0) enqueueThumbnailSources(requestableSources)
		},
		[enqueueThumbnailSources, hydrateCachedPreview, releasePendingPreviewRequest],
	)

	const setPreviewVisible = useCallback(
		(source: ProjectFileImagePreviewSource, visible: boolean) => {
			const current = visibleSourcesRef.current.get(source.cacheKey)

			if (visible) {
				if (current) {
					current.count += 1
					current.source = source
					return
				}

				visibleSourcesRef.current.set(source.cacheKey, { source, count: 1 })
				seedDirectPreviewSourceIfNeeded(source)
				if (hydrateCachedPreview(source)) return
				if (
					shouldRequestPreview(
						source,
						previewStatesRef.current,
						pendingKeysRef.current,
						imageErrorRetryAttemptedKeysRef.current,
					)
				) {
					enqueueThumbnailSources([source])
				}
				return
			}

			if (!current) return
			if (current.count > 1) {
				current.count -= 1
				return
			}

			visibleSourcesRef.current.delete(source.cacheKey)
			if (!mountedSourceKeysRef.current.has(source.cacheKey)) {
				thumbnailQueueRef.current.delete(source.cacheKey)
				releasePendingPreviewRequest(source.cacheKey)
			}
		},
		[enqueueThumbnailSources, hydrateCachedPreview, releasePendingPreviewRequest],
	)

	useEffect(() => {
		const staleStateChanges: Array<[string, undefined]> = []
		for (const cacheKey of previewStatesRef.current.keys()) {
			if (!currentPreviewKeys.has(cacheKey)) staleStateChanges.push([cacheKey, undefined])
		}
		if (staleStateChanges.length > 0) applyPreviewStateChanges(staleStateChanges)

		for (const cacheKey of Array.from(imageErrorRetryAttemptedKeysRef.current)) {
			if (!currentPreviewKeys.has(cacheKey)) {
				imageErrorRetryAttemptedKeysRef.current.delete(cacheKey)
			}
		}
	}, [applyPreviewStateChanges, currentPreviewKeys])

	useEffect(() => {
		disposedRef.current = false
		return () => {
			disposedRef.current = true
			if (thumbnailFlushTimerRef.current) clearTimeout(thumbnailFlushTimerRef.current)
			for (const cacheKey of Array.from(pendingKeysRef.current.keys())) {
				releasePendingPreviewRequest(cacheKey)
			}
			previewListenersRef.current.clear()
			imageErrorRetryAttemptedKeysRef.current.clear()
		}
	}, [releasePendingPreviewRequest])

	const markPreviewImageError = useCallback(
		(source: ProjectFileImagePreviewSource) => {
			const alreadyRetried = imageErrorRetryAttemptedKeysRef.current.has(source.cacheKey)
			const willForceRefresh = isSourceAdmitted(source.cacheKey) && !alreadyRetried
			deleteProjectFileImagePreviewCacheItem(source, { fileApi })
			applyPreviewStateChanges([[source.cacheKey, { status: "error" }]])
			// Broken thumbnail URLs must not force-refresh forever while the row stays visible.
			if (!willForceRefresh) return
			imageErrorRetryAttemptedKeysRef.current.add(source.cacheKey)
			void requestPreviewSources([source], {
				forceRefresh: true,
				allowAttachmentListUrl: false,
			})
		},
		[applyPreviewStateChanges, isSourceAdmitted, requestPreviewSources, fileApi],
	)

	const ensurePreview = useCallback(
		(source: ProjectFileImagePreviewSource) => {
			seedDirectPreviewSourceIfNeeded(source, fileApi)
			if (hydrateCachedPreview(source)) return
			if (
				shouldRequestPreview(
					source,
					previewStatesRef.current,
					pendingKeysRef.current,
					imageErrorRetryAttemptedKeysRef.current,
				)
			) {
				requestPreviewSources([source])
			}
		},
		[hydrateCachedPreview, requestPreviewSources, fileApi],
	)

	return useMemo(
		() => ({
			ensurePreview,
			getPreviewState,
			getPreviewSnapshot,
			markPreviewImageError,
			subscribePreview,
			setMountedItems,
			setPreviewVisible,
		}),
		[
			ensurePreview,
			getPreviewSnapshot,
			getPreviewState,
			markPreviewImageError,
			setMountedItems,
			setPreviewVisible,
			subscribePreview,
		],
	)
}

export function ProjectFileImagePreviewProvider({
	children,
	manager,
}: {
	children: ReactNode
	manager: ProjectFileImagePreviewManager
}) {
	return (
		<ProjectFileImagePreviewContext.Provider value={manager}>
			{children}
		</ProjectFileImagePreviewContext.Provider>
	)
}

export function useProjectFileImagePreviewContext() {
	return useContext(ProjectFileImagePreviewContext)
}

export function useProjectFileImagePreviewState(
	source: ProjectFileImagePreviewSource | null,
): PreviewState | null {
	const manager = useProjectFileImagePreviewContext()
	const sourceRef = useRef(source)
	sourceRef.current = source

	const subscribe = useCallback(
		(listener: () => void) => {
			const currentSource = sourceRef.current
			if (!manager || !currentSource) return () => undefined
			return manager.subscribePreview(currentSource.cacheKey, listener)
		},
		[manager?.subscribePreview, source?.cacheKey],
	)
	const getSnapshot = useCallback(() => {
		const currentSource = sourceRef.current
		if (!currentSource) return "unavailable\0"
		if (manager) return manager.getPreviewSnapshot(currentSource)
		return isProjectFileImagePreviewDirectUrlUsable(currentSource)
			? `loaded\0${currentSource.directThumbnailUrl}`
			: "idle\0"
	}, [manager?.getPreviewSnapshot, source?.cacheKey, source?.directThumbnailUrl])

	useSyncExternalStore(subscribe, getSnapshot, getSnapshot)

	if (!source) return null
	if (manager) return manager.getPreviewState(source)
	if (isProjectFileImagePreviewDirectUrlUsable(source)) {
		return { status: "loaded", url: source.directThumbnailUrl }
	}
	return EMPTY_PREVIEW_STATE
}
