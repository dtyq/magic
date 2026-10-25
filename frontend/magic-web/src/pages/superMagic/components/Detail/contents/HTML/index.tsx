import { useSharedHtmlAppPermissions } from "./hooks/HtmlAppPermissionContext"
import { lazy, memo, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { isConvertibleFile } from "../../utils/file"
import IsolatedHTMLRenderer, {
	type IsolatedHTMLRendererContentMetrics,
	type IsolatedHTMLRendererRef,
} from "./IsolatedHTMLRenderer"
import {
	createParentMessageHandler,
	injectFetchInterceptorScript,
	createKeyboardMessageHandler,
	POST_MESSAGE_TARGET_STRATEGIES,
	type FileItem,
} from "./utils/fetchInterceptor"
import { createNestedIframeContentHandler } from "./utils/nested-iframe-content"
import { createVirtualStorageMessageHandler } from "./utils/virtual-storage"
import { HTML_IFRAME_RENDER_LIFECYCLE_EVENT } from "./telemetry/iframeRenderLifecycle"
import type { SaveResult } from "./iframe-bridge/types"
import { useStyles } from "./styles"
import MagicTooltip from "@/components/base/MagicTooltip"
import { useHtmlPreviewFreshness, type HtmlPreviewFailure } from "./hooks/useHtmlPreviewFreshness"
import { HtmlPreviewFreshness } from "./components/HtmlPreviewFreshness"
import { useFileAccess } from "@/pages/superMagic/fileAccess/FileAccessProvider"
import { useFileApi } from "@/pages/superMagic/fileAccess/fileApi"
import {
	getFileAccessContentKey,
	isShareFileAccess,
} from "@/pages/superMagic/fileAccess/fileAccessContext"
import { useFileData } from "@/pages/superMagic/hooks/useFileData"
import { processHtmlContent, type HtmlPreviewBundledTemplateKind } from "./htmlProcessor"
import { resolveHtmlPreviewBundledTemplate } from "./html-preview-bundled-shell"
import {
	attemptHtmlSaveFlow,
	confirmHtmlConflictSave,
	resolveRelativePath,
	resolveServerUpdateState,
} from "./utils"
import { useDeepCompareEffect, useMemoizedFn, useUpdateEffect } from "ahooks"
import CommonHeaderV2 from "../../components/CommonHeaderV2"
import { useDevicePreview } from "../../components/DevicePreview/useDevicePreview"
import { DevicePreviewToolbar } from "../../components/DevicePreview/DevicePreviewToolbar"
import { DevicePreviewViewport } from "../../components/DevicePreview/DevicePreviewViewport"
import { Flex } from "antd"
import { shadow } from "@/utils/shadow"
import CodeEditor from "@/components/base/CodeEditor"
import { scrollToAnchor } from "@/utils/slug"
import {
	getHtmlNavigationKey,
	normalizeHtmlPreviewPath,
	parseHtmlNavigationRequest,
	resolveRootHtmlIndexFallback,
	getHtmlNavigationIntent,
	type HtmlNavigationIntent,
} from "./utils/html-navigation"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import MagicSpin from "@/components/base/MagicSpin"
import DashboardIsolatedHTMLRenderer from "./dashboard/DashboardIsolatedHTMLRenderer"
import { usePreviewFrameSwap } from "./hooks/usePreviewFrameSwap"
import { useSaveConfirmation } from "./hooks/useSaveConfirmation"
import { inlineDashboardDataJs } from "./dashboard/resourceVersioning"
import { useDashboardVersioning } from "./dashboard/useDashboardVersioning"
import { useAIEditMenuItems } from "@/pages/superMagic/components/Detail/components/EditToolbar/useAIEditMenuItems"
import FileEditButtons from "@/pages/superMagic/components/Detail/components/EditToolbar/FileEditButtons"
import ConditionalTooltip from "@/pages/superMagic/components/Detail/components/EditToolbar/ConditionalTooltip"
import ActionButton from "@/pages/superMagic/components/Detail/components/CommonHeader/components/ActionButton"
import { cn } from "@/utils/cn"
import { ProjectListItem } from "@/pages/superMagic/pages/Workspace/types"
import CommonFooter from "../../components/CommonFooter"
import { useIsMobile } from "@/hooks/useIsMobile"
import useExportMenuItems from "./useExportMenuItems"
import type { BeforeAction } from "../../utils/actionGuard"
import { runGuardedAction } from "../../utils/actionGuard"
import Deleted from "../../components/Deleted"
import useSaveHandlerRegistration from "../../hooks/useSaveHandlerRegistration"
import { useCurrentHtmlFileInfo } from "./hooks/useCurrentHtmlFileInfo"
import useShareButtonVisibility from "../../hooks/useShareButtonVisibility"
import type { HeaderActionConfig } from "../../components/CommonHeaderV2/types"
import useServerUpdate from "../../hooks/useServerUpdate"
import CodeVersionCompareDialog from "../../components/versioning/CodeVersionCompareDialog"
import VersionCompareDialog from "../../components/versioning/VersionCompareDialog"
import HistoryVersionCompareDialog from "../../components/PPTRender/components/HistoryVersionCompareDialog"
import { getFileContentById, downloadFileContent } from "@/pages/superMagic/utils/api"
import { useTranslation } from "react-i18next"
import { AlertTriangle, Crosshair, ShieldCheck, Terminal } from "lucide-react"
import { Button } from "@/components/shadcn-ui/button"
import { env } from "@/utils/env"
import { logger as Logger } from "@/infrastructure/logger"
import magicToast from "@/components/base/MagicToaster/utils"
import { type ImageExportFormat } from "@magic-web/html2image"
import { resolvePptScaleContentDimensions } from "./utils/slide-dimensions"
import { HTML_PREVIEW_IMAGE_PROCESS } from "./previewImageProcess"
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/shadcn-ui/alert-dialog"
import {
	shouldShowHtmlPermissionManager,
	useHtmlAppPermissions,
} from "./hooks/useHtmlAppPermissions"
import { useHtmlDevConsoleState } from "./hooks/useHtmlDevConsoleState"
import DesignStyleButton from "./design-styles/DesignStyleButton"
import {
	type HtmlPermissionManagerHandle,
	useHtmlPermissionManagerBridge,
} from "./hooks/useHtmlPermissionManagerBridge"
import { collectClientEnvironmentContext } from "./telemetry/clientEnvironmentContext"
import {
	readCachedHtmlEditButton,
	writeCachedHtmlEditButton,
} from "./utils/edit-capability-session"

const htmlRenderLogger = Logger.createLogger("HTMLContent")
import { HTML_PERMISSION_ANCHOR_ATTRIBUTE } from "./components/PermissionManager/CodeChangeConfirmPopover"
const HtmlPermissionManagerDialog = lazy(
	() => import("./components/PermissionManager/HtmlPermissionManagerDialog"),
)

interface HTMLProps {
	data: string | any
	attachments?: any[]
	type?: string
	currentIndex?: number
	onPrevious?: () => void
	onNext?: () => void
	onFullscreen?: () => void
	onDownload?: (fileId?: string, fileVersion?: number) => void
	totalFiles?: number
	userSelectDetail?: any
	hasUserSelectDetail?: boolean
	setUserSelectDetail?: (detail: any) => void
	isFromNode?: boolean
	onClose?: () => void
	isFullscreen?: boolean
	/** Keeps pure share fullscreen HTML in document flow for long screenshots. */
	documentFlowFullscreen?: boolean
	attachmentList?: any[]
	isEditMode?: boolean
	setIsEditMode?: (isEditMode: boolean) => void
	saveEditContent?: (
		data: any,
		fileId?: string,
		enable_shadow?: boolean,
		fetchFileVersions?: (fileId: string) => void,
		isPPTEditMode?: boolean,
		shouldExitEditMode?: boolean,
		options?: { silent?: boolean },
	) => Promise<boolean | void>
	allowEdit?: boolean
	// New props for ActionButtons functionality
	viewMode?: "code" | "desktop" | "phone"
	onViewModeChange?: (mode: "code" | "desktop" | "phone") => void
	onCopy?: (fileVersion?: number, fileId?: string) => void
	fileContent?: string
	currentFile?: {
		id: string
		name: string
		type: string
		url?: string
	}
	className?: string
	updatedAt?: string
	detailMode?: "single" | "files"
	displayConfig?: any
	openFileTab?: (fileItem: any, autoEdit?: boolean) => void
	exportFile?: (fileId: string, fileVersion?: number) => void
	exportPdf?: (fileId: string, previewElement?: HTMLElement) => void
	exportRasterPdf?: (fileId: string, pageMode: "fit" | "paginate") => void
	exportPptx?: (fileId: string) => void
	exportImage?: (fileId: string, format?: ImageExportFormat) => void
	isExporting?: boolean
	selectedProject?: ProjectListItem | null
	showFileHeader?: boolean
	activeFileId?: string | null
	/** Live tab state, excluded from cached renderProps. */
	isTabActive?: boolean
	showFooter?: boolean
	onRefreshFile?: () => void
	onRegisterAIEdit?: (handler: (() => void) | null) => void
	onAIEditActiveChange?: (active: boolean) => void
	onRegisterDevConsoleToggle?: (handler: (() => void) | null) => void
	onDevConsoleActiveChange?: (active: boolean) => void
	/** 向无文件头的外部页面注册当前 HTML 的授权管理入口。 */
	onHtmlPermissionManagerChange?: (manager: HtmlPermissionManagerHandle | null) => void
	isPlaybackMode?: boolean
	onRegisterSaveHandler?: (handler: (() => Promise<void>) | null) => void
	isInPPTMode?: boolean
	// 是否允许下载（用于分享页面权限控制）
	allowDownload?: boolean
	projectId?: string
	/** 发布微应用身份，仅由宿主传入。 */
	microAppId?: string
	microAppName?: string
	/** 跨多个 HTML 文件共享虚拟存储时使用的稳定标记。 */
	virtualStorageMarkerId?: string
	/** 分享预览不拉项目文件版本，走分享下载 */
	isSharePreview?: boolean
	/** Controls whether the HTML header exposes the manual refresh action. */
	showRefresh?: boolean
}

interface HtmlExportActionProps {
	handleExportSource: () => void
	handleExportPDF: () => void
	handleExportPptx: () => void
	handleExportImage?: (format: ImageExportFormat) => void
	handleExportRasterPdf?: (pageMode: "fit" | "paginate") => void
	isExporting?: boolean
	showButtonText: boolean
	showExportPptx?: boolean
	showExportImage?: boolean
	showExportRasterPdf?: boolean
	beforeAction?: BeforeAction
}

const HtmlExportAction = memo(function HtmlExportAction({
	handleExportSource,
	handleExportPDF,
	handleExportPptx,
	handleExportImage,
	handleExportRasterPdf,
	isExporting,
	showButtonText,
	showExportPptx,
	showExportImage,
	showExportRasterPdf,
	beforeAction,
}: HtmlExportActionProps) {
	const { ExportDropdownButton } = useExportMenuItems({
		handleExportSource,
		handleExportPDF,
		handleExportPptx,
		handleExportImage,
		handleExportRasterPdf,
		isExporting,
		showButtonText,
		showExportPptx,
		showExportImage,
		showExportRasterPdf,
		beforeAction,
	})

	return ExportDropdownButton
})

export default memo(function HTML(props: HTMLProps) {
	const fileAccess = useFileAccess()
	const fileApi = useFileApi()
	// Token refresh must not reprocess HTML / remount the iframe.
	const fileAccessContentKey = getFileAccessContentKey(fileAccess)
	const {
		data: displayData,
		attachments,
		type,
		onFullscreen,
		onDownload,
		isFromNode,
		isFullscreen,
		documentFlowFullscreen = false,
		attachmentList,
		isEditMode,
		setIsEditMode,
		saveEditContent: saveEditContentWithToast,
		allowEdit,
		viewMode,
		onViewModeChange,
		onCopy,
		fileContent,
		currentFile,
		className,
		updatedAt,
		detailMode,
		displayConfig: externalDisplayConfig,
		openFileTab,
		exportFile,
		exportPdf,
		exportRasterPdf,
		exportPptx,
		exportImage,
		isExporting,
		selectedProject,
		showFileHeader = true,
		activeFileId,
		isTabActive,
		showFooter,
		onRefreshFile,
		onRegisterAIEdit,
		onAIEditActiveChange,
		onRegisterDevConsoleToggle,
		onDevConsoleActiveChange,
		onHtmlPermissionManagerChange,
		isPlaybackMode = false,
		onRegisterSaveHandler,
		isInPPTMode = false,
		allowDownload,
		projectId,
		microAppId,
		microAppName,
		virtualStorageMarkerId,
		isSharePreview = false,
		showRefresh = true,
	} = props
	// origin：显式传入的项目，缺省时用当前选中项目
	const runtimeProjectId = projectId ?? selectedProject?.id

	const displayConfig = displayData?.display_config || externalDisplayConfig
	const { styles, cx } = useStyles()
	const { t } = useTranslation("super")
	const isMobile = useIsMobile()
	const isImmersiveLayout = !showFileHeader && !showFooter
	// The simulated phone frame has a fixed height and cannot be used for page-level scrolling.
	const shouldUsePhonePreviewFrame = !documentFlowFullscreen && viewMode === "phone"
	const devicePreview = useDevicePreview(
		String(runtimeProjectId || ""),
		String(displayData?.file_id || ""),
	)
	const devicePreviewEnabled =
		shouldUsePhonePreviewFrame && !isMobile && showFileHeader && !isPlaybackMode && !isInPPTMode
	const [deviceContentScaled, setDeviceContentScaled] = useState(false)
	// 通过 previewPolicy 声明能力，详情页消费配置
	const previewPolicy = displayData?.display_config?.previewPolicy
	const isReadonlyPreview = previewPolicy?.readonly === true
	const remoteHtmlFileId =
		previewPolicy?.keepLocalContent === true ? "" : displayData?.file_id || ""

	const [processedContent, setProcessedContent] = useState<string>("")
	const [isProcessedEditVariant, setIsProcessedEditVariant] = useState(false)
	const [filePathMapping, setFilePathMapping] = useState<Map<string, string>>(new Map()) // 记录文件的相对路径和替换后的url映射关系
	// 跨域 shell 渲染下，数据加载完成 ≠ iframe 内容已画出来；
	// 用 iframe 上报的渲染就绪信号来控制预览 loading 收起时机，避免"loading 没了但页面空白"。
	const [isPreviewRenderReady, setIsPreviewRenderReady] = useState(false)
	const previewFreshness = useHtmlPreviewFreshness(displayData?.file_id, (failure) =>
		reportPreviewFailure(failure),
	)
	const {
		begin: beginPreviewUpdate,
		ready: acknowledgePreview,
		isCurrent: isCurrentPreview,
		fail: failPreview,
		rendering: markPreviewRendering,
	} = previewFreshness
	const [previewRenderGeneration, setPreviewRenderGeneration] = useState(0)
	// Generation that produced the document now sent to the iframe. A newer load
	// may start before that document acknowledges, so this is not `isCurrent`.
	const displayedPreviewGenerationRef = useRef(0)
	const forcePreviewRestartRef = useRef(false)
	const readyPreviewContentRef = useRef<string | null>(null)
	useEffect(() => {
		displayedPreviewGenerationRef.current = 0
		readyPreviewContentRef.current = null
		forcePreviewRestartRef.current = false
		setIsPreviewRenderReady(false)
	}, [displayData?.file_id])
	const [documentFlowContentHeight, setDocumentFlowContentHeight] = useState(0)
	const [saveFunction, setSaveFunction] = useState<
		(() => Promise<SaveResult | undefined>) | (() => void) | null
	>(null) // 保存函数
	const [renderKey, setRenderKey] = useState(0)
	const fileIdForEditCache = displayData?.file_id || currentFile?.id
	const cachedEditButtonVisible = useMemo(
		() => readCachedHtmlEditButton(fileIdForEditCache),
		[fileIdForEditCache],
	)
	/** 当前展示的 HTML 文件的数据 */
	const [data, setData] = useState<any>({})
	const [editingCodeContent, setEditingCodeContent] = useState<string>("")
	/** 是否正处于编辑后的状态 */
	const [isEditingAfter, setIsEditingAfter] = useState(false)
	const [serverUpdatedContent, setServerUpdatedContent] = useState<string>()
	const editSessionUpdatedAtRef = useRef<string | undefined>(undefined)
	const serverUpdateRequestIdRef = useRef(0)
	const editSessionBaselineContentRef = useRef<string | null>(null)
	// Tracks the last successful local save so the follow-up refresh is not treated as an external update.
	const lastLocalSavedContentRef = useRef<string | null>(null)
	// Set between adopting the saved content and the parent leaving edit mode, so
	// the still-open editor iframe is not reloaded with content it already shows.
	const isExitingAfterSaveRef = useRef(false)
	const pendingSaveIntentRef = useRef<"save" | "save-and-exit" | null>(null)
	const scaleContentDimensions = useMemo(
		() =>
			isInPPTMode ? resolvePptScaleContentDimensions(processedContent, data?.content) : null,
		[isInPPTMode, processedContent, data?.content],
	)

	const {
		fileData: htmlFileData,
		refreshFile,
		loadStatus,
		loadProgress,
		loadRevision,
		loadError,
		fileVersion: htmlFileVersion,
		changeFileVersion: changeHtmlFileVersion,
		loading,
		fetchFileVersions: fetchHtmlFileVersions,
		fileVersionsList: htmlFileVersionsList,
		handleVersionRollback: handleHtmlVersionRollback,
		isNewestVersion: htmlIsNewestVersion,
		isDeleted: htmlIsDeleted,
	} = useFileData({
		file_id: remoteHtmlFileId,
		isEditing: isEditMode,
		updatedAt,
		activeFileId,
		isFromNode,
		content: displayData?.content || "",
		disabledUrlCache: isPlaybackMode,
		isSharePreview,
	})

	const {
		allAttachmentItems,
		flattenedAttachmentList,
		isDataAnalysis,
		dashboardDataJsFile,
		dashboardDataJsContent,
		activeHistory,
		resourceFileVersions,
		fetchDashboardDataJsFileVersions,
	} = useDashboardVersioning({
		attachmentList,
		displayData,
		displayConfig,
		isFromNode,
		isPlaybackMode,
		isSharePreview,
		htmlVersioning: {
			fileVersion: htmlFileVersion,
			changeFileVersion: changeHtmlFileVersion,
			fileVersionsList: htmlFileVersionsList,
			handleVersionRollback: handleHtmlVersionRollback,
			isNewestVersion: htmlIsNewestVersion,
			loading,
		},
	})

	/** 头部刷新：拉取 HTML / data.js 版本列表；若最新版本号变新则切到最新并加载 */
	const handleDetailHeaderRefresh = useMemoizedFn(async () => {
		if (!displayData?.file_id) return

		// Use live tab state because cached activeFileId may be stale.
		const isCurrentTabActive =
			isTabActive === undefined ? activeFileId === displayData.file_id : isTabActive
		if (!isCurrentTabActive) return

		// Refreshing must never replace an editing draft. The existing compare flow
		// remains the only path for accepting remote content while editing.
		if (isEditMode) return
		if (!isDataAnalysis) {
			await refreshHtmlPreview()
			return
		}

		const htmlFileId = displayData.file_id
		const prevHtmlNewest = htmlFileVersionsList[0]?.version
		const newHtmlVersions = await fetchHtmlFileVersions(htmlFileId, false)
		const nextHtmlNewest = newHtmlVersions[0]?.version
		if (
			typeof prevHtmlNewest === "number" &&
			typeof nextHtmlNewest === "number" &&
			nextHtmlNewest > prevHtmlNewest
		) {
			changeHtmlFileVersion(undefined, newHtmlVersions)
		}

		if (!isDataAnalysis || !dashboardDataJsFile?.file_id) return

		const dataJsId = dashboardDataJsFile.file_id
		const prevDataNewest = activeHistory.fileVersionsList[0]?.version
		const newDataVersions = await fetchDashboardDataJsFileVersions(dataJsId, false)
		const nextDataNewest = newDataVersions[0]?.version
		if (
			typeof prevDataNewest === "number" &&
			typeof nextDataNewest === "number" &&
			nextDataNewest > prevDataNewest
		) {
			activeHistory.changeFileVersion(undefined)
		}
	})

	useEffect(() => {
		pubsub.subscribe(PubSubEvents.Super_Magic_Detail_Refresh, handleDetailHeaderRefresh)
		return () => {
			pubsub.unsubscribe(PubSubEvents.Super_Magic_Detail_Refresh, handleDetailHeaderRefresh)
		}
	}, [handleDetailHeaderRefresh])

	const currentHtmlFileInfo = useCurrentHtmlFileInfo({
		attachmentList: allAttachmentItems,
		fileId: displayData?.file_id,
		fallbackFileName: data?.file_name || displayData?.file_name,
	})
	const sharedHtmlPermissionController = useSharedHtmlAppPermissions()
	const localHtmlPermissionController = useHtmlAppPermissions({
		content: processedContent,
		rawSourceCode: data?.content,
		relativeFilePath: currentHtmlFileInfo.relativeFilePath,
		projectId: runtimeProjectId,
		fileList: flattenedAttachmentList,
		enabled: !sharedHtmlPermissionController && !isDataAnalysis && !htmlIsDeleted,
	})
	const htmlPermissionController = sharedHtmlPermissionController ?? localHtmlPermissionController
	const {
		hasHtmlPermissionDeclarations,
		activeHtmlPermissionGrantCount,
		getPermissionSnapshot,
		preauthorizeHtmlPermission,
		revokeHtmlPermission,
		updateHtmlPermissionTtl,
		revokeAllHtmlPermissions,
		acknowledgeHtmlPermissionCodeChanges,
		htmlPermissionCodeChanged,
		permissionRevision,
	} = htmlPermissionController
	const canManageHtmlPermissions = Boolean(
		!isDataAnalysis &&
		!htmlIsDeleted &&
		shouldShowHtmlPermissionManager(
			hasHtmlPermissionDeclarations,
			activeHtmlPermissionGrantCount,
		),
	)
	const {
		open: permissionManagerOpen,
		setOpen: setPermissionManagerOpen,
		openManager: handleOpenHtmlPermissionManager,
	} = useHtmlPermissionManagerBridge({
		available: canManageHtmlPermissions,
		onManagerChange: onHtmlPermissionManagerChange,
	})

	/**
	 * 仅可视化预览：dashboard / audio / video 入口 HTML 走构建内 templates；dashboard 另换壳 CSS/JS。
	 * 代码模式、编辑、回放、PPT 仍用用户仓库 HTML + OSS。
	 */
	const htmlPreviewBundledTemplate = useMemo((): HtmlPreviewBundledTemplateKind | undefined => {
		if (viewMode === "code" || isPlaybackMode || isInPPTMode) return undefined
		if (isEditMode && !isDataAnalysis) return undefined
		return resolveHtmlPreviewBundledTemplate({
			fileName: currentHtmlFileInfo.fileName || data?.file_name,
			relativeFilePath: currentHtmlFileInfo.relativeFilePath,
			displayConfigType: displayConfig?.type,
		})
	}, [
		currentHtmlFileInfo,
		data?.file_name,
		displayConfig?.type,
		isDataAnalysis,
		isEditMode,
		viewMode,
		isPlaybackMode,
		isInPPTMode,
	])

	/** 更新HTML文件的数据内容 */
	const updateDataContent = useMemoizedFn((fileData: any) => {
		// Remote props must not replace the current editing baseline or draft.
		if (isEditMode && data.content !== undefined) return
		const newData = {
			...displayData,
			content: fileData ?? displayData?.content,
		}
		const contentChanged = data.content !== newData.content
		const navigationChanged =
			getHtmlNavigationKey(data?.htmlNavigation) !==
			getHtmlNavigationKey(newData?.htmlNavigation)

		if (contentChanged || navigationChanged || data?.file_id !== newData?.file_id) {
			setData(newData)
		}
	})

	useDeepCompareEffect(() => {
		// 如果正处于编辑后的状态，则不进行content更新，避免页面内容发生闪动
		if (isEditingAfter) {
			setIsEditingAfter(false)
			return
		}
		updateDataContent(htmlFileData)
	}, [displayData, htmlFileData])

	/** 处理代码预览模式 */
	useUpdateEffect(() => {
		if (viewMode === "code") {
			const newData = {
				...displayData,
				content: htmlFileData ?? displayData?.content,
			}
			setData(newData)
		} else {
			updateDataContent(htmlFileData)
		}
	}, [viewMode])

	// IsolatedHTMLRenderer 的 ref，用于获取拦截回调函数
	const htmlRendererRef = useRef<IsolatedHTMLRendererRef>(null)
	const fileId = displayData?.file_id as string | undefined
	const htmlTestIdsEnabled = isTabActive ?? (!activeFileId || activeFileId === fileId)
	const [isAppendPicking, setIsAppendPicking] = useState(false)
	const [isQuickSelecting, setIsQuickSelecting] = useState(false)
	// 菜单退出确认可能改变状态；保留点击时的开关意图，避免确认退出后又重新开启。
	const handleAIEdit = useCallback(() => {
		if (isAppendPicking) {
			htmlRendererRef.current?.stopInspector()
		} else {
			htmlRendererRef.current?.startInspectorAppend()
		}
	}, [isAppendPicking])
	const handleQuickSelection = useMemoizedFn(async () => {
		if (isQuickSelecting) {
			await htmlRendererRef.current?.requestInspectorExit?.()
			return
		}
		if (isAppendPicking) {
			const canStart = (await htmlRendererRef.current?.requestInspectorExit?.()) ?? true
			if (!canStart) return
		}
		htmlRendererRef.current?.startInspectorQuickSelect()
	})

	useEffect(() => {
		onRegisterAIEdit?.(handleAIEdit)
		return () => onRegisterAIEdit?.(null)
	}, [handleAIEdit, onRegisterAIEdit])

	useEffect(() => {
		onAIEditActiveChange?.(isAppendPicking)
	}, [isAppendPicking, onAIEditActiveChange])
	const {
		enabled: devConsoleEnabled,
		setEnabled: updateDevConsoleEnabled,
		toggle: handleDevConsoleToggle,
	} = useHtmlDevConsoleState({
		fileId,
		onRegisterToggle: onRegisterDevConsoleToggle,
		onEnabledChange: onDevConsoleActiveChange,
	})

	const getCurrentEditingContent = useMemoizedFn(async () => {
		if (viewMode === "code") return editingCodeContent || data?.content || ""
		return (await htmlRendererRef.current?.getContent()) || data?.content || ""
	})

	const applyEditingContent = useMemoizedFn((nextContent: string) => {
		if (viewMode !== "code") return

		setEditingCodeContent(nextContent)
		setData((prev: any) => ({
			...prev,
			content: nextContent,
		}))
	})

	const getEditSessionBaselineContent = useMemoizedFn(() => {
		return data?.content || htmlFileData || displayData?.content || ""
	})

	const {
		hasServerUpdate,
		actualServerContent,
		showVersionCompareDialog,
		showSaveWithUpdateConfirmDialog,
		currentEditingContent,
		handleViewServerUpdate,
		handleUseMyVersion,
		handleUseServerVersion,
		clearServerUpdate,
		checkServerUpdateBeforeSave,
		setShowVersionCompareDialog,
		setShowSaveWithUpdateConfirmDialog,
		applyServerUpdate,
	} = useServerUpdate({
		externalServerUpdatedContent: serverUpdatedContent,
		onClearServerUpdate: () => {
			setServerUpdatedContent(undefined)
		},
		isEditMode: Boolean(isEditMode),
		rendererRef: htmlRendererRef,
		content: data?.content || displayData?.content || "",
		getCurrentEditingContent,
		applyContent: applyEditingContent,
	})

	// ==================== 历史版本对比 ====================
	const [showHistoryCompareDialog, setShowHistoryCompareDialog] = useState(false)
	const [compareHistoryVersion, setCompareHistoryVersion] = useState<number | undefined>(
		undefined,
	)
	const [compareHistoryContent, setCompareHistoryContent] = useState<string>("")
	/** Ignore stale history version fetch responses when user switches versions quickly */
	const compareHistorySwitchSeqRef = useRef(0)

	/** 获取指定版本内容用于对比（不改变当前显示版本） */
	const getVersionContentForCompare = useMemoizedFn(
		async (targetVersion: number): Promise<string | null> => {
			if (!fileId) return null
			try {
				const urlRes = await fileApi.getTemporaryDownloadUrl({
					file_ids: [fileId],
					file_versions: { [fileId]: targetVersion },
				})
				if (!urlRes[0]?.url) {
					magicToast.error(t("common.fileUrlFetchFailed"))
					return null
				}
				const content = await downloadFileContent(urlRes[0].url, { responseType: "text" })
				return content as string
			} catch (error) {
				console.error("Failed to download version content for compare:", error)
				magicToast.error(t("common.fileDownloadFailed"))
				return null
			}
		},
	)

	/** 处理历史版本内容（路径替换） */
	const processHistoricalContent = useMemoizedFn(async (rawHtml: string): Promise<string> => {
		try {
			const result = await processHtmlContent({
				content: rawHtml,
				attachments,
				fileId,
				fileName: data?.file_name,
				attachmentList,
				displayConfig,
				xMagicImageProcess: HTML_PREVIEW_IMAGE_PROCESS,
				access: fileAccess,
				fileApi,
			})
			return result.processedContent
		} catch {
			return rawHtml
		}
	})

	/** 点击历史版本 → 打开对比弹窗 */
	const handleCompareVersion = useMemoizedFn(async (version: number) => {
		try {
			const raw = await getVersionContentForCompare(version)
			if (raw) {
				const processed = await processHistoricalContent(raw)
				// 将三个状态更新批量提交，确保 HistoryVersionCompareDialog 首次挂载时
				// historyContent 已就绪，避免组件以空内容初始化后无法正确渲染
				setCompareHistoryVersion(version)
				setCompareHistoryContent(processed)
				setShowHistoryCompareDialog(true)
			}
		} catch (error) {
			console.error("Failed to load version for comparison:", error)
		}
	})

	/** 在对比弹窗中切换历史版本 */
	const handleSwitchHistoryVersion = useMemoizedFn(async (version: number) => {
		const switchId = ++compareHistorySwitchSeqRef.current
		try {
			const raw = await getVersionContentForCompare(version)
			if (switchId !== compareHistorySwitchSeqRef.current) return
			if (!raw) {
				throw new Error(`Failed to load history version ${version}`)
			}
			const processed = await processHistoricalContent(raw)
			if (switchId !== compareHistorySwitchSeqRef.current) return
			// Update content and version together so dialog does not render mismatched state
			setCompareHistoryContent(processed)
			setCompareHistoryVersion(version)
		} catch (error) {
			console.error("Failed to switch history version:", error)
			throw error
		}
	})

	/** 使用历史版本 → 执行回滚并刷新 */
	const handleUseHistoryVersionFromCompare = useMemoizedFn(async (version: number) => {
		try {
			setShowHistoryCompareDialog(false)
			await activeHistory.handleVersionRollback(version)
			onRefreshFile?.()
			if (fileId) {
				await fetchHtmlFileVersions(fileId, true)
			}
		} catch (error) {
			console.error("Failed to rollback to history version:", error)
		}
	})

	/** 保留最新版本 → 关闭对比弹窗 */
	const handleUseLatestVersionFromCompare = useMemoizedFn(() => {
		setShowHistoryCompareDialog(false)
	})
	// ======================================================

	useEffect(() => {
		setServerUpdatedContent(undefined)
		editSessionUpdatedAtRef.current = updatedAt
		editSessionBaselineContentRef.current = null
		// Reset local-save memory when the user switches to another file.
		lastLocalSavedContentRef.current = null
		// Do not depend on updatedAt here, otherwise external updates will be
		// consumed before the edit-session detection effect can compare them.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [displayData?.file_id])

	useEffect(() => {
		if (isEditMode) {
			if (editSessionUpdatedAtRef.current === undefined) {
				editSessionUpdatedAtRef.current = updatedAt
			}
			if (editSessionBaselineContentRef.current === null) {
				editSessionBaselineContentRef.current = getEditSessionBaselineContent()
			}
			return
		}

		setServerUpdatedContent(undefined)
		editSessionUpdatedAtRef.current = updatedAt
		editSessionBaselineContentRef.current = null
		// Leaving edit mode ends the current conflict-detection session.
		lastLocalSavedContentRef.current = null
	}, [getEditSessionBaselineContent, isEditMode, updatedAt])

	useEffect(() => {
		if (!isEditMode || !displayData?.file_id || !updatedAt) return
		if (editSessionUpdatedAtRef.current === undefined) {
			editSessionUpdatedAtRef.current = updatedAt
			return
		}
		if (editSessionUpdatedAtRef.current === updatedAt) return

		editSessionUpdatedAtRef.current = updatedAt
		const currentRequestId = serverUpdateRequestIdRef.current + 1
		serverUpdateRequestIdRef.current = currentRequestId

		getFileContentById(displayData.file_id, {
			responseType: "text",
		})
			.then(async (latestContent) => {
				if (serverUpdateRequestIdRef.current !== currentRequestId) return
				if (typeof latestContent !== "string") return

				const { shouldPrompt, nextLastLocalSavedContent } = resolveServerUpdateState({
					latestContent,
					sessionBaselineContent: editSessionBaselineContentRef.current,
					lastLocalSavedContent: lastLocalSavedContentRef.current,
				})

				lastLocalSavedContentRef.current = nextLastLocalSavedContent

				if (!shouldPrompt) {
					setServerUpdatedContent(undefined)
					return
				}

				setServerUpdatedContent(latestContent)
			})
			.catch((error) => {
				console.error("[HTML] 获取服务端最新内容失败", error)
			})
	}, [displayData?.file_id, getCurrentEditingContent, isEditMode, updatedAt])

	const refreshServerUpdateState = useMemoizedFn(async () => {
		if (!displayData?.file_id) return false

		const latestContent = await getFileContentById(displayData.file_id, {
			responseType: "text",
		})
		if (typeof latestContent !== "string") return false

		const { shouldPrompt, nextLastLocalSavedContent } = resolveServerUpdateState({
			latestContent,
			sessionBaselineContent: editSessionBaselineContentRef.current,
			lastLocalSavedContent: lastLocalSavedContentRef.current,
		})

		lastLocalSavedContentRef.current = nextLastLocalSavedContent

		if (!shouldPrompt) {
			setServerUpdatedContent(undefined)
			return false
		}

		setServerUpdatedContent(latestContent)
		return true
	})

	const postMessageTargetStrategy = useMemo(
		() =>
			env("MAGIC_HTML_SANDBOX_URL")
				? POST_MESSAGE_TARGET_STRATEGIES.CROSS_ORIGIN_PARENT
				: POST_MESSAGE_TARGET_STRATEGIES.SAME_ORIGIN_ANCESTOR,
		[],
	)

	// 创建消息处理器并注册/移除监听器（即使没有 attachments 也要注册）
	useEffect(() => {
		// 获取当前HTML文件的相对文件夹路径
		let htmlRelativeFolderPath = "/"
		const currentFileId = displayData?.file_id
		if (currentFileId && flattenedAttachmentList.length > 0) {
			const currentFile = flattenedAttachmentList.find(
				(item) => item.file_id === currentFileId,
			)
			if (currentFile && currentFile.relative_file_path && currentFile.file_name) {
				// 从relative_file_path中去掉file_name，得到文件夹路径
				htmlRelativeFolderPath = currentFile.relative_file_path.replace(
					currentFile.file_name,
					"",
				)
			}
		}
		// 即使没有 attachments 也创建空数组，确保拦截器能正常工作
		const allFiles = flattenedAttachmentList as FileItem[]

		// 获取拦截回调函数
		const onFetchIntercepted = htmlRendererRef.current?.getFetchInterceptedCallback()

		// 创建新的消息处理器，传入 fileId 和回调函数
		const messageHandler = createParentMessageHandler(
			allFiles,
			htmlRelativeFolderPath,
			currentFileId || "",
			onFetchIntercepted,
			fileAccess,
			fileApi,
		)

		// 处理嵌套 HTML iframe 内容请求
		const nestedIframeHandler = createNestedIframeContentHandler(
			allFiles,
			htmlRelativeFolderPath,
			currentFileId || "",
			attachmentList || [],
			{
				postMessageTargetStrategy,
				projectId: runtimeProjectId,
				access: fileAccess,
				fileApi,
				parentTargetOrigin: window.location.origin,
				onTelemetry: (data) => {
					htmlRenderLogger.report(HTML_IFRAME_RENDER_LIFECYCLE_EVENT, {
						renderMode: env("MAGIC_HTML_SANDBOX_URL") ? "cross-origin" : "same-origin",
						shellUrl: env("MAGIC_HTML_SANDBOX_URL") || "/husky.html",
						fileId: currentFileId || "",
						relativeFilePath: htmlRelativeFolderPath,
						...data,
					})
				},
			},
		)

		// 处理来自 iframe 的键盘快捷键消息
		const keyboardMessageHandler = createKeyboardMessageHandler({
			onSave: handleSave,
			onSaveAndExit: handleSaveAndExit,
			onCancel: handleCancel,
			onEscape: () =>
				htmlRendererRef.current?.consumeInspectorEscape?.() ||
				htmlRendererRef.current?.closeElementContextPanel?.() ||
				false,
		})
		const virtualStorageMessageHandler = createVirtualStorageMessageHandler()

		window.addEventListener("message", messageHandler)
		window.addEventListener("message", nestedIframeHandler)
		window.addEventListener("message", keyboardMessageHandler)
		window.addEventListener("message", virtualStorageMessageHandler)

		return () => {
			window.removeEventListener("message", messageHandler)
			window.removeEventListener("message", nestedIframeHandler)
			window.removeEventListener("message", keyboardMessageHandler)
			window.removeEventListener("message", virtualStorageMessageHandler)
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [attachmentList, displayData?.file_id, runtimeProjectId, fileApi, fileAccess])

	// The failed notice is generic and these paths only wrote console.error, so a blank
	// preview in production could not be traced. Report the failing stage and file context.
	const reportPreviewFailure = useMemoizedFn((failure: HtmlPreviewFailure) => {
		const { reason, elapsedMs, hasRendered, error } = failure
		const httpStatus =
			(error as { status?: number; response?: { status?: number } } | undefined)?.status ??
			(error as { response?: { status?: number } } | undefined)?.response?.status
		htmlRenderLogger.error({
			eventKey: "html_preview_failed",
			errorKind: "render",
			error,
			// Reason is in the message because logger de-duplication keys on error identity, not context.
			message: `HTML 预览更新失败: ${reason}`,
			context: {
				reason,
				elapsedMs,
				// false = the user was left with a blank area rather than a stale preview.
				hasRendered,
				fileId: displayData?.file_id || "",
				loadStatus,
				httpStatus,
				// Sizes separate "huge file" from "empty/never downloaded" without logging content.
				downloadedLength: htmlFileData?.length ?? 0,
				contentLength: data?.content?.length ?? 0,
				attachmentCount: attachmentList?.length ?? 0,
				isSharePreview: Boolean(isSharePreview),
				renderMode: env("MAGIC_HTML_SANDBOX_URL") ? "cross-origin" : "same-origin",
				// Download progress at the moment of failure: 0 bytes = never started, partial = slow link.
				receivedBytes: loadProgress?.loaded,
				totalBytes: loadProgress?.total,
				...collectClientEnvironmentContext(),
			},
		})
	})

	const processContent = useMemoizedFn(
		async (sourceContent = data?.content, background = false) => {
			// Resource metadata can change before a newer file finishes downloading.
			// Processing the previous bytes must not acknowledge that remote update.
			if (
				!isEditMode &&
				!isDataAnalysis &&
				(loadStatus === "loading" || loadStatus === "error")
			)
				return
			if (isSharePreview && !isShareFileAccess(fileAccess)) return
			if (isDataAnalysis && !activeHistory.isPreviewReady) return
			const request = beginPreviewUpdate(!isDataAnalysis && !background)
			if (sourceContent === "") {
				forcePreviewRestartRef.current = false
				readyPreviewContentRef.current = ""
				setProcessedContent("")
				setFilePathMapping(new Map())
				setIsPreviewRenderReady(true)
				acknowledgePreview(request)
				return
			}

			try {
				const result = await processHtmlContent({
					content: sourceContent,
					attachments,
					fileId: displayData?.file_id,
					fileName: data?.file_name,
					attachmentList,
					displayConfig,
					resourceFileVersions,
					htmlPreviewBundledTemplate,
					xMagicImageProcess: HTML_PREVIEW_IMAGE_PROCESS,
					access: fileAccess,
					fileApi,
				})

				let finalProcessedContent = result.processedContent
				finalProcessedContent = inlineDashboardDataJs({
					html: finalProcessedContent,
					dataJsContent: dashboardDataJsContent,
				})

				// 注入fetch拦截器脚本（默认启用）
				// 注意：media拦截器现在在htmlProcessor中根据display_config.type自动注入
				finalProcessedContent = injectFetchInterceptorScript(finalProcessedContent, {
					fileId: displayData?.file_id || "",
					postMessageTargetStrategy,
				})

				// Edit mode must not change the document: any content change is rewritten into the
				// live iframe (document.open/write in the same Window), which flashes and breaks
				// page scripts with top-level let/const/class. Save/Escape shortcuts are forwarded
				// by the iframe EditorRuntime instead of an injected script.
				const isStaleRequest = !isCurrentPreview(request)
				if (isStaleRequest) return
				const shouldRestart = forcePreviewRestartRef.current
				forcePreviewRestartRef.current = false
				setPreviewRenderGeneration(request)
				displayedPreviewGenerationRef.current = request
				if (
					isDataAnalysis ||
					(finalProcessedContent === readyPreviewContentRef.current && !shouldRestart)
				) {
					acknowledgePreview(request)
				} else {
					if (!isDataAnalysis) markPreviewRendering(request)
					setIsPreviewRenderReady(false)
				}
				if (shouldRestart) {
					readyPreviewContentRef.current = null
					setRenderKey((current) => current + 1)
				}
				setProcessedContent(finalProcessedContent)
				setIsProcessedEditVariant(Boolean(isEditMode && !isDataAnalysis))
				setFilePathMapping(result.filePathMapping)
			} catch (error) {
				console.error("Error processing HTML content:", error)
				// Keep the last working preview when resource processing fails.
				if (!isDataAnalysis) failPreview(request, "process_failed", error)
			}
		},
	)

	const refreshHtmlPreview = useMemoizedFn(async () => {
		if (isEditMode || isDataAnalysis) return
		forcePreviewRestartRef.current = true
		if (remoteHtmlFileId) {
			await refreshFile()
		} else {
			await processContent()
		}
	})

	// The file loader can fail before processing starts, or finish with identical
	// bytes. Observe both outcomes so an unchanged file never becomes falsely stale.
	const handleRemoteLoadStatus = useMemoizedFn(() => {
		if (isEditMode || isDataAnalysis) return
		if (loadStatus === "loading") {
			beginPreviewUpdate()
		} else if (loadStatus === "error") {
			failPreview(beginPreviewUpdate(), "load_failed", loadError)
		} else if (loadStatus === "ready" && htmlFileData === data?.content) {
			void processContent()
		}
	})
	useEffect(handleRemoteLoadStatus, [
		handleRemoteLoadStatus,
		loadStatus,
		loadRevision,
		loadError,
		isEditMode,
		isDataAnalysis,
	])

	const shouldReprocessOnEditMode = !isDataAnalysis && Boolean(isEditMode)

	useDeepCompareEffect(() => {
		if (typeof data?.content !== "string") return
		if (isSharePreview && !isShareFileAccess(fileAccess)) return
		if (isDataAnalysis && !activeHistory.isPreviewReady) return
		if (isEditMode && isExitingAfterSaveRef.current) return
		isExitingAfterSaveRef.current = false
		processContent()
	}, [
		data,
		displayConfig,
		shouldReprocessOnEditMode,
		htmlPreviewBundledTemplate,
		resourceFileVersions,
		dashboardDataJsContent,
		fileAccessContentKey,
		isDataAnalysis,
		isSharePreview,
		activeHistory.isPreviewReady,
	])

	// 编辑态下，附件 updated_at 变化会导致 processedContent 重算并触发 iframe setContent，
	// 进而打断未保存编辑；因此仅在非编辑态响应 attachmentList 变化。
	useDeepCompareEffect(() => {
		if (isEditMode) return
		if (typeof data?.content !== "string") return
		if (isSharePreview && !isShareFileAccess(fileAccess)) return
		if (isDataAnalysis && !activeHistory.isPreviewReady) return
		// Attachment changes often come from runtime data writes. Only show feedback
		// if processing actually produces a different document.
		processContent(undefined, true)
	}, [
		attachmentList,
		htmlPreviewBundledTemplate,
		resourceFileVersions,
		dashboardDataJsContent,
		fileAccessContentKey,
		isDataAnalysis,
		isSharePreview,
		activeHistory.isPreviewReady,
	])

	// AI modification detection is now handled by PPTStore internally
	// This logic has been removed to simplify the component

	const editButtonStateReady = Boolean(
		displayData?.file_id &&
		!loading &&
		!activeHistory.loading &&
		(saveFunction !== null || viewMode === "code"),
	)

	// 按钮处理函数
	const handleEdit = useMemoizedFn(() => {
		// Cached visibility prevents a visual flash, but must not enable editing before live data is ready.
		if (setIsEditMode && editButtonStateReady) {
			editSessionBaselineContentRef.current = getEditSessionBaselineContent()
			setIsEditMode(true)
			// 初始化编辑内容
			setEditingCodeContent(data?.content || "")
		}
	})

	// Save feedback lives in the preview notice, so the generic toast is muted.
	const saveEditContent = useMemoizedFn(
		(
			content: any,
			fileId?: string,
			enableShadow?: boolean,
			fetchFileVersions?: (fileId: string) => void,
			isPPTEditMode?: boolean,
		) =>
			saveEditContentWithToast?.(
				content,
				fileId,
				enableShadow,
				fetchFileVersions,
				isPPTEditMode,
				false,
				{ silent: !isDataAnalysis },
			),
	)
	const hasSaveEditContent = Boolean(saveEditContentWithToast)
	const saveStage = useSaveConfirmation(
		displayData?.file_id,
		isEditMode || previewFreshness.phase === "idle",
	)

	const performSave = useMemoizedFn(async (): Promise<boolean> => {
		setIsEditingAfter(true)
		if (viewMode === "code" && editingCodeContent) {
			// 保存代码编辑内容
			const saveResult = await saveEditContent(
				shadow(editingCodeContent),
				displayData?.file_id,
				true,
				fetchHtmlFileVersions,
			)
			// Older integrations do not return a value; only an explicit false means
			// that the persistence request failed.
			if (saveResult === false) return false
			// Code mode saves exactly the editor text, so we can cache it directly.
			lastLocalSavedContentRef.current = editingCodeContent
			editSessionBaselineContentRef.current = editingCodeContent
			setData((prev: any) => ({
				...prev,
				content: editingCodeContent,
			}))
		} else if (saveFunction) {
			const result = await saveFunction()
			if (result && !result.success) {
				console.error("[HTML Editor] 保存失败", result)
				return false
			}
			if (result?.success) {
				// Visual mode returns the cleaned HTML that will be stored on the server.
				lastLocalSavedContentRef.current = result.cleanContent
				editSessionBaselineContentRef.current = result.cleanContent
			}
		}
		setShowSaveWithUpdateConfirmDialog(false)
		clearServerUpdate()
		// 不再退出编辑模式
		return true
	})

	const exitEditModeAfterSave = useMemoizedFn(() => {
		// Adopt what was just saved instead of refreshing the tab: a refresh
		// remounts the whole preview and repaints it from scratch.
		const savedContent = lastLocalSavedContentRef.current
		if (typeof savedContent === "string") {
			isExitingAfterSaveRef.current = true
			setData((prev: any) => ({ ...prev, content: savedContent }))
		}
		if (setIsEditMode) {
			setIsEditMode(false)
		}
	})

	const runSaveAttempt = useMemoizedFn(async (intent: "save" | "save-and-exit") => {
		pendingSaveIntentRef.current = intent

		const result = await attemptHtmlSaveFlow({
			shouldExitAfterSave: intent === "save-and-exit",
			refreshServerUpdateState,
			showConflictDialog: () => setShowSaveWithUpdateConfirmDialog(true),
			checkServerUpdateBeforeSave,
			performSave,
			exitEditMode: exitEditModeAfterSave,
			onRefreshServerUpdateError: (error: unknown) => {
				console.error("[HTML] 保存前检查服务端冲突失败", error)
			},
		})

		if (!result.isAwaitingConflictConfirmation) {
			pendingSaveIntentRef.current = null
		}

		return result.didSave
	})

	const handleSave = useMemoizedFn(async () => {
		await runSaveAttempt("save")
	})

	// Register save handler when in edit mode
	useSaveHandlerRegistration({
		isEditMode,
		handleSave,
		onRegisterSaveHandler,
	})

	const handleSaveAndExit = useMemoizedFn(async () => {
		await runSaveAttempt("save-and-exit")
	})

	const handleSaveConflictDialogChange = useMemoizedFn((open: boolean) => {
		setShowSaveWithUpdateConfirmDialog(open)
	})

	const handleDismissSaveWithUpdate = useMemoizedFn(() => {
		pendingSaveIntentRef.current = null
	})

	const handleConfirmSaveWithUpdate = useMemoizedFn(async () => {
		const shouldExitAfterSave = pendingSaveIntentRef.current === "save-and-exit"

		await confirmHtmlConflictSave({
			shouldExitAfterSave,
			performSave,
			exitEditMode: exitEditModeAfterSave,
		})

		pendingSaveIntentRef.current = null
	})

	const handleCancel = useMemoizedFn(async () => {
		pendingSaveIntentRef.current = null
		setShowSaveWithUpdateConfirmDialog(false)
		if (setIsEditMode) {
			setIsEditMode(false)
		}
		// 重置编辑内容
		setEditingCodeContent("")
		applyServerUpdate()
		clearServerUpdate()
		setRenderKey((prev) => prev + 1)
		onRefreshFile?.()
	})

	const handleAcceptMyVersion = useMemoizedFn((editedContent?: string) => {
		if (actualServerContent) {
			editSessionBaselineContentRef.current = actualServerContent
		}
		handleUseMyVersion(editedContent)
	})

	const handleAcceptServerVersion = useMemoizedFn((editedContent?: string) => {
		// Visual compare may return normalized HTML that differs from the raw server payload.
		// Keep the conflict baseline anchored to the last accepted server version so the next
		// save is not treated as a brand-new external conflict.
		const nextBaselineContent = actualServerContent || editedContent
		if (nextBaselineContent) {
			editSessionBaselineContentRef.current = nextBaselineContent
		}
		lastLocalSavedContentRef.current = null
		handleUseServerVersion(editedContent)
	})

	const quitEditMode = useMemoizedFn(() => {
		if (setIsEditMode) {
			setIsEditMode(false)
		}
		setEditingCodeContent("")
	})

	// 用于接收保存函数的回调
	const onSaveReady = useCallback(
		(triggerSave: () => Promise<SaveResult | undefined> | (() => void)) => {
			setSaveFunction(() => triggerSave)
		},
		[],
	)

	const handlePreviewRenderReady = useCallback(() => {
		if (displayedPreviewGenerationRef.current !== previewRenderGeneration) return
		readyPreviewContentRef.current = processedContent
		setIsPreviewRenderReady(true)
		// No-op when a newer load superseded this request; that load then
		// matches `readyPreviewContentRef` and acknowledges itself.
		acknowledgePreview(previewRenderGeneration)
	}, [acknowledgePreview, previewRenderGeneration, processedContent])

	// 当 viewMode 变化时，退出编辑模式
	useEffect(() => {
		if (setIsEditMode && isEditMode) {
			setIsEditMode(false)
		}
		// 重置编辑内容
		setEditingCodeContent("")
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [viewMode])

	const openNewTab = (
		fileId: string,
		path: string,
		autoEdit?: boolean,
		intent?: HtmlNavigationIntent,
	) => {
		// 防护检查：fileId 不能为空
		if (!fileId) {
			console.warn("openNewTab: fileId is empty, cannot open new tab")
			return
		}

		const navigationTarget = parseHtmlNavigationRequest(path, window.location.href)
		if (!navigationTarget) return

		const { filePath, anchor } = navigationTarget
		const targetsCurrentContext = ["_self", "_parent", "_top"].includes(
			(intent?.target || "_self").toLowerCase(),
		)

		// Handle pure anchor link (navigation within current document)
		if (!filePath && !navigationTarget.search && anchor && targetsCurrentContext) {
			scrollToAnchor(anchor, 80) // 80px offset for fixed headers
			return
		}

		const fileItem = attachmentList?.find((item: any) => item.file_id === fileId)

		// 防护检查：必须找到对应的文件项
		if (!fileItem || !fileItem.relative_file_path || !fileItem.file_name) {
			console.warn("openNewTab: fileItem not found or missing required fields", {
				fileId,
				fileItem,
			})
			return
		}

		const requestedPath = filePath ? filePath.replace(/\\/g, "/") : ""
		const relativePath = normalizeHtmlPreviewPath(
			fileItem.relative_file_path.replace(fileItem.file_name, ""),
		)
		let newPath = requestedPath
			? requestedPath.startsWith("/")
				? requestedPath.replace(/^\/+/, "")
				: resolveRelativePath(relativePath, requestedPath)
			: fileItem.relative_file_path

		newPath = normalizeHtmlPreviewPath(newPath)

		// Empty or directory paths resolve to the directory's index.html.
		if (!newPath || newPath.endsWith("/")) {
			newPath = `${newPath}index.html`
		}

		let item = attachmentList?.find((attachment: any) => {
			return normalizeHtmlPreviewPath(attachment.relative_file_path) === newPath
		})

		if (!item) {
			item = resolveRootHtmlIndexFallback(newPath, attachmentList)
		}

		if (item) {
			openFileTab?.(
				{
					...item,
					htmlNavigation: {
						...navigationTarget,
						...getHtmlNavigationIntent(intent || {}),
					},
				},
				autoEdit,
			)

			// A new tab owns its anchor; never scroll the preserved opener underneath it.
			if (anchor && targetsCurrentContext && !intent?.background) {
				// Wait for document to render before scrolling
				setTimeout(() => {
					scrollToAnchor(anchor, 80)
				}, 300) // Adjust delay as needed
			}
		}
	}

	const handleExportSource = useMemoizedFn(() => {
		exportFile?.(displayData?.file_id, htmlFileVersion)
	})

	const handleExportPDF = useMemoizedFn(() => {
		exportPdf?.(displayData?.file_id, htmlRendererRef.current?.getIframeElement() ?? undefined)
	})

	const handleExportRasterPdf = useMemoizedFn((pageMode: "fit" | "paginate") => {
		exportRasterPdf?.(displayData?.file_id, pageMode)
	})

	const handleExportPptx = useMemoizedFn(() => {
		exportPptx?.(displayData?.file_id)
	})

	const handleExportImage = useMemoizedFn((format: ImageExportFormat = "png") => {
		exportImage?.(displayData?.file_id, format)
	})

	const handleDownload = useMemoizedFn(() => {
		onDownload?.(displayData?.file_id, htmlFileVersion)
	})

	/** 是否为媒体场景（audio/video） */
	const isMediaScenario = displayConfig?.type === "audio" || displayConfig?.type === "video"
	const isCodeViewMode = viewMode === "code"
	const versionCompareFileName = data?.file_name || data?.title || "file.html"

	/** 是否显示 AI编辑 按钮 */
	const showAIOptimizationButton = useMemo(() => {
		if (isReadonlyPreview) {
			return false
		}
		// 当 display_config.type 为 audio/video 时，隐藏 AI 编辑按钮
		if (isMediaScenario) {
			return false
		}
		return (
			!isMobile &&
			!isCodeViewMode &&
			allowEdit &&
			!isEditMode &&
			activeHistory.isNewestVersion
		)
	}, [
		isReadonlyPreview,
		isMediaScenario,
		isCodeViewMode,
		isMobile,
		allowEdit,
		isEditMode,
		activeHistory.isNewestVersion,
	])

	/** 是否显示编辑按钮 */
	const showFileEditButton = useMemo(() => {
		if (isReadonlyPreview) {
			return false
		}
		// 当 display_config.type 为 audio/video 时，隐藏编辑按钮
		if (isMediaScenario) {
			return false
		}
		return (
			setIsEditMode &&
			allowEdit &&
			!isMobile &&
			(saveFunction !== null || viewMode === "code") &&
			displayData?.file_id &&
			activeHistory.isNewestVersion
		)
	}, [
		isReadonlyPreview,
		isMediaScenario,
		setIsEditMode,
		allowEdit,
		isMobile,
		saveFunction,
		viewMode,
		displayData?.file_id,
		activeHistory.isNewestVersion,
	])
	const canUseCachedEditButton = Boolean(
		fileIdForEditCache && !isReadonlyPreview && !isMediaScenario && !isMobile && allowEdit,
	)
	const effectiveShowFileEditButton = editButtonStateReady
		? showFileEditButton
		: canUseCachedEditButton
			? (cachedEditButtonVisible ?? showFileEditButton)
			: showFileEditButton

	useEffect(() => {
		if (!editButtonStateReady || !fileIdForEditCache) return
		writeCachedHtmlEditButton(fileIdForEditCache, showFileEditButton)
	}, [editButtonStateReady, fileIdForEditCache, showFileEditButton])

	const showDesignStyleButton = useMemo(
		() =>
			Boolean(
				!isReadonlyPreview &&
				!isEditMode &&
				allowEdit &&
				!isDataAnalysis &&
				!isMediaScenario &&
				displayData?.file_id &&
				currentHtmlFileInfo.fileName &&
				(currentHtmlFileInfo.relativeFilePath || currentHtmlFileInfo.fileName),
			),
		[
			allowEdit,
			currentHtmlFileInfo.fileName,
			currentHtmlFileInfo.relativeFilePath,
			displayData?.file_id,
			isDataAnalysis,
			isEditMode,
			isMediaScenario,
			isReadonlyPreview,
		],
	)

	/** 使用分享按钮可见性控制 Hook */
	const { showDownloadButton, showExportButton } = useShareButtonVisibility({
		allowDownload,
		isMediaScenario,
		isMobile,
		allowEdit,
		isEditMode,
	})

	const quickSelectionLabel = isQuickSelecting
		? t("topicFiles.exitSelectElement")
		: t("topicFiles.selectElement")
	const quickSelectionTitle = isQuickSelecting
		? t("topicFiles.exitSelectElementDescription")
		: t("topicFiles.selectElementDescription")

	const aiEditMenuItems = useAIEditMenuItems({
		attachmentList,
		fileId: displayData?.file_id,
		enabled: Boolean(showAIOptimizationButton && htmlTestIdsEnabled),
		maxItems: 3,
		onPrimaryAction: handleAIEdit,
		isPrimaryActive: isAppendPicking,
	})
	const headerActionConfig = useMemo<HeaderActionConfig>(
		() => ({
			overrides: {
				refresh: {
					disabled: Boolean(
						isEditMode ||
						(!isDataAnalysis &&
							(previewFreshness.phase === "updating" ||
								previewFreshness.phase === "rendering")),
					),
					tooltip: t("htmlEditor.previewRefreshTooltip"),
				},
			},
			hideDefaults: isReadonlyPreview
				? ["refresh", "download", "share", "versionMenu", "more"]
				: [],
			customActions: [
				{
					key: "html-server-update",
					zone: "secondary",
					before: "refresh",
					visible: () => Boolean(isEditMode && hasServerUpdate),
					render: (context) => (
						<MagicTooltip title={t("htmlEditor.serverUpdateTooltip")}>
							<Button
								variant="secondary"
								size="sm"
								onClick={() =>
									void runGuardedAction(
										context.beforeAction,
										handleViewServerUpdate,
									)
								}
								className="h-6 gap-1.5 rounded-md px-3 text-xs font-normal shadow-xs"
								data-testid={
									htmlTestIdsEnabled ? "html-server-update-button" : undefined
								}
							>
								<AlertTriangle size={16} className="text-amber-600" />
								<span>{t("ppt.serverUpdateAvailable")}</span>
							</Button>
						</MagicTooltip>
					),
				},
				{
					key: "html-toolbar-actions",
					zone: "secondary",
					before: "refresh",
					visible: () =>
						Boolean(
							showAIOptimizationButton ||
							effectiveShowFileEditButton ||
							showDesignStyleButton,
						),
					render: (context) => (
						<div
							className="flex items-center gap-1"
							data-testid={
								htmlTestIdsEnabled ? "html-editor-toolbar-actions" : undefined
							}
						>
							{showDesignStyleButton && (
								<DesignStyleButton
									fileInfo={{
										fileId: displayData?.file_id ?? "",
										fileName: currentHtmlFileInfo.fileName,
										filePath:
											currentHtmlFileInfo.relativeFilePath ??
											currentHtmlFileInfo.fileName ??
											"",
									}}
									showButtonText={context.showButtonText}
									isMobile={context.isMobile}
									getPopupContainer={context.getPopupContainer}
									testId={
										htmlTestIdsEnabled ? "html-design-style-button" : undefined
									}
								/>
							)}
							{showAIOptimizationButton && !isEditMode && (
								<ConditionalTooltip
									showText={Boolean(context.showButtonText)}
									title={quickSelectionTitle}
									getPopupContainer={context.getPopupContainer}
								>
									<Button
										variant="outline"
										size="sm"
										onClick={() => void handleQuickSelection()}
										aria-pressed={isQuickSelecting}
										aria-label={quickSelectionLabel}
										title={quickSelectionTitle}
										className={cn(
											"h-6 rounded-[8px] py-0 text-xs font-normal text-foreground shadow-xs",
											context.showButtonText ? "gap-1.5 px-3" : "px-1.5",
										)}
										data-testid={
											htmlTestIdsEnabled ? "html-ai-pick-button" : undefined
										}
									>
										<Crosshair
											size={16}
											className={
												isQuickSelecting ? "text-primary" : undefined
											}
										/>
										{context.showButtonText && (
											<span
												className={
													isQuickSelecting ? "text-primary" : undefined
												}
											>
												{quickSelectionLabel}
											</span>
										)}
									</Button>
								</ConditionalTooltip>
							)}
							{effectiveShowFileEditButton && (
								<FileEditButtons
									testIdPrefix={htmlTestIdsEnabled ? "html-editor" : undefined}
									isEditMode={isEditMode}
									isSaving={false}
									showButtonText={context.showButtonText}
									editLabel={t("common.edit")}
									onEdit={handleEdit}
									beforeAction={() =>
										htmlRendererRef.current?.requestInspectorExit?.() ??
										Promise.resolve(true)
									}
									onSave={handleSave}
									onSaveAndExit={handleSaveAndExit}
									onCancel={handleCancel}
									getPopupContainer={context.getPopupContainer}
								/>
							)}
						</div>
					),
				},
				{
					key: "html-permission-manager",
					zone: "secondary",
					before: "refresh",
					visible: () => canManageHtmlPermissions && !sharedHtmlPermissionController,
					render: (context) => (
						<ActionButton
							icon={
								// The anchor lets the code-change reminder point at this button; the dot flags
								// grants whose app code changed after they were confirmed.
								<span
									className="relative inline-flex"
									{...{ [HTML_PERMISSION_ANCHOR_ATTRIBUTE]: "" }}
								>
									<ShieldCheck size={16} />
									{htmlPermissionCodeChanged ? (
										<span
											role="img"
											aria-label={t(
												"htmlEditor.permissionManager.codeChangedDot",
											)}
											className="absolute -right-1 -top-1 size-2 rounded-full bg-amber-500 ring-2 ring-background"
											data-testid="html-permission-code-changed-dot"
										/>
									) : null}
								</span>
							}
							onClick={() =>
								void runGuardedAction(
									context.beforeAction,
									handleOpenHtmlPermissionManager,
								)
							}
							title={t("htmlEditor.permissionManager.open")}
							text={t("htmlEditor.permissionManager.open")}
							showText={context.showButtonText}
							data-testid={
								htmlTestIdsEnabled ? "html-permission-manager-button" : undefined
							}
						/>
					),
				},
				{
					key: "html-export-dropdown",
					zone: "secondary",
					after: "download",
					visible: () => Boolean(!isReadonlyPreview && showExportButton),
					render: (context) => (
						<HtmlExportAction
							handleExportSource={handleExportSource}
							handleExportPDF={handleExportPDF}
							handleExportPptx={handleExportPptx}
							handleExportImage={handleExportImage}
							handleExportRasterPdf={handleExportRasterPdf}
							isExporting={isExporting}
							showButtonText={context.showButtonText}
							showExportPptx={isConvertibleFile(displayData, ["html"])}
							showExportImage={isConvertibleFile(displayData, ["html"])}
							showExportRasterPdf
							beforeAction={context.beforeAction}
						/>
					),
				},
			],
		}),
		[
			attachmentList,
			currentHtmlFileInfo.fileName,
			currentHtmlFileInfo.relativeFilePath,
			displayData,
			handleCancel,
			handleAIEdit,
			handleQuickSelection,
			handleEdit,
			handleExportPDF,
			handleExportPptx,
			handleExportImage,
			handleExportRasterPdf,
			handleExportSource,
			handleSave,
			handleSaveAndExit,
			handleViewServerUpdate,
			hasServerUpdate,
			previewFreshness.phase,
			htmlTestIdsEnabled,
			isExporting,
			isEditMode,
			isInPPTMode,
			isReadonlyPreview,
			showAIOptimizationButton,
			showDesignStyleButton,
			showExportButton,
			effectiveShowFileEditButton,
			isAppendPicking,
			isQuickSelecting,
			quickSelectionLabel,
			quickSelectionTitle,
			canManageHtmlPermissions,
			sharedHtmlPermissionController,
			handleOpenHtmlPermissionManager,
			t,
		],
	)

	const headerContext = {
		testIdsEnabled: htmlTestIdsEnabled,
		type,
		onFullscreen,
		onDownload: handleDownload,
		isFromNode,
		isFullscreen,
		viewMode,
		onViewModeChange,
		onCopy: (targetFileVersion?: number) =>
			onCopy?.(
				targetFileVersion || activeHistory.fileVersionsList[0]?.version,
				displayData?.file_id,
			),
		fileContent: fileContent || processedContent,
		beforeAction: () =>
			htmlRendererRef.current?.requestInspectorExit?.() ?? Promise.resolve(true),
		currentFile,
		detailMode,
		showDownload: showDownloadButton && !showExportButton,
		isEditMode,
		fileVersion: activeHistory.fileVersion,
		isNewestFileVersion: activeHistory.isNewestVersion,
		showRefreshButton: showRefresh,
		changeFileVersion: activeHistory.changeFileVersion,
		fileVersionsList: activeHistory.fileVersionsList,
		handleVersionRollback: activeHistory.handleVersionRollback,
		quitEditMode,
		allowEdit,
		attachments,
		actionConfig: headerActionConfig,
		onCompareVersion: handleCompareVersion,
		extraMoreMenuItems: [
			...(aiEditMenuItems ?? []),
			...(!isDataAnalysis && !isCodeViewMode
				? [
						{
							key: "dev-console-toggle",
							label: (
								<div className="flex items-center gap-1.5 text-sm">
									<Terminal size={16} />
									<span>
										{devConsoleEnabled
											? t("stylePanel.closeDevConsole")
											: t("stylePanel.openDevConsole")}
									</span>
								</div>
							),
							onClick: handleDevConsoleToggle,
						},
					]
				: []),
		],
	}

	const rendererStaticProps = {
		className: isImmersiveLayout ? undefined : "!bg-[#eeeeee] dark:!bg-[#2b2b2b]",
		devicePreview: {
			...devicePreview,
			active: htmlTestIdsEnabled,
			enabled: devicePreviewEnabled,
		},
		rawSourceCode: data?.content,
		sandboxType: "iframe" as const,
		isPptRender: isInPPTMode,
		scaleContentDimensions,
		isFullscreen,
		documentFlowFullscreen,
		documentFlowContentHeight,
		isEditMode,
		saveEditContent: hasSaveEditContent ? saveEditContent : undefined,
		fileId: displayData?.file_id,
		htmlNavigation: data?.htmlNavigation,
		virtualStorageMarkerId,
		filePathMapping,
		openNewTab,
		htmlRelativeFolderPath: currentHtmlFileInfo.htmlRelativeFolderPath,
		projectId: runtimeProjectId,
		microAppId,
		microAppName,
		devConsoleEnabled,
		permissionController: htmlPermissionController,
		attachmentList,
		isPlaybackMode,
		isVisible: htmlTestIdsEnabled,
		isTabActive: htmlTestIdsEnabled,
	}
	const previewFrameSwap = usePreviewFrameSwap({
		token: `${displayData?.file_id}:${renderKey}`,
		content: processedContent,
		isEditing: Boolean(isEditMode),
		contentIsEditVariant: isProcessedEditVariant,
		props: rendererStaticProps,
	})

	return (
		<div
			className={cx(styles.htmlContainer, className, {
				[styles.immersiveHtmlContainer]: isImmersiveLayout,
				[styles.documentFlowHtmlContainer]: documentFlowFullscreen,
			})}
			data-testid={htmlTestIdsEnabled ? "html-preview" : undefined}
			data-edit-mode={isEditMode ? "true" : "false"}
		>
			{showFileHeader && <CommonHeaderV2 {...headerContext} />}
			{devicePreviewEnabled && (
				<DevicePreviewToolbar
					{...devicePreview}
					active={htmlTestIdsEnabled && !activeHistory.loading && !htmlIsDeleted}
					contentScaled={!isDataAnalysis && deviceContentScaled}
				/>
			)}
			{activeHistory.loading ? (
				documentFlowFullscreen ? (
					<div className="min-h-dvh" />
				) : (
					<Flex
						justify="center"
						align="center"
						style={{
							height: "100%",
							width: "100%",
							backgroundColor: "white",
						}}
					>
						<MagicSpin spinning />
					</Flex>
				)
			) : isCodeViewMode ? (
				<div
					className={styles.htmlBody}
					data-testid={htmlTestIdsEnabled ? "html-editor-code-view" : undefined}
				>
					<CodeEditor
						content={data?.content || ""}
						fileName={data?.file_name || data?.title || "file.html"}
						isEditMode={isEditMode}
						onChange={(value) => setEditingCodeContent(value)}
						height="100%"
						showLineNumbers={true}
						theme="light"
					/>
				</div>
			) : (
				<div
					data-testid={htmlTestIdsEnabled ? "html-preview-container" : undefined}
					className={cx(styles.previewContainerBase, {
						[styles.phoneModeContainer]:
							shouldUsePhonePreviewFrame && !devicePreviewEnabled,
						[styles.immersivePreviewContainer]: isImmersiveLayout,
						[styles.documentFlowPreviewContainer]: documentFlowFullscreen,
					})}
				>
					<div
						data-testid={htmlTestIdsEnabled ? "html-preview-content" : undefined}
						className={cx(styles.previewInnerBase, styles.htmlBody, "relative", {
							[styles.phoneModeInner]:
								shouldUsePhonePreviewFrame && !devicePreviewEnabled,
							[styles.immersivePreviewInner]: isImmersiveLayout,
							[styles.documentFlowHtmlBody]: documentFlowFullscreen,
							[styles.documentFlowPreviewInner]: documentFlowFullscreen,
						})}
					>
						{!isDataAnalysis && (
							<HtmlPreviewFreshness
								key={displayData?.file_id}
								phase={previewFreshness.phase}
								saveStage={saveStage}
								previewStatusEnabled={!isEditMode}
								hasRendered={previewFreshness.hasRendered}
								slow={previewFreshness.slow}
								progress={
									previewFreshness.phase === "updating" ? loadProgress : null
								}
								onRetry={() => void refreshHtmlPreview()}
							/>
						)}
						{isDataAnalysis ? (
							<DevicePreviewViewport
								{...devicePreview}
								active={htmlTestIdsEnabled}
								enabled={devicePreviewEnabled}
							>
								<DashboardIsolatedHTMLRenderer
									devicePreviewEnabled={devicePreviewEnabled}
									key={`dashboard-html-${dashboardDataJsFile?.file_id || "none"}-${activeHistory.previewRevision}`}
									content={processedContent}
									className={className}
									isEditMode={isEditMode || false}
									dashboardRenderMode={
										viewMode === "phone"
											? "mobile"
											: viewMode === "desktop"
												? "desktop"
												: "auto"
									}
									onSaveReady={onSaveReady as (triggerSave: () => void) => void}
									attachments={attachments}
									attachmentList={attachmentList}
									currentFileId={displayData?.file_id}
									currentFileName={data?.file_name}
									projectId={runtimeProjectId}
									topicId={selectedProject?.current_topic_id}
								/>
							</DevicePreviewViewport>
						) : htmlIsDeleted ? (
							<Deleted data={displayData} showHeader={false} />
						) : (
							<>
								{previewFrameSwap.frames.map((frame) => (
									<div
										key={`${renderKey}-${frame.id}`}
										className={
											frame.isVisible
												? "contents"
												: "pointer-events-none invisible absolute inset-0"
										}
									>
										{frame.isLive ? (
											<IsolatedHTMLRenderer
												{...rendererStaticProps}
												ref={htmlRendererRef}
												onDeviceContentScaledChange={setDeviceContentScaled}
												content={frame.content}
												onSaveReady={onSaveReady}
												onRenderReady={() => {
													handlePreviewRenderReady()
													previewFrameSwap.markReady(frame.id)
												}}
												onContentMetrics={(
													metrics: IsolatedHTMLRendererContentMetrics,
												) => {
													if (!documentFlowFullscreen) return
													const nextHeight = Math.ceil(
														metrics.contentHeight,
													)
													if (
														!Number.isFinite(nextHeight) ||
														nextHeight <= 0
													)
														return

													setDocumentFlowContentHeight((currentHeight) =>
														currentHeight === nextHeight
															? currentHeight
															: nextHeight,
													)
												}}
												onDevConsoleClose={() =>
													updateDevConsoleEnabled(false)
												}
												onAppendPickingChange={setIsAppendPicking}
												onQuickSelectionChange={setIsQuickSelecting}
											/>
										) : (
											frame.frozenProps && (
												<IsolatedHTMLRenderer
													{...frame.frozenProps}
													content={frame.content}
												/>
											)
										)}
									</div>
								))}
								{/* 跨域 shell 渲染期间用 loading 覆盖层填补"数据已就绪但 iframe 内容未画出"的空窗 */}
								{Boolean(processedContent) &&
									!isPreviewRenderReady &&
									!previewFrameSwap.holdsPreviousFrame &&
									previewFreshness.phase !== "failed" &&
									!documentFlowFullscreen && (
										<Flex
											data-testid={
												htmlTestIdsEnabled
													? "html-preview-loading"
													: undefined
											}
											justify="center"
											align="center"
											className="absolute inset-0 z-10 bg-white dark:bg-[#1c1c1c]"
										>
											<MagicSpin spinning />
										</Flex>
									)}
							</>
						)}
					</div>
				</div>
			)}
			{/* 底部 */}
			{showFooter && !isReadonlyPreview && (
				<CommonFooter
					fileVersion={activeHistory.fileVersion}
					changeFileVersion={activeHistory.changeFileVersion}
					fileVersionsList={activeHistory.fileVersionsList}
					handleVersionRollback={activeHistory.handleVersionRollback}
					quitEditMode={quitEditMode}
					allowEdit={allowEdit}
					isEditMode={isEditMode}
				/>
			)}

			{permissionManagerOpen && canManageHtmlPermissions ? (
				<Suspense fallback={null}>
					<HtmlPermissionManagerDialog
						open={permissionManagerOpen}
						onOpenChange={setPermissionManagerOpen}
						permissionRevision={permissionRevision}
						getPermissionSnapshot={getPermissionSnapshot}
						onAuthorize={preauthorizeHtmlPermission}
						onRevoke={revokeHtmlPermission}
						onUpdateTtl={updateHtmlPermissionTtl}
						onRevokeAll={revokeAllHtmlPermissions}
						onAcknowledgeCodeChanges={acknowledgeHtmlPermissionCodeChanges}
					/>
				</Suspense>
			) : null}
			<AlertDialog
				open={showSaveWithUpdateConfirmDialog}
				onOpenChange={handleSaveConflictDialogChange}
			>
				<AlertDialogContent data-testid="html-save-with-update-dialog">
					<AlertDialogHeader>
						<AlertDialogTitle>{t("ppt.saveWithServerUpdateTitle")}</AlertDialogTitle>
						<AlertDialogDescription>
							{t("ppt.saveWithServerUpdate")}
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel
							data-testid="html-save-with-update-cancel-button"
							onClick={handleDismissSaveWithUpdate}
						>
							{t("common.cancel")}
						</AlertDialogCancel>
						<AlertDialogAction
							data-testid="html-save-with-update-confirm-button"
							onClick={handleConfirmSaveWithUpdate}
						>
							{t("common.save")}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
			{isCodeViewMode ? (
				<CodeVersionCompareDialog
					open={showVersionCompareDialog}
					onOpenChange={setShowVersionCompareDialog}
					currentContent={currentEditingContent}
					serverContent={actualServerContent}
					fileName={versionCompareFileName}
					onUseMyVersion={() => handleAcceptMyVersion()}
					onUseServerVersion={() => handleAcceptServerVersion()}
				/>
			) : (
				<VersionCompareDialog
					open={showVersionCompareDialog}
					onOpenChange={setShowVersionCompareDialog}
					currentContent={currentEditingContent}
					serverContent={actualServerContent}
					onUseMyVersion={handleAcceptMyVersion}
					onUseServerVersion={handleAcceptServerVersion}
					filePathMapping={filePathMapping}
					fileId={displayData?.file_id}
					htmlNavigation={data?.htmlNavigation}
					openNewTab={openNewTab}
					selectedProject={selectedProject}
					attachmentList={attachmentList}
				/>
			)}

			{/* 历史版本对比弹窗；isPptRender 与单页预览一致，PPT 项目内启用缩放 */}
			{compareHistoryVersion && (
				<HistoryVersionCompareDialog
					open={showHistoryCompareDialog}
					onOpenChange={setShowHistoryCompareDialog}
					latestContent={processedContent}
					historyContent={compareHistoryContent}
					historyVersion={compareHistoryVersion}
					fileVersionsList={activeHistory.fileVersionsList}
					onUseHistoryVersion={handleUseHistoryVersionFromCompare}
					onUseLatestVersion={handleUseLatestVersionFromCompare}
					onSwitchHistoryVersion={handleSwitchHistoryVersion}
					filePathMapping={filePathMapping}
					fileId={displayData?.file_id}
					openNewTab={openNewTab}
					selectedProject={selectedProject}
					attachmentList={attachmentList}
					isPptRender={isInPPTMode}
				/>
			)}
		</div>
	)
})
