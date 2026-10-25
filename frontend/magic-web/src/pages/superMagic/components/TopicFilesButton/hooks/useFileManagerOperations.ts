import { useEffect, useRef, useState } from "react"
import { useMemoizedFn } from "ahooks"
import { useTranslation } from "react-i18next"
import { SuperMagicApi } from "@/apis"
import magicToast from "@/components/base/MagicToaster/utils"
import { processDroppedItems } from "../utils/file-system"
import { getFileReferenceIdentityKey } from "../../../services/userFileReferenceResolver"
import { useDownloadProgress } from "../../../hooks/useDownloadProgress"
import workspaceStore from "../../../stores/core/workspace"
import projectStore from "../../../stores/core/project"
import { useFileOperations } from "./useFileOperations"
import { useMoveFile } from "./useMoveFile"
import { useCopyFileSelector } from "./useCopyFileSelector"
import { useCrossProjectFileOperation } from "./useCrossProjectFileOperation"
import { useImportFromOtherProject } from "./useImportFromOtherProject"
import { useDuplicateFileHandler } from "./useDuplicateFileHandler"
import { useUploadWithModal } from "./useUploadWithModal"
import { useDragUpload } from "./useDragUpload"
import { useBatchDownload } from "./useBatchDownload"
import { useFileManagerNames } from "./useFileManagerNames"
import { useFileManagerConfirmation } from "./useFileManagerConfirmation"
import { useFileReplace } from "./useFileReplace"
import { useSelectedFilesManager } from "./useSelectedFilesManager"
import { useShareFile } from "./useShareFile"
import { useFileInfoPanel } from "./useFileInfoPanel"
import { useContextMenu } from "./useContextMenu"
import { scheduleFileManagerRename } from "./scheduleFileManagerRename"
import { useDownloadImageMenu } from "../../Detail/contents/Image/hooks/useDownloadImageMenu"
import { useAICardCreateDialog } from "../../Detail/components/SelfMediaRootRender/components/AICardCreateDialog"
import { getAttachmentKey } from "../utils/getAttachmentKey"
import { getDuplicateFileModalProps } from "../components/duplicateFileModalProps"
import { resolveTopicFilesCapabilities } from "../file-space"
import type { FileManagerProps } from "../components/FileManager/types"
import type { AttachmentIndex } from "../utils/attachmentIndex"
import type { AttachmentItem, FileOperationPreparation } from "./types"

interface Options {
	props: FileManagerProps
	index: AttachmentIndex
	directory?: AttachmentItem
	selectedIds: Set<string>
	setSelectedIds: (ids: Set<string>) => void
	onOpen: (file: AttachmentItem) => void
	onMoveComplete: (ids: string[]) => void
}

interface TransferPreparation {
	fileIds: string[]
	targetId: string
	targetName: string
	mode: "move" | "copy"
	phase: Parameters<FileOperationPreparation["onPhase"]>[0] | "error"
}

/** 组合现有文件业务流程。手势和快捷键只调用这里暴露的操作，不直接请求文件 API。 */
export function useFileManagerOperations({
	props,
	index,
	directory,
	selectedIds,
	setSelectedIds,
	onOpen,
	onMoveComplete,
}: Options) {
	const { t } = useTranslation("super")
	const { attachments, projectId, spaceConfig, selectedProject, selectedTopic } = props
	const transferPending = useRef(false)
	const retryTransfer = useRef<(() => Promise<void>) | null>(null)
	const [preparingTransfer, setPreparingTransfer] = useState(false)
	const [transferPreparation, setTransferPreparation] = useState<TransferPreparation | null>(null)
	const currentTransfer = useRef<{
		controller: AbortController
		phase: TransferPreparation["phase"]
	} | null>(null)
	const activeScope = useRef({ key: props.scopeKey, active: props.isActive })
	activeScope.current = { key: props.scopeKey, active: props.isActive }
	const confirmation = useFileManagerConfirmation({
		scopeKey: props.scopeKey,
		isActive: props.isActive,
		rootName: props.rootName,
		index,
		attachments,
	})
	const callbacks = spaceConfig?.operations
	const confirmUpload = useMemoizedFn((files: File[], target?: AttachmentItem) =>
		confirmation.confirm({
			operation: "upload",
			files,
			target,
			targetPath: [
				props.rootName,
				(!target && !directory) || (target ?? directory)?.file_id === props.rootId
					? (props.defaultWritePath ?? (target ?? directory)?.relative_file_path)
					: (target ?? directory)?.relative_file_path,
			]
				.filter(Boolean)
				.join(" / "),
		}),
	)
	const replace = useFileReplace({
		projectId,
		selectedProject,
		selectedTopic,
		fileScope: spaceConfig?.scope,
		beforeReplace: (target, file) =>
			confirmation.confirm({
				operation: "replace",
				files: [file],
				target,
				targetPath: [props.rootName, target.relative_file_path || target.file_name]
					.filter(Boolean)
					.join(" / "),
			}),
	})
	const capabilities = resolveTopicFilesCapabilities(spaceConfig?.capabilities)
	const selectedWorkspace = selectedProject
		? workspaceStore.getWorkspaceById(selectedProject.workspace_id)
		: null
	const downloadProgress = useDownloadProgress()
	const duplicate = useDuplicateFileHandler({ attachments })
	const operations = useFileOperations({
		beforeUpload: confirmUpload,
		attachments,
		projectId,
		projectFilesStore: props.projectFilesStore,
		selectedProject: selectedProject ?? undefined,
		selectedTopic,
		fileScope: spaceConfig?.scope,
		isCurrent: callbacks?.isCurrent,
		resolveCreateParent: callbacks?.resolveCreateParent,
		onNodeCreated: callbacks?.onNodeCreated,
		onFileClick: onOpen,
		onFileCreated: onOpen,
		onUpdateAttachments: props.onRefresh,
		getItemId: getAttachmentKey,
		selectedItems: selectedIds,
		filteredFiles: attachments,
		duplicateFileHandler: duplicate,
		downloadProgress,
	})
	const names = useFileManagerNames(props, operations, directory)
	const pendingMoveIds = useRef<string[]>([])
	const move = useMoveFile({
		confirmOperation: confirmation.confirm,
		projectId,
		attachments,
		attachmentIndex: index,
		allFiles: attachments,
		selectedItems: selectedIds,
		setSelectedItems: setSelectedIds,
		getItemId: getAttachmentKey,
		directorySource: spaceConfig?.directorySource,
		isCurrent: callbacks?.isCurrent,
		handleMoveFile: operations.handleMoveFile,
		useDetailedDuplicateConflict: true,
		onMoveSuccess: (ids) => {
			onMoveComplete(ids ?? pendingMoveIds.current)
			pendingMoveIds.current = []
			props.onRefresh()
		},
		onDirectoryMoveComplete: (files, targetId) => {
			callbacks?.onDirectoryMoveComplete(files, targetId)
		},
		onDirectoryMoveSuccess: (files) => {
			onMoveComplete(files.flatMap((file) => (file.file_id ? [file.file_id] : [])))
		},
	})
	const crossProject = useCrossProjectFileOperation({
		confirmOperation: confirmation.confirm,
		isCurrent: callbacks?.isCurrent,
		fileScope: spaceConfig?.scope,
		projectId,
		selectedProject: selectedProject ?? null,
		selectedWorkspace,
		projects: projectStore.projects,
		onSuccess: (result) => {
			if (result?.operationType === "move") onMoveComplete(result.fileIds)
			if (result?.operationType === "copy" && result.targetParentId)
				callbacks?.onDirectoryMoveComplete([], result.targetParentId)
			props.onRefresh()
		},
	})
	const copy = useCopyFileSelector({
		projectId,
		attachments,
		directorySource: spaceConfig?.directorySource,
	})
	const importOperation = useImportFromOtherProject({
		isCurrent: () => props.isActive && (callbacks?.isCurrent?.() ?? true),
		confirmOperation: confirmation.confirm,
		projectId,
		selectedProject: selectedProject ?? null,
		selectedWorkspace,
		workspaces: workspaceStore.workspaces,
		attachments,
		onSuccess: props.onRefresh,
	})
	const chat = useSelectedFilesManager({
		selectedItems: selectedIds,
		mergedFiles: attachments,
		getItemId: getAttachmentKey,
		selectedProject: spaceConfig?.chatContext?.selectedProject ?? selectedProject,
		selectedWorkspace: spaceConfig?.chatContext?.selectedWorkspace ?? selectedWorkspace,
		createAttachmentMention: spaceConfig?.chatContext?.createAttachmentMention,
		fileSpaceType: spaceConfig?.chatContext?.fileSpaceType,
	})
	const share = useShareFile({
		getItemId: getAttachmentKey,
		selectedItems: selectedIds,
		mergedFiles: attachments,
		setShareFileInfo: operations.setShareFileInfo,
		setShareModalVisible: operations.setShareModalVisible,
		selectedProject: selectedProject ?? undefined,
	})
	const batchShare = async (fileIds: string[]) => {
		const similar = await SuperMagicApi.findSimilarShares({ file_ids: fileIds }).catch(() => [])
		if (similar.length) {
			share.setSimilarShares(similar, fileIds)
			return
		}
		operations.setShareFileInfo({ projectName: selectedProject?.project_name, fileIds })
		operations.setShareModalVisible(true)
	}
	const batch = useBatchDownload({
		confirmOperation: confirmation.confirm,
		fileScope: spaceConfig?.scope,
		projectId,
		getItemId: getAttachmentKey,
		selectedItems: selectedIds,
		setSelectedItems: setSelectedIds,
		filteredFiles: attachments,
		attachments,
		selectedProject,
		selectedWorkspace,
		crossProjectOperation: {
			openMoveModal: (ids) => moveTo(ids),
			openCopyModal: (ids) => copyTo(ids),
		},
		moveFileHook: { openBatchMove: () => moveTo([...selectedIds]) },
		getParentPathByFileId: index.getParentItemsById,
		onUpdateAttachments: props.onRefresh,
		onDownloadSelected: spaceConfig?.scope ? operations.downloadSelectedFiles : undefined,
		resolveDeleteItems: callbacks?.resolveDeleteItems,
		beforeDelete: callbacks?.beforeDelete,
		onFilesDeleted: callbacks?.onFilesDeleted,
		isCurrent: callbacks?.isCurrent,
		removeFile: operations.removeFile,
		isMoving: move.isMoving,
		allowEdit: Boolean(
			props.allowEdit &&
			[...selectedIds].every((id) => {
				const file = index.getItemById(id)
				return file && (props.isItemMutable?.(file) ?? true)
			}),
		),
		allowCopyTo: Boolean(spaceConfig?.directorySource && props.allowEdit && capabilities.copy),
		allowDownload: props.allowDownload,
		allowMove: capabilities.move,
		allowCopy: capabilities.copy,
		allowShare: capabilities.share,
		onBatchShareClick: capabilities.share ? batchShare : undefined,
		isInProject: Boolean(projectId),
		downloadProgress,
	})
	const uploadTarget = useRef<AttachmentItem>()
	const userUpload = useUploadWithModal({
		beforeUpload: (files) => confirmUpload(files, uploadTarget.current),
		projectId,
		fileScope: spaceConfig?.scope,
		title: props.rootName,
		resolveUploadTarget: callbacks
			? () => callbacks.resolveUploadTarget(uploadTarget.current)
			: undefined,
	})
	const cancelUserUpload = useMemoizedFn(userUpload.cancelDirectUpload)
	useEffect(() => () => cancelUserUpload(), [props.scopeKey, cancelUserUpload])
	const dragUpload = useDragUpload({
		allowUpload: Boolean(props.allowEdit && capabilities.upload),
		projectId,
		fileScope: spaceConfig?.scope,
		selectedProject,
		selectedTopic,
		workspaceId: selectedProject?.workspace_id,
		attachments,
		duplicateFileHandler: duplicate,
		onUpdateAttachments: props.onRefresh,
	})
	const uploadFile = (target?: AttachmentItem) => {
		if (callbacks) {
			uploadTarget.current = target ?? directory
			userUpload.handleCustomUploadFile()
		} else operations.handleUploadFile(target ?? directory)
	}
	const uploadFiles = async (files: File[], target?: AttachmentItem) => {
		if (callbacks) {
			uploadTarget.current = target ?? directory
			await userUpload.handleFilesSelected(files, false, true)
		} else await dragUpload.handleUploadFiles(files, target ?? directory, false)
	}
	const externalDrop = async (data: DataTransfer, target?: AttachmentItem) => {
		const identity = getFileReferenceIdentityKey()
		try {
			const dropped = await processDroppedItems(data)
			if (identity !== getFileReferenceIdentityKey()) return
			if (
				!(await confirmUpload(
					[
						...dropped.standaloneFiles,
						...dropped.folders.flatMap((folder) => folder.files),
					],
					target,
				))
			)
				return
			if (identity !== getFileReferenceIdentityKey()) return
			if (dropped.standaloneFiles.length) await uploadFiles(dropped.standaloneFiles, target)
			for (const folder of dropped.folders) {
				if (identity !== getFileReferenceIdentityKey()) return
				if (callbacks) {
					magicToast.error(t("topicFiles.error.dragFolderNotSupported"))
					break
				}
				await dragUpload.handleUploadFiles(folder.files, target ?? directory, true)
			}
		} catch {
			if (identity === getFileReferenceIdentityKey())
				magicToast.error(t("userSpace.operationFailed"))
		}
	}
	const imageDownload = useDownloadImageMenu({
		onDownload: (mode, item) => operations.handleDownloadOriginal(item as AttachmentItem, mode),
	})
	const info = useFileInfoPanel()
	const aiCard = useAICardCreateDialog({ projectId })
	const createFile = (
		type: Parameters<typeof names.file.createVirtualFile>[0],
		key?: string,
		path?: string,
	) =>
		names.file.createVirtualFile(
			type,
			key ?? directory?.file_id,
			path ?? directory?.relative_file_path,
		)
	const createFolder = (key?: string, path?: string) =>
		names.folder.createVirtualFolder(
			key ?? directory?.file_id,
			path ?? directory?.relative_file_path,
		)
	const moveTo = (ids: string[]) => {
		pendingMoveIds.current = ids
		if (capabilities.crossProject)
			crossProject.openMoveModal(ids, index.getParentItemsById(ids[0]))
		else move.openBatchMoveByFileIds(ids)
	}
	const copyTo = (ids: string[]) => {
		const directoryId = directory?.file_id ?? props.rootId
		if (directoryId === null) return
		if (spaceConfig?.directorySource)
			copy.openBatchCopyByFileIds(ids, spaceConfig.directorySource.getPath(directoryId))
		else crossProject.openCopyModal(ids, index.getParentItemsById(ids[0]))
	}
	const isMutable = (file: AttachmentItem) =>
		Boolean(props.allowEdit && (props.isItemMutable?.(file) ?? true))
	const onUploadFolder =
		props.allowEdit && capabilities.upload && !spaceConfig?.directorySource
			? (file?: AttachmentItem) => operations.handleUploadFolder(file ?? directory)
			: undefined
	const onImportFromOtherProject =
		props.allowEdit && capabilities.importFromOtherProject
			? (file?: AttachmentItem) =>
					importOperation.openImportModal(
						file?.file_id
							? [...index.getParentItemsById(file.file_id), file]
							: directory?.file_id
								? [...index.getParentItemsById(directory.file_id), directory]
								: [],
					)
			: undefined
	const onAddDesign = capabilities.projectContentCreation
		? (key?: string, path?: string) =>
				names.design.createVirtualDesignProject(
					key ?? directory?.file_id,
					path ?? directory?.relative_file_path,
				)
		: undefined
	const onAddSelfMedia = capabilities.projectContentCreation
		? (key?: string, path?: string) =>
				names.selfMedia.createVirtualSelfMediaProject(
					key ?? directory?.file_id,
					path ?? directory?.relative_file_path,
				)
		: undefined
	const onAddAICard = capabilities.projectContentCreation
		? (_key?: string, path?: string) => aiCard.open(path ?? directory?.relative_file_path)
		: undefined
	const menu = useContextMenu({
		handleOpenFile: onOpen,
		handleOpenDirectory: onOpen,
		handleDeleteItem: operations.handleDeleteItem,
		handleDeleteWithConfirm: (file) => {
			if (isMutable(file)) void batch.deleteWithConfirm([file])
		},
		handleStartRename: (file) => {
			if (!isMutable(file)) return
			clearScheduledRename()
			// Wait for the Radix menu to restore trigger focus before mounting the input.
			cancelScheduledRename.current = scheduleFileManagerRename(() => {
				cancelScheduledRename.current = null
				if (isMutable(file)) names.rename.handleStartRename(file)
			})
		},
		handleDownloadOriginal: operations.handleDownloadOriginal,
		handleDownloadPdf: operations.handleDownloadPdf,
		handleDownloadPpt: operations.handleDownloadPpt,
		handleDownloadPptx: operations.handleDownloadPptx,
		handleDownloadImage: operations.handleDownloadImage,
		handleDownloadNoWaterMark: imageDownload.handleDownloadNoWaterMark,
		preloadWaterMarkFreeModal: imageDownload.preloadWaterMarkFreeModal,
		isFreeTrialVersion: imageDownload.isFreeTrialVersion,
		shouldUseSingleDownloadEntry: spaceConfig
			? true
			: imageDownload.shouldUseSingleDownloadEntry,
		handleShowInfo: info.handleShowInfo,
		handleUploadFile: props.allowEdit && capabilities.upload ? uploadFile : undefined,
		handleUploadFolder: onUploadFolder,
		handleShareItem: capabilities.share ? share.handleShareItem : undefined,
		handleAddToCurrentChat: capabilities.addToChat ? chat.handleAddToCurrentChat : undefined,
		handleAddToNewChat: capabilities.addToChat ? chat.handleAddToNewChat : undefined,
		handleAddMultipleFilesToCurrentChat: capabilities.addToChat
			? chat.handleAddMultipleFilesToCurrentChat
			: undefined,
		handleAddMultipleFilesToNewChat: capabilities.addToChat
			? chat.handleAddMultipleFilesToNewChat
			: undefined,
		handleMoveFile:
			props.allowEdit && capabilities.move
				? (file) => file.file_id && moveTo([file.file_id])
				: undefined,
		onCopyFile: capabilities.copy ? copyTo : undefined,
		handleReplaceFile:
			props.allowEdit && capabilities.replace ? replace.handleReplaceFile : undefined,
		handleImportFromOtherProject: onImportFromOtherProject,
		createVirtualFile: createFile,
		createVirtualFolder: createFolder,
		createVirtualDesignProject: onAddDesign,
		createVirtualSelfMediaProject: onAddSelfMedia,
		createVirtualAICardProject: onAddAICard,
		selectedItems: selectedIds,
		treeIndex: index,
		attachments,
		allowDownload: props.allowDownload,
		filterBatchDownloadLayerMenuItems: (items) => (props.allowEdit ? items : []),
		isMoving: move.isMoving || crossProject.isOperating || batch.batchLoading || names.pending,
		filterMenuItems: (items, file) =>
			items.filter((item) => {
				if (!item || ["selectMultiple", "toggleFolderContents"].includes(String(item.key)))
					return false
				if (
					props.allowDownload === false &&
					["download", "downloadFolder"].includes(String(item.key))
				)
					return false
				return (
					(file ? isMutable(file) : props.allowEdit) ||
					[
						"openFile",
						"download",
						"downloadFolder",
						"showInfo",
						"copyPath",
						"addToCurrentChat",
						"addToNewChat",
					].includes(String(item.key))
				)
			}),
	})
	const duplicateProps = getDuplicateFileModalProps({
		sharedDuplicateHandler: callbacks
			? { ...userUpload.duplicateFileHandler, handleCancel: userUpload.cancelDirectUpload }
			: duplicate,
		moveDuplicateHandler: move,
		crossProjectDuplicateHandler: crossProject,
		importDuplicateHandler: importOperation,
	})
	const cancelTransfer = useMemoizedFn(() => {
		const current = currentTransfer.current
		if (current?.phase === "executing") return
		if (current) {
			current.controller.abort()
			confirmation.cancel()
			move.handleDuplicateCancel()
			move.handleFolderConflictCancel()
			crossProject.handleDuplicateCancel()
			crossProject.handleFolderConflictCancel()
		}
		currentTransfer.current = null
		retryTransfer.current = null
		transferPending.current = false
		setPreparingTransfer(false)
		setTransferPreparation(null)
	})
	useEffect(() => {
		if (!props.isActive) cancelTransfer()
		return cancelTransfer
	}, [props.scopeKey, props.isActive, cancelTransfer])
	const cancelScheduledRename = useRef<(() => void) | null>(null)
	/** Drop a pending menu-triggered rename if the panel closes before the timeout. */
	const clearScheduledRename = useMemoizedFn(() => {
		cancelScheduledRename.current?.()
		cancelScheduledRename.current = null
	})
	useEffect(() => {
		if (!props.isActive) clearScheduledRename()
		return clearScheduledRename
	}, [props.scopeKey, props.isActive, clearScheduledRename])
	const runPreparedTransfer = useMemoizedFn(
		async (
			requestData: {
				ids: string[]
				targetId: string
				path: AttachmentItem[]
				mode: "move" | "copy"
				rootName?: string
			},
			execute: (preparation: FileOperationPreparation) => Promise<unknown>,
		) => {
			if (transferPending.current || !props.isActive) return
			const { ids, targetId, path, mode, rootName } = requestData
			retryTransfer.current = () => runPreparedTransfer(requestData, execute)
			const controller = new AbortController()
			const current = { controller, phase: "checking" as TransferPreparation["phase"] }
			const identity = getFileReferenceIdentityKey()
			const isCurrent = () =>
				currentTransfer.current === current &&
				!controller.signal.aborted &&
				activeScope.current.active &&
				activeScope.current.key === props.scopeKey &&
				identity === getFileReferenceIdentityKey()
			currentTransfer.current = current
			transferPending.current = true
			setPreparingTransfer(true)

			const request: TransferPreparation = {
				fileIds: [...ids],
				targetId,
				mode,
				phase: "checking",
				targetName: [
					rootName ?? props.rootName,
					...path
						.filter((file) => file.file_id !== props.rootId)
						.map((file) => file.file_name || file.filename || file.name),
				]
					.filter(Boolean)
					.join(" / "),
			}
			setTransferPreparation(request)
			const preparation: FileOperationPreparation = {
				signal: controller.signal,
				onPhase: (phase) => {
					if (!isCurrent()) {
						controller.abort()
						controller.signal.throwIfAborted()
					}
					current.phase = phase
					setTransferPreparation({ ...request, phase })
				},
			}
			let failed = false
			try {
				await execute(preparation)
			} catch {
				if (isCurrent()) {
					// 写入开始后的错误交给原执行结果处理，不能通过“重试检查”重放写入。
					if (current.phase === "executing")
						magicToast.error(t("userSpace.operationFailed"))
					else {
						failed = true
						setTransferPreparation({ ...request, phase: "error" })
					}
				}
			} finally {
				// 旧读取结束不能解除后来一次操作的锁，也不能清掉新的准备提示。
				if (currentTransfer.current === current) {
					currentTransfer.current = null
					transferPending.current = false
					setPreparingTransfer(false)
					if (!failed) {
						setTransferPreparation(null)
						retryTransfer.current = null
					}
				}
			}
		},
	)

	const transfer = useMemoizedFn((ids: string[], targetId: string, mode: "move" | "copy") => {
		const path = spaceConfig?.directorySource
			? spaceConfig.directorySource.getPath(targetId)
			: targetId
				? [...index.getParentItemsById(targetId), index.getItemById(targetId)].filter(
						(item): item is AttachmentItem => Boolean(item),
					)
				: []
		return runPreparedTransfer({ ids, targetId, path, mode }, async (preparation) => {
			if (mode === "move") {
				pendingMoveIds.current = ids
				if (spaceConfig?.directorySource)
					await move.moveWithinDirectorySource(path, ids, preparation)
				else
					await move.batchMoveFilesWithDuplicateCheck({
						fileIds: ids,
						projectId: projectId ?? "",
						targetParentId: targetId,
						preparation,
					})
			} else if (projectId || spaceConfig?.scope === "user") {
				await crossProject.executeCopyOperation({
					fileIds: ids,
					targetProjectId: projectId ?? "",
					targetPath: path,
					sourceAttachments: attachments,
					targetAttachments: attachments,
					preparation,
				})
			}
		})
	})
	const confirmMoveWithPreparation = (data: { path: AttachmentItem[] }) => {
		// 选择器提交后会立即清空状态；检查及重试始终使用提交时的文件集合。
		const ids = [...move.selectorConfig.pendingMoveFileIds]
		const targetId = data.path.at(-1)?.file_id ?? props.rootId
		if (targetId === null) return Promise.resolve()
		return runPreparedTransfer(
			{ ids, targetId, path: data.path, mode: "move" },
			async (preparation) => {
				pendingMoveIds.current = ids
				if (spaceConfig?.directorySource)
					await move.moveWithinDirectorySource(data.path, ids, preparation)
				else
					await move.batchMoveFilesWithDuplicateCheck({
						fileIds: ids,
						projectId: projectId ?? "",
						targetParentId: targetId,
						targetPath: data.path,
						preparation,
					})
			},
		)
	}
	const crossProjectWithPreparation = (
		mode: "move" | "copy",
		data: Parameters<typeof crossProject.executeCopyOperation>[0],
	) => {
		const request = { ...data, fileIds: [...(data.fileIds ?? crossProject.fileIds)] }
		// 文件集合已保存，关闭选择器后重试不再依赖它的可见状态。
		crossProject.closeModal()
		return runPreparedTransfer(
			{
				ids: request.fileIds,
				targetId: request.targetPath.at(-1)?.file_id ?? "",
				path: request.targetPath,
				mode,
				rootName: request.targetProject?.project_name,
			},
			(preparation) =>
				mode === "move"
					? crossProject.executeMoveOperation({ ...request, preparation })
					: crossProject.executeCopyOperation({ ...request, preparation }),
		)
	}

	return {
		confirmation,
		operations,
		names,
		move,
		copy,
		crossProject,
		importOperation,
		share,
		batch,
		userUpload,
		duplicate,
		duplicateProps,
		imageDownload,
		info,
		aiCard,
		menu,
		capabilities,
		selectedWorkspace,
		uploadFile,
		onUploadFolder,
		onImportFromOtherProject,
		onAddDesign,
		onAddSelfMedia,
		onAddAICard,
		uploadFiles,
		externalDrop,
		createFolder,
		createFile,
		moveTo,
		copyTo,
		isMutable,
		pendingMoveIds,
		busy:
			Boolean(confirmation.state) ||
			Boolean(transferPreparation) ||
			preparingTransfer ||
			move.isMoving ||
			crossProject.isOperating ||
			importOperation.isOperating ||
			batch.batchLoading ||
			names.pending,
		transfer,
		transferPreparation,
		retryTransfer: () => retryTransfer.current?.(),
		confirmMoveWithPreparation,
		crossProjectWithPreparation,
		cancelTransfer,
	}
}
