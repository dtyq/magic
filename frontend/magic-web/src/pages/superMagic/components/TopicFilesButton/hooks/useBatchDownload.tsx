import { useFileAccess as useFilePermissions } from "@/pages/superMagic/providers/FileAccessProvider"
import { filterFileAccessMenuItems } from "../utils/file-access-menu"
import { createElement, useState, useMemo, useRef } from "react"
import type { AttachmentItem, ConfirmFileOperation } from "./types"
import { Button } from "antd"
import type { MenuProps } from "antd"
import { collectFileIds } from "../utils/collectFileIds"
import { collectSelectedItemIds } from "../utils/collectSelectedItemIds"
import {
	hasMagicSystemFolderInDeletionSelection,
	resolveBatchDeleteConfirmContentKey,
} from "../utils/magic-system-folder"
import {
	IconDownload,
	IconFileTypePdf,
	IconFileTypePpt,
	IconTrash,
	IconFolderSymlink,
	IconShare3,
	IconCopy,
} from "@tabler/icons-react"
import { useTranslation } from "react-i18next"
import { downloadFileWithAnchor } from "../../../utils/handleFIle"
import type { DownloadProgressController } from "@/pages/superMagic/hooks/useDownloadProgress"
import { getParentPathFromFileId } from "../../SelectPathModal/utils/attachmentUtils"
import MagicModal from "@/components/base/MagicModal"
import { MagicSystemFolderIcon } from "../components/MagicSystemFolderIcon"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import { useIsMobile } from "@/hooks/useIsMobile"
import { SuperMagicApi } from "@/apis"
import { getShareAccessToken } from "@/pages/superMagic/fileAccess/fileAccessContext"
import { useFileAccess } from "@/pages/superMagic/fileAccess/FileAccessProvider"
import { useFileApi } from "@/pages/superMagic/fileAccess/fileApi"
import useShareRoute from "../../../hooks/useShareRoute"
import magicToast from "@/components/base/MagicToaster/utils"
import { createRandomUuidV4 } from "@/utils/create-random-uuid-v4"
import { isCachedChatWorkspaceProject } from "@/pages/superMagic/utils/isChatWorkspaceProject"
import { normalizeMenuItems } from "../utils/menu-items"
import { useMobileDeleteConfirmSheet } from "./useMobileDeleteConfirmSheet"
import { downloadBlobFile } from "@/utils/file"
import type { ExportIssue } from "@magic/html2pptx"
import { publishPptxExportIssues } from "@/pages/superMagic/utils/pptxExportIssues"
import {
	collectClientBatchExportTargets,
	getClientBatchItemType,
	runClientBatchDocumentExport,
} from "../modules/client-batch-export"
import {
	detectCanvasProjectOperationRisk,
	getCanvasProjectOperationImpact,
} from "../utils/canvasProjectOperationRisk"
import { collectSelectedFiles } from "./useSelectedFilesManager"
import type { FileScope } from "@/apis/modules/fileScope"

// BatchDeleteFilesRequestDTO 的 file_ids 上限；后代先于父目录，失败后停止后续批次。
const DELETE_BATCH_SIZE = 500

interface UseBatchDownloadOptions {
	confirmOperation?: ConfirmFileOperation
	fileScope?: FileScope
	onDownloadSelected?: (items: AttachmentItem[]) => Promise<void>
	resolveDeleteItems?: (items: AttachmentItem[]) => Promise<AttachmentItem[]>
	beforeDelete?: (ids: string[]) => Promise<boolean>
	isCurrent?: () => boolean
	projectId?: string
	getItemId: (item: AttachmentItem) => string
	selectedItems: Set<string>
	setSelectedItems: (items: Set<string>) => void
	filteredFiles: AttachmentItem[]
	onSelectModeChange?: (isSelectMode: boolean) => void
	// 批量移动和复制相关
	attachments?: AttachmentItem[]
	selectedWorkspace?: any
	selectedProject?: any
	crossProjectOperation?: {
		openMoveModal: (fileIds: string[], parentPath: AttachmentItem[]) => void
		openCopyModal: (fileIds: string[], parentPath?: AttachmentItem[]) => void
	}
	moveFileHook?: {
		openBatchMove: () => void
	}
	// 新增：操作完成回调（用于刷新列表）
	onUpdateAttachments?: () => void
	removeFile?: (fileId: string) => void
	onFilesDeleted?: (fileIds: string[]) => void
	getParentPathByFileId?: (fileId: string) => AttachmentItem[]
	isMoving?: boolean
	allowEdit?: boolean
	allowCopyTo?: boolean
	allowDownload?: boolean
	/** 是否允许批量移动。 */
	allowMove?: boolean
	/** 是否允许批量复制。 */
	allowCopy?: boolean
	/** 是否允许批量分享。 */
	allowShare?: boolean
	// 新增：批量分享回调
	onBatchShareClick?: (fileIds: string[]) => void
	// 是否在项目内
	isInProject?: boolean
	downloadProgress?: DownloadProgressController
}

/**
 * useBatchDownload - 处理批量下载功能
 */
export function useBatchDownload(options: UseBatchDownloadOptions) {
	const {
		projectId,
		getItemId,
		selectedItems,
		setSelectedItems,
		filteredFiles,
		onSelectModeChange,
		attachments = [],
		selectedWorkspace,
		selectedProject,
		crossProjectOperation,
		moveFileHook,
		onUpdateAttachments,
		removeFile,
		getParentPathByFileId,
		isMoving = false,
		allowEdit,
		allowCopyTo = false,
		allowDownload,
		allowMove = true,
		allowCopy = true,
		allowShare = true,
		onBatchShareClick,
		isInProject,
		downloadProgress,
	} = options
	const [batchLoading, setBatchLoading] = useState(false)
	const deletingRef = useRef(false)
	const { t } = useTranslation("super")
	const isMobile = useIsMobile()
	const isChatProject = isCachedChatWorkspaceProject(selectedProject)
	const { deleteConfirmNode, openDeleteConfirm } = useMobileDeleteConfirmSheet()
	const { isShareRoute, isFileShare } = useShareRoute()
	const fileAccess = useFileAccess()
	const fileApi = useFileApi()
	const {
		permissions: access,
		options: { copyTo, moveTo },
	} = useFilePermissions()
	const canDownload = allowDownload !== false

	// 退出多选模式的辅助函数
	const exitSelectMode = () => {
		setSelectedItems(new Set())
		onSelectModeChange?.(false)
	}

	const getInitialParentPath = (fileId: string) => {
		return getParentPathByFileId
			? getParentPathByFileId(fileId)
			: getParentPathFromFileId(fileId, attachments)
	}

	// 检测选中项目中是否包含文件夹
	const hasSelectedFolders = () => {
		let foundFolder = false
		const checkItems = (items: AttachmentItem[]) => {
			for (const item of items) {
				const itemId = getItemId(item)
				if (selectedItems.has(itemId)) {
					if (item.is_directory) {
						foundFolder = true
						return
					}
				}
				if (item.is_directory && "children" in item && item.children) {
					checkItems(item.children)
				}
			}
		}
		checkItems(filteredFiles)
		return foundFolder
	}

	// 显示批量下载按钮的条件
	const showBatchDownload = useMemo(() => {
		return selectedItems.size > 0
	}, [selectedItems])

	// Mobile batch delete uses the hierarchy confirmation sheet (same as project-detail).
	const handleMobileBatchDelete = async () => {
		const rootAttachments = attachments?.length ? attachments : filteredFiles

		openDeleteConfirm({
			attachments: rootAttachments,
			selectedKeys: selectedItems,
			onConfirm: handleBatchDelete,
			testIdPrefix: "topic-files-batch-delete-confirm",
		})
	}

	// PC端批量删除（使用 Modal 确认）
	const handlePCBatchDeleteWithConfirm = async () => {
		if (options.confirmOperation) {
			await deleteWithConfirm(collectSelectedFiles(selectedItems, filteredFiles, getItemId))
			return
		}
		const containsFolders = hasSelectedFolders()
		const touchesMagicFolder = hasMagicSystemFolderInDeletionSelection(
			filteredFiles,
			selectedItems,
			getItemId,
		)
		const contentKey = resolveBatchDeleteConfirmContentKey({
			containsFolders,
			touchesMagicFolder,
		})

		MagicModal.confirm({
			title: t("topicFiles.contextMenu.deleteTip"),
			content: t(contentKey, {
				count: selectedItems.size,
			}),
			variant: "destructive",
			showIcon: true,
			icon: touchesMagicFolder ? <MagicSystemFolderIcon size={24} /> : undefined,
			okText: t("topicFiles.contextMenu.delete"),
			cancelText: t("topicFiles.contextMenu.cancel"),
			onOk: handleBatchDelete,
		})
	}

	const deleteItems = async (
		items: AttachmentItem[],
		keys?: Set<string>,
		confirmedIds?: string[],
	) => {
		if (deletingRef.current) return
		const isCurrent = options.isCurrent ?? (() => true)
		if (!isCurrent()) return
		const ids =
			confirmedIds ??
			[
				...new Set(
					collectFileIds({
						items,
						selectedItems: keys,
						getItemId,
						includeFolderIds: true,
					}),
				),
			].reverse()
		if (!ids.length) return
		deletingRef.current = true
		setBatchLoading(true)
		const confirmed = new Set<string>()
		try {
			for (let offset = 0; offset < ids.length; offset += DELETE_BATCH_SIZE) {
				if (!isCurrent()) return
				const batch = ids.slice(offset, offset + DELETE_BATCH_SIZE)
				let unresolved = batch.length
				try {
					const result = await SuperMagicApi.deleteFiles({
						file_ids: batch,
						project_id: options.fileScope === "user" ? "0" : projectId,
					})
					if (!isCurrent()) return
					const returnedIds = new Set(result.file_ids.map(String))
					const deleted = batch.filter((id) => returnedIds.has(id))
					for (const id of batch) {
						if (returnedIds.has(id)) {
							confirmed.add(id)
							unresolved -= 1
						}
					}
					if (options.onFilesDeleted) options.onFilesDeleted(deleted)
					else deleted.forEach((id) => removeFile?.(id))
					if (unresolved) throw new Error("Incomplete file deletion result")
				} catch {
					if (!isCurrent()) return
					// 写请求失败可能已在服务器执行；不重放，也不继续提交父目录。
					magicToast.error(
						t("topicFiles.deleteIncomplete", {
							success: confirmed.size,
							unknown: unresolved,
							pending: ids.length - offset - batch.length,
						}),
					)
					onUpdateAttachments?.()
					return
				}
			}
			if (!isCurrent()) return
			if (options.fileScope !== "user") pubsub.publish(PubSubEvents.Cancel_File_Selection)
			onUpdateAttachments?.()
			magicToast.success(t("topicFiles.contextMenu.deleteFileSuccess"))
			exitSelectMode()
		} finally {
			deletingRef.current = false
			if (isCurrent()) setBatchLoading(false)
		}
	}

	// 批量删除（不带确认弹窗，由调用方使用 Popconfirm 处理）
	const handleBatchDelete = async () => {
		if (!selectedItems.size) return
		if (!options.resolveDeleteItems) return deleteItems(filteredFiles, selectedItems)
		const selected = collectSelectedFiles(selectedItems, filteredFiles, getItemId)
		const items = await options.resolveDeleteItems(selected)
		if (
			options.beforeDelete &&
			!(await options.beforeDelete(collectFileIds({ items, includeFolderIds: true })))
		)
			return
		await deleteItems(items)
	}

	const preparingDelete = useRef(false)
	const deleteWithConfirm = async (selected: AttachmentItem[]) => {
		if (!selected.length || deletingRef.current || preparingDelete.current) return
		preparingDelete.current = true
		if (options.confirmOperation) setBatchLoading(true)
		const isCurrent = options.isCurrent ?? (() => true)
		try {
			const items = options.resolveDeleteItems
				? await options.resolveDeleteItems(selected)
				: selected
			if (!isCurrent()) return
			const ids = collectFileIds({ items, includeFolderIds: true })
			if (options.beforeDelete && !(await options.beforeDelete(ids))) return
			if (!isCurrent()) return
			const keys = new Set(items.map(getItemId))
			const contentKey = resolveBatchDeleteConfirmContentKey({
				containsFolders: items.some((item) => item.is_directory),
				touchesMagicFolder: hasMagicSystemFolderInDeletionSelection(items, keys, getItemId),
			})
			const risk =
				options.fileScope === "user"
					? undefined
					: await detectCanvasProjectOperationRisk({
							attachments,
							items,
							operation: "delete",
						})
			if (!isCurrent()) return
			const impact = risk && getCanvasProjectOperationImpact(risk)
			if (options.confirmOperation) {
				// 确认看到的 ID 就是执行集合；目录在等待期间变化不能扩大这次删除范围。
				const confirmedIds = [...new Set(ids)].reverse()
				const warning = [
					t(contentKey, { count: selected.length }),
					risk?.shouldWarn
						? t(
								impact === "open-failure"
									? "topicFiles.contextMenu.deleteCanvasOpenFailureRiskContent"
									: impact === "content-loss"
										? "topicFiles.contextMenu.deleteCanvasContentLossRiskContent"
										: "topicFiles.contextMenu.deleteCanvasMixedRiskContent",
							)
						: "",
					t("fileManager.confirmation.deleteWarning"),
				]
					.filter(Boolean)
					.join(" ")
				if (
					await options.confirmOperation({
						operation: "delete",
						fileIds: confirmedIds,
						sourceAttachments: items,
						selectedIds: selected.flatMap((item) =>
							item.file_id ? [item.file_id] : [],
						),
						warning,
					})
				) {
					if (isCurrent()) await deleteItems(items, undefined, confirmedIds)
				}
				return
			}
			MagicModal.confirm({
				title: t("topicFiles.contextMenu.deleteTip"),
				content: risk?.shouldWarn
					? t(
							impact === "open-failure"
								? "topicFiles.contextMenu.deleteCanvasOpenFailureRiskContent"
								: impact === "content-loss"
									? "topicFiles.contextMenu.deleteCanvasContentLossRiskContent"
									: "topicFiles.contextMenu.deleteCanvasMixedRiskContent",
						)
					: t(contentKey, { count: selected.length }),
				variant: "destructive",
				okText: t("topicFiles.contextMenu.delete"),
				cancelText: t("topicFiles.contextMenu.cancel"),
				onOk: () => (isCurrent() ? deleteItems(items) : undefined),
			})
		} catch (error) {
			if (error instanceof DOMException && error.name === "AbortError") return
			if (isCurrent()) magicToast.error(t("topicFiles.error.deleteFileFailed"))
		} finally {
			preparingDelete.current = false
			if (options.confirmOperation) setBatchLoading(false)
		}
	}

	// 批量下载选中文件
	const handleBatchDownload = async () => {
		if (!access.download) return
		if (!canDownload || selectedItems.size === 0 || (!projectId && !options.onDownloadSelected))
			return
		setBatchLoading(true)
		let keepLoadingForPolling = false
		try {
			// 收集选中的文件ID（只收集直接选中的项目，不递归展开文件夹）
			const selectedFileIds = collectSelectedItemIds(filteredFiles, selectedItems, getItemId)
			if (options.onDownloadSelected) {
				const files = collectSelectedFiles(selectedItems, filteredFiles, getItemId)
				await options.onDownloadSelected(files)
				if (!options.isCurrent || options.isCurrent()) exitSelectMode()
				return
			}
			if (!projectId) return

			if (selectedFileIds.length === 0) {
				setBatchLoading(false)
				console.warn("No downloadable files found")
				return
			}

			const token =
				isShareRoute || isFileShare
					? getShareAccessToken(fileAccess) || undefined
					: undefined

			if (downloadProgress) {
				await downloadProgress.startDownload({
					projectId,
					fileIds: selectedFileIds,
					token,
					label: t("topicFiles.downloading"),
					onSuccess: () => {
						magicToast.success({
							content: t("topicFiles.downloadSuccess"),
							duration: 1000,
						})
						exitSelectMode()
					},
					onError: (error) => {
						const message = error instanceof Error ? error.message : undefined
						magicToast.error({
							content: message || t("topicFiles.downloadFailed"),
							duration: 1000,
						})
					},
					onCancel: () => {
						magicToast.info(t("topicFiles.downloadAbort"))
					},
				})
				return
			}

			const toastId = createRandomUuidV4()
			magicToast.loading({
				key: toastId,
				content: t("topicFiles.downloading"),
				duration: 0,
			})

			// 调用后端创建批量下载任务
			const data = await SuperMagicApi.createBatchDownload({
				project_id: projectId,
				file_ids: selectedFileIds,
				token,
			})

			if (data.status === "ready" && data.download_url) {
				downloadFileWithAnchor(data.download_url)
				magicToast.success({
					key: toastId,
					content: t("topicFiles.downloadSuccess"),
					duration: 1000,
				})
				exitSelectMode()
				return
			}

			if (data.status === "processing") {
				keepLoadingForPolling = true
				// 每2秒轮询批量状态
				const timer = setInterval(async () => {
					try {
						const checkData = await SuperMagicApi.checkBatchDownloadStatus(
							data.batch_key,
							token,
						)
						if (checkData.status === "ready" && checkData.download_url) {
							downloadFileWithAnchor(checkData.download_url)
							magicToast.success({
								key: toastId,
								content: t("topicFiles.downloadSuccess"),
								duration: 1000,
							})
							setBatchLoading(false)
							exitSelectMode()
							clearInterval(timer)
						}
						if (checkData?.status === "failed") {
							setBatchLoading(false)
							clearInterval(timer)
							magicToast.error({
								key: toastId,
								content: checkData.message || t("topicFiles.downloadFailed"),
								duration: 1000,
							})
							return
						}
					} catch (error) {
						setBatchLoading(false)
						clearInterval(timer)
						console.error("Batch download check failed:", error)
						magicToast.error({
							key: toastId,
							content: t("topicFiles.downloadFailed"),
							duration: 1000,
						})
					}
				}, 2000)
				return
			}

			magicToast.error({
				key: toastId,
				content: t("topicFiles.downloadFailed"),
				duration: 1000,
			})
		} catch (error) {
			console.error("Batch download failed:", error)
			magicToast.error({
				content: t("topicFiles.downloadFailed"),
				duration: 1000,
			})
		} finally {
			if (!keepLoadingForPolling) {
				setBatchLoading(false)
			}
		}
	}

	const handleExportDocument = async (format: "pdf" | "pptx" = "pdf") => {
		if (!access.export) return
		if (!canDownload || selectedItems.size === 0) return
		// Always resolve against the complete attachment tree. The filtered tree can omit
		// folder resources while a search is active, which would produce incomplete exports.
		const sourceItems = attachments.length > 0 ? attachments : filteredFiles
		const { targets, unsupportedItems } = collectClientBatchExportTargets({
			items: sourceItems,
			selectedItems,
			getItemId,
			format,
		})

		if (unsupportedItems.length > 0) {
			const unsupportedTypes = Array.from(
				new Set(
					unsupportedItems.map((item) =>
						getClientBatchItemType(item, {
							folder: t("filenameValidator.type.folder"),
							unknown: t("common.unknown"),
						}),
					),
				),
			).join(", ")
			magicToast.error(
				t("folderUpload.errors.unsupportedFileType", { fileType: unsupportedTypes }),
			)
			return
		}

		if (targets.length === 0) {
			magicToast.error(
				t("folderUpload.errors.unsupportedFileType", {
					fileType: format === "pdf" ? "PDF" : "PPTX",
				}),
			)
			return
		}

		setBatchLoading(true)
		const toastId = createRandomUuidV4()
		const exportController = format === "pptx" ? new AbortController() : null
		const exportText =
			format === "pdf" ? t("topicFiles.batchExportingPdf") : t("topicFiles.batchExportingPpt")
		const getExportToastContent = (progressText: string) =>
			exportController
				? createElement(
						"div",
						{ style: { display: "flex", alignItems: "center", gap: 8 } },
						createElement("span", null, progressText),
						createElement(
							Button,
							{
								type: "default",
								size: "small",
								danger: true,
								onClick: () => exportController.abort(),
							},
							t("topicFiles.exportCancel"),
						),
					)
				: progressText
		magicToast.loading({
			key: toastId,
			content: getExportToastContent(exportText),
			duration: 0,
		})

		try {
			const exportIssues: ExportIssue[] = []
			const result = await runClientBatchDocumentExport({
				format,
				targets,
				attachments: sourceItems,
				projectName: selectedProject?.project_name,
				access: fileAccess ?? undefined,
				fileApi,
				signal: exportController?.signal,
				onProgress: (progress) => {
					magicToast.loading({
						key: toastId,
						content: getExportToastContent(`${exportText} (${Math.round(progress)}%)`),
						duration: 0,
					})
				},
				onExportIssue: (issue) => exportIssues.push(issue),
			})

			if (format === "pptx") {
				publishPptxExportIssues(exportIssues, {
					fileName: selectedProject?.project_name,
				})
			}

			if (result.cancelled) {
				magicToast.destroy(toastId)
				return
			}
			if (result.unavailable) {
				magicToast.error({
					key: toastId,
					content: t("topicFiles.contextMenu.fileExport.unsupportedInCurrentVersion"),
					duration: 1000,
				})
				return
			}
			if ((!result.artifact && !result.streamedToDisk) || result.successCount === 0) {
				magicToast.error({
					key: toastId,
					content: t("topicFiles.contextMenu.fileExport.exportFailed"),
					duration: 1000,
				})
				return
			}

			if (result.artifact) {
				// PDF paths return one in-memory artifact. Streaming PPTX paths have already
				// committed their files to the selected destination.
				const downloadResult = await downloadBlobFile(
					result.artifact.blob,
					result.artifact.fileName,
					format,
				)
				if (!downloadResult.success) {
					throw new Error(downloadResult.message || "Batch export download failed")
				}
			}

			if (result.failureCount > 0) {
				magicToast.error({
					key: toastId,
					content: t("topicFiles.contextMenu.fileExport.exportFailed"),
					duration: 1000,
				})
			} else {
				magicToast.success({
					key: toastId,
					content: t("topicFiles.exportSuccess"),
					duration: 1000,
				})
				exitSelectMode()
			}
		} catch (error) {
			console.error("Client batch export failed:", error)
			magicToast.error({
				key: toastId,
				content: t("topicFiles.contextMenu.fileExport.exportFailed"),
				duration: 1000,
			})
		} finally {
			setBatchLoading(false)
		}
	}

	// 批量分享选中文件
	const handleBatchShare = () => {
		if (!access.share) return
		if (selectedItems.size === 0 || !onBatchShareClick) return

		// PC multi-select stores the folder row ID itself, so share must preserve direct selections.
		const selectedFileIds = collectSelectedItemIds(filteredFiles, selectedItems, getItemId)

		if (selectedFileIds.length > 0) {
			onBatchShareClick(selectedFileIds)
			exitSelectMode()
		}
	}

	// Open the appropriate selector for batch moves.
	const handleBatchMove = () => {
		if (!selectedItems || selectedItems.size === 0) return

		const fileIds = Array.from(selectedItems)
		const firstFileId = fileIds[0]
		const parentPath = firstFileId ? getInitialParentPath(firstFileId) : []

		if (crossProjectOperation && options.fileScope !== "user" && !isMobile && !isChatProject) {
			crossProjectOperation.openMoveModal(fileIds, parentPath)
		} else if (moveFileHook) {
			// Mobile and chat projects keep the directory selector.
			moveFileHook.openBatchMove()
		}
	}

	// 批量复制处理函数
	const handleBatchCopy = () => {
		if (!selectedItems || selectedItems.size === 0) return
		if (!crossProjectOperation) return

		const fileIds = Array.from(selectedItems)
		const firstFileId = fileIds[0]
		const parentPath = firstFileId ? getInitialParentPath(firstFileId) : []

		crossProjectOperation.openCopyModal(fileIds, parentPath)
	}

	// 创建下拉菜单项配置
	const rawBatchMenuItems = [
		// 分享文件（仅在项目内显示）
		...(isInProject && allowEdit && allowShare && onBatchShareClick && access.share
			? [
					{
						key: "share",
						label: (
							<div style={{ display: "flex", alignItems: "center", gap: 8 }}>
								<IconShare3 size={16} stroke={1.5} />
								<span>{t("topicFiles.contextMenu.shareFile")}</span>
							</div>
						),
						onClick: handleBatchShare,
						disabled: batchLoading || !onBatchShareClick,
					},
				]
			: []),
		// 批量下载（带二级菜单）
		...(canDownload && isInProject
			? [
					{
						key: "download",
						label: (
							<div style={{ display: "flex", alignItems: "center", gap: 8 }}>
								<IconDownload size={16} stroke={1.5} />
								<span>{t("topicFiles.downloadTitle")}</span>
							</div>
						),
						disabled: batchLoading,
						children: [
							{
								key: "download-selected",
								label: (
									<div style={{ display: "flex", alignItems: "center", gap: 8 }}>
										<IconDownload size={16} stroke={1.5} />
										<span>
											{t("topicFiles.downloadSelected", {
												count: selectedItems.size,
											})}
										</span>
									</div>
								),
								onClick: handleBatchDownload,
								disabled: batchLoading,
							},
							{
								key: "export-pdf",
								label: (
									<div style={{ display: "flex", alignItems: "center", gap: 8 }}>
										<IconFileTypePdf size={16} stroke={1.5} />
										<span>{t("topicFiles.exportPdf")}</span>
									</div>
								),
								onClick: () => handleExportDocument("pdf"),
								disabled: batchLoading,
							},
							{
								key: "export-ppt",
								label: (
									<div style={{ display: "flex", alignItems: "center", gap: 8 }}>
										<IconFileTypePpt size={16} stroke={1.5} />
										<span>{t("topicFiles.exportPptx")}</span>
									</div>
								),
								onClick: () => handleExportDocument("pptx"),
								disabled: batchLoading,
							},
						],
					},
				]
			: canDownload
				? // 不在项目内，暂时只显示一个一级菜单的批量下载（兼容金融模式）
					[
						{
							key: "download-selected",
							label: (
								<div style={{ display: "flex", alignItems: "center", gap: 8 }}>
									<IconDownload size={16} stroke={1.5} />
									<span>
										{t("topicFiles.downloadSelected", {
											count: selectedItems.size,
										})}
									</span>
								</div>
							),
							onClick: handleBatchDownload,
							disabled: batchLoading,
						},
						{
							key: "export-pdf",
							label: (
								<div style={{ display: "flex", alignItems: "center", gap: 8 }}>
									<IconFileTypePdf size={16} stroke={1.5} />
									<span>{t("topicFiles.exportPdf")}</span>
								</div>
							),
							onClick: () => handleExportDocument("pdf"),
							disabled: batchLoading,
						},
						{
							key: "export-ppt",
							label: (
								<div style={{ display: "flex", alignItems: "center", gap: 8 }}>
									<IconFileTypePpt size={16} stroke={1.5} />
									<span>{t("topicFiles.exportPptx")}</span>
								</div>
							),
							onClick: () => handleExportDocument("pptx"),
							disabled: batchLoading,
						},
					]
				: []),
		// 批量移动（仅在允许编辑时显示）
		...((isInProject || options.fileScope === "user") && allowEdit && allowMove && moveTo
			? [
					{
						key: "move",
						label: (
							<div style={{ display: "flex", alignItems: "center", gap: 8 }}>
								<IconFolderSymlink size={16} stroke={1.5} />
								<span>{t("topicFiles.contextMenu.batchMove")}</span>
							</div>
						),
						onClick: handleBatchMove,
						disabled: batchLoading || isMoving,
					},
				]
			: []),
		// 批量复制（仅在允许编辑时显示）
		...(((isInProject && allowEdit) || allowCopyTo) && allowCopy && copyTo
			? [
					{
						key: "copy",
						label: (
							<div style={{ display: "flex", alignItems: "center", gap: 8 }}>
								<IconCopy size={16} stroke={1.5} />
								<span>{t("topicFiles.contextMenu.batchCopy")}</span>
							</div>
						),
						onClick: handleBatchCopy,
						disabled: batchLoading || isMoving,
					},
				]
			: []),
		// 分隔线
		...((isInProject || options.fileScope === "user") && allowEdit
			? [
					{
						type: "divider" as const,
						key: "divider",
					},
				]
			: []),
		// 批量删除（仅在允许编辑时显示）
		...((isInProject || options.fileScope === "user") && allowEdit
			? [
					{
						key: "delete",
						label: (
							<div
								style={{
									display: "flex",
									alignItems: "center",
									gap: 8,
									color: "#FF4D3A",
								}}
							>
								<IconTrash size={16} stroke={1.5} />
								<span>{t("topicFiles.contextMenu.delete")}</span>
							</div>
						),
						onClick: isMobile
							? handleMobileBatchDelete
							: handlePCBatchDeleteWithConfirm,
						disabled: batchLoading || isMoving,
					},
				]
			: []),
	]
	const batchMenuItems = normalizeMenuItems(
		filterFileAccessMenuItems(rawBatchMenuItems, access),
	).filter(
		(item) =>
			options.fileScope !== "user" ||
			!item ||
			!["export-pdf", "export-ppt"].includes(String(item.key)),
	) as MenuProps["items"]
	const canShowBatchOperations = showBatchDownload && Boolean(batchMenuItems?.length)

	return {
		// 状态
		batchLoading,
		showBatchDownload: canShowBatchOperations,

		// 处理函数
		handleBatchDownload,
		handleExportDocument,
		handleBatchDelete,
		deleteWithConfirm,
		handleMobileBatchDelete,
		handleBatchShare,
		hasSelectedFolders,

		// 下拉菜单项配置
		batchMenuItems,
		deleteConfirmNode,
	}
}
