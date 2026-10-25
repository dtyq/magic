import { useEffect, useMemo, useRef, useState } from "react"
import { useMemoizedFn } from "ahooks"
import { SuperMagicApi } from "@/apis"
import type { AttachmentItem } from "@/pages/superMagic/components/TopicFilesButton/hooks/types"
import type { MentionListItem } from "@/components/business/MentionPanel/tiptap-plugin/types"
import { DesignProjectCreationError } from "@/pages/superMagic/components/Detail/contents/Design/utils/designProjectCreation"
import { requestProjectAttachmentsFullRefresh } from "@/pages/superMagic/services/attachmentsTopicSync"
import type { ProjectFilesStore } from "@/stores/projectFiles"
import type { AttachmentLoadState } from "@/stores/projectFiles/types"
import {
	buildAiCanvasMention,
	createAiCanvasDocument,
	findAiCanvasFolder,
	getAiCanvasDefaultFolderName,
	getRecentAiCanvasDocument,
	resolveAiCanvasFolderName,
} from "../utils/aiCanvas"

interface UseAiCanvasDocumentOptions {
	enabled: boolean
	projectId?: string
	/** The canvas folder follows this name (renames, AI-given names); see the rename sync below. */
	projectName?: string
	isReadOnly: boolean
	/** Root file tree of the selected project (projectFilesStore.workspaceFileTree). */
	attachments: AttachmentItem[]
	attachmentLoadState?: AttachmentLoadState
	projectFilesStore: Pick<ProjectFilesStore, "registerCreatedDesignProject">
	/** Opens a file tree item in the detail panel (TopicPage's handleFileClickWithPanel). */
	openCanvas: (folder: AttachmentItem) => void
}

/**
 * Keeps an AI canvas project bound to exactly one visible canvas.
 *
 * | Project files (after a full load) | Behavior                                        |
 * | has a root canvas                 | open it once per project                        |
 * | has no canvas, editable           | create one, refresh files, then open it         |
 * | has no canvas, read-only          | show the empty detail state; never write        |
 * | creation failed                   | expose the error; `retry` creates it again      |
 *
 * The canvas also takes the project's name: once the files are loaded, an editable project whose
 * name differs from its canvas folder renames that folder (once per folder and name, so a failed
 * rename is not retried in a loop). Projects without a name keep the default canvas name.
 *
 * Missing files are only judged after the project's complete request succeeded ("ready"):
 * partial snapshots may not contain the canvas yet and would otherwise create duplicates. A canvas
 * created moments ago (e.g. by the AI canvas home) can also arrive before the backend marks it as
 * a canvas; it is then registered as an optimistic canvas rather than created again.
 */
export function useAiCanvasDocument({
	enabled,
	projectId,
	projectName,
	isReadOnly,
	attachments,
	attachmentLoadState,
	projectFilesStore,
	openCanvas,
}: UseAiCanvasDocumentOptions) {
	const canvasFolder = useMemo(
		() => (enabled ? findAiCanvasFolder(attachments) : null),
		[attachments, enabled],
	)
	const [isCreating, setIsCreating] = useState(false)
	const [creationError, setCreationError] = useState(false)
	const openedKeyRef = useRef<string | null>(null)
	// One creation attempt per project; reset only by switching project or an explicit retry.
	const attemptedProjectRef = useRef<string | null>(null)
	// Last folder rename sent, as `${folderId}:${name}`.
	const renamedKeyRef = useRef<string | null>(null)
	const currentProjectRef = useRef(projectId)
	currentProjectRef.current = projectId

	const isFilesReady =
		Boolean(projectId) &&
		attachmentLoadState?.projectId === projectId &&
		attachmentLoadState?.status === "ready"

	useEffect(() => {
		openedKeyRef.current = null
		attemptedProjectRef.current = null
		renamedKeyRef.current = null
		setIsCreating(false)
		setCreationError(false)
	}, [projectId])

	const handleOpenCanvas = useMemoizedFn(openCanvas)

	useEffect(() => {
		if (!enabled || !projectId || !canvasFolder?.file_id) return
		const key = `${projectId}:${canvasFolder.file_id}`
		if (openedKeyRef.current === key) return
		openedKeyRef.current = key
		handleOpenCanvas(canvasFolder)
	}, [canvasFolder, enabled, handleOpenCanvas, projectId])

	const createCanvas = useMemoizedFn(async () => {
		if (!projectId) return
		const targetProjectId = projectId
		attemptedProjectRef.current = targetProjectId
		setIsCreating(true)
		setCreationError(false)
		try {
			const created = await createAiCanvasDocument(targetProjectId)
			if (currentProjectRef.current !== targetProjectId) return
			projectFilesStore.registerCreatedDesignProject({
				projectId: targetProjectId,
				folderId: String(created.folder.file_id),
				configFileId: String(created.magicProjectFile.file_id),
				folderName: getAiCanvasDefaultFolderName(),
				status: "confirmed",
			})
		} catch (error) {
			if (currentProjectRef.current !== targetProjectId) return
			// An ambiguous write may still have created the canvas; the refresh below decides.
			if (!(error instanceof DesignProjectCreationError && error.outcome === "ambiguous")) {
				setCreationError(true)
			}
		} finally {
			if (currentProjectRef.current === targetProjectId) {
				setIsCreating(false)
				requestProjectAttachmentsFullRefresh({
					projectId: targetProjectId,
					reason: "ai-canvas-default-canvas",
				})
			}
		}
	})

	useEffect(() => {
		if (!enabled || isReadOnly || !isFilesReady || canvasFolder || !projectId) return
		if (attemptedProjectRef.current === projectId) return
		attemptedProjectRef.current = projectId
		const recent = getRecentAiCanvasDocument(projectId)
		// Only a folder still in the tree counts: a canvas deleted since must be created again.
		if (recent && attachments.some((item) => String(item.file_id) === recent.folderId)) {
			// The folder exists but its display_config is still being written; the overlay
			// shows it as a canvas until the server snapshot confirms it.
			projectFilesStore.registerCreatedDesignProject({
				projectId,
				folderId: recent.folderId,
				configFileId: recent.configFileId,
				folderName: recent.folderName,
				status: "confirmed",
			})
			return
		}
		void createCanvas()
	}, [
		attachments,
		canvasFolder,
		createCanvas,
		enabled,
		isFilesReady,
		isReadOnly,
		projectFilesStore,
		projectId,
	])

	const targetFolderName = resolveAiCanvasFolderName(projectName)
	const canvasFolderId = canvasFolder?.file_id ? String(canvasFolder.file_id) : ""
	const canvasFolderName = canvasFolder?.file_name || canvasFolder?.name || ""

	useEffect(() => {
		if (!enabled || isReadOnly || !isFilesReady || !projectId || !canvasFolderId) return
		if (!targetFolderName || canvasFolderName === targetFolderName) return
		const key = `${canvasFolderId}:${targetFolderName}`
		if (renamedKeyRef.current === key) return
		renamedKeyRef.current = key
		const targetProjectId = projectId

		SuperMagicApi.renameFile({ file_id: canvasFolderId, target_name: targetFolderName })
			.then(() => {
				if (currentProjectRef.current !== targetProjectId) return
				// The tree refresh brings the renamed folder (and its tab label) back in.
				requestProjectAttachmentsFullRefresh({
					projectId: targetProjectId,
					reason: "ai-canvas-rename-canvas",
				})
			})
			.catch((error) => console.error("Failed to rename the AI canvas folder:", error))
	}, [
		canvasFolderId,
		canvasFolderName,
		enabled,
		isFilesReady,
		isReadOnly,
		projectId,
		targetFolderName,
	])

	const canvasMentionItems = useMemo<MentionListItem[]>(
		() => (canvasFolder ? [buildAiCanvasMention(canvasFolder)] : []),
		[canvasFolder],
	)

	return {
		canvasFolder,
		canvasMentionItems,
		isCreating,
		creationError: creationError && !canvasFolder,
		retry: createCanvas,
	}
}
