import { useCallback, useEffect, useMemo, useRef, type RefObject } from "react"
import { useTranslation } from "react-i18next"
import type { CanvasDocument } from "@/components/CanvasDesign/runtime/document/types"
import {
	getImageContentById,
	isImageElementContent,
} from "@/components/CanvasDesign/runtime/document/elementContent"
import type { CanvasDesignRef } from "@/components/CanvasDesign/public/props"
import type {
	CanvasImageFileRename,
	CanvasImageRenameFile,
	CanvasImageRenameMethods,
} from "@/components/CanvasDesign/public/magic-types"
import { GenerationStatus } from "@/components/CanvasDesign/public/magic-types"
import type { ResolveCanvasResourceReference } from "@/components/CanvasDesign/public/resource-reference"
import { SuperMagicApi } from "@/apis"
import type { FileItem } from "@/pages/superMagic/components/Detail/components/FilesViewer/types"
import {
	buildDesignAttachmentIndex,
	type DesignAttachmentIndex,
} from "../utils/designAttachmentIndex"
import { validateFilename } from "@/utils/filename-validator"
import { normalizePath } from "../utils/utils"
import {
	getCanvasFilePathReplacementResult,
	type CanvasFilePathReplacementResult,
} from "../utils/replace-canvas-file-path-references"
import { registerWaitForNextAttachmentsRefreshForProject } from "@/pages/superMagic/services/attachmentsTopicSync"
import {
	resolveDesignCanvasResourceFileItem,
	resolveDesignResourceReference,
	type DesignResourceReferenceResolverContext,
} from "../utils/designResourceReferenceResolver"

interface Options {
	canvasDesignRef: RefObject<CanvasDesignRef | null>
	currentCanvasData?: CanvasDocument
	flatAttachments: FileItem[]
	attachmentsReady?: boolean
	attachmentIndex?: DesignAttachmentIndex | null
	designProjectBasePath?: string
	projectId?: string
	persistCanvasData: (canvasData: CanvasDocument) => void
	updateAttachments: () => void
}

function fileName(file: FileItem): string {
	return file.file_name || file.display_filename || file.filename || ""
}

function parentPath(path: string): string {
	const normalized = normalizePath(path)
	const index = normalized.lastIndexOf("/")
	return index < 0 ? "" : normalized.slice(0, index)
}

export function useCanvasImageFileRenameSync(options: Options): CanvasImageRenameMethods {
	const { t } = useTranslation("super")
	// 请求等待期间始终读取最新画布与附件，不能把打开面板时的整份文档写回。
	const latest = useRef(options)
	latest.current = options
	const queue = useRef<Promise<void>>(Promise.resolve())
	const pending = useRef(new Map<string, Promise<CanvasImageRenameFile>>())
	const referenceUpdates = useRef(
		new Map<string, (document: CanvasDocument) => CanvasFilePathReplacementResult>(),
	)
	// 请求结果未知时，等待新的附件快照再允许重试，避免把超时当作未写入。
	const uncertain = useRef(new Map<string, FileItem | undefined>())
	const contextRevision = useRef(0)
	const contextCache = useRef<{
		attachments: FileItem[]
		index?: DesignAttachmentIndex | null
		basePath?: string
		ready?: boolean
		revision: number
		value: DesignResourceReferenceResolverContext
	}>()
	// 已由接口确认、但附件快照尚未跟上的结果，避免刷新延迟导致重复写入。
	const confirmed = useRef(
		new Map<string, { file: CanvasImageRenameFile; previousName: string }>(),
	)
	useEffect(() => {
		for (const [id, record] of confirmed.current) {
			const attachment = options.flatAttachments.find((item) => item.file_id === id)
			if (attachment && fileName(attachment) !== record.previousName) {
				confirmed.current.delete(id)
				contextRevision.current += 1
			}
		}
	}, [options.flatAttachments])

	const context = useCallback(() => {
		const snapshot = latest.current
		const cached = contextCache.current
		if (
			cached &&
			cached.attachments === snapshot.flatAttachments &&
			cached.index === snapshot.attachmentIndex &&
			cached.basePath === snapshot.designProjectBasePath &&
			cached.ready === snapshot.attachmentsReady &&
			cached.revision === contextRevision.current
		)
			return cached.value
		const flatAttachments = confirmed.current.size
			? snapshot.flatAttachments.map((item) => {
					const record = confirmed.current.get(item.file_id)
					if (!record || fileName(item) !== record.previousName) return item
					const file = record.file
					return {
						...item,
						file_name: file.fileName,
						relative_file_path: file.parentPath
							? `${file.parentPath}/${file.fileName}`
							: file.fileName,
					}
				})
			: snapshot.flatAttachments
		// 附件与确认结果未变化时复用索引，避免每一行和每次输入都重新扫描万级文件列表。
		const value = {
			flatAttachments,
			attachmentsReady: snapshot.attachmentsReady,
			attachmentIndex: confirmed.current.size
				? buildDesignAttachmentIndex(flatAttachments)
				: snapshot.attachmentIndex,
			designProjectBasePath: snapshot.designProjectBasePath,
		}
		contextCache.current = {
			attachments: snapshot.flatAttachments,
			index: snapshot.attachmentIndex,
			basePath: snapshot.designProjectBasePath,
			ready: snapshot.attachmentsReady,
			revision: contextRevision.current,
			value,
		}
		return value
	}, [])

	const resolveImageRenameFile = useCallback(
		(path: string): CanvasImageRenameFile | undefined => {
			const matched = resolveDesignCanvasResourceFileItem(path, context())
			if (matched?.file_id) {
				const cached = confirmed.current.get(matched.file_id)
				if (cached) return cached.file
				const name = fileName(matched)
				if (!name) return undefined
				return {
					fileId: matched.file_id,
					fileName: name,
					sourcePath: path,
					parentPath: parentPath(matched.relative_file_path || name),
				}
			}
			return [...confirmed.current.values()].find((record) => record.file.sourcePath === path)
				?.file
		},
		[context],
	)

	const validateImageFileRenames = useCallback(
		(changes: readonly CanvasImageFileRename[]): Record<string, string> => {
			const errors: Record<string, string> = {}
			const destinations = new Map<string, string>()
			const canvas = latest.current.canvasDesignRef.current?.getCanvasInstance()
			for (const change of changes) {
				if (uncertain.current.has(change.fileId)) {
					const fresh = latest.current.flatAttachments.find(
						(item) => item.file_id === change.fileId,
					)
					if (!fresh || fresh === uncertain.current.get(change.fileId)) {
						errors[change.fileId] = t("design.rename.verifyResult")
						continue
					}
					uncertain.current.delete(change.fileId)
				}
				const element = canvas?.elementManager.getElementData(change.elementId)
				const content =
					element && isImageElementContent(element)
						? getImageContentById(element, change.contentId)
						: undefined
				const file = content?.src ? resolveImageRenameFile(content.src) : undefined
				if (
					!content ||
					content.status === GenerationStatus.Pending ||
					content.status === GenerationStatus.Processing ||
					!canvas?.permissionManager.canRename(element) ||
					!file ||
					file.fileId !== change.fileId
				) {
					errors[change.fileId] = t("design.rename.fileUnavailable")
					continue
				}
				if (file.fileName !== change.expectedName && file.fileName !== change.targetName) {
					errors[change.fileId] = t("design.rename.fileChanged")
					continue
				}
				const validation = validateFilename(change.targetName, false, { t })
				if (!validation.isValid) {
					errors[change.fileId] =
						validation.errorMessage || t("topicFiles.contextMenu.renameFailed")
					continue
				}
				const destination = `${file.parentPath}/${change.targetName}`
				const other = destinations.get(destination)
				if (other && other !== file.fileId) {
					errors[other] = errors[file.fileId] = t(
						"topicFiles.contextMenu.newFile.duplicateError",
					)
				}
				destinations.set(destination, file.fileId)
				const duplicate = latest.current.flatAttachments.some((item) => {
					if (item.is_directory || item.file_id === file.fileId) return false
					const currentName =
						confirmed.current.get(item.file_id)?.file.fileName || fileName(item)
					return (
						currentName === change.targetName &&
						parentPath(item.relative_file_path || currentName) === file.parentPath
					)
				})
				if (duplicate)
					errors[file.fileId] = t("topicFiles.contextMenu.newFile.duplicateError")
			}
			return errors
		},
		[resolveImageRenameFile, t],
	)

	const performRename = useCallback(
		async (change: CanvasImageFileRename): Promise<CanvasImageRenameFile> => {
			const error = validateImageFileRenames([change])[change.fileId]
			if (error) throw new Error(error)
			const { canvasDesignRef, projectId, updateAttachments } = latest.current
			const canvas = canvasDesignRef.current?.getCanvasInstance()
			const element = canvas?.elementManager.getElementData(change.elementId)
			const content =
				element && isImageElementContent(element)
					? getImageContentById(element, change.contentId)
					: undefined
			const file = content?.src ? resolveImageRenameFile(content.src) : undefined
			if (!file) throw new Error(t("design.rename.fileUnavailable"))
			const updateReferences = () => {
				const replace = referenceUpdates.current.get(file.fileId)
				if (!replace) return
				const document =
					canvasDesignRef.current?.exportCurrentDocument() ||
					latest.current.currentCanvasData
				if (!document) throw new Error(t("design.rename.fileRenamedSaveFailed"))
				const replacement = replace(document)
				if (replacement.status === "unsafe")
					throw new Error(t("design.rename.fileRenamedSaveFailed"))
				if (replacement.canvasData !== document) {
					latest.current.persistCanvasData(replacement.canvasData)
					canvasDesignRef.current?.updateData(replacement.canvasData, {
						historyPolicy: "exclude",
					})
				}
				canvas?.historyManager.applyExternalFileRename(
					(snapshot) => replace(snapshot).canvasData,
				)
				referenceUpdates.current.delete(file.fileId)
			}
			// 文件接口成功、画布更新失败时，重试只修复引用，不重复请求文件改名。
			if (file.fileName === change.targetName) {
				updateReferences()
				return file
			}
			updateReferences()
			const currentFile = latest.current.flatAttachments.find(
				(item) => item.file_id === file.fileId,
			)
			if (!currentFile) throw new Error(t("design.rename.fileUnavailable"))
			const oldPath = file.parentPath ? `${file.parentPath}/${file.fileName}` : file.fileName
			const targetPath = file.parentPath
				? `${file.parentPath}/${change.targetName}`
				: change.targetName
			const resolverContext = context()
			const resolveResourceReference: ResolveCanvasResourceReference = (
				input,
				inputOptions,
			) => resolveDesignResourceReference(input, resolverContext, inputOptions)
			const target = resolveResourceReference({
				namespace: "workspace-path",
				path: targetPath,
			})
			const document =
				canvasDesignRef.current?.exportCurrentDocument() || latest.current.currentCanvasData
			if (target.status !== "resolved" || !document)
				throw new Error(t("design.rename.fileUnavailable"))
			const replacementOptions = {
				preserveAssetReferences: true,
				oldWorkspaceRelativePath: oldPath,
				newCanvasPath: target.storagePath,
				resolveResourceReference,
			}
			if (
				getCanvasFilePathReplacementResult(document, replacementOptions).status === "unsafe"
			)
				throw new Error(t("topicFiles.contextMenu.renameFailed"))

			let requestError: unknown
			try {
				await SuperMagicApi.renameFile({
					file_id: file.fileId,
					target_name: change.targetName,
				})
			} catch (error) {
				requestError = error
			}
			updateAttachments()
			try {
				await registerWaitForNextAttachmentsRefreshForProject(projectId, {
					timeoutMs: 15_000,
				})
			} catch {
				/* 超时仍继续用当前 flatAttachments / 回退路径 */
			}
			const refreshed = latest.current.flatAttachments.find(
				(item) => item.file_id === file.fileId,
			)
			const refreshedName = refreshed ? fileName(refreshed) : undefined
			// 超时可能已写入：只能在附件确认目标名称后继续，不能把未知结果直接当成可安全重试。
			if (requestError && refreshedName !== change.targetName) {
				if (!refreshed || refreshed === currentFile)
					uncertain.current.set(file.fileId, refreshed)
				throw new Error(
					refreshed && refreshed !== currentFile && requestError instanceof Error
						? requestError.message
						: t("design.rename.verifyResult"),
				)
			}
			const nextFile = {
				...file,
				fileName: change.targetName,
				sourcePath: target.storagePath,
			}
			confirmed.current.set(file.fileId, { file: nextFile, previousName: file.fileName })
			contextRevision.current += 1
			referenceUpdates.current.set(file.fileId, (document) =>
				getCanvasFilePathReplacementResult(document, replacementOptions),
			)
			updateReferences()
			return nextFile
		},
		[context, resolveImageRenameFile, t, validateImageFileRenames],
	)

	const renameImageFile = useCallback(
		(change: CanvasImageFileRename) => {
			const key = `${change.fileId}\0${change.targetName}`
			const current = pending.current.get(key)
			if (current) return current
			const task = queue.current.catch(() => undefined).then(() => performRename(change))
			pending.current.set(key, task)
			queue.current = task.then(
				() => undefined,
				() => undefined,
			)
			void task.finally(() => pending.current.delete(key)).catch(() => undefined)
			return task
		},
		[performRename],
	)
	return useMemo(
		() => ({ resolveImageRenameFile, validateImageFileRenames, renameImageFile }),
		[resolveImageRenameFile, validateImageFileRenames, renameImageFile],
	)
}
