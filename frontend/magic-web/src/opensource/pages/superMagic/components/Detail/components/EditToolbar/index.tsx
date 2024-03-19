import { useState } from "react"
import { useTranslation } from "react-i18next"
import { AlertTriangle, Maximize, Minimize, RefreshCw, Share2 } from "lucide-react"
import { observer } from "mobx-react-lite"
import { Button } from "@/opensource/components/shadcn-ui/button"
import { cn } from "@/opensource/lib/utils"
import ViewModeSwitcher from "../ViewModeSwitcher"
import AIEditButton from "./AIEditButton"
import FileEditButtons from "./FileEditButtons"
import ExportDropdown from "./ExportDropdown"
import { VersionHistorySelector } from "../PPTRender/components/VersionHistorySelector"
import type { FileHistoryVersion } from "@/opensource/pages/superMagic/pages/Workspace/types"
import ActionButton from "../CommonHeader/components/ActionButton"
import { usePPTEventBus } from "../PPTRender/hooks/usePPTEventBus"
import { useFileShare } from "../CommonHeader/hooks"
import { FileShareModals } from "../CommonHeader/components"
import type { AttachmentItem } from "../../../TopicFilesButton/hooks/types"
import useFileExport from "../../hooks/useFileExport"
import { projectStore } from "@/opensource/pages/superMagic/stores/core"
import usePPTStoreOptional from "./usePPTStoreOptional"
import magicToast from "@/opensource/components/base/MagicToaster/utils"
import { exportPPTX } from "../../../../../../../../packages/html2pptx/src"

interface EditToolbarProps {
	style?: React.CSSProperties
	/** 主文件ID */
	mainFileId?: string
	/** 是否显示AI编辑按钮 */
	showAIOptimization?: boolean
	/** 是否显示在线编辑按钮 */
	showFileEdit?: boolean
	/** 是否处于编辑模式 */
	isEditMode?: boolean
	/** 是否正在保存 */
	isSaving?: boolean
	/** 附件列表（用于AI编辑） */
	attachmentList?: AttachmentItem[]
	/** 当前文件ID */
	fileId?: string
	/** 编辑按钮点击回调 */
	onEdit?: () => void
	/** 保存按钮点击回调 */
	onSave?: () => void
	/** 取消按钮点击回调 */
	onCancel?: () => void
	/** 自定义类名 */
	className?: string
	/** 是否有服务端更新 */
	hasServerUpdate?: boolean
	/** 查看服务端更新回调 */
	onViewServerUpdate?: () => void
	/** 当前视图模式 */
	viewMode?: "code" | "desktop" | "phone"
	/** 视图模式切换回调 */
	onViewModeChange?: (mode: "code" | "desktop" | "phone") => void
	/** 是否显示版本历史选择器 */
	showVersionHistory?: boolean
	/** 当前版本号 */
	fileVersion?: number
	/** 版本列表 */
	fileVersionsList?: FileHistoryVersion[]
	/** 是否是最新版本 */
	isNewestVersion?: boolean
	/** 版本切换回调 */
	onVersionChange?: (version: number | undefined) => void
	/** 版本回滚回调 */
	onVersionRollback?: (version?: number) => void
	/** 版本对比回调 */
	onCompareVersion?: (version: number) => void
	/** 获取版本列表回调 */
	fetchFileVersions?: (fileId: string) => void
	/** 是否显示按钮文字（从 PPTStore 传递） */
	shouldShowButtonText?: boolean
	/** 是否显示刷新按钮 */
	showRefresh?: boolean
	/** 刷新回调 */
	onRefresh?: () => void
	/** 是否正在刷新 */
	isRefreshing?: boolean
	/** 当前文件信息（用于分享） */
	currentFile?: {
		id: string
		name: string
		type: string
		url?: string
	}
	/** 附件列表（用于分享） */
	attachments?: AttachmentItem[]
	/** 是否显示分享按钮 */
	showShare?: boolean
	/** 是否允许分享（仅在最新版本时允许） */
	allowShare?: boolean
	/** 是否显示下载按钮 */
	showDownload?: boolean
}

function EditToolbar({
	showAIOptimization = false,
	showFileEdit = false,
	isEditMode = false,
	isSaving = false,
	attachmentList,
	fileId,
	onEdit,
	onSave,
	onCancel,
	className,
	hasServerUpdate = false,
	onViewServerUpdate,
	viewMode = "desktop",
	onViewModeChange,
	showVersionHistory = false,
	fileVersion,
	fileVersionsList = [],
	isNewestVersion = true,
	onVersionChange,
	onVersionRollback,
	onCompareVersion,
	fetchFileVersions,
	shouldShowButtonText = true,
	showRefresh = false,
	onRefresh,
	isRefreshing = false,
	currentFile,
	attachments,
	showShare = true,
	allowShare = true,
	mainFileId,
	showDownload = true,
	style,
}: EditToolbarProps) {
	const { t } = useTranslation("super")
	const { emitFullscreenToggle } = usePPTEventBus()
	const [isFullscreen, setIsFullscreen] = useState(false)
	const [isEditableExporting, setIsEditableExporting] = useState(false)

	// Get project info from store
	const selectedProject = projectStore.selectedProject

	// Try to get PPT store if available (only in PPT context)
	const pptStore = usePPTStoreOptional()

	// Get page info from PPT store if available
	const currentPageIndex = pptStore?.activeIndex
	const totalPages = pptStore?.slidePaths.length

	// File export hook
	const { isExporting, exportFile, exportPdf, exportPpt } = useFileExport({
		attachments: attachmentList,
		selectedProject: selectedProject ? { id: selectedProject.id } : undefined,
		projectId: selectedProject?.id,
		t,
	})

	function exportEditablePptByPaths(input: { slidePaths?: string[] }) {
		if (!pptStore) {
			magicToast.error(t("topicFiles.contextMenu.fileExport.exportFailed"))
			return
		}

		const { slidePaths } = input
		const storeConfig = pptStore.getConfigForExport()
		const defaultName = storeConfig?.metadata?.name || "slides"

		const targetSlides = slidePaths?.length
			? pptStore.slides.filter((slide) => slidePaths.includes(slide.path))
			: pptStore.slides

		if (!targetSlides.length) {
			magicToast.error(t("topicFiles.contextMenu.fileExport.exportFailed"))
			return
		}

		const htmlSlides = targetSlides.map((slide) => slide.content ?? "")
		const toastId = crypto.randomUUID()
		let exportHandle: ReturnType<typeof exportPPTX> | null = null

		function getExportToastContent(progressText: string) {
			return (
				<div className="flex items-center gap-2">
					<span>{progressText}</span>
					<Button
						type="button"
						variant="secondary"
						size="sm"
						className="h-6 bg-destructive-custom px-2 text-xs text-destructive hover:opacity-90"
						onClick={() => exportHandle?.cancel()}
					>
						{t("topicFiles.exportCancel")}
					</Button>
				</div>
			)
		}

		exportHandle = exportPPTX(htmlSlides, {
			fileName: defaultName,
			skipFailedPages: true,
			onSlideProgress: ({ index, total }) => {
				const progress = total > 1 ? ` (${index + 1}/${total})` : ""
				magicToast.loading({
					key: toastId,
					content: getExportToastContent(`${t("topicFiles.exporting")}${progress}`),
					duration: 0,
				})
			},
		})

		setIsEditableExporting(true)

		exportHandle.promise
			.then(() => {
				magicToast.success({
					key: toastId,
					content: t("topicFiles.exportSuccess"),
					duration: 1000,
				})
			})
			.catch((error: unknown) => {
				const isAbort = (error as { name?: string } | null)?.name === "AbortError"
				if (isAbort) {
					magicToast.info({
						key: toastId,
						content: t("topicFiles.exportCancel"),
						duration: 1000,
					})
				} else {
					magicToast.error({
						key: toastId,
						content: t("topicFiles.contextMenu.fileExport.exportFailed"),
						duration: 1000,
					})
					console.error("Export editable PPT failed:", error)
				}
			})
			.finally(() => {
				setIsEditableExporting(false)
			})
	}

	// File sharing hook
	const {
		shareModalVisible,
		showSuccessModal,
		existingShareInfo,
		shareFileId,
		showSimilarSharesDialog,
		similarShares,
		isCheckingShare,
		handleShare,
		handleSelectSimilarShare,
		handleCreateNewShare,
		handleCancelShare,
		handleEditShare,
		setShareModalVisible,
		setShowSuccessModal,
		setExistingShareInfo,
		closeSimilarSharesDialog,
	} = useFileShare({
		currentFile,
		attachments,
	})

	const showViewModeSwitcher = !isEditMode && onViewModeChange
	const showServerUpdateButton = isEditMode && hasServerUpdate
	const showAIOptimizationButton = showAIOptimization && !isEditMode
	const showFileEditButtons = showFileEdit
	const showVersionHistorySelector =
		showVersionHistory && !isEditMode && fileId && onVersionChange && fetchFileVersions
	const showRefreshButton = showRefresh && !isEditMode && onRefresh
	const showShareButton = showShare && !isEditMode && isNewestVersion && allowShare && currentFile

	return (
		<div className={cn("h-12 w-full border-b border-border", className)} style={style}>
			<div className="scrollbar-x-thin h-full w-full overflow-x-auto">
				<div className="flex h-full w-max min-w-full flex-nowrap items-center justify-end gap-1 px-2">
					{showVersionHistorySelector && (
						<>
							<VersionHistorySelector
								fileId={fileId}
								fileVersion={fileVersion}
								fileVersionsList={fileVersionsList}
								isNewestVersion={isNewestVersion}
								onVersionChange={onVersionChange}
								showButtonText={shouldShowButtonText}
								onRollback={
									onVersionRollback ||
									(() => {
										// No-op fallback
									})
								}
								onCompareVersion={onCompareVersion}
								fetchFileVersions={fetchFileVersions}
							/>
						</>
					)}

					{showVersionHistorySelector && showViewModeSwitcher && (
						<div className="mx-1 h-4 w-px bg-border" />
					)}

					{/* 视图切换器 */}
					{showViewModeSwitcher && (
						<>
							<ViewModeSwitcher
								viewMode={viewMode}
								onViewModeChange={onViewModeChange}
								isMobile={false}
								enableMobileMode={false}
							/>
						</>
					)}

					{showViewModeSwitcher &&
						(showRefreshButton ||
							showServerUpdateButton ||
							showAIOptimizationButton ||
							showFileEditButtons) && <div className="mx-1 h-4 w-px bg-border" />}

					{/* 服务端更新提示按钮 */}
					{showServerUpdateButton && (
						<Button
							variant="secondary"
							size="sm"
							onClick={onViewServerUpdate}
							className="shadow-xs h-6 gap-1.5 rounded-md px-3 text-xs font-normal"
						>
							<AlertTriangle size={16} className="text-amber-600" />
							<span>{t("ppt.serverUpdateAvailable")}</span>
						</Button>
					)}

					{/* AI 编辑按钮 */}
					{showAIOptimizationButton && fileId && (
						<AIEditButton
							showButtonText={shouldShowButtonText}
							attachmentList={attachmentList}
							fileId={fileId}
						/>
					)}

					{/* 在线编辑按钮 */}
					{showFileEditButtons && (
						<FileEditButtons
							isEditMode={isEditMode}
							isSaving={isSaving}
							showButtonText={shouldShowButtonText}
							onEdit={onEdit}
							onSave={onSave}
							onCancel={onCancel}
						/>
					)}

					{/* 刷新按钮 */}
					{showRefreshButton && (
						<ActionButton
							icon={
								<RefreshCw
									size={16}
									className={cn(isRefreshing && "animate-spin")}
								/>
							}
							onClick={onRefresh}
							title={t("ppt.refreshCurrentSlide")}
							text={t("ppt.refreshCurrentSlide")}
							showText={shouldShowButtonText}
							disabled={isRefreshing}
						/>
					)}

					<div className="mx-1 h-4 w-px bg-border" />

					{/* 全屏按钮 */}

					<ActionButton
						icon={isFullscreen ? <Minimize size={16} /> : <Maximize size={16} />}
						onClick={() => {
							emitFullscreenToggle()
							setIsFullscreen(!isFullscreen)
						}}
						title={
							isFullscreen
								? t("fileViewer.exitFullscreen")
								: t("fileViewer.fullscreen")
						}
						text={
							isFullscreen
								? t("fileViewer.exitFullscreen")
								: t("fileViewer.fullscreen")
						}
						showText={shouldShowButtonText}
					/>

					{showDownload && (
						<ExportDropdown
							showText={shouldShowButtonText}
							isExporting={isExporting || isEditableExporting}
							supportPPT={true}
							supportCurrentPage={!!pptStore}
							supportSpecificPages={!!pptStore}
							slides={pptStore?.slides}
							currentPageIndex={currentPageIndex}
							totalPages={totalPages}
							onExportSource={() => {
								if (!mainFileId) return

								const currentFile = attachmentList?.find(
									(item: AttachmentItem) => item.file_id === mainFileId,
								)

								// 如果当前文件是文件夹，直接下载文件夹
								if (currentFile?.is_directory) {
									exportFile([mainFileId])
									return
								}

								// 检查是否有父文件夹
								const parentFileId = currentFile?.parent_id
								if (parentFileId) {
									const parentFile = attachmentList?.find(
										(item: AttachmentItem) => item.file_id === parentFileId,
									)
									// 如果父文件是文件夹，下载整个文件夹
									if (parentFile?.is_directory) {
										exportFile([parentFileId])
										return
									}
								}

								// 默认下载当前文件
								exportFile([mainFileId])
							}}
							onExportPDF={() => exportPdf([mainFileId || ""])}
							onExportPPT={() => exportPpt([mainFileId || ""])}
							onExportEditablePPT={() => exportEditablePptByPaths({})}
							onExportCurrentSource={() => {
								if (fileId)
									exportFile(
										[fileId],
										fileVersion ? { [fileId]: fileVersion } : undefined,
									)
							}}
							onExportCurrentPDF={() => {
								if (fileId) exportPdf([fileId])
							}}
							onExportCurrentPPT={() => {
								if (fileId) exportPpt([fileId])
							}}
							onExportCurrentEditablePPT={() => {
								const currentSlide = pptStore?.slides[currentPageIndex || 0]
								if (!currentSlide?.path) return
								exportEditablePptByPaths({
									slidePaths: [currentSlide.path],
								})
							}}
							onExportSpecificPages={(
								filePaths: string[],
								format: "source" | "pdf" | "ppt" | "pptx",
							) => {
								if (!filePaths.length) return

								const fileIds =
									filePaths
										.map((filePath) => pptStore?.getFileIdByPath(filePath))
										.filter(
											(fileId): fileId is string => fileId !== undefined,
										) ?? []

								if (!fileIds.length) return

								const exportHandlers = {
									source: () => exportFile(fileIds),
									pdf: () => exportPdf(fileIds),
									ppt: () => exportPpt(fileIds),
									pptx: () => exportEditablePptByPaths({ slidePaths: filePaths }),
								}

								exportHandlers[format]?.()
							}}
							onGenerateScreenshot={
								pptStore
									? async (index: number) => {
											await pptStore.ensureSlideScreenshot(index)
										}
									: undefined
							}
						/>
					)}

					{/* 分享按钮 */}
					{showShareButton && (
						<ActionButton
							icon={<Share2 size={16} />}
							onClick={handleShare}
							title={t("ppt.share")}
							text={t("ppt.share")}
							showText={shouldShowButtonText}
							loading={isCheckingShare}
							disabled={isCheckingShare}
						/>
					)}

					{/* File sharing modals */}
					{showShareButton && (
						<FileShareModals
							shareModalVisible={shareModalVisible}
							onCloseShareModal={() => {
								setShareModalVisible(false)
								setExistingShareInfo(null)
							}}
							showSuccessModal={showSuccessModal}
							existingShareInfo={existingShareInfo}
							currentFile={currentFile}
							shareFileId={shareFileId}
							attachments={attachments}
							onCancelShare={handleCancelShare}
							onEditShare={handleEditShare}
							onCloseSuccessModal={() => {
								setShowSuccessModal(false)
								setExistingShareInfo(null)
							}}
							showSimilarSharesDialog={showSimilarSharesDialog}
							similarShares={similarShares}
							onSelectSimilarShare={handleSelectSimilarShare}
							onCreateNewShare={handleCreateNewShare}
							onCloseSimilarSharesDialog={closeSimilarSharesDialog}
							isMobile={false}
						/>
					)}
				</div>
			</div>
		</div>
	)
}

export default observer(EditToolbar)
