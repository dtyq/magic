import { filterPptSlidePaths } from "@/pages/superMagic/utils/pptHiddenSlides"
import { useState, useEffect, useCallback } from "react"
import { useTranslation } from "react-i18next"
import {
	AlertTriangle,
	Crosshair,
	DownloadIcon,
	Maximize,
	Minimize,
	RefreshCw,
	Share2,
	MoreHorizontal,
} from "lucide-react"
import { observer } from "mobx-react-lite"
import { Button } from "@/components/shadcn-ui/button"
import { cn } from "@/utils/cn"
import ViewModeSwitcher from "../ViewModeSwitcher"
import { useAIEditMenuItems } from "./useAIEditMenuItems"
import MagicDropdown from "@/components/base/MagicDropdown"
import ConditionalTooltip from "./ConditionalTooltip"
import FileEditButtons from "./FileEditButtons"
import ExportDropdown from "./ExportDropdown"
import { VersionHistorySelector } from "../PPTRender/components/VersionHistorySelector"
import type { FileHistoryVersion } from "@/pages/superMagic/pages/Workspace/types"
import ActionButton from "../CommonHeader/components/ActionButton"
import { usePPTEventBus } from "../PPTRender/hooks/usePPTEventBus"
import useFullscreenMode from "@/hooks/useFullscreenMode"
import { useFileShare } from "../CommonHeader/hooks"
import { FileShareModals } from "../CommonHeader/components"
import type { AttachmentItem } from "../../../TopicFilesButton/hooks/types"
import useFileExport from "../../hooks/useFileExport"
import { projectStore } from "@/pages/superMagic/stores/core"
import usePPTStoreOptional from "./usePPTStoreOptional"
import magicToast from "@/components/base/MagicToaster/utils"
import { exportHtmlToImage } from "@magic-web/html2image"
import { pptxExternalLogger, reportPptxExportError } from "@/pages/superMagic/utils/pptxLogger"
import { createPptxResourceErrorCollector } from "@/pages/superMagic/utils/pptxResourceErrors"
import {
	publishPptxExportFailure,
	publishPptxExportIssues,
} from "@/pages/superMagic/utils/pptxExportIssues"
import type { ExportIssue } from "@magic/html2pptx"
import { createRandomUuidV4 } from "@/utils/create-random-uuid-v4"
import {
	createPptxSlideConfig,
	resolvePptScaleContentDimensions,
} from "../../contents/HTML/utils/slide-dimensions"
import {
	documentExportService,
	type DocumentExport,
} from "@/pages/superMagic/services/documentExport"
import { runGuardedAction, guardMenuItems } from "../../utils/actionGuard"
import { iteratePreparedHtmlPages } from "@/utils/htmlExportPrepare"
import {
	assertPptxExportAvailable,
	formatPptxStreamingProgress,
	openPptxDestination,
	PptxExportUnavailableError,
	supportsPptxExport,
	startPptxStreamingExportFromFactory,
} from "@/pages/superMagic/services/pptxStreamingExport"
import type { BeforeAction } from "../../utils/actionGuard"

export interface EditToolbarProps {
	/** Controlled by the preview host when fullscreen is managed outside this toolbar. */
	isFullscreen?: boolean
	/** 将更多菜单挂载到当前预览容器，以支持全屏。 */
	getPopupContainer?: () => HTMLElement | null
	/** Only the active cached preview should expose fixed test ids. */
	testIdsEnabled?: boolean
	style?: React.CSSProperties
	/** 禁用工具栏交互及其全局快捷键，但保持组件实例和内部状态常驻 */
	interactionDisabled?: boolean
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
	onSave?: () => void | Promise<void>
	/** 保存并退出按钮点击回调 */
	onSaveAndExit?: () => void | Promise<void>
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
		projectId?: string
		projectName?: string
	}
	/** 附件列表（用于分享） */
	attachments?: AttachmentItem[]
	/** 是否显示分享按钮 */
	showShare?: boolean
	/** 是否允许分享（仅在最新版本时允许） */
	allowShare?: boolean
	/** 是否显示下载按钮 */
	showDownload?: boolean
	/** 项目ID（分享页面等 projectStore 不可用时的 fallback） */
	projectId?: string
	/** 触发元素选取检查器（仅 HTML 场景下传入）*/
	onStartInspector?: () => void
	/** 触发元素拾取（选取后追加元素信息到当前输入框）*/
	onStartInspectorAppend?: () => void
	/** AI 选取是否正在进行中 */
	isAppendPicking?: boolean
	/** 触发即时元素选取并写入输入框 */
	onStartInspectorQuickSelect?: () => void
	/** 即时元素选取是否正在进行中 */
	isQuickSelecting?: boolean
	/** Optional guard run before actions that leave the current selection flow. */
	beforeAction?: BeforeAction
}

function EditToolbar({
	isFullscreen: controlledFullscreen,
	testIdsEnabled = true,
	interactionDisabled = false,
	showAIOptimization = false,
	showFileEdit = false,
	isEditMode = false,
	isSaving = false,
	attachmentList,
	fileId,
	onEdit,
	onSave,
	onSaveAndExit,
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
	projectId,
	onStartInspectorAppend,
	isAppendPicking = false,
	onStartInspectorQuickSelect,
	isQuickSelecting = false,
	beforeAction,
	getPopupContainer,
}: EditToolbarProps) {
	const { t } = useTranslation("super")
	const { emitFullscreenToggle } = usePPTEventBus()
	const [localFullscreen, setIsFullscreen] = useState(false)
	const isFullscreen = controlledFullscreen ?? localFullscreen
	const isFullscreenMode = useFullscreenMode()
	const [isEditableExporting, setIsEditableExporting] = useState(false)

	useEffect(() => {
		function handleKeyDown(event: KeyboardEvent) {
			if (event.key === "Escape") {
				setIsFullscreen(false)
			}
		}

		window.addEventListener("keydown", handleKeyDown)
		return () => window.removeEventListener("keydown", handleKeyDown)
	}, [isFullscreen, emitFullscreenToggle])

	const selectedProject = projectStore.selectedProject
	const resolvedProjectId = selectedProject?.id || projectId

	// Try to get PPT store if available (only in PPT context)
	const pptStore = usePPTStoreOptional()

	// File export hook
	const { isExporting, exportFile, exportPptx } = useFileExport({
		attachments: attachmentList,
		selectedProject: resolvedProjectId ? { id: resolvedProjectId } : undefined,
		projectId: resolvedProjectId,
		t,
	})

	function exportPdfByPaths(input: { slidePaths?: string[]; includeHiddenSlides?: boolean }) {
		if (!pptStore) {
			magicToast.error(t("topicFiles.contextMenu.fileExport.exportFailed"))
			return
		}
		const documentExporter = documentExportService.get()
		if (!documentExporter) {
			magicToast.error(t("topicFiles.contextMenu.fileExport.unsupportedInCurrentVersion"))
			return
		}

		const { slidePaths } = input
		const storeConfig = pptStore.getConfigForExport()
		const defaultName =
			storeConfig?.displayConfig?.name || storeConfig?.mainFileName || "slides"

		const exportPaths = new Set(
			filterPptSlidePaths(
				slidePaths ?? pptStore.slides.map((slide) => slide.path),
				storeConfig?.displayConfig?.hidden_slides,
				input.includeHiddenSlides,
			),
		)
		const targetSlides = pptStore.slides.filter((slide) => exportPaths.has(slide.path))

		if (!targetSlides.length) {
			magicToast.error(t("topicFiles.contextMenu.fileExport.exportFailed"))
			return
		}

		const htmlSlides = targetSlides.map((slide) => slide.content ?? "")
		const toastId = createRandomUuidV4()
		const resourceErrors = documentExporter.createResourceErrorCollector(t)
		let pdfHandle: DocumentExport.Handle | null = null

		function getPdfExportToastContent(progressText: string) {
			return (
				<div className="flex items-center gap-2">
					<span>{progressText}</span>
					<Button
						type="button"
						variant="secondary"
						size="sm"
						className="h-6 bg-destructive-custom px-2 text-xs text-destructive hover:opacity-90"
						onClick={() => pdfHandle?.cancel?.()}
					>
						{t("topicFiles.exportCancel")}
					</Button>
				</div>
			)
		}

		magicToast.loading({
			key: toastId,
			content: getPdfExportToastContent(t("topicFiles.exporting")),
			duration: 0,
		})

		pdfHandle = documentExporter.exportPages(htmlSlides, {
			fileName: defaultName.replace(/\.html?$/i, "") + ".pdf",
			skipFailedPages: true,
			pptMode: true,
			onResourceLoadError: resourceErrors.onResourceLoadError,
			onPageProgress: (ctx) => {
				const { index, total } = ctx as DocumentExport.PageProgressContext
				const progress = total > 1 ? ` (${index + 1}/${total})` : ""
				magicToast.loading({
					key: toastId,
					content: getPdfExportToastContent(`${t("topicFiles.exporting")}${progress}`),
					duration: 0,
				})
			},
		})

		setIsEditableExporting(true)

		pdfHandle.promise
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
					console.error("[exportPDF] failed:", error)
				}
			})
			.finally(() => {
				setIsEditableExporting(false)
			})
	}

	function exportImageByPaths(input: {
		slidePaths?: string[]
		imageFormat: "png" | "jpeg"
		includeHiddenSlides?: boolean
	}) {
		if (!pptStore) {
			magicToast.error(t("topicFiles.contextMenu.fileExport.exportFailed"))
			return
		}

		const { slidePaths, imageFormat } = input
		const storeConfig = pptStore.getConfigForExport()
		const defaultName =
			storeConfig?.displayConfig?.name || storeConfig?.mainFileName || "slides"

		const exportPaths = new Set(
			filterPptSlidePaths(
				slidePaths ?? pptStore.slides.map((slide) => slide.path),
				storeConfig?.displayConfig?.hidden_slides,
				input.includeHiddenSlides,
			),
		)
		const targetSlides = pptStore.slides.filter((slide) => exportPaths.has(slide.path))

		if (!targetSlides.length) {
			magicToast.error(t("topicFiles.contextMenu.fileExport.exportFailed"))
			return
		}

		const htmlSlides = targetSlides.map((slide) => slide.content ?? "")
		const toastId = createRandomUuidV4()
		let imageHandle: ReturnType<typeof exportHtmlToImage> | null = null

		function getImageExportToastContent(progressText: string) {
			return (
				<div className="flex items-center gap-2">
					<span>{progressText}</span>
					<Button
						type="button"
						variant="secondary"
						size="sm"
						className="h-6 bg-destructive-custom px-2 text-xs text-destructive hover:opacity-90"
						onClick={() => imageHandle?.cancel()}
					>
						{t("topicFiles.exportCancel")}
					</Button>
				</div>
			)
		}

		magicToast.loading({
			key: toastId,
			content: getImageExportToastContent(t("topicFiles.exporting")),
			duration: 0,
		})

		imageHandle = exportHtmlToImage({
			pages: htmlSlides,
			format: imageFormat,
			fileName: defaultName.replace(/\.html?$/i, ""),
			onProgress: ({ phase, current, total }) => {
				if (phase === "capture" && total > 0) {
					const progress = total > 1 ? ` (${current}/${total})` : ""
					magicToast.loading({
						key: toastId,
						content: getImageExportToastContent(
							`${t("topicFiles.exporting")}${progress}`,
						),
						duration: 0,
					})
				}
			},
		})

		setIsEditableExporting(true)

		imageHandle.promise
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
					console.error("[exportHtmlToImage] failed:", error)
				}
			})
			.finally(() => {
				setIsEditableExporting(false)
			})
	}

	async function exportEditablePptByPaths(input: {
		slidePaths?: string[]
		includeHiddenSlides?: boolean
	}) {
		if (!pptStore) {
			magicToast.error(t("topicFiles.contextMenu.fileExport.exportFailed"))
			return
		}

		const { slidePaths } = input
		const storeConfig = pptStore.getConfigForExport()
		const defaultName =
			storeConfig?.displayConfig?.name || storeConfig?.mainFileName || "slides"

		const selectedPathSet = new Set(
			filterPptSlidePaths(
				slidePaths ?? pptStore.slides.map((slide) => slide.path),
				storeConfig?.displayConfig?.hidden_slides,
				input.includeHiddenSlides,
			),
		)
		const selectedSlides = pptStore.slides.filter((slide) => selectedPathSet.has(slide.path))
		const firstSlide = selectedSlides[0]
		const pageCount = selectedSlides.length

		if (!firstSlide || pageCount === 0) {
			magicToast.error(t("topicFiles.contextMenu.fileExport.exportFailed"))
			return
		}

		const ensureSlideContent = async (slide: (typeof pptStore.slides)[number]) => {
			if (slide.loadingState === "loaded" && slide.content?.trim()) {
				return slide.content
			}

			const slideIndex = pptStore.slides.indexOf(slide)
			const fileId =
				pptStore.getFileIdByPath(slide.path) || pptStore.tryExtractAndMapFileId(slide.path)
			const content = fileId
				? await pptStore.loadSlideContentByFileId(fileId, {
						path: slide.path,
						url: slide.url,
						indexHint: slideIndex,
					})
				: await pptStore.loadSlideContent(slide.url || "", slideIndex)

			if (!content?.trim()) {
				throw new Error(`Slide content is unavailable for export: ${slide.path}`)
			}
			return content
		}

		const toastId = createRandomUuidV4()
		let destinationLease: Awaited<ReturnType<typeof openPptxDestination>> = null
		try {
			assertPptxExportAvailable({ pageCount })
			destinationLease = await openPptxDestination({ suggestedName: defaultName })
		} catch (error) {
			const isUnavailable = error instanceof PptxExportUnavailableError
			magicToast.error(
				isUnavailable ? error.message : t("topicFiles.contextMenu.fileExport.exportFailed"),
			)
			reportPptxExportError(error, {
				fileName: defaultName,
				slideCount: pageCount,
				source: "EditToolbar.destination",
			})
			return
		}
		if (!destinationLease) return
		let cancelExport: (() => void) | null = null
		const resourceErrors = createPptxResourceErrorCollector(t)
		const exportIssues: ExportIssue[] = []

		function getExportToastContent(progressText: string) {
			return (
				<div className="flex items-center gap-2">
					<span>{progressText}</span>
					<Button
						type="button"
						variant="secondary"
						size="sm"
						className="h-6 bg-destructive-custom px-2 text-xs text-destructive hover:opacity-90"
						onClick={() => cancelExport?.()}
					>
						{t("topicFiles.exportCancel")}
					</Button>
				</div>
			)
		}

		const pptFontResolver = documentExportService.get()?.getPptFontResolver?.()

		{
			const destination = destinationLease.destination
			const streamingHandle = startPptxStreamingExportFromFactory(
				(signal) =>
					iteratePreparedHtmlPages({
						pages: (async function* iterateSelectedSlides() {
							for (const [index, slide] of selectedSlides.entries()) {
								if (signal.aborted) return
								const content = await ensureSlideContent(slide)
								if (signal.aborted) return
								const fileId =
									pptStore.getFileIdByPath(slide.path) ||
									pptStore.tryExtractAndMapFileId(slide.path)
								yield {
									index,
									html: content,
									key: slide.path,
									pageName:
										slide.path.split("/").pop() || slide.title || slide.path,
									pagePath: slide.path,
									pageFileId: fileId,
								}
							}
						})(),
						signal,
					}),
				(firstPage) => ({
					fileName: defaultName,
					destination,
					outputPolicy: "file-stream",
					pageCount,
					config: createPptxSlideConfig(
						resolvePptScaleContentDimensions(firstPage.html, firstSlide.rawContent),
					),
					// A malformed page script (for example, ECharts targeting a missing container)
					// is reported through onExportIssue but must not prevent the remaining slides
					// from being written to the selected PPTX destination.
					skipFailedPages: true,
					fontResolver: pptFontResolver,
					logger: pptxExternalLogger,
					logLevel: "warn",
					onResourceLoadError: resourceErrors.onResourceLoadError,
					onExportIssue: (issue) => exportIssues.push(issue),
					onProgress: (progress) => {
						magicToast.loading({
							key: toastId,
							content: getExportToastContent(
								formatPptxStreamingProgress(t("topicFiles.exporting"), progress),
							),
							duration: 0,
						})
					},
				}),
			)
			cancelExport = streamingHandle.cancel
			magicToast.loading({
				key: toastId,
				content: getExportToastContent(t("topicFiles.exporting")),
				duration: 0,
			})

			setIsEditableExporting(true)
			streamingHandle.promise
				.then(() => {
					publishPptxExportIssues(exportIssues, { fileName: defaultName })
					magicToast.success({
						key: toastId,
						content: t("topicFiles.exportSuccess"),
						duration: 1000,
					})
				})
				.catch(async (error: unknown) => {
					await destinationLease.abort(error).catch(() => undefined)
					const isAbort = (error as { name?: string } | null)?.name === "AbortError"
					if (isAbort) {
						magicToast.info({
							key: toastId,
							content: t("topicFiles.exportCancel"),
							duration: 1000,
						})
					} else {
						publishPptxExportFailure(exportIssues, error, { fileName: defaultName })
						magicToast.error({
							key: toastId,
							content: t("topicFiles.contextMenu.fileExport.exportFailed"),
							duration: 1000,
						})
						reportPptxExportError(error, {
							fileName: defaultName,
							slideCount: pageCount,
							source: "EditToolbar.streaming",
						})
					}
				})
				.finally(() => {
					setIsEditableExporting(false)
				})
			return
		}
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
		shareTarget,
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

	const isCodeViewMode = viewMode === "code"
	const showViewModeSwitcher = !isEditMode && onViewModeChange
	const showServerUpdateButton = isEditMode && hasServerUpdate
	const showAIOptimizationButton = showAIOptimization && !isEditMode
	const aiEditMenuItems = useAIEditMenuItems({
		attachmentList,
		fileId,
		enabled: showAIOptimizationButton && !interactionDisabled && testIdsEnabled,
		maxItems: 3,
		onPrimaryAction: isCodeViewMode ? undefined : onStartInspectorAppend,
		isPrimaryActive: isAppendPicking,
	})
	const showFileEditButtons = showFileEdit
	const quickSelectionLabel = t(
		isQuickSelecting ? "topicFiles.exitSelectElement" : "topicFiles.selectElement",
	)
	const showVersionHistorySelector =
		showVersionHistory && !isEditMode && fileId && onVersionChange && fetchFileVersions
	const showRefreshButton = showRefresh && !isEditMode && onRefresh
	const showShareButton = showShare && !isEditMode && isNewestVersion && allowShare && currentFile
	const runToolbarAction = useCallback(
		(action: () => void | Promise<void>) => {
			void runGuardedAction(beforeAction, action)
		},
		[beforeAction],
	)
	const handleDownloadSource = (): void => {
		if (!fileId || interactionDisabled) return
		// 源码下载当前页的已保存版本，不使用主文稿 ID，也不导出预览加工后的 HTML。
		runToolbarAction(() =>
			exportFile([fileId], fileVersion !== undefined ? { [fileId]: fileVersion } : undefined),
		)
	}

	return (
		<div
			className={cn("h-12 w-full border-b border-border", className)}
			style={style}
			data-testid={testIdsEnabled ? "ppt-edit-toolbar-actions" : undefined}
		>
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
								beforeAction={beforeAction}
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
								data-testid={
									testIdsEnabled
										? "ppt-edit-toolbar-view-mode-switcher"
										: undefined
								}
								testIdsEnabled={testIdsEnabled}
								testIdPrefix={
									testIdsEnabled ? "ppt-edit-toolbar-view-mode" : undefined
								}
								viewMode={viewMode}
								onViewModeChange={(mode) =>
									runToolbarAction(() => onViewModeChange?.(mode))
								}
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
							data-testid={
								testIdsEnabled ? "ppt-edit-toolbar-server-update-button" : undefined
							}
							variant="secondary"
							size="sm"
							onClick={() => runToolbarAction(() => onViewServerUpdate?.())}
							className="h-6 gap-1.5 rounded-md px-3 text-xs font-normal shadow-xs"
						>
							<AlertTriangle size={16} className="text-amber-600" />
							<span>{t("ppt.serverUpdateAvailable")}</span>
						</Button>
					)}

					{/* AI 选取按钮 */}
					{showFileEditButtons &&
						!isEditMode &&
						!isCodeViewMode &&
						(onStartInspectorQuickSelect || onStartInspectorAppend) && (
							<ConditionalTooltip
								showText={shouldShowButtonText}
								title={quickSelectionLabel}
							>
								<Button
									data-testid={
										testIdsEnabled
											? "ppt-edit-toolbar-quick-select-button"
											: undefined
									}
									variant="outline"
									size="sm"
									onClick={onStartInspectorQuickSelect || onStartInspectorAppend}
									aria-pressed={isQuickSelecting}
									className={cn(
										"h-6 gap-1.5 rounded-[8px] px-3 py-0 text-xs font-normal text-foreground shadow-xs",
										isQuickSelecting && "text-primary",
									)}
								>
									<Crosshair
										size={16}
										className={cn(isQuickSelecting && "animate-pulse")}
									/>
									{shouldShowButtonText && <span>{quickSelectionLabel}</span>}
								</Button>
							</ConditionalTooltip>
						)}

					{/* 编辑按钮 */}
					{showFileEditButtons && (
						<FileEditButtons
							testIdPrefix={testIdsEnabled ? "ppt-edit-toolbar" : undefined}
							fileId={fileId}
							interactionDisabled={interactionDisabled}
							isEditMode={isEditMode}
							isSaving={isSaving}
							showButtonText={shouldShowButtonText}
							editLabel={t("common.edit")}
							onEdit={() => runToolbarAction(() => onEdit?.())}
							onSave={onSave}
							onSaveAndExit={onSaveAndExit}
							onCancel={onCancel}
						/>
					)}

					<div className="mx-1 h-4 w-px bg-border" />

					{/* 刷新按钮 */}
					{showRefreshButton && (
						<ActionButton
							data-testid={
								testIdsEnabled ? "ppt-edit-toolbar-refresh-button" : undefined
							}
							icon={
								<RefreshCw
									size={16}
									className={cn(isRefreshing && "animate-spin")}
								/>
							}
							onClick={() => runToolbarAction(() => onRefresh?.())}
							title={t("ppt.refreshCurrentSlide")}
							text={t("ppt.refreshCurrentSlide")}
							showText={shouldShowButtonText}
							disabled={isRefreshing}
						/>
					)}

					{/* 全屏按钮 */}

					{!isFullscreenMode && (
						<ActionButton
							data-testid={
								testIdsEnabled ? "ppt-edit-toolbar-fullscreen-button" : undefined
							}
							icon={isFullscreen ? <Minimize size={16} /> : <Maximize size={16} />}
							onClick={() => {
								void runGuardedAction(beforeAction, () => {
									emitFullscreenToggle()
									if (controlledFullscreen === undefined)
										setIsFullscreen(!isFullscreen)
								})
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
					)}

					{showDownload && isCodeViewMode && (
						<ActionButton
							data-testid={
								testIdsEnabled
									? "ppt-edit-toolbar-download-source-button"
									: undefined
							}
							icon={<DownloadIcon size={16} />}
							title={t("ppt.download")}
							text={t("ppt.download")}
							showText={shouldShowButtonText}
							disabled={!fileId || interactionDisabled}
							onClick={handleDownloadSource}
						/>
					)}
					{showDownload && !isCodeViewMode && (
						<ExportDropdown
							showText={shouldShowButtonText}
							isExporting={isExporting || isEditableExporting}
							supportPptx={supportsPptxExport()}
							beforeAction={beforeAction}
							supportSpecificPages={!!pptStore}
							slides={pptStore?.slides}
							hiddenSlides={
								pptStore?.getConfigForExport()?.displayConfig?.hidden_slides
							}
							onExportPptx={() => {
								if (pptStore) exportEditablePptByPaths({})
								else void exportPptx([mainFileId || ""])
							}}
							onExportSpecificPages={(
								filePaths: string[],
								format: "source" | "pdf" | "pptx" | "image_png" | "image_jpeg",
								includeHiddenSlides?: boolean,
							) => {
								if (!filePaths.length) return

								// PDF 和 PPTX 使用纯前端多页导出（直接拿 slide content）
								if (format === "pdf") {
									exportPdfByPaths({ slidePaths: filePaths, includeHiddenSlides })
									return
								}
								if (format === "pptx") {
									exportEditablePptByPaths({
										slidePaths: filePaths,
										includeHiddenSlides,
									})
									return
								}
								if (format === "image_png" || format === "image_jpeg") {
									exportImageByPaths({
										slidePaths: filePaths,
										includeHiddenSlides,
										imageFormat: format === "image_png" ? "png" : "jpeg",
									})
									return
								}

								if (format === "source") {
									const fileIds = filePaths
										.map((filePath) => pptStore?.getFileIdByPath(filePath))
										.filter((fileId): fileId is string => fileId !== undefined)
									if (fileIds.length) exportFile(fileIds)
								}
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
							data-testid="detail-header-action-item-share"
							icon={<Share2 size={16} />}
							onClick={() => runToolbarAction(() => handleShare())}
							title={t("ppt.share")}
							text={t("ppt.share")}
							showText={shouldShowButtonText}
							loading={isCheckingShare}
							disabled={isCheckingShare}
						/>
					)}

					{showAIOptimizationButton && fileId && (
						<MagicDropdown
							menu={{ items: guardMenuItems(aiEditMenuItems, beforeAction) }}
							trigger={["click"]}
							placement="bottomRight"
							disabled={interactionDisabled}
							getPopupContainer={() => getPopupContainer?.() ?? document.body}
						>
							<Button
								type="button"
								variant="ghost"
								size="sm"
								aria-label={t("fileViewer.more")}
								title={t("fileViewer.more")}
								className="h-6 gap-1.5 rounded-lg px-1.5 text-xs font-normal"
								data-testid={
									testIdsEnabled ? "ppt-edit-toolbar-more-button" : undefined
								}
								disabled={interactionDisabled}
							>
								<MoreHorizontal size={16} />
								{shouldShowButtonText && <span>{t("fileViewer.more")}</span>}
							</Button>
						</MagicDropdown>
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
							currentFile={shareTarget ?? currentFile}
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
