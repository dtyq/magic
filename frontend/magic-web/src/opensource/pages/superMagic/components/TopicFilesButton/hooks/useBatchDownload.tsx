import { useState, useMemo } from "react"
import type { AttachmentItem } from "./types"
import { MenuProps } from "antd"
import { collectFileIds } from "../utils/collectFileIds"
import { collectSelectedItemIds } from "../utils/collectSelectedItemIds"
import {
	IconAlertTriangleFilled,
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
import { getParentPathFromFileId } from "../../SelectPathModal/utils/attachmentUtils"
import MagicModal from "@/opensource/components/base/MagicModal"
import pubsub, { PubSubEvents } from "@/opensource/utils/pubsub"
import { useIsMobile } from "@/opensource/hooks/useIsMobile"
import { getAppEntryFile } from "../../MessageList/components/MessageAttachment/utils"
import { SuperMagicApi } from "@/opensource/apis"
import useShareRoute from "../../../hooks/useShareRoute"
import magicToast from "@/opensource/components/base/MagicToaster/utils"

interface UseBatchDownloadOptions {
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
	projects?: any[]
	crossProjectOperation?: {
		openMoveModal: (fileIds: string[], parentPath: AttachmentItem[]) => void
		openCopyModal: (fileIds: string[], parentPath?: AttachmentItem[]) => void
	}
	moveFileHook?: {
		openBatchMove: () => void
	}
	// 新增：操作完成回调（用于刷新列表）
	onUpdateAttachments?: () => void
	removeFile: (fileId: string) => void
	isMoving?: boolean
	// 批量导出进度回调
	onBatchPdfExportStart?: () => void
	onBatchPdfExportProgress?: (progress: number) => void
	onBatchPdfExportEnd?: () => void
	onBatchPptExportStart?: () => void
	onBatchPptExportProgress?: (progress: number) => void
	onBatchPptExportEnd?: () => void
	allowEdit?: boolean
	// 新增：批量分享回调
	onBatchShareClick?: (fileIds: string[]) => void
	// 是否在项目内
	isInProject?: boolean
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
		projects = [],
		crossProjectOperation,
		moveFileHook,
		onUpdateAttachments,
		removeFile,
		isMoving = false,
		onBatchPdfExportStart,
		onBatchPdfExportProgress,
		onBatchPdfExportEnd,
		onBatchPptExportStart,
		onBatchPptExportProgress,
		onBatchPptExportEnd,
		allowEdit,
		onBatchShareClick,
		isInProject,
	} = options
	const [batchLoading, setBatchLoading] = useState(false)
	const { t } = useTranslation("super")
	const isMobile = useIsMobile()
	const { isShareRoute, isFileShare } = useShareRoute()

	// 批量导出进度控制辅助函数
	const handleBatchExportStart = (convertType: "pdf" | "ppt") => {
		if (convertType === "pdf") {
			onBatchPdfExportStart?.()
		} else {
			onBatchPptExportStart?.()
		}
	}

	const handleBatchExportProgress = (convertType: "pdf" | "ppt", progress: number) => {
		if (convertType === "pdf") {
			onBatchPdfExportProgress?.(progress)
		} else {
			onBatchPptExportProgress?.(progress)
		}
	}

	const handleBatchExportEnd = (convertType: "pdf" | "ppt") => {
		if (convertType === "pdf") {
			onBatchPdfExportEnd?.()
		} else {
			onBatchPptExportEnd?.()
		}
	}

	// 退出多选模式的辅助函数
	const exitSelectMode = () => {
		setSelectedItems(new Set())
		onSelectModeChange?.(false)
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

	// 移动端批量删除（使用 Modal 确认）
	const handleMobileBatchDelete = async () => {
		const containsFolders = hasSelectedFolders()

		MagicModal.confirm({
			title: t("topicFiles.contextMenu.deleteTip"),
			content: containsFolders
				? t("topicFiles.contextMenu.confirmBatchDeleteWithFolders", {
						count: selectedItems.size,
					})
				: t("topicFiles.contextMenu.confirmBatchDelete", {
						count: selectedItems.size,
					}),
			variant: "destructive",
			showIcon: true,
			okText: t("topicFiles.contextMenu.delete"),
			cancelText: t("topicFiles.contextMenu.cancel"),
			onOk: handleBatchDelete,
		})
	}

	// PC端批量删除（使用 Modal 确认）
	const handlePCBatchDeleteWithConfirm = async () => {
		const containsFolders = hasSelectedFolders()

		MagicModal.confirm({
			title: t("topicFiles.contextMenu.deleteTip"),
			content: containsFolders
				? t("topicFiles.contextMenu.confirmBatchDeleteWithFolders", {
						count: selectedItems.size,
					})
				: t("topicFiles.contextMenu.confirmBatchDelete", {
						count: selectedItems.size,
					}),
			variant: "destructive",
			showIcon: true,
			okText: t("topicFiles.contextMenu.delete"),
			cancelText: t("topicFiles.contextMenu.cancel"),
			onOk: handleBatchDelete,
		})
	}

	// 批量删除（不带确认弹窗，由调用方使用 Popconfirm 处理）
	const handleBatchDelete = async () => {
		if (selectedItems.size === 0) return
		setBatchLoading(true)
		try {
			const selectedFileIds = collectFileIds({
				items: filteredFiles,
				selectedItems,
				getItemId,
				includeFolderIds: true, // 删除时需要包含文件夹ID
			})

			if (selectedFileIds.length > 0) {
				await SuperMagicApi.deleteFiles({
					file_ids: selectedFileIds,
					project_id: projectId,
				}).catch(() => null)
				selectedFileIds.forEach((fileId) => {
					removeFile(fileId)
				})
			}
			pubsub.publish(PubSubEvents.Update_Attachments)
			pubsub.publish(PubSubEvents.Cancel_File_Selection)
			onUpdateAttachments?.()
			magicToast.success(t("topicFiles.contextMenu.deleteFileSuccess"))
			exitSelectMode()
		} catch (error) {
			console.error("Batch delete failed:", error)
			magicToast.error(t("topicFiles.error.deleteFileFailed"))
		} finally {
			setBatchLoading(false)
		}
	}

	// 批量下载选中文件
	const handleBatchDownload = async () => {
		if (selectedItems.size === 0 || !projectId) return
		setBatchLoading(true)
		try {
			// 收集选中的文件ID（只收集直接选中的项目，不递归展开文件夹）
			const selectedFileIds = collectSelectedItemIds(filteredFiles, selectedItems, getItemId)

			if (selectedFileIds.length === 0) {
				setBatchLoading(false)
				console.warn("No downloadable files found")
				return
			}

			// 调用后端创建批量下载任务
			const data = await SuperMagicApi.createBatchDownload({
				project_id: projectId,
				file_ids: selectedFileIds,
				// @ts-ignore
				...(isShareRoute || isFileShare ? { token: window.temporary_token || "" } : {}),
			})

			if (data.status === "ready" && data.download_url) {
				downloadFileWithAnchor(data.download_url)
				setBatchLoading(false)
				exitSelectMode()
				return
			}

			if (data.status === "processing") {
				// 每2秒轮询批量状态
				const timer = setInterval(async () => {
					const checkData = await SuperMagicApi.checkBatchDownloadStatus(data.batch_key)
					if (checkData.status === "ready" && checkData.download_url) {
						downloadFileWithAnchor(checkData.download_url)
						setBatchLoading(false)
						exitSelectMode()
						clearInterval(timer)
					}
					if (checkData?.status === "failed") {
						setBatchLoading(false)
						clearInterval(timer)
						magicToast.error(checkData.message)
						return
					}
				}, 2000)
			}
		} catch (error) {
			setBatchLoading(false)
			console.error("Batch download failed:", error)
		}
	}

	const handleExportPdfOrPpt = async (convert_type = "pdf") => {
		if (selectedItems.size === 0 || !projectId) return
		console.log("🔵 导出PDF或PPT:", convert_type)
		setBatchLoading(true)

		const convertType = convert_type as "pdf" | "ppt"
		// 开始导出
		handleBatchExportStart(convertType)

		const target = convertType === "pdf" ? "_blank" : "_self"

		try {
			// Collect selected file ids with special filtering for export
			const selectedFileIds = collectFileIds({
				items: filteredFiles,
				selectedItems,
				getItemId,
				includeFolderIds: false,
				filterFn: (item) => {
					// 处理 metadata 和 index.html 的特殊情况
					if (item?.metadata && item?.name !== "index.html") {
						// 这种情况在 collectFileIds 中已经处理了，这里不需要额外过滤
						return true
					}
					// 过滤掉 md 文件转 ppt 的情况
					if (item?.file_extension === "md" && convertType === "ppt") {
						return false
					}
					return true
				},
			})

			// 处理 metadata 和 index.html 的特殊情况
			// 需要单独处理，因为需要获取 appEntryFile
			const processedFileIds: string[] = []
			const processMetadataItems = (items: AttachmentItem[], parentSelected = false) => {
				items.forEach((item) => {
					const itemId = getItemId(item)
					const isSelected = parentSelected || selectedItems.has(itemId)

					if (isSelected && item?.metadata && item?.name !== "index.html") {
						const appEntryFile = getAppEntryFile(item?.children || [])
						if (appEntryFile?.file_id) {
							processedFileIds.push(appEntryFile.file_id)
						}
						return
					}
				})
			}
			processMetadataItems(filteredFiles)

			// 合并处理后的文件ID
			const finalFileIds = [
				...selectedFileIds.filter((id) => !processedFileIds.some((pid) => pid === id)),
				...processedFileIds,
			]
			if (finalFileIds.length === 0) {
				setBatchLoading(false)
				handleBatchExportEnd(convertType)
				console.warn("No exportable files found")
				return
			}
			// Call backend to create batch export file task
			const data = await SuperMagicApi.exportPdfOrPpt({
				project_id: projectId,
				file_ids: finalFileIds,
				convert_type: convertType,
			})
			if (data.status === "completed") {
				data.download_url && downloadFileWithAnchor(data.download_url, undefined, target)
				setBatchLoading(false)
				handleBatchExportEnd(convertType)
				exitSelectMode()
				return
			}

			if (data.status === "processing") {
				let timer: NodeJS.Timeout | null = null

				timer = setInterval(async () => {
					try {
						const checkData = await SuperMagicApi.checkExportPdfOrPptStatus(
							data.task_key,
						)
						if (checkData.status === "processing") {
							// 更新进度
							const progress = checkData.conversion_rate || 0
							handleBatchExportProgress(convertType, progress)
						}
						if (checkData.status === "completed") {
							console.log("🔵 导出成功:", checkData)
							// magicToast.success(t("topicFiles.exportSuccess"))
							checkData.download_url &&
								downloadFileWithAnchor(checkData.download_url, undefined, target)
							setBatchLoading(false)
							handleBatchExportEnd(convertType)
							exitSelectMode()
							if (timer) clearInterval(timer)
						}
						if (checkData?.status === "failed") {
							setBatchLoading(false)
							handleBatchExportEnd(convertType)
							if (timer) clearInterval(timer)
							magicToast.error(checkData.message)
							return
						}
					} catch (error) {
						setBatchLoading(false)
						handleBatchExportEnd(convertType)
						if (timer) clearInterval(timer)
						console.error("Batch export failed:", error)
					}
				}, 5000)
			}
		} catch (error) {
			console.log("completed4")
			setBatchLoading(false)
			handleBatchExportEnd(convertType)
			console.error("Batch export failed:", error)
		}
	}

	// 批量分享选中文件
	const handleBatchShare = () => {
		if (selectedItems.size === 0 || !onBatchShareClick) return

		// 只收集直接选中的项目ID（包括文件夹），不递归展开子文件
		// 遵循"在外边勾选了谁，那么文件分享弹层就默认显示谁"的原则
		const selectedFileIds = collectSelectedItemIds(filteredFiles, selectedItems, getItemId)

		if (selectedFileIds.length > 0) {
			onBatchShareClick(selectedFileIds)
			exitSelectMode()
		}
	}

	// 批量移动处理函数
	const handleBatchMove = () => {
		if (!selectedItems || selectedItems.size === 0) return

		const fileIds = Array.from(selectedItems)
		const firstFileId = fileIds[0]
		const parentPath = firstFileId ? getParentPathFromFileId(firstFileId, attachments) : []

		// 如果有跨项目操作所需的数据，使用新的跨项目 Modal
		if (selectedWorkspace && selectedProject && projects.length > 0 && crossProjectOperation) {
			crossProjectOperation.openMoveModal(fileIds, parentPath)
		} else if (moveFileHook) {
			// 否则使用原来的 SelectDirectoryModal
			moveFileHook.openBatchMove()
		}
	}

	// 批量复制处理函数
	const handleBatchCopy = () => {
		if (!selectedItems || selectedItems.size === 0) return
		if (
			!selectedWorkspace ||
			!selectedProject ||
			projects.length === 0 ||
			!crossProjectOperation
		)
			return

		const fileIds = Array.from(selectedItems)
		const firstFileId = fileIds[0]
		const parentPath = firstFileId ? getParentPathFromFileId(firstFileId, attachments) : []

		crossProjectOperation.openCopyModal(fileIds, parentPath)
	}

	// 创建下拉菜单项配置
	const batchMenuItems: MenuProps["items"] = [
		// 分享文件（仅在项目内显示）
		...(isInProject && allowEdit
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
		...(isInProject
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
								onClick: () => handleExportPdfOrPpt("pdf"),
								disabled: batchLoading,
							},
							{
								key: "export-ppt",
								label: (
									<div style={{ display: "flex", alignItems: "center", gap: 8 }}>
										<IconFileTypePpt size={16} stroke={1.5} />
										<span>{t("topicFiles.exportPpt")}</span>
									</div>
								),
								onClick: () => handleExportPdfOrPpt("ppt"),
								disabled: batchLoading,
							},
						],
					},
				]
			: // 不在项目内，暂时只显示一个一级菜单的批量下载（兼容金融模式）
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
						onClick: () => handleExportPdfOrPpt("pdf"),
						disabled: batchLoading,
					},
					{
						key: "export-ppt",
						label: (
							<div style={{ display: "flex", alignItems: "center", gap: 8 }}>
								<IconFileTypePpt size={16} stroke={1.5} />
								<span>{t("topicFiles.exportPpt")}</span>
							</div>
						),
						onClick: () => handleExportPdfOrPpt("ppt"),
						disabled: batchLoading,
					},
				]),
		// 批量移动（仅在允许编辑时显示）
		...(isInProject && allowEdit
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
		...(isInProject && allowEdit
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
		...(isInProject && allowEdit
			? [
					{
						type: "divider" as const,
						key: "divider",
					},
				]
			: []),
		// 批量删除（仅在允许编辑时显示）
		...(isInProject && allowEdit
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

	return {
		// 状态
		batchLoading,
		showBatchDownload,

		// 处理函数
		handleBatchDownload,
		handleExportPdfOrPpt,
		handleBatchDelete,
		handleMobileBatchDelete,
		handleBatchShare,
		hasSelectedFolders,

		// 下拉菜单项配置
		batchMenuItems,
	}
}
