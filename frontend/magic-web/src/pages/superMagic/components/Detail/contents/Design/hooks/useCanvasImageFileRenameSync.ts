import { useCallback, useEffect, useRef, type RefObject } from "react"
import { useTranslation } from "react-i18next"
import type { CanvasDocument, ImageElement } from "@/components/CanvasDesign/canvas/types"
import type { CanvasDesignRef } from "@/components/CanvasDesign/types"
import { SuperMagicApi } from "@/apis"
import magicToast from "@/components/base/MagicToaster/utils"
import type { FileItem } from "@/pages/superMagic/components/Detail/components/FilesViewer/types"
import type { DesignAttachmentIndex } from "../utils/designAttachmentIndex"
import { validateFilename } from "@/utils/filename-validator"
import { normalizeDesignAttachmentPathForCanvas } from "../utils/designDslPathUtils"
import { compareDesignData, findFileBySrc, normalizePath, splitFileName } from "../utils/utils"
import { replaceCanvasFilePathReferences } from "../utils/replace-canvas-file-path-references"
import { registerWaitForNextAttachmentsRefreshForProject } from "@/pages/superMagic/services/attachmentsTopicSync"

const GENERIC_CLIPBOARD_IMAGE_FILE_NAME_PATTERN =
	/^image(?:\(\d+\))?\.(png|jpg|jpeg|webp|gif|bmp)$/i

interface PendingImageFileRenameTask {
	fileId: string
	targetFileName: string
}

interface UseCanvasImageFileRenameSyncOptions {
	canvasDesignRef: RefObject<CanvasDesignRef | null>
	currentCanvasData?: CanvasDocument
	flatAttachments: FileItem[]
	attachmentIndex?: DesignAttachmentIndex | null
	designProjectBasePath?: string
	projectId?: string
	persistCanvasData: (canvasData: CanvasDocument) => void
	updateAttachments: () => void
}

interface UseCanvasImageFileRenameSyncReturn {
	handleCanvasDesignDataChange: (canvasData: CanvasDocument) => void
}

function isGenericClipboardImageFileName(fileName: string): boolean {
	return GENERIC_CLIPBOARD_IMAGE_FILE_NAME_PATTERN.test(fileName.trim())
}

function buildTargetFileName(elementName: string, originalFileName: string): string {
	const { extension } = splitFileName(originalFileName)
	return `${elementName}${extension}`
}

function getFileDisplayName(fileItem: FileItem | null | undefined): string {
	if (!fileItem) return ""
	return fileItem.file_name || fileItem.display_filename || fileItem.filename || ""
}

function getParentDirectoryPath(filePath: string): string {
	const normalizedFilePath = normalizePath(filePath)
	const lastSlashIndex = normalizedFilePath.lastIndexOf("/")
	if (lastSlashIndex === -1) return ""
	return normalizedFilePath.slice(0, lastSlashIndex)
}

function buildFallbackRelativeFilePath(filePath: string, nextFileName: string): string {
	const normalizedFilePath = normalizePath(filePath)
	if (!normalizedFilePath) return nextFileName

	const parentDirectoryPath = getParentDirectoryPath(normalizedFilePath)
	if (!parentDirectoryPath) return nextFileName

	return `${parentDirectoryPath}/${nextFileName}`
}

function hasDuplicateSiblingFileName(
	flatAttachments: FileItem[],
	fileId: string,
	targetFileName: string,
	parentDirectoryPath: string,
): boolean {
	return flatAttachments.some((item) => {
		if (item.is_directory || item.file_id === fileId) return false
		if (getFileDisplayName(item) !== targetFileName) return false
		return getParentDirectoryPath(item.relative_file_path || "") === parentDirectoryPath
	})
}

export function useCanvasImageFileRenameSync(
	options: UseCanvasImageFileRenameSyncOptions,
): UseCanvasImageFileRenameSyncReturn {
	const {
		canvasDesignRef,
		currentCanvasData,
		flatAttachments,
		attachmentIndex,
		designProjectBasePath,
		projectId,
		persistCanvasData,
		updateAttachments,
	} = options
	const { t } = useTranslation("super")

	const previousCanvasDataRef = useRef<CanvasDocument | undefined>(currentCanvasData)
	const latestCanvasDataRef = useRef<CanvasDocument | undefined>(currentCanvasData)
	const flatAttachmentsRef = useRef<FileItem[]>(flatAttachments)
	const attachmentIndexRef = useRef<DesignAttachmentIndex | null | undefined>(attachmentIndex)
	const designProjectBasePathRef = useRef(designProjectBasePath)
	const isApplyingSyncedCanvasUpdateRef = useRef(false)
	const queuedTaskKeysRef = useRef<Set<string>>(new Set())
	const queueRef = useRef<Promise<void>>(Promise.resolve())

	useEffect(() => {
		previousCanvasDataRef.current = currentCanvasData
		latestCanvasDataRef.current = currentCanvasData
	}, [currentCanvasData])

	useEffect(() => {
		flatAttachmentsRef.current = flatAttachments
	}, [flatAttachments])

	useEffect(() => {
		designProjectBasePathRef.current = designProjectBasePath
	}, [designProjectBasePath])

	useEffect(() => {
		attachmentIndexRef.current = attachmentIndex
	}, [attachmentIndex])

	const syncImageFileRename = useCallback(
		async (task: PendingImageFileRenameTask) => {
			const currentAttachments = flatAttachmentsRef.current
			const currentFileItem =
				currentAttachments.find(
					(item) => !item.is_directory && item.file_id === task.fileId,
				) ?? null
			if (!currentFileItem) return

			const currentFileName = getFileDisplayName(currentFileItem)
			if (!currentFileName || currentFileName === task.targetFileName) return

			const validationResult = validateFilename(task.targetFileName, false, { t })
			if (!validationResult.isValid) {
				magicToast.error(
					validationResult.errorMessage || t("topicFiles.contextMenu.renameFailed"),
				)
				return
			}

			const parentDirectoryPath = getParentDirectoryPath(
				currentFileItem.relative_file_path || "",
			)
			if (
				hasDuplicateSiblingFileName(
					currentAttachments,
					task.fileId,
					task.targetFileName,
					parentDirectoryPath,
				)
			) {
				magicToast.error(t("topicFiles.contextMenu.newFile.duplicateError"))
				return
			}

			try {
				await SuperMagicApi.renameFile({
					file_id: task.fileId,
					target_name: task.targetFileName,
				})
			} catch (error) {
				const errorMessage =
					error instanceof Error && error.message
						? error.message
						: t("topicFiles.contextMenu.renameFailed")
				magicToast.error(errorMessage)
				return
			}

			updateAttachments()
			try {
				await registerWaitForNextAttachmentsRefreshForProject(projectId, {
					timeoutMs: 15_000,
				})
			} catch {
				// 超时仍继续用当前 flatAttachments / 回退路径
			}

			const refreshedAttachments = flatAttachmentsRef.current
			const renamedFileItem =
				refreshedAttachments.find(
					(item) => !item.is_directory && item.file_id === task.fileId,
				) ?? null

			const oldWorkspaceRelativePath =
				currentFileItem.relative_file_path || currentFileItem.file_name || currentFileName
			const renamedRelativeFilePath =
				renamedFileItem?.relative_file_path ||
				buildFallbackRelativeFilePath(
					currentFileItem.relative_file_path || currentFileName,
					task.targetFileName,
				)
			if (!oldWorkspaceRelativePath || !renamedRelativeFilePath) return

			const latestCanvasData = latestCanvasDataRef.current
			if (!latestCanvasData) return

			const nextCanvasPath = normalizeDesignAttachmentPathForCanvas(
				renamedRelativeFilePath,
				designProjectBasePathRef.current,
			)
			const nextCanvasData = replaceCanvasFilePathReferences(latestCanvasData, {
				oldWorkspaceRelativePath,
				newCanvasPath: nextCanvasPath,
				designProjectBasePath: designProjectBasePathRef.current,
			})
			if (nextCanvasData === latestCanvasData) return

			latestCanvasDataRef.current = nextCanvasData
			previousCanvasDataRef.current = nextCanvasData
			persistCanvasData(nextCanvasData)

			if (!canvasDesignRef.current) return

			isApplyingSyncedCanvasUpdateRef.current = true
			canvasDesignRef.current.updateData(nextCanvasData)
		},
		[canvasDesignRef, persistCanvasData, projectId, t, updateAttachments],
	)

	const enqueueRenameTask = useCallback(
		(task: PendingImageFileRenameTask) => {
			const taskKey = `${task.fileId}\0${task.targetFileName}`
			if (queuedTaskKeysRef.current.has(taskKey)) return

			queuedTaskKeysRef.current.add(taskKey)
			queueRef.current = queueRef.current
				.catch(() => undefined)
				.then(async () => {
					try {
						await syncImageFileRename(task)
					} finally {
						queuedTaskKeysRef.current.delete(taskKey)
					}
				})
		},
		[syncImageFileRename],
	)

	const handleCanvasDesignDataChange = useCallback(
		(canvasData: CanvasDocument) => {
			latestCanvasDataRef.current = canvasData

			if (isApplyingSyncedCanvasUpdateRef.current) {
				isApplyingSyncedCanvasUpdateRef.current = false
				previousCanvasDataRef.current = canvasData
				return
			}

			const previousCanvasData = previousCanvasDataRef.current
			previousCanvasDataRef.current = canvasData
			if (!previousCanvasData) return

			const diff = compareDesignData(
				{ type: "design", name: "", version: "1.0.0", canvas: previousCanvasData },
				{ type: "design", name: "", version: "1.0.0", canvas: canvasData },
			)
			if (!diff.modified.length) return

			diff.modified.forEach((change) => {
				const oldElement = change.oldElement as ImageElement | undefined
				const newElement = change.newElement as ImageElement | undefined
				if (oldElement?.type !== "image" || newElement?.type !== "image") return
				if ((oldElement.name || "").trim() === (newElement.name || "").trim()) return

				const nextElementName = (newElement.name || "").trim()
				if (!nextElementName) return

				const sourcePath = newElement.src || oldElement.src
				if (!sourcePath) return

				const matchedFileItem = findFileBySrc(
					sourcePath,
					flatAttachmentsRef.current,
					designProjectBasePathRef.current,
					attachmentIndexRef.current,
				)
				if (!matchedFileItem?.file_id) return

				const currentFileName = getFileDisplayName(matchedFileItem)
				if (!currentFileName || !isGenericClipboardImageFileName(currentFileName)) return

				const targetFileName = buildTargetFileName(nextElementName, currentFileName)
				if (!targetFileName || targetFileName === currentFileName) return

				enqueueRenameTask({
					fileId: matchedFileItem.file_id,
					targetFileName,
				})
			})
		},
		[enqueueRenameTask],
	)

	return {
		handleCanvasDesignDataChange,
	}
}
