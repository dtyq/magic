import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useFileApi } from "@/pages/superMagic/fileAccess/fileApi"
import type { FileApi } from "@/pages/superMagic/fileAccess/fileApi"
import { useFileAccess } from "@/pages/superMagic/fileAccess/FileAccessProvider"
import { shouldWaitForShareAccess } from "@/pages/superMagic/fileAccess/fileAccessContext"
import type { AttachmentItem } from "@/pages/superMagic/components/TopicFilesButton/hooks/types"
import type { AudioProjectListItem } from "@/types/audioProject"
import type { LoadedRecordingTextFile, RecordingDetailFileMap } from "../types/recording-detail"
import { parseMagicProjectConfig } from "../utils/magic-project-config"
import { buildRecordingDetailFileMap, getAttachmentFileName } from "../utils/recording-detail-files"
import {
	buildShareRecordingMagicProjectConfig,
	type ShareRecordingDisplayConfig,
} from "../utils/share-recording-detail"

interface ShareRecordingDetailTextState {
	transcript?: LoadedRecordingTextFile
	notes?: LoadedRecordingTextFile
	summary: Record<string, LoadedRecordingTextFile>
	magicProject?: LoadedRecordingTextFile
}

interface ShareRecordingDetailDataInput {
	projectId: string
	resourceName?: string
	target?: AttachmentItem
	attachments: {
		tree: AttachmentItem[]
		list: AttachmentItem[]
	}
}

/** Loads recording detail data directly from share attachments so the share page never depends on owner-only APIs. */
export function useShareRecordingDetailData(input: ShareRecordingDetailDataInput) {
	const { projectId, resourceName, target, attachments } = input
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState(false)
	const [projectItem, setProjectItem] = useState<AudioProjectListItem | null>(null)
	const [fileMap, setFileMap] = useState<RecordingDetailFileMap | null>(null)
	const [texts, setTexts] = useState<ShareRecordingDetailTextState>({ summary: {} })
	const [audioUrl, setAudioUrl] = useState("")
	const [refreshing, setRefreshing] = useState(false)
	const loadedRequestKeyRef = useRef("")
	const requestSequenceRef = useRef(0)
	const fileAccess = useFileAccess()
	// Bound to the ambient FileAccessProvider identity so share reads carry the share access.
	const fileApi = useFileApi()
	const targetRef = useRef(target)
	const attachmentsRef = useRef(attachments)
	targetRef.current = target
	attachmentsRef.current = attachments
	const targetKey = `${String(target?.file_id || "")}:${String(target?.relative_file_path || "")}`
	const attachmentsKey = useMemo(
		() =>
			attachments.list
				.map((item) => `${item.file_id}:${item.updated_at || ""}`)
				.sort()
				.join("|"),
		[attachments.list],
	)

	const activeProjectIdRef = useRef(projectId)
	useEffect(() => {
		activeProjectIdRef.current = projectId
	}, [projectId])

	/** Resolves every readonly detail dependency from the already-authorized share attachment snapshot. */
	const loadDetail = useCallback(
		async ({ silent = false }: { silent?: boolean } = {}) => {
			if (shouldWaitForShareAccess(fileAccess)) return
			if (!projectId) {
				setLoading(false)
				setError(true)
				return
			}

			const currentProjectId = projectId
			const requestSequence = ++requestSequenceRef.current
			const requestKey = `${projectId}:${targetKey}`
			const isInitialLoad = loadedRequestKeyRef.current !== requestKey
			// Target changes can happen inside one project, so projectId alone cannot identify the latest request.
			const isCurrentRequest = () =>
				requestSequence === requestSequenceRef.current &&
				currentProjectId === activeProjectIdRef.current
			// Keep the workbench mounted during same-bundle refreshes; only a new bundle needs the blocking skeleton.
			if (isInitialLoad) setLoading(true)
			else if (!silent) setRefreshing(true)
			setError(false)
			if (isInitialLoad) {
				setTexts({ summary: {} })
				setAudioUrl("")
			}

			try {
				const currentTarget = targetRef.current
				const currentAttachments = attachmentsRef.current
				const audioDirectory = findAudioDirectoryNode(
					currentAttachments.tree,
					currentTarget,
				)
				const bundleRootPath = resolveRecordingBundleRootPath(
					currentAttachments.tree,
					currentAttachments.list,
					currentTarget,
				)
				const magicProjectFile = findMagicProjectFile(
					currentAttachments.list,
					bundleRootPath,
				)
				const magicProjectContent = magicProjectFile
					? await readTextFile(fileApi, magicProjectFile.file_id)
					: undefined
				if (!isCurrentRequest()) return

				const parsedMagicProjectConfig = magicProjectContent?.content
					? parseMagicProjectConfig(magicProjectContent.content)
					: null
				const magicProjectConfig = buildShareRecordingMagicProjectConfig({
					magicProjectConfig: parsedMagicProjectConfig,
					audioDisplayConfig: (audioDirectory?.display_config ||
						currentTarget?.display_config) as ShareRecordingDisplayConfig | null,
				})
				const nextFileMap = buildRecordingDetailFileMap({
					tree: currentAttachments.tree,
					list: currentAttachments.list,
					magicProjectConfig,
					bundleRootPath,
				})
				// Share pages may only render files that are present in the authorized snapshot.
				nextFileMap.summaryFiles = nextFileMap.summaryFiles.filter((entry) =>
					Boolean(entry.file?.file_id),
				)
				const [nextTexts, nextAudioUrl] = await Promise.all([
					loadTextFiles(fileApi, nextFileMap, magicProjectContent),
					loadAudioUrl(fileApi, nextFileMap.audio),
				])
				// Audio is optional share content, so a missing attachment must not fail the whole load:
				// the player shows its noAudio empty state while the texts loaded above keep rendering.
				if (!isCurrentRequest()) return

				setProjectItem(
					buildShareProjectItem({
						projectId,
						resourceName,
						fileMap: nextFileMap,
						audioDisplayConfig: audioDirectory?.display_config as
							ShareRecordingDisplayConfig | null | undefined,
					}),
				)
				setFileMap(nextFileMap)
				setTexts(nextTexts)
				setAudioUrl(nextAudioUrl)
				loadedRequestKeyRef.current = requestKey
			} catch (loadError) {
				console.error("Failed to load share recording detail:", loadError)
				if (isCurrentRequest()) setError(true)
			} finally {
				if (isCurrentRequest()) {
					setLoading(false)
					setRefreshing(false)
				}
			}
		},
		// attachmentsKey intentionally recreates the loader for real attachment updates;
		// the latest arrays are read from refs to avoid unstable object dependencies.
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[attachmentsKey, fileAccess, fileApi, projectId, resourceName, targetKey],
	)

	useEffect(() => {
		// Attachment synchronization should update content quietly; only the explicit refresh button
		// requests the visible local skeleton.
		void loadDetail({ silent: true })
	}, [loadDetail])

	/** Keeps the share title stable even when the file map can only recover bundle metadata. */
	const title = useMemo(() => {
		return (
			projectItem?.project_name ||
			fileMap?.magicProjectConfig?.metadata?.title ||
			fileMap?.magicProjectConfig?.name ||
			resourceName ||
			""
		)
	}, [
		fileMap?.magicProjectConfig?.metadata?.title,
		fileMap?.magicProjectConfig?.name,
		projectItem?.project_name,
		resourceName,
	])

	return {
		loading,
		error,
		refreshing,
		projectItem,
		fileMap,
		texts,
		audioUrl,
		title,
		attachmentTree: attachments.tree,
		attachmentList: attachments.list,
		refresh: loadDetail,
	}
}

/** Reads a text attachment by file id inside the already-authorized share route session. */
async function readTextFile(
	fileApi: FileApi,
	fileId?: string,
): Promise<LoadedRecordingTextFile | undefined> {
	if (!fileId) return undefined
	const content = await fileApi.getFileContentById(fileId, {
		responseType: "text",
	})
	return {
		fileId,
		content: typeof content === "string" ? content : "",
	}
}

/** Loads transcript, notes, summary files, and preserves a preloaded magic.project.js when one was already read upstream. */
async function loadTextFiles(
	fileApi: FileApi,
	fileMap: RecordingDetailFileMap,
	preloadedMagicProject?: LoadedRecordingTextFile,
): Promise<ShareRecordingDetailTextState> {
	const summaryEntries = await Promise.all(
		fileMap.summaryFiles.map(async (entry) => {
			if (!entry.file?.file_id) return [entry.type, undefined] as const
			try {
				return [entry.type, await readTextFile(fileApi, entry.file.file_id)] as const
			} catch (error) {
				console.warn(`Failed to load share recording summary file ${entry.type}:`, error)
				return [entry.type, undefined] as const
			}
		}),
	)

	const [transcript, notes] = await Promise.all([
		readTextFile(fileApi, fileMap.transcript?.file_id).catch(() => undefined),
		readTextFile(fileApi, fileMap.notes?.file_id).catch(() => undefined),
	])

	return {
		transcript,
		notes,
		magicProject:
			preloadedMagicProject ||
			(fileMap.magicProject?.file_id
				? await readTextFile(fileApi, fileMap.magicProject.file_id).catch(() => undefined)
				: undefined),
		summary: Object.fromEntries(
			summaryEntries.filter((entry): entry is readonly [string, LoadedRecordingTextFile] =>
				Boolean(entry[1]),
			),
		),
	}
}

/** Resolves a temporary playable OSS url for the share detail audio bar. */
async function loadAudioUrl(fileApi: FileApi, file?: AttachmentItem): Promise<string> {
	if (!file?.file_id) return ""
	const [urlItem] = await fileApi.getTemporaryDownloadUrl({
		file_ids: [file.file_id],
	})
	return urlItem?.url ?? ""
}

/** Recovers the audio bundle root so filename-based fallback matching stays inside the current shared recording folder. */
function resolveRecordingBundleRootPath(
	tree: AttachmentItem[],
	list: AttachmentItem[],
	target?: AttachmentItem,
): string | undefined {
	const targetPath = getAttachmentPathCandidates(target).find(Boolean)
	if (targetPath) {
		return target?.is_directory
			? normalizeBundlePath(targetPath)
			: getParentDirectoryPath(targetPath)
	}

	const audioDirectory = findAudioDirectoryNode(tree, target)
	const audioDirectoryPath = getAttachmentPathCandidates(audioDirectory).find(Boolean)
	if (audioDirectoryPath) return normalizeBundlePath(audioDirectoryPath)

	const magicProjectFile = list.find(isMagicProjectFile)
	return getParentDirectoryPath(getAttachmentPathCandidates(magicProjectFile).find(Boolean))
}

/** Locates the shared audio directory node that carries display_config metadata and bundle file mappings. */
function findAudioDirectoryNode(
	items: AttachmentItem[] = [],
	target?: AttachmentItem,
): AttachmentItem | undefined {
	if (target?.is_directory && target.display_config?.type === "audio") return target

	for (const item of items) {
		if (item.is_directory && item.display_config?.type === "audio") return item
		const nested = findAudioDirectoryNode(item.children || [], target)
		if (nested) return nested
	}
	return undefined
}

/** Finds the bundle config file generated beside recording exports. */
function findMagicProjectFile(
	files: AttachmentItem[],
	bundleRootPath?: string,
): AttachmentItem | undefined {
	const normalizedBundleRoot = normalizeBundlePath(bundleRootPath)

	return files.find((file) => {
		if (!isMagicProjectFile(file)) return false
		if (!normalizedBundleRoot) return true

		return getAttachmentPathCandidates(file).some((candidate) =>
			normalizeBundlePath(candidate).startsWith(`${normalizedBundleRoot}/`),
		)
	})
}

/** Builds a minimal read-only project item so existing detail panels can still render metadata chips consistently. */
function buildShareProjectItem(input: {
	projectId: string
	resourceName?: string
	fileMap: RecordingDetailFileMap
	audioDisplayConfig?: ShareRecordingDisplayConfig | null
}): AudioProjectListItem {
	const { projectId, resourceName, fileMap, audioDisplayConfig } = input
	const metadata = fileMap.magicProjectConfig?.metadata ?? audioDisplayConfig?.metadata
	const projectName =
		metadata?.title ||
		fileMap.magicProjectConfig?.name ||
		audioDisplayConfig?.name ||
		resourceName ||
		""

	return {
		id: projectId,
		project_name: projectName,
		created_at: parseDisplayDateToUnix(metadata?.date),
		duration: metadata?.duration ?? 0,
		tags: metadata?.tags ?? [],
		device_id: "",
		audio_source: "recorded",
		current_phase: "summarizing",
		phase_status: "completed",
		card_status: "summarized",
		is_summarized: true,
		audio_file_id: fileMap.audio?.file_id,
		source: "h5",
	}
}

/** Normalizes attachment lookup candidates so file names, relative paths, and storage keys stay comparable. */
function getAttachmentPathCandidates(file?: AttachmentItem): string[] {
	if (!file) return []

	return [file.relative_file_path, file.path, file.file_key, getAttachmentFileName(file)].filter(
		(candidate): candidate is string => Boolean(candidate),
	)
}

/** Collapses separators and casing so bundle path comparisons work across share tree variants. */
function normalizeBundlePath(path?: string): string {
	return decodeURIComponent(path || "")
		.trim()
		.toLowerCase()
		.replace(/\\/g, "/")
		.replace(/^\/+|\/+$/g, "")
}

/** Detects the generated recording config file without depending on a specific parent folder structure. */
function isMagicProjectFile(file: AttachmentItem): boolean {
	return getAttachmentPathCandidates(file).some((candidate) =>
		normalizeBundlePath(candidate).endsWith("magic.project.js"),
	)
}

/** Strips the trailing filename so file map lookup can stay inside one shared bundle folder. */
function getParentDirectoryPath(path?: string): string | undefined {
	if (!path) return undefined

	const normalizedPath = normalizeBundlePath(path)
	if (!normalizedPath) return undefined

	const lastSlashIndex = normalizedPath.lastIndexOf("/")
	return lastSlashIndex >= 0 ? normalizedPath.slice(0, lastSlashIndex) : undefined
}

/** Parses bundle metadata timestamps into unix seconds while tolerating empty or invalid share payload values. */
function parseDisplayDateToUnix(value?: string): number {
	if (!value) return 0

	const timestamp = Date.parse(value.replace(/-/g, "/"))
	return Number.isFinite(timestamp) ? Math.floor(timestamp / 1000) : 0
}
