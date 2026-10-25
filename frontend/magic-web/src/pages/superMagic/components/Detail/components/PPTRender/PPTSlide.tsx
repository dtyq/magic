import {
	useState,
	useCallback,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	type CSSProperties,
} from "react"
import { PPT_BUILD_ATTRIBUTE } from "@dtyq/html-sandbox/utils/pptBuild"
import { flushSync } from "react-dom"
import { useTranslation } from "react-i18next"
import { FileX, Loader2 } from "lucide-react"
import IsolatedHTMLRenderer, {
	type IsolatedHTMLRendererRef,
} from "../../contents/HTML/IsolatedHTMLRenderer"
import { HtmlPreviewFreshness } from "../../contents/HTML/components/HtmlPreviewFreshness"
import { useSaveConfirmation } from "../../contents/HTML/hooks/useSaveConfirmation"
import { usePreviewFrameSwap } from "../../contents/HTML/hooks/usePreviewFrameSwap"
import EditToolbar, {
	type EditToolbarProps,
} from "@/pages/superMagic/components/Detail/components/EditToolbar"
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
import { useIsMobile } from "@/hooks/useIsMobile"
import useEditMode from "../../hooks/useEditMode"
import useServerUpdate from "../../hooks/useServerUpdate"
import { observer } from "mobx-react-lite"
import { SaveResult } from "../../contents/HTML/iframe-bridge/types/props"
import type { SlideLoadingState } from "./PPTSidebar/types"
import PPTSlideError from "./PPTSlideError"
import VersionCompareDialog from "../versioning/VersionCompareDialog"
import HistoryVersionCompareDialog from "./components/HistoryVersionCompareDialog"
import { CodeEditor } from "@/components/base"
import { shadow } from "@/utils/shadow"
import { useMemoizedFn } from "ahooks"
import { processHtmlContent, type ProcessHtmlContentInput } from "../../contents/HTML/htmlProcessor"
import { HTML_PREVIEW_IMAGE_PROCESS } from "../../contents/HTML/previewImageProcess"
import { resolvePptScaleContentDimensions } from "../../contents/HTML/utils/slide-dimensions"
import { usePPTVersionManager } from "./hooks/usePPTVersionManager"
import { flushFileSaves } from "../../services/fileSaveQueue"
import { cn } from "@/utils/cn"
import { AttachmentItem } from "../../../TopicFilesButton/hooks"
import MagicSpin from "@/components/base/MagicSpin"
import { stripPPTBuildMetadata } from "./utils/pptBuildSource"
import { stripSlideNotes } from "./utils/slideNotes"
import type { FileApi } from "@/pages/superMagic/fileAccess/fileApi"
import { injectPPTSwipeBridge } from "./utils/pptSwipeBridge"
import { injectPPTAnimationHoldBridge } from "./utils/pptAnimationHold"
import { canReplaySlideInPlace } from "./utils/slideReplayPolicy"
import { usePPTSlideReplay } from "./hooks/usePPTSlideReplay"
import { injectPPTBuildBridge } from "./utils/pptBuildBridge"
import { usePPTBuildPlayback, type PPTBuildController } from "./hooks/usePPTBuildPlayback"
import magicToast from "@/components/base/MagicToaster/utils"
import { usePPTSwipeNavigation, type PPTSwipeDirection } from "./hooks/usePPTSwipeNavigation"

let buildDocumentSequence = 0

export interface PPTSlideToolbarModel {
	token: object
	props: EditToolbarProps
}

interface PPTSlideProps {
	buildPanelOpen?: boolean
	onBuildPanelOpenChange?: (open: boolean) => void
	buildStartAtEnd?: boolean
	onBuildControllerChange?: (controller: PPTBuildController | null) => void
	onBuildAction?: () => void
	allowDownload?: boolean
	showRefresh?: boolean
	index: number
	isActive: boolean
	/** The slide currently painted in the main canvas. May differ from isActive while preparing. */
	isPresented?: boolean
	/** Both real iframe layers are visible during a transition, but neither accepts input. */
	transitionRole?: "incoming" | "outgoing"
	onTransitionLayerChange?: (key: string, element: HTMLDivElement | null) => void
	/** Hide presented-slide chrome when the file tab is cached. */
	isTabActive?: boolean
	content: string
	rawContent: string
	/** Stable content revision used to remount only the iframe whose HTML actually changed. */
	renderRevision?: string
	isFullscreen: boolean
	isPlaybackMode?: boolean
	saveEditContent?: (
		content: any,
		fileId?: string,
		enable_shadow?: boolean,
		fetchFileVersions?: (fileId: string) => void,
		isPPTEditMode?: boolean,
		shouldExitEditMode?: boolean,
		options?: { silent?: boolean },
	) => Promise<boolean | void>
	fileId: string
	projectId?: string
	filePathMapping: Map<string, string>
	openNewTab: (fileId: string, path: string) => void
	htmlRelativeFolderPath?: string
	selectedProject?: any
	attachmentList?: any[]
	/** Deck-level HTML resource processing; keeps every render path consistent. */
	processSource?: (rawContent: string) => Promise<string>
	updateSlideContents: (newContents: Map<number, string>) => void
	loadingState?: SlideLoadingState
	loadingError?: Error
	allowEdit?: boolean
	/** 当幻灯片变为非激活状态时的回调 */
	onDeactivate?: () => void
	/** 编辑状态变化回调 - 通知父组件当前幻灯片的编辑状态 */
	onEditModeChange?: (isEditing: boolean) => void
	/** 注册保存处理器 - 用于导航确认对话框 */
	onRegisterSaveHandler?: (handler: (() => Promise<boolean>) | null) => void
	/** 注册放弃处理器 - 用于导航确认对话框和关闭文件 */
	onRegisterDiscardHandler?: (handler: (() => Promise<boolean>) | null) => void
	/** 注册保存处理器 - 用于关闭文件/标签页 */
	onRegisterCloseSaveHandler?: (handler: (() => Promise<boolean>) | null) => void
	/** Callback when user manually saves - mark as manual save and update thumbnail */
	onManualSave?: (saveResult: SaveResult | undefined, index: number) => Promise<void>
	/** Server updated content (passed from parent) */
	serverUpdatedContent?: string
	/** Callback to clear server update flag */
	onClearServerUpdate?: () => void
	/** Callback to refresh current slide content from server */
	onRefreshSlide?: (index: number) => Promise<void>
	/** 是否显示按钮文字 */
	showButtonText?: boolean
	/** 主 PPT 文件 ID（用于分享整个 PPT） */
	mainFileId?: string
	/** 主 PPT 文件名（用于分享整个 PPT） */
	mainFileName?: string
	/** 附件列表 */
	attachments?: AttachmentItem[]
	/** File client bound to the current host/share access context. */
	fileApi?: FileApi
	manualScale?: number | null
	onManualScaleChange?: (scale: number | null) => void
	onScaleRatioChange?: (scale: number) => void
	/** Reports whether the real iframe/fallback for this slide is ready to be presented. */
	onRenderReadyChange?: (ready: boolean) => void
	/** Scoped live-render key used to associate this slide with the shared toolbar host. */
	toolbarOwnerKey?: string
	/** Registers this slide's toolbar model without mounting another EditToolbar instance. */
	onToolbarModelChange?: (
		ownerKey: string,
		model: PPTSlideToolbarModel | null,
		token: object,
	) => void
	/** Mobile horizontal swipe navigation, kept outside the iframe's link handling. */
	onSwipe?: (direction: PPTSwipeDirection) => void
}

interface PerformSaveOptions {
	shouldExitEditMode?: boolean
	shouldDeactivate?: boolean
}

const PPTSlide = observer(function PPTSlide({
	buildPanelOpen = false,
	onBuildPanelOpenChange,
	index,
	isActive,
	isPresented,
	transitionRole,
	onTransitionLayerChange,
	isTabActive,
	content,
	rawContent,
	renderRevision,
	isFullscreen,
	isPlaybackMode,
	saveEditContent: saveEditContentWithToast,
	fileId,
	projectId,
	filePathMapping,
	openNewTab,
	htmlRelativeFolderPath,
	selectedProject,
	attachmentList,
	processSource,
	updateSlideContents,
	loadingState = "idle",
	loadingError,
	allowEdit = false,
	onDeactivate,
	onEditModeChange,
	onRegisterSaveHandler,
	onRegisterDiscardHandler,
	onRegisterCloseSaveHandler,
	onManualSave,
	serverUpdatedContent: externalServerUpdatedContent,
	onClearServerUpdate,
	onRefreshSlide,
	showButtonText,
	mainFileId,
	mainFileName,
	attachments,
	fileApi,
	allowDownload = true,
	showRefresh = true,
	manualScale,
	onManualScaleChange,
	onScaleRatioChange,
	onRenderReadyChange,
	toolbarOwnerKey,
	onToolbarModelChange,
	onSwipe,
	buildStartAtEnd,
	onBuildControllerChange,
	onBuildAction,
}: PPTSlideProps) {
	const { t } = useTranslation("super")
	const isMobile = useIsMobile()
	const fileTabActive = isTabActive !== false
	const effectiveIsPresented = (isPresented ?? isActive) && fileTabActive
	const isTransitionVisible = Boolean(transitionRole) && fileTabActive
	const isVisible = effectiveIsPresented || isTransitionVisible
	const isInteractive = effectiveIsPresented && isActive && !transitionRole

	// 内部管理编辑模式
	const { isEditMode, setIsEditMode } = useEditMode({ fileId })
	const [showSaveDialog, setShowSaveDialog] = useState(false)
	const [pendingDeactivate, setPendingDeactivate] = useState(false)
	const [isSaving, setIsSaving] = useState(false)
	// Match the HTML preview notice: mute the global toast and show save status here.
	const saveEditContent = useMemoizedFn(
		(
			content: any,
			nextFileId?: string,
			enableShadow?: boolean,
			fetchFileVersions?: (fileId: string) => void,
			isPPTEditMode?: boolean,
		) =>
			saveEditContentWithToast?.(
				content,
				nextFileId,
				enableShadow,
				fetchFileVersions,
				isPPTEditMode,
				false,
				{ silent: true },
			),
	)
	const saveStage = useSaveConfirmation(fileId, !isSaving)
	const [isRefreshing, setIsRefreshing] = useState(false)
	const [isAppendPicking, setIsAppendPicking] = useState(false)
	const [isQuickSelecting, setIsQuickSelecting] = useState(false)
	// 跨域 shell 渲染下，setContent 后到真实绘制完成有异步空窗；
	// 这里用 iframe renderReady 作为 PPT 幻灯片 loading 的收敛信号。
	const [isSlideRenderReady, setIsSlideRenderReady] = useState(false)
	// 保存 IsolatedHTMLRenderer 暴露的保存函数引用
	const [triggerSaveRef, setTriggerSaveRef] = useState<
		(() => Promise<SaveResult | undefined>) | null
	>(null)
	// IsolatedHTMLRenderer 的 ref，用于重置内容
	const rendererRef = useRef<IsolatedHTMLRendererRef>(null)
	const slideWrapperRef = useRef<HTMLDivElement>(null)
	const toolbarRegistrationToken = useRef({}).current
	const pendingSaveIntentRef = useRef<"save" | "save-and-exit" | "save-and-switch" | null>(null)
	const pendingSaveResolveRef = useRef<((didSave: boolean) => void) | null>(null)
	const isConfirmingConflictSaveRef = useRef(false)
	const presentedVisualRef = useRef<{
		revision: string
		content: string
		usesIframe: boolean
	} | null>(null)
	// Renderer key that has already painted once. Later in-place updates stay silent.
	const paintedRendererKeyRef = useRef<string | null>(null)
	const iframeElement = rendererRef.current?.getIframeElement() ?? null
	usePPTSwipeNavigation({
		containerRef: slideWrapperRef,
		iframe: iframeElement,
		enabled: (isMobile || isFullscreen) && isInteractive && !isEditMode && Boolean(onSwipe),
		activationKey: `${renderRevision ?? ""}:${isSlideRenderReady}`,
		onSwipe: onSwipe ?? (() => undefined),
	})

	// Use specialized PPT version manager hook
	const {
		fileVersion,
		changeFileVersion,
		fileVersionsList,
		fetchFileVersions,
		handleVersionRollback,
		isNewestVersion,
		versionContent,
		getVersionContentForCompare,
	} = usePPTVersionManager({
		fileId: fileId || "",
	})
	const notesVersionSourceRef = useRef({ fileId, rawContent })
	useEffect(() => {
		const previous = notesVersionSourceRef.current
		notesVersionSourceRef.current = { fileId, rawContent }
		if (
			previous.fileId !== fileId ||
			previous.rawContent === rawContent ||
			stripSlideNotes(previous.rawContent) !== stripSlideNotes(rawContent)
		)
			return
		// Notes change the local source without refreshing the iframe. Wait for the
		// shared optimistic save queue before asking the server for the new history.
		let cancelled = false
		void flushFileSaves([fileId]).then((saved) => {
			if (saved && !cancelled) void fetchFileVersions(fileId, true)
		})
		return () => {
			cancelled = true
		}
	}, [fileId, rawContent, fetchFileVersions])

	// While the animation panel is open the editor mutates the live preview, so build metadata
	// is ignored when deciding to reload it. Once the panel closes (or the slide is presented)
	// the preview syncs with the saved source, so reopening the panel or playing never sees a
	// stale document.
	const isEditingBuilds = Boolean(
		buildPanelOpen && allowEdit && isActive && !isFullscreen && !isPlaybackMode && !fileVersion,
	)
	const comparableSource = useCallback(
		(html: string) => stripSlideNotes(isEditingBuilds ? stripPPTBuildMetadata(html) : html),
		[isEditingBuilds],
	)
	const [displayContent, setDisplayContent] = useState<{
		content: string
		rawContent: string
		sourceVersion?: number
	}>({
		content: content,
		rawContent: rawContent,
		sourceVersion: undefined,
	})
	// Bind only preview HTML to the frame runtime; saved/raw HTML remains authored content.
	const hasSwipeNavigation = Boolean(onSwipe)
	// Key the runtime by actual preview content, not unrelated metadata/reorder revisions.
	const buildDocumentKey = useMemo(() => {
		const source = `${fileId ?? "slide"}:${displayContent.sourceVersion ?? "latest"}`
		return displayContent.content ? `${source}:${++buildDocumentSequence}` : `${source}:empty`
	}, [displayContent.content, displayContent.sourceVersion, fileId])
	const registerBuild = useMemoizedFn((controller: PPTBuildController | null) =>
		onBuildControllerChange?.(controller),
	)
	const buildPlayback = usePPTBuildPlayback({
		documentKey: buildDocumentKey,
		hasBuilds: displayContent.content.includes(PPT_BUILD_ATTRIBUTE),
		enabled: Boolean(isFullscreen || isPlaybackMode) && !isEditMode,
		active: isActive,
		startAtEnd: buildStartAtEnd,
		getIframe: () => rendererRef.current?.getIframeElement() ?? null,
		onController: registerBuild,
		onAction: onBuildAction,
		onFailure: () => magicToast.info(t("ppt.build.fallback")),
		onIgnored: () => magicToast.info(t("ppt.build.ignored")),
	})
	const previewRuntimeContent = useMemo(() => {
		const origin = window.location.origin
		let content = injectPPTAnimationHoldBridge(displayContent.content, origin)
		content = injectPPTBuildBridge(
			content,
			origin,
			buildDocumentKey,
			Boolean(isFullscreen || isPlaybackMode) && !isEditMode && !buildPlayback.failed,
		)
		return hasSwipeNavigation ? injectPPTSwipeBridge(content, origin) : content
	}, [
		displayContent.content,
		hasSwipeNavigation,
		buildDocumentKey,
		isFullscreen,
		isPlaybackMode,
		isEditMode,
		buildPlayback.failed,
	])

	const isDisplayContentCurrent =
		fileVersion === undefined
			? displayContent.sourceVersion === undefined &&
				comparableSource(displayContent.rawContent) === comparableSource(rawContent)
			: typeof versionContent === "string" &&
				displayContent.sourceVersion === fileVersion &&
				displayContent.rawContent === versionContent
	const [viewMode, setViewMode] = useState<"code" | "desktop" | "phone">("desktop")
	const [editingCodeContent, setEditingCodeContent] = useState<string>(rawContent)
	const scaleContentDimensions = useMemo(
		() => resolvePptScaleContentDimensions(displayContent.content, displayContent.rawContent),
		[displayContent.content, displayContent.rawContent],
	)
	// Latest-version refreshes keep the previous render on screen until the new HTML is
	// processed, like the HTML preview. Version switches still show the blocking spinner.
	const isDisplayContentStale =
		!isDisplayContentCurrent &&
		fileVersion === undefined &&
		displayContent.sourceVersion === undefined &&
		Boolean(displayContent.content.trim())
	const canRenderDisplayContent = isDisplayContentCurrent || isDisplayContentStale
	// Stable across content updates so the iframe is updated in place, not remounted.
	const rendererKey = `${fileId ?? "slide"}:${displayContent.sourceVersion ?? "latest"}`
	// Hold the edit-time preview through save-and-exit until reprocessed HTML
	// arrives in the same render (effects would freeze the swap with no live frame).
	const [editPreviewHoldContent, setEditPreviewHoldContent] = useState<string | null>(null)
	const expectContentSyncAfterExitRef = useRef(false)
	if (isEditMode) {
		if (editPreviewHoldContent !== previewRuntimeContent) {
			setEditPreviewHoldContent(previewRuntimeContent)
		}
	} else if (editPreviewHoldContent !== null) {
		if (previewRuntimeContent !== editPreviewHoldContent) {
			expectContentSyncAfterExitRef.current = false
			setEditPreviewHoldContent(null)
		} else if (!expectContentSyncAfterExitRef.current) {
			// Cancel/exit without a pending content sync: do not freeze forever.
			setEditPreviewHoldContent(null)
		}
	}
	const releaseEditPreviewHold = useCallback(() => {
		expectContentSyncAfterExitRef.current = false
		setEditPreviewHoldContent(null)
	}, [])
	const holdsEditPreview = Boolean(isEditMode || editPreviewHoldContent !== null)
	const isIframeMounted =
		loadingState === "loaded" &&
		Boolean(content?.trim()) &&
		canRenderDisplayContent &&
		viewMode !== "code"

	useEffect(() => {
		if (!isIframeMounted) paintedRendererKeyRef.current = null
	}, [isIframeMounted])

	// 历史版本对比弹窗状态
	const [showHistoryCompareDialog, setShowHistoryCompareDialog] = useState(false)
	const [compareHistoryVersion, setCompareHistoryVersion] = useState<number | undefined>(
		undefined,
	)
	const [compareHistoryContent, setCompareHistoryContent] = useState<string>("")
	/** Ignore stale history version fetch responses when user switches versions quickly */
	const compareHistorySwitchSeqRef = useRef(0)

	// 处理历史版本内容 - 进行路径替换
	const processHistoricalContent = useMemoizedFn(async (rawContent: string) => {
		try {
			if (processSource) return await processSource(rawContent)
			const input: ProcessHtmlContentInput = {
				content: rawContent,
				attachments: attachmentList,
				fileId: fileId,
				fileName: `slide_${index}.html`,
				attachmentList: attachmentList,
				html_relative_path: htmlRelativeFolderPath,
				fileApi,
				xMagicImageProcess: HTML_PREVIEW_IMAGE_PROCESS,
			}

			const result = await processHtmlContent(input)
			return result.processedContent
		} catch (error) {
			console.error("Failed to process historical content:", error)
			// 如果处理失败，返回原始内容
			return rawContent
		}
	})

	// Listen to version content changes (when switching versions)
	useEffect(() => {
		if (fileVersion === undefined || typeof versionContent !== "string") {
			return
		}

		let cancelled = false
		const targetVersion = fileVersion
		void processHistoricalContent(versionContent).then((processedContent) => {
			if (cancelled) return
			setDisplayContent({
				content: processedContent,
				rawContent: versionContent,
				sourceVersion: targetVersion,
			})
		})

		return () => {
			cancelled = true
		}
	}, [fileVersion, processHistoricalContent, versionContent])

	// 当传入的 content 变化且不在查看历史版本时，更新显示内容
	useEffect(() => {
		if (fileVersion !== undefined) return
		if (
			displayContent.sourceVersion === undefined &&
			rawContent === displayContent.rawContent
		) {
			return
		}
		if (
			displayContent.sourceVersion === undefined &&
			comparableSource(rawContent) === comparableSource(displayContent.rawContent)
		) {
			// Only notes can be tracked in place. Build metadata edited through the animation
			// panel keeps the source this preview was rendered from, so closing the panel still
			// sees the difference and syncs the processed content.
			if (stripSlideNotes(rawContent) === stripSlideNotes(displayContent.rawContent))
				setDisplayContent((current) => ({ ...current, rawContent }))
			return
		}

		let cancelled = false
		void processHistoricalContent(rawContent).then((processedContent) => {
			if (cancelled) return
			setDisplayContent({
				content: processedContent,
				rawContent,
				sourceVersion: undefined,
			})
		})

		return () => {
			cancelled = true
		}
	}, [
		displayContent.rawContent,
		displayContent.sourceVersion,
		comparableSource,
		fileVersion,
		processHistoricalContent,
		rawContent,
	])

	// 服务端更新状态管理 - 使用自定义 hook
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
		externalServerUpdatedContent,
		onClearServerUpdate,
		isEditMode,
		rendererRef,
		content: displayContent.rawContent,
	})

	// 通知父组件编辑状态变化
	useEffect(() => {
		if (isActive) {
			onEditModeChange?.(isEditMode)
		}
	}, [isEditMode, isActive, onEditModeChange])

	// 检测是否应该显示编辑工具栏
	const showEditToolbar = useMemo(() => {
		return !isMobile && !isFullscreen && !isPlaybackMode
	}, [isMobile, isFullscreen, isPlaybackMode])

	const presentedReadyRef = useRef<boolean | null>(null)
	const reportSlideRenderReady = useMemoizedFn((ready: boolean) => {
		if (ready) {
			presentedVisualRef.current = {
				revision: renderRevision,
				content: displayContent.content,
				usesIframe: isIframeMounted,
			}
		}
		if (presentedReadyRef.current === ready) return
		presentedReadyRef.current = ready
		setIsSlideRenderReady(ready)
		onRenderReadyChange?.(ready)
	})
	// Inspect only the authored source, once per content change; injected host scripts do not
	// turn a declarative slide into a custom application that needs document reconstruction.
	const canReplayInPlace = useMemo(
		() => canReplaySlideInPlace(displayContent.rawContent || content),
		[displayContent.rawContent, content],
	)
	const {
		isPreparingReplay,
		isReplayPendingRef,
		onRenderReady: onReplayRenderReady,
	} = usePPTSlideReplay({
		content: displayContent.content,
		documentKey: rendererKey,
		canReplayInPlace,
		isActive,
		isPresented: effectiveIsPresented,
		isEditing: Boolean(isEditMode),
		isCodeView: viewMode === "code",
		iframeMounted: isIframeMounted,
		ready: isSlideRenderReady,
		getIframe: () => rendererRef.current?.getIframeElement() ?? null,
		restartDocument: () => rendererRef.current?.restartDocument?.(),
		onReadyChange: reportSlideRenderReady,
	})

	// Paint transition layers and the replay preparation frame without dropping the saved preview.
	const isRendering = isVisible || (isPreparingReplay && fileTabActive)
	const slideWrapperClassNames = "absolute inset-0 flex h-full w-full flex-col"
	// Keep every resident slide at the same dimensions while only the presented one is interactive.
	const slideWrapperStyle: CSSProperties = {
		visibility: isRendering ? "visible" : "hidden",
		pointerEvents: isInteractive ? "auto" : "none",
		// Incoming must cover outgoing independently of their stable DOM/cache order.
		zIndex: transitionRole === "incoming" ? 2 : isVisible ? 1 : 0,
	}

	useLayoutEffect(() => {
		const wrapper = slideWrapperRef.current as (HTMLDivElement & { inert?: boolean }) | null
		if (!wrapper) return

		wrapper.inert = !isInteractive
		if (!isInteractive && wrapper.contains(document.activeElement)) {
			;(document.activeElement as HTMLElement | null)?.blur?.()
		}
	}, [isInteractive])

	// 接收 IsolatedHTMLRenderer 暴露的保存函数
	const handleSaveReady = useCallback((triggerSave: () => Promise<SaveResult | undefined>) => {
		setTriggerSaveRef(() => triggerSave)
	}, [])

	// Step edits persist the whole slide, so they must honor the same "server has a newer
	// version" confirmation as a normal save instead of silently overwriting someone else.
	const saveBuildConfiguration = useMemoizedFn(() => runSaveAttempt("save"))
	const rendererStaticProps = {
		buildPanelOpen: isEditingBuilds,
		onBuildPanelOpenChange,
		onBuildSave: saveBuildConfiguration,
		// Metadata saves must reach the save boundary immediately, even while the
		// processed preview is retained. Historical previews keep their own source.
		rawSourceCode: fileVersion === undefined ? rawContent : displayContent.rawContent,
		sandboxType: "iframe" as const,
		isPptRender: true as const,
		scaleContentDimensions,
		isFullscreen,
		isEditMode,
		isVisible: isRendering,
		isPlaybackPaused: Boolean(transitionRole) || isPreparingReplay,
		isTabActive: isInteractive,
		isSaving,
		saveEditContent,
		fileId,
		filePathMapping,
		openNewTab,
		htmlRelativeFolderPath,
		projectId,
		selectedProject,
		attachmentList,
		setSlideContents: updateSlideContents,
		slideIndex: index,
		isPlaybackMode,
		className: cn(
			"h-full",
			!isFullscreen && !isPlaybackMode && "!bg-[#eeeeee] dark:!bg-[#2b2b2b]",
		),
		autoFitVerticalPadding: isFullscreen ? 0 : 64,
		manualScale,
		onManualScaleChange: isEditMode ? undefined : onManualScaleChange,
		onScaleRatioChange: effectiveIsPresented ? onScaleRatioChange : undefined,
	}
	const previewFrameSwap = usePreviewFrameSwap({
		token: rendererKey,
		content: previewRuntimeContent,
		isEditing: Boolean(isEditMode),
		contentIsEditVariant: holdsEditPreview,
		props: rendererStaticProps,
	})

	const reacknowledgeRenderReady = useMemoizedFn(() => {
		onRenderReadyChange?.(true)
	})

	const handleSlideRenderReady = useMemoizedFn(() => {
		if (loadingState !== "loaded" || !displayContent.content || !isDisplayContentCurrent)
			return false
		const finish = () => {
			paintedRendererKeyRef.current = rendererKey
			onReplayRenderReady()
			return true
		}
		// Static pages retain synchronous readiness. Only configured previews await a frame ack.
		if (displayContent.content.includes(PPT_BUILD_ATTRIBUTE))
			return buildPlayback.initialize(true).then((ready) => ready && finish())
		return finish()
	})

	useEffect(() => {
		const canPresentWithoutIframe =
			loadingState === "error" ||
			(loadingState === "loaded" &&
				isDisplayContentCurrent &&
				(viewMode === "code" || !displayContent.content.trim()))

		if (canPresentWithoutIframe) {
			reportSlideRenderReady(true)
			return
		}

		// Keep iframe ready when the rendered HTML is unchanged, even if the store revision moved.
		// Code view unmounts the iframe, so it is a new present.
		const presentedVisual = presentedVisualRef.current
		const isUnchangedPresentedVisual =
			!isReplayPendingRef.current &&
			Boolean(presentedVisual) &&
			presentedVisual?.content === displayContent.content &&
			presentedVisual?.usesIframe === isIframeMounted &&
			loadingState === "loaded" &&
			isDisplayContentCurrent

		if (isUnchangedPresentedVisual) {
			const wasReported = presentedReadyRef.current === true
			const isRevisionChanged = presentedVisual?.revision !== renderRevision
			reportSlideRenderReady(true)
			// The owner tracks readiness per revision, so a new revision needs a fresh ack.
			if (wasReported && isRevisionChanged) reacknowledgeRenderReady()
			return
		}
		reportSlideRenderReady(false)
		if (loadingState !== "loaded" || !displayContent.content || !isDisplayContentCurrent) return

		// 兜底：极端情况下 iframe 未回传 renderReady，避免 loading 永久卡住。
		// This only releases the local spinner for the initially presented page. It must not tell the
		// double buffer that a hidden target is safe to swap before a real renderComplete signal.
		const fallbackTimer = window.setTimeout(() => {
			paintedRendererKeyRef.current = rendererKey
			setIsSlideRenderReady(true)
		}, 4000)

		return () => {
			window.clearTimeout(fallbackTimer)
		}
	}, [
		content,
		displayContent.content,
		fileVersion,
		isDisplayContentCurrent,
		isIframeMounted,
		isReplayPendingRef,
		loadingState,
		rawContent,
		renderRevision,
		rendererKey,
		reacknowledgeRenderReady,
		reportSlideRenderReady,
		viewMode,
	])

	// 当幻灯片变为非激活状态时，检查是否需要提示保存
	useEffect(() => {
		if (!isActive && isEditMode) {
			// 显示保存提示对话框
			setShowSaveDialog(true)
			setPendingDeactivate(true)
		}
	}, [isActive, isEditMode])

	// 编辑按钮处理
	const handleEdit = useCallback(() => {
		// 如果正在查看历史版本，先回到最新版本
		if (fileVersion) {
			changeFileVersion(undefined)
		}
		setIsEditMode(true)
	}, [setIsEditMode, fileVersion, changeFileVersion])
	const prepareBuildPanel = useMemoizedFn(() => {
		// Animation metadata always belongs to the latest slide, without opening a body draft.
		if (fileVersion !== undefined) changeFileVersion(undefined)
	})
	useEffect(() => {
		if (buildPanelOpen) prepareBuildPanel()
	}, [buildPanelOpen, prepareBuildPanel])

	// 版本切换处理 - 强制退出编辑模式
	const handleVersionChange = useMemoizedFn((version: number | undefined) => {
		onBuildPanelOpenChange?.(false)
		if (isEditMode) {
			setIsEditMode(false)
		}
		if (version === undefined) {
			// 回到最新版本
			changeFileVersion(undefined)
		} else {
			// 切换到指定版本
			changeFileVersion(version)
		}
	})

	// 回到最新版本
	const handleReturnLatest = useMemoizedFn(() => {
		handleVersionChange(undefined)
	})

	// Version rollback
	const handleRollback = useMemoizedFn(async (version?: number) => {
		if (!version) return
		try {
			await handleVersionRollback(version)
			// After rollback, update store with the latest content (which is the rolled back content)
			// The hook automatically switches to latest version after rollback
			if (onManualSave) {
				await onManualSave(
					{
						success: true,
						cleanContent: rawContent,
						rawContent: rawContent,
						fileId,
					},
					index,
				)
			}
		} catch (error) {
			console.error("Version rollback failed:", error)
		}
	})

	// 处理版本对比 - 直接获取版本内容不影响主预览
	const handleCompareVersion = useMemoizedFn(async (version: number) => {
		try {
			setCompareHistoryVersion(version)
			// 直接获取版本内容用于对比，不改变当前显示
			const historyContent = await getVersionContentForCompare(version)
			if (historyContent) {
				// 处理历史版本内容
				const processedContent = await processHistoricalContent(historyContent)
				setCompareHistoryContent(processedContent)
				setShowHistoryCompareDialog(true)
			}
		} catch (error) {
			console.error("Failed to load version for comparison:", error)
		}
	})

	// 使用历史版本 - 执行回滚操作
	const handleUseHistoryVersion = useMemoizedFn(async (version: number) => {
		try {
			setShowHistoryCompareDialog(false)
			// 执行回滚操作，将历史版本恢复为最新版本
			await handleVersionRollback(version)

			// 回滚后刷新当前幻灯片内容
			if (onRefreshSlide) {
				await onRefreshSlide(index)
			}

			// 刷新版本列表
			if (fileId) {
				await fetchFileVersions(fileId, true)
			}
		} catch (error) {
			console.error("Failed to rollback to history version:", error)
		}
	})

	// 使用最新版本 - 只关闭对比弹窗，不做任何操作
	const handleUseLatestVersion = useMemoizedFn(() => {
		setShowHistoryCompareDialog(false)
	})

	// 在对比面板中切换历史版本
	const handleSwitchHistoryVersion = useMemoizedFn(async (version: number) => {
		const switchId = ++compareHistorySwitchSeqRef.current
		try {
			const historyContent = await getVersionContentForCompare(version)
			if (switchId !== compareHistorySwitchSeqRef.current) return
			if (!historyContent) {
				throw new Error(`Failed to load history version ${version}`)
			}
			const processedContent = await processHistoricalContent(historyContent)
			if (switchId !== compareHistorySwitchSeqRef.current) return
			setCompareHistoryContent(processedContent)
			setCompareHistoryVersion(version)
		} catch (error) {
			console.error("Failed to switch history version:", error)
			throw error
		}
	})

	const executeSaveContent = useMemoizedFn(async (): Promise<SaveResult | false> => {
		if (viewMode === "code") {
			const saveResult = await saveEditContent?.(
				shadow(editingCodeContent),
				fileId,
				true,
				fetchFileVersions,
				true,
			)
			// Render returns false when the persistence request fails. Do not mark the
			// slide as saved or leave edit/fullscreen state in that case.
			if (saveResult === false) return false
			return {
				success: true,
				cleanContent: editingCodeContent,
				rawContent: content,
				fileId,
			}
		}

		if (!triggerSaveRef) return false

		const saveResult = await triggerSaveRef()
		if (saveResult?.success === false) return false
		return saveResult ?? false
	})

	const finishSave = useMemoizedFn((options: PerformSaveOptions = {}) => {
		const { shouldExitEditMode = false, shouldDeactivate = false } = options

		if (shouldExitEditMode) {
			setIsEditMode(false)
		}

		setShowSaveDialog(false)
		setPendingDeactivate(false)
		clearServerUpdate()
		setShowSaveWithUpdateConfirmDialog(false)

		if (shouldDeactivate && pendingDeactivate) {
			onDeactivate?.()
		}
	})

	const resolvePendingSave = useMemoizedFn((didSave: boolean) => {
		pendingSaveResolveRef.current?.(didSave)
		pendingSaveResolveRef.current = null
	})

	// 执行实际保存操作
	const performSave = useMemoizedFn(async (options: PerformSaveOptions = {}) => {
		setIsSaving(true)
		try {
			const saveResult = await executeSaveContent()
			if (!saveResult) return false

			// Flush exit before store sync: leaveEdit used to await presence API
			// first, so content remounted while isEditMode was still true and
			// orphaned ENTER_EDIT_MODE requests (selection fails intermittently).
			if (options.shouldExitEditMode) {
				expectContentSyncAfterExitRef.current = true
				flushSync(() => {
					finishSave(options)
				})
			} else {
				finishSave(options)
			}
			const syncing = onManualSave?.(saveResult, index)
			if (options.shouldExitEditMode) {
				// Identical preview HTML never triggers the content-change release.
				void Promise.resolve(syncing).finally(releaseEditPreviewHold)
			}
			return true
		} catch (err) {
			console.error("保存失败", err)
			return false
		} finally {
			setIsSaving(false)
		}
	})

	const runSaveAttempt = useMemoizedFn(
		async (intent: "save" | "save-and-exit" | "save-and-switch") => {
			if (isSaving) return false

			pendingSaveIntentRef.current = intent

			if (!checkServerUpdateBeforeSave()) {
				return await new Promise<boolean>((resolve) => {
					pendingSaveResolveRef.current = resolve
				})
			}

			const didSave = await performSave({
				shouldExitEditMode: intent !== "save",
				shouldDeactivate: intent === "save-and-switch",
			})

			pendingSaveIntentRef.current = null
			resolvePendingSave(didSave)
			return didSave
		},
	)

	// 保存按钮处理
	const handleSave = useMemoizedFn(async () => {
		await runSaveAttempt("save")
	})

	const handleSaveForNavigation = useMemoizedFn(async () => {
		return await runSaveAttempt("save-and-switch")
	})

	const handleSaveForClose = useMemoizedFn(async () => {
		return await runSaveAttempt("save-and-exit")
	})

	const performDiscard = useMemoizedFn(
		async (options?: { shouldDeactivate?: boolean }): Promise<boolean> => {
			const { shouldDeactivate = false } = options || {}

			pendingSaveIntentRef.current = null
			resolvePendingSave(false)
			applyServerUpdate()
			await setIsEditMode(false)
			setShowSaveDialog(false)
			setPendingDeactivate(false)
			clearServerUpdate()
			setShowSaveWithUpdateConfirmDialog(false)

			if (shouldDeactivate && pendingDeactivate) {
				onDeactivate?.()
			}

			return true
		},
	)

	const handleDiscardForExternalAction = useMemoizedFn(async () => {
		return await performDiscard()
	})

	useEffect(() => {
		if (!onRegisterSaveHandler) return

		if (isEditMode) onRegisterSaveHandler(handleSaveForNavigation)
		else onRegisterSaveHandler(null)

		return () => {
			onRegisterSaveHandler(null)
		}
	}, [handleSaveForNavigation, isEditMode, onRegisterSaveHandler])

	useEffect(() => {
		if (!onRegisterDiscardHandler) return

		if (isEditMode) onRegisterDiscardHandler(handleDiscardForExternalAction)
		else onRegisterDiscardHandler(null)

		return () => {
			onRegisterDiscardHandler(null)
		}
	}, [handleDiscardForExternalAction, isEditMode, onRegisterDiscardHandler])

	useEffect(() => {
		if (!onRegisterCloseSaveHandler) return

		if (isEditMode) onRegisterCloseSaveHandler(handleSaveForClose)
		else onRegisterCloseSaveHandler(null)

		return () => {
			onRegisterCloseSaveHandler(null)
		}
	}, [handleSaveForClose, isEditMode, onRegisterCloseSaveHandler])

	// 取消按钮处理
	const handleCancel = useMemoizedFn(() => {
		void performDiscard()
	})

	// 对话框 - 保存并切换
	const handleSaveAndExit = useMemoizedFn(async () => {
		await runSaveAttempt("save-and-exit")
	})

	// 对话框 - 保存并切换
	const handleSaveAndSwitch = useMemoizedFn(async () => {
		await runSaveAttempt("save-and-switch")
	})

	// 对话框 - 不保存，直接切换
	const handleDiscardAndSwitch = useMemoizedFn(async () => {
		await performDiscard({ shouldDeactivate: true })
	})

	const handleSaveConflictDialogChange = useMemoizedFn((open: boolean) => {
		setShowSaveWithUpdateConfirmDialog(open)
		if (!open && !isConfirmingConflictSaveRef.current) {
			pendingSaveIntentRef.current = null
			resolvePendingSave(false)
		}
	})

	const handleDismissSaveWithUpdate = useMemoizedFn(() => {
		pendingSaveIntentRef.current = null
		resolvePendingSave(false)
		setShowSaveWithUpdateConfirmDialog(false)
	})

	const handleConfirmSaveWithUpdate = useMemoizedFn(async () => {
		const intent = pendingSaveIntentRef.current
		if (!intent) return

		isConfirmingConflictSaveRef.current = true
		const didSave = await performSave({
			shouldExitEditMode: intent !== "save",
			shouldDeactivate: intent === "save-and-switch",
		})
		isConfirmingConflictSaveRef.current = false

		pendingSaveIntentRef.current = null
		resolvePendingSave(didSave)
	})

	// Handle refresh current slide
	const handleRefresh = useMemoizedFn(async () => {
		if (isRefreshing) return

		setIsRefreshing(true)
		try {
			// Exit edit mode if editing
			if (isEditMode) {
				setIsEditMode(false)
			}

			// If viewing historical version, return to latest
			if (fileVersion) {
				changeFileVersion(undefined)
			}

			// Refresh slide content from server
			if (onRefreshSlide) {
				await onRefreshSlide(index)
			}

			// Refresh version list
			if (fileId) {
				await fetchFileVersions(fileId, true)
			}

			// Clear server update flag
			clearServerUpdate()
		} catch (error) {
			console.error("Failed to refresh slide:", error)
		} finally {
			setIsRefreshing(false)
		}
	})

	// 同步 editingCodeContent 和 displayContent
	useEffect(() => {
		setEditingCodeContent(displayContent.rawContent)
	}, [displayContent.rawContent])

	// Construct current file info for sharing - use main PPT file instead of individual slide
	const currentFile = useMemo(() => {
		// Prefer main PPT file for sharing the entire presentation
		if (mainFileId && mainFileName) {
			return {
				id: mainFileId,
				name: mainFileName,
				type: "html",
				projectId: selectedProject?.id || projectId,
				projectName: selectedProject?.project_name,
			}
		}

		// Fallback to individual slide if main file info is not available
		if (!fileId) return undefined

		return {
			id: fileId,
			name: `slide_${index + 1}.html`,
			type: "html",
			projectId: selectedProject?.id || projectId,
			projectName: selectedProject?.project_name,
		}
	}, [
		mainFileId,
		mainFileName,
		fileId,
		index,
		selectedProject?.id,
		selectedProject?.project_name,
		projectId,
	])

	// 菜单退出确认可能改变状态；保留点击时的开关意图，避免确认退出后又重新开启。
	const handleAIEdit = useCallback(() => {
		if (isAppendPicking) {
			rendererRef.current?.stopInspector()
		} else {
			rendererRef.current?.startInspectorAppend()
		}
	}, [isAppendPicking])
	const handleQuickSelect = useMemoizedFn(() => {
		if (isQuickSelecting) {
			void rendererRef.current?.requestInspectorExit?.()
		} else {
			rendererRef.current?.startInspectorQuickSelect?.()
		}
	})
	const handleViewModeChange = useMemoizedFn(
		(mode: NonNullable<EditToolbarProps["viewMode"]>) => {
			// 工具栏已通过选取退出确认；源码会卸载渲染器，在此同步清除本页激活态。
			if (mode === "code") {
				setIsAppendPicking(false)
				setIsQuickSelecting(false)
			}
			setViewMode(mode)
		},
	)
	const resolvedToolbarOwnerKey = toolbarOwnerKey || `${fileId || "missing-file"}:${index}`
	useLayoutEffect(() => {
		onTransitionLayerChange?.(resolvedToolbarOwnerKey, slideWrapperRef.current)
		return () => onTransitionLayerChange?.(resolvedToolbarOwnerKey, null)
	}, [onTransitionLayerChange, resolvedToolbarOwnerKey])
	const toolbarModel = useMemo<PPTSlideToolbarModel | null>(() => {
		if (!showEditToolbar) return null

		return {
			token: toolbarRegistrationToken,
			props: {
				onStartInspectorAppend: handleAIEdit,
				isAppendPicking,
				onStartInspectorQuickSelect: handleQuickSelect,
				isQuickSelecting,
				showAIOptimization: allowEdit && !fileVersion,
				beforeAction: () =>
					rendererRef.current?.requestInspectorExit?.() ?? Promise.resolve(true),
				showFileEdit: allowEdit && !fileVersion,
				isEditMode,
				isSaving: false,
				attachmentList,
				fileId,
				mainFileId,
				projectId: selectedProject?.id || projectId,
				onEdit: handleEdit,
				onSave: handleSave,
				onSaveAndExit: handleSaveAndExit,
				onCancel: handleCancel,
				hasServerUpdate,
				onViewServerUpdate: handleViewServerUpdate,
				viewMode,
				onViewModeChange: handleViewModeChange,
				showVersionHistory: allowEdit,
				fileVersion,
				fileVersionsList,
				isNewestVersion,
				onVersionChange: handleVersionChange,
				onVersionRollback: handleRollback,
				onCompareVersion: handleCompareVersion,
				fetchFileVersions,
				shouldShowButtonText: showButtonText,
				showRefresh,
				onRefresh: handleRefresh,
				isRefreshing,
				currentFile,
				attachments,
				showShare: allowEdit,
				allowShare: isNewestVersion && !fileVersion,
				showDownload: allowDownload,
				className: "max-w-full flex-shrink-0 overflow-x-auto bg-white dark:bg-card",
			},
		}
	}, [
		allowDownload,
		allowEdit,
		attachmentList,
		attachments,
		currentFile,
		fetchFileVersions,
		fileId,
		fileVersion,
		fileVersionsList,
		handleCancel,
		handleCompareVersion,
		handleEdit,
		handleRefresh,
		handleRollback,
		handleSave,
		handleSaveAndExit,
		handleAIEdit,
		handleQuickSelect,
		handleVersionChange,
		handleViewModeChange,
		handleViewServerUpdate,
		hasServerUpdate,
		isAppendPicking,
		isEditMode,
		isQuickSelecting,
		isNewestVersion,
		isRefreshing,
		isSaving,
		showRefresh,
		mainFileId,
		projectId,
		selectedProject?.id,
		showButtonText,
		showEditToolbar,
		toolbarRegistrationToken,
		viewMode,
	])

	useLayoutEffect(() => {
		if (!onToolbarModelChange) return
		onToolbarModelChange(resolvedToolbarOwnerKey, toolbarModel, toolbarRegistrationToken)
	}, [onToolbarModelChange, resolvedToolbarOwnerKey, toolbarModel, toolbarRegistrationToken])

	useLayoutEffect(() => {
		if (!onToolbarModelChange) return
		return () => {
			onToolbarModelChange(resolvedToolbarOwnerKey, null, toolbarRegistrationToken)
		}
	}, [onToolbarModelChange, resolvedToolbarOwnerKey, toolbarRegistrationToken])

	const renderMainContent = () => {
		if (loadingState === "loading") {
			return (
				<div
					data-testid="ppt-slide-loading"
					className={slideWrapperClassNames}
					style={slideWrapperStyle}
				>
					<div className="flex h-full w-full flex-col items-center justify-center gap-4 bg-background text-muted-foreground">
						<MagicSpin spinning wrapperClassName="w-auto" />
						<div className="text-center">
							<p className="text-lg font-medium">{t("ppt.loading")}</p>
							<p className="mt-2 text-sm text-muted-foreground">
								{t("ppt.slideLoading", { index: index + 1 })}
							</p>
						</div>
					</div>
				</div>
			)
		}

		if (loadingState === "error") {
			return (
				<PPTSlideError
					className={slideWrapperClassNames}
					style={slideWrapperStyle}
					index={index}
					error={loadingError}
					isActive={isActive}
				/>
			)
		}

		if (loadingState === "idle") {
			return (
				<div
					data-testid="ppt-slide-idle"
					className={slideWrapperClassNames}
					style={slideWrapperStyle}
				>
					<div className="flex h-full w-full flex-col items-center justify-center gap-4 bg-background text-muted-foreground">
						<div className="text-center">
							<p className="text-lg font-medium">{t("ppt.slideIdle")}</p>
							<p className="mt-2 text-sm text-muted-foreground">
								{t("ppt.slideIdleDescription", { index: index + 1 })}
							</p>
						</div>
					</div>
				</div>
			)
		}

		// Empty content fallback UI
		if (!content || content.trim() === "") {
			return (
				<div
					data-testid="ppt-slide-empty"
					className={slideWrapperClassNames}
					style={slideWrapperStyle}
				>
					<div className="flex h-full w-full flex-col items-center justify-center gap-4 bg-background text-muted-foreground">
						<FileX size={64} className="text-muted-foreground" />
						<div className="text-center">
							<p className="text-lg font-medium">{t("ppt.fileNotFound")}</p>
							<p className="mt-2 text-sm text-muted-foreground">
								{t("ppt.slideContentEmpty", { index: index + 1 })}
							</p>
						</div>
					</div>
				</div>
			)
		}

		if (!canRenderDisplayContent) {
			return (
				<div
					data-testid="ppt-slide-content-updating"
					className={slideWrapperClassNames}
					style={slideWrapperStyle}
				>
					<div className="flex h-full w-full items-center justify-center bg-background">
						<MagicSpin spinning wrapperClassName="w-auto" />
					</div>
				</div>
			)
		}

		return viewMode === "code" ? (
			<CodeEditor
				content={displayContent.rawContent || ""}
				fileName={fileId}
				isEditMode={isEditMode}
				onChange={(value) => setEditingCodeContent(value)}
				height="100%"
				showLineNumbers={true}
			/>
		) : (
			<div
				data-testid="ppt-slide-render-content"
				className={cn("relative min-h-0 w-full", isFullscreen ? "h-full" : "flex-1")}
			>
				{previewFrameSwap.frames.map((frame) => (
					<div
						key={`${rendererKey}-${frame.id}`}
						className={
							frame.isVisible && !buildPlayback.preparing
								? "contents"
								: "pointer-events-none invisible absolute inset-0"
						}
					>
						{frame.isLive ? (
							<IsolatedHTMLRenderer
								{...rendererStaticProps}
								ref={rendererRef as React.RefObject<IsolatedHTMLRendererRef>}
								content={frame.content}
								onSaveReady={handleSaveReady}
								onRenderReady={() => {
									const ready = handleSlideRenderReady()
									if (ready instanceof Promise) {
										void ready.then((allowed) => {
											if (allowed) previewFrameSwap.markReady(frame.id)
										})
									} else previewFrameSwap.markReady(frame.id)
								}}
								onAppendPickingChange={setIsAppendPicking}
								onQuickSelectionChange={setIsQuickSelecting}
							/>
						) : (
							frame.frozenProps && (
								<IsolatedHTMLRenderer
									{...frame.frozenProps}
									// Frozen preview frames cannot retain editor-only sidebars or markers.
									buildPanelOpen={false}
									// A saved frame can outlive its captured props while the deck starts a transition.
									isPlaybackPaused={Boolean(transitionRole) || isPreparingReplay}
									content={frame.content}
								/>
							)
						)}
					</div>
				))}
				<HtmlPreviewFreshness
					key={fileId}
					phase="idle"
					hasRendered
					saveStage={saveStage}
					previewStatusEnabled={false}
					onRetry={() => undefined}
				/>
				{(buildPlayback.preparing ||
					(!isSlideRenderReady &&
						!previewFrameSwap.holdsPreviousFrame &&
						paintedRendererKeyRef.current !== rendererKey)) && (
					<div className="absolute inset-0 z-10 flex items-center justify-center bg-white dark:bg-[#1c1c1c]">
						<MagicSpin spinning />
					</div>
				)}
			</div>
		)
	}

	return (
		<>
			<div
				ref={slideWrapperRef}
				data-testid={fileId ? `ppt-slide-item-${fileId}` : "ppt-slide-item"}
				className={slideWrapperClassNames}
				style={slideWrapperStyle}
				aria-hidden={!isInteractive}
				data-interactive={String(isInteractive)}
			>
				{!onToolbarModelChange && toolbarModel && (
					<EditToolbar
						{...toolbarModel.props}
						getPopupContainer={() => slideWrapperRef.current}
					/>
				)}

				{renderMainContent()}
			</div>

			{/* 保存提示对话框 */}
			<AlertDialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
				<AlertDialogContent data-testid="ppt-slide-save-dialog">
					<AlertDialogHeader>
						<AlertDialogTitle>{t("ppt.unsavedChangesTitle")}</AlertDialogTitle>
						<AlertDialogDescription>
							{t("ppt.unsavedChangesDescription")}
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel
							data-testid="ppt-slide-save-dialog-discard"
							onClick={handleDiscardAndSwitch}
							disabled={isSaving}
						>
							{t("ppt.discardChanges")}
						</AlertDialogCancel>
						<AlertDialogAction
							data-testid="ppt-slide-save-dialog-save"
							onClick={handleSaveAndSwitch}
							disabled={isSaving}
						>
							{isSaving ? t("ppt.saving") : t("ppt.saveChanges")}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>

			{/* 保存时服务端更新确认对话框 */}
			<AlertDialog
				open={showSaveWithUpdateConfirmDialog}
				onOpenChange={handleSaveConflictDialogChange}
			>
				<AlertDialogContent data-testid="ppt-slide-save-with-update-dialog">
					<AlertDialogHeader>
						<AlertDialogTitle>{t("ppt.saveWithServerUpdateTitle")}</AlertDialogTitle>
						<AlertDialogDescription>
							{t("ppt.saveWithServerUpdate")}
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel
							onClick={handleDismissSaveWithUpdate}
							disabled={isSaving}
						>
							{t("common.cancel")}
						</AlertDialogCancel>
						<AlertDialogAction
							onClick={handleConfirmSaveWithUpdate}
							disabled={isSaving}
						>
							{isSaving ? t("ppt.saving") : t("ppt.saveChanges")}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>

			{/* 版本对比对话框 */}
			<VersionCompareDialog
				open={showVersionCompareDialog}
				onOpenChange={setShowVersionCompareDialog}
				currentContent={currentEditingContent}
				serverContent={actualServerContent}
				onUseMyVersion={handleUseMyVersion}
				onUseServerVersion={handleUseServerVersion}
				filePathMapping={filePathMapping}
				fileId={fileId}
				openNewTab={openNewTab}
				selectedProject={selectedProject}
				attachmentList={attachmentList}
			/>

			{/* 历史版本对比对话框 */}
			{compareHistoryVersion && (
				<HistoryVersionCompareDialog
					open={showHistoryCompareDialog}
					onOpenChange={setShowHistoryCompareDialog}
					latestContent={content}
					historyContent={compareHistoryContent}
					historyVersion={compareHistoryVersion}
					fileVersionsList={fileVersionsList}
					onUseHistoryVersion={handleUseHistoryVersion}
					onUseLatestVersion={handleUseLatestVersion}
					onSwitchHistoryVersion={handleSwitchHistoryVersion}
					filePathMapping={filePathMapping}
					fileId={fileId}
					openNewTab={openNewTab}
					selectedProject={selectedProject}
					attachmentList={attachmentList}
				/>
			)}
		</>
	)
})

export default PPTSlide
