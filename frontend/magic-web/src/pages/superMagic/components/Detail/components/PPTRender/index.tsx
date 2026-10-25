import { generateSpeakerNotes } from "./services/generateSpeakerNotes"
import { PPT_BUILD_ATTRIBUTE } from "@dtyq/html-sandbox/utils/pptBuild"
import type { AttachmentLoadState } from "@/stores/projectFiles/types"
import {
	lazy,
	Suspense,
	useCallback,
	useEffect,
	useId,
	useLayoutEffect,
	useRef,
	useMemo,
	useState,
} from "react"
import { createPortal } from "react-dom"
import { useMemoizedFn } from "ahooks"
import { useTranslation } from "react-i18next"
import { observer } from "mobx-react-lite"
import { ChevronDown, Minimize, PanelLeftOpen, Presentation, Plus } from "lucide-react"
import { usePPTBuildNavigation } from "./hooks/usePPTBuildNavigation"
import PPTSlide, { type PPTSlideToolbarModel } from "./PPTSlide"
import PPTSidebar from "./PPTSidebar/index"
import { PPTControlBar } from "./PPTControlBar"
import {
	usePPTSidebar,
	useFullscreen,
	useSlideFileLocator,
	useCheckBeforeNavigate,
	usePPTEventBus,
	usePPTStore,
	useSyncActiveState,
	useSlideSync,
	useSlideNavigation,
	useSlideHandlers,
	usePPTPresenterWindow,
} from "./hooks"
import { getLiveRenderSlideKey, usePPTLiveRenderCache } from "./hooks/usePPTLiveRenderCache"
import MagicSpin from "@/components/base/MagicSpin"
import { useResizableSidebar } from "./hooks/useResizableSidebar"
import { useIsMobile } from "@/hooks/useIsMobile"
import { useOrganization } from "@/models/user/hooks/useOrganization"
import { useFileApi } from "@/pages/superMagic/fileAccess/fileApi"
import { userStore } from "@/models/user"
import { configStore } from "@/models/config"
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
import { TAILWIND_Z_INDEX_CLASSES } from "../../contents/HTML/constants/z-index"
import TextAnimation from "@/components/animations/TextAnimation"
import { MagicDropdown, MagicTooltip } from "@/components/base"
import MagicModal from "@/components/base/MagicModal"
import { Button } from "@/components/shadcn-ui/button"
import { cn } from "@/utils/cn"
import { findPPTSlideIndex } from "./utils/slideNavigation"
import { PPTLinkContext } from "../../contents/HTML/contexts/PPTLinkContext"
import { PPTProvider } from "./contexts/PPTContext"
import { useContainerShowButtonText } from "@/hooks/useContainerShowButtonText"
import type { MenuProps } from "antd"
import type { PPTSlideStructureAdapter } from "./types"
import { getPPTLiveRenderCacheSize } from "./PPTSidebar/utils/devicePerformance"
import EditToolbar from "../EditToolbar"
import PPTSpeakerNotesPanel from "./components/PPTSpeakerNotesPanel"
import PPTPresenterNextSlide from "./components/PPTPresenterNextSlide"
import PPTPresenterConsoleControls from "./components/PPTPresenterConsoleControls"
import PPTPresenterLayout from "./components/PPTPresenterLayout"
import PPTPresenterFilmstrip from "./components/PPTPresenterFilmstrip"
import type { PPTNotesAction } from "./components/PPTNotesActions"
import { pptNotesPreferenceStore } from "@/stores/layout/PPTNotesPreferenceStore"
import { runGuardedAction } from "../../utils/actionGuard"
import type { OptionItem } from "@/pages/superMagic/components/MainInputContainer/panels/types"
import {
	buildSlidesTemplateReplacementPayload,
	type SlidesTemplateReplacementTarget,
} from "@/pages/superMagic/utils/slidesTemplateReplacementActions"
import pubsub, { PubSubEvents } from "@/utils/pubsub"

import { usePPTDeckTools } from "./hooks/usePPTDeckTools"
import {
	normalizeHiddenSlides,
	getPptVisibleSlideIndices,
} from "@/pages/superMagic/utils/pptHiddenSlides"
import { getPPTTransition, type PPTTransitionEdit } from "./utils/pptTransitions"
import PPTTransitionPanel from "./components/PPTTransitionPanel"
import magicToast from "@/components/base/MagicToaster/utils"
import { ensureFileSavesSynced, getFileSaveQueue } from "../../services/fileSaveQueue"
const SlidesTemplateReplacementDialog = lazy(() => import("./SlidesTemplateReplacementDialog"))

interface ManualSaveResult {
	fileId?: string
	cleanContent?: string
}

export function reconcilePPTSlideToolbarModels(
	currentModels: Map<string, PPTSlideToolbarModel>,
	ownerKey: string,
	model: PPTSlideToolbarModel | null,
	token: object,
): Map<string, PPTSlideToolbarModel> {
	const currentModel = currentModels.get(ownerKey)

	if (model) {
		if (currentModel === model) return currentModels
		const nextModels = new Map(currentModels)
		nextModels.set(ownerKey, model)
		return nextModels
	}

	if (!currentModel || currentModel.token !== token) return currentModels
	const nextModels = new Map(currentModels)
	nextModels.delete(ownerKey)
	return nextModels
}

function getHtmlRelativeFolderPath(fileItem?: { relative_file_path?: string; file_name?: string }) {
	const path = fileItem?.relative_file_path
	if (!path) return undefined
	if (fileItem?.file_name && path.endsWith(fileItem.file_name)) {
		return path.slice(0, -fileItem.file_name.length)
	}

	return path.replace(/[^/]*$/, "") || undefined
}

interface PPTRenderProps {
	onDeckConfigSaved?: (config: Record<string, unknown>) => void
	attachmentLoadState?: AttachmentLoadState
	// ========== 外部依赖（必需） ==========
	slidePaths: string[]
	attachments?: any[]
	attachmentList?: any[]
	mainFileId?: string
	mainFileName?: string
	filePathMapping: Map<string, string>
	selectedProject?: any
	projectId?: string
	displayConfig?: any
	allowDownload?: boolean
	showRefresh?: boolean

	// ========== 受控状态（可选） ==========
	/** 初始激活索引（用于缓存恢复） */
	initialActiveIndex?: number
	/** 激活索引变化时的回调 */
	onActiveIndexChange?: (index: number, fileId: string) => void

	// ========== 模式标志 ==========
	isPlaybackMode?: boolean
	allowEdit?: boolean

	// ========== 业务回调 ==========
	saveEditContent?: (
		content: any,
		fileId?: string,
		enable_shadow?: boolean,
		fetchFileVersions?: (fileId: string) => void,
		isPPTEditMode?: boolean,
		shouldExitEditMode?: boolean,
		options?: { silent?: boolean },
	) => Promise<boolean | void>
	onSortSave?: (newSlidesUrls: string[]) => void
	openNewTab?: (fileId: string, path: string) => void
	onDownload?: ({
		fileId,
		fileVersion,
	}: {
		fileId: string
		fileVersion?: number
		type?: "file" | "pdf" | "pptx"
	}) => void
	onFullscreen?: () => void
	isFileFullscreen?: boolean
	isTabActive?: boolean
	onRegisterCheckBeforeClose?: (fileId: string, callback: () => Promise<boolean>) => void
	onUnregisterCheckBeforeClose?: (fileId: string) => void
	slideStructureAdapter?: PPTSlideStructureAdapter
}

/**
 * PPTRender 包装组件
 * 创建事件总线和 store 实例并提供给子组件
 */
const PPTRender = observer(function PPTRender(props: PPTRenderProps) {
	const {
		slidePaths,
		attachments,
		attachmentList,
		mainFileId,
		mainFileName,
		displayConfig,
		initialActiveIndex,
		selectedProject,
		projectId,
		allowDownload,
	} = props

	const { organizationCode } = useOrganization()
	const fileApi = useFileApi()
	const resolvedProjectId = selectedProject?.id || projectId
	const userId = userStore.user.userInfo?.user_id
	const clusterCode = configStore.cluster.clusterCode
	const thumbnailCacheScope = useMemo(
		() =>
			userId && organizationCode && resolvedProjectId && mainFileId
				? {
						clusterCode,
						userId,
						organizationCode,
						projectId: resolvedProjectId,
						mainFileId,
					}
				: undefined,
		[clusterCode, userId, organizationCode, resolvedProjectId, mainFileId],
	)
	// 身份变化复用 Provider 的卸载清理，旧 HTML／请求不能进入新账号的缓存作用域。
	const previewScopeKey = JSON.stringify([
		clusterCode,
		userId,
		organizationCode,
		resolvedProjectId,
		mainFileId,
	])
	const effectiveDisplayConfig = useMemo(() => {
		if (!slidePaths?.length) return displayConfig
		return {
			...displayConfig,
			slides: slidePaths,
		}
	}, [displayConfig, slidePaths])

	const storeConfig = useMemo(
		() => ({
			thumbnailCacheScope,
			attachmentLoadState: props.attachmentLoadState,
			attachments,
			attachmentList,
			projectId: resolvedProjectId,
			mainFileId,
			mainFileName,
			displayConfig: effectiveDisplayConfig,
			initialActiveIndex,
			organizationCode,
			selectedProjectId: selectedProject?.id,
			enableCache: true,
			allowDownload,
			fileApi,
		}),
		[
			thumbnailCacheScope,
			props.attachmentLoadState,
			attachments,
			attachmentList,
			resolvedProjectId,
			mainFileId,
			mainFileName,
			effectiveDisplayConfig,
			initialActiveIndex,
			organizationCode,
			selectedProject?.id,
			allowDownload,
			fileApi,
		],
	)

	return (
		<PPTProvider key={previewScopeKey} storeConfig={storeConfig}>
			<PPTRenderInner {...props} />
		</PPTProvider>
	)
})

/**
 * PPTRenderInner - PPT 渲染主逻辑
 * 使用事件总线进行组件间通信
 */
const PPTRenderInner = observer(function PPTRenderInner({
	slidePaths,
	attachments,
	attachmentList,
	projectId,
	mainFileId,
	mainFileName,
	filePathMapping,
	selectedProject,
	initialActiveIndex,
	onActiveIndexChange,
	isPlaybackMode,
	allowEdit = false,
	saveEditContent,
	onSortSave,
	openNewTab,
	onDownload,
	onFullscreen: onFileFullscreen,
	isFileFullscreen = false,
	isTabActive,
	allowDownload,
	showRefresh = true,
	onRegisterCheckBeforeClose,
	onUnregisterCheckBeforeClose,
	slideStructureAdapter,
	onDeckConfigSaved,
}: PPTRenderProps) {
	const { t } = useTranslation("super")
	const isMobile = useIsMobile()
	const fileApi = useFileApi()
	const containerRef = useRef<HTMLDivElement>(null)
	const presentationStageRef = useRef<HTMLDivElement>(null)
	const { onDownloadRequest, onFullscreenToggle, emitFullscreenStateChange } = usePPTEventBus()
	const store = usePPTStore()

	useEffect(() => {
		const queue = getFileSaveQueue()
		const unsubs = store.slides.map((slide) => {
			const fileId = store.getFileIdByPath(slide.path)
			if (!fileId) return () => {}
			const unrestore = queue.registerRestoreHandler(fileId, async () => {
				await store.loadSlideContentByFileId(fileId, { path: slide.path })
			})
			const unapply = queue.registerDraftApplyHandler(fileId, async (content) => {
				await store.applyUnsyncedDraft(fileId, content)
			})
			return () => {
				unrestore()
				unapply()
			}
		})
		return () => unsubs.forEach((unsubscribe) => unsubscribe())
	}, [store, store.slides])

	const [isAnySlideEditing, setIsAnySlideEditing] = useState(false)
	const [notesPending, setNotesPending] = useState(false)
	const [transitionPanelOpen, setTransitionPanelOpen] = useState(false)
	const [buildPanelOpen, setBuildPanelOpen] = useState(false)
	const [transitionPanelSession, setTransitionPanelSession] = useState(0)
	const [transitionTarget, setTransitionTarget] = useState({
		path: "",
		scope: "current" as "current" | "selected",
	})
	const transitionCloseGuardRef = useRef<(() => Promise<boolean>) | null>(null)
	const savingTransitionsRef = useRef(false)
	const registerTransitionCloseGuard = useMemoizedFn((guard: (() => Promise<boolean>) | null) => {
		transitionCloseGuardRef.current = guard
	})
	const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
	const [manualScale, setManualScale] = useState<number | null>(null)
	const [activeSlideScaleRatio, setActiveSlideScaleRatio] = useState(1)
	const activeInspectorPickingRef = useRef(false)
	const activeInspectorExitRef = useRef<(() => boolean | Promise<boolean>) | null>(null)
	const [templateReplacementTarget, setTemplateReplacementTarget] =
		useState<SlidesTemplateReplacementTarget | null>(null)
	const activeSlideCloseSaveHandlerRef = useRef<(() => Promise<boolean>) | null>(null)
	const activeSlideDiscardHandlerRef = useRef<(() => Promise<boolean>) | null>(null)

	const handleManualScaleChange = useMemoizedFn((scale: number | null) => {
		setManualScale(scale)
		if (scale !== null) {
			setActiveSlideScaleRatio(scale)
		}
	})

	const { sidebarWidth, isResizing, handleResizeStart } = useResizableSidebar({
		containerRef,
		minWidth: 160,
		defaultWidth: 200,
	})

	const {
		checkBeforeNavigate: checkBeforeNavigateGuard,
		registerSaveHandler,
		registerDiscardHandler: registerDiscardHandlerForNavigation,
		showNavigationDialog,
		setShowNavigationDialog,
		isSavingForNavigation,
		targetPageNumber,
		handleSaveAndNavigate,
		handleDiscardAndNavigate,
		handleCancelNavigation,
	} = useCheckBeforeNavigate({
		isAnySlideEditing,
		isInspectorPicking: () => activeInspectorPickingRef.current,
		requestInspectorExit: () => activeInspectorExitRef.current?.() ?? Promise.resolve(true),
		activeIndex: store.activeIndex,
	})

	const navigationFocusRef = useRef<HTMLElement | null>(null)
	const checkBeforeNavigate = useMemoizedFn(
		(type: "prev" | "next" | "first" | "jump", targetIndex?: number) => {
			navigationFocusRef.current =
				document.activeElement instanceof HTMLElement ? document.activeElement : null
			if (transitionCloseGuardRef.current) {
				return transitionCloseGuardRef
					.current()
					.then((allowed) =>
						allowed ? checkBeforeNavigateGuard(type, targetIndex) : false,
					)
			}
			return checkBeforeNavigateGuard(type, targetIndex)
		},
	)
	// 幻灯片初始化与增量同步
	useSlideSync({
		store,
		slidePaths,
		deckKey: mainFileId || mainFileName,
		initialActiveIndex,
	})

	// 当激活索引或文件 ID 变化时通知父组件
	useSyncActiveState({ store, onActiveIndexChange, isTabActive })

	// 幻灯片操作处理函数（编辑/刷新/截图/侧边栏）
	const {
		handleEditModeChange,
		handleRefreshSlide,
		handleRefreshAllSlides,
		refreshAllProgress,
		handleRegenerateScreenshot,
		handleSidebarCollapsedChange,
	} = useSlideHandlers({ store, setIsAnySlideEditing, setIsSidebarCollapsed })

	// 在文件树中定位活动幻灯片；缩略图滚动由虚拟侧边栏自身负责。
	useSlideFileLocator({ store })

	// Presenter controls reuse the same guarded slide navigation as the main window.
	const {
		changeSlide: changePage,
		goToFirstSlide: firstPage,
		handleJumpToPage: jumpPage,
		preparePresentation,
	} = useSlideNavigation({
		store,
		checkBeforeNavigate,
		isPresenting: () =>
			isPresentationFullscreen || isPresenterWindowOpen || Boolean(isPlaybackMode),
		getHiddenSlidePaths: () => store.getConfigForExport().displayConfig?.hidden_slides,
		hasPendingNavigationGuard: () =>
			transitionPanelOpen || isAnySlideEditing || activeInspectorPickingRef.current,
		onHiddenSlide: () => magicToast.info(t("ppt.hiddenPageSkipped")),
		onNoVisibleSlides: () => magicToast.info(t("ppt.noVisibleSlides")),
	})
	// 这里只表示 PPT 放映全屏。外层 FilesViewer 全屏只放大完整查看界面，不能隐藏侧栏和工具栏。
	const {
		isFullscreen: isPresentationFullscreen,
		isPresenterView,
		toggleFullscreen: togglePresentationFullscreen,
	} = useFullscreen({
		containerRef,
		preserveMobileLayout: isMobile,
		presenterTargetRef: presentationStageRef,
		presenterEnabled: false,
		beforeEnter: () => {
			if (isPresenterStarting) return false
			if (hasPendingPresenterRequest()) {
				magicToast.info(t("ppt.presenter.requestPending"))
				return false
			}
			if (deckTools.busy) return false
			if (notesPending) {
				magicToast.warning(t("ppt.batch.saveNotesFirst"))
				return false
			}
			const prepared = preparePresentation()
			return prepared instanceof Promise
				? prepared.then((index) => index !== null)
				: prepared !== null
		},
	})
	const {
		isOpen: isPresenterWindowOpen,
		isStarting: isPresenterStarting,
		hasPendingNativeRequest: hasPendingPresenterRequest,
		isFallbackOnly: isPresenterFallbackOnly,
		screens: presenterScreens,
		selectedScreen: selectedPresenterScreen,
		open: openPresenterWindow,
		consoleContainer: presenterConsoleContainer,
		close: closePresenterWindow,
		moveToScreen: movePresenterToScreen,
	} = usePPTPresenterWindow(presentationStageRef)
	const togglePresenter = useMemoizedFn(async () => {
		if (isPresenterWindowOpen || isPresenterStarting) {
			closePresenterWindow()
			return
		}
		if (hasPendingPresenterRequest()) {
			magicToast.info(t("ppt.presenter.requestPending"))
			return
		}
		if (deckTools.busy) return
		if (notesPending) {
			magicToast.warning(t("ppt.batch.saveNotesFirst"))
			return
		}
		const prepared = preparePresentation()
		const index = prepared instanceof Promise ? await prepared : prepared
		if (index === null) return
		// Read after the guard, which may have skipped a hidden starting page.
		const slide = store.slides[index]
		if (!isPresenterFallbackOnly && !isMobile && slide?.content) {
			const result = await openPresenterWindow()
			if (result === "blocked") magicToast.info(t("ppt.presenter.requestPending"))
			if (result !== "fallback") return
			// A denied prompt or an opened popup may consume/expire the gesture. The
			// browser requires a fresh click; do not issue a native request guaranteed to fail.
			if (navigator.userActivation?.isActive === false) {
				magicToast.info(t("ppt.presenter.retryFullscreen"))
				return
			}
		}
		await togglePresentationFullscreen()
	})
	const isSingleWindowFullscreen = isPresentationFullscreen && !isPresenterView
	useEffect(() => {
		// A new page/document starts its own editor session; cached frames must not retain markers.
		setBuildPanelOpen(false)
	}, [store.activeIndex, mainFileId, isPlaybackMode, isPresentationFullscreen, isTabActive])
	const isPresenterConsole = isPresenterWindowOpen
	const buildNavigation = usePPTBuildNavigation({
		hasBuilds: () =>
			Boolean(store.slides[store.activeIndex]?.content?.includes(PPT_BUILD_ATTRIBUTE)),
		getPageKey: () => store.slides[store.activeIndex]?.path ?? "",
		isPresenting: () =>
			isPresentationFullscreen || isPresenterWindowOpen || Boolean(isPlaybackMode),
		canNavigate: () =>
			isTabActive !== false &&
			!transitionPanelOpen &&
			!isAnySlideEditing &&
			!isDeleteModalOpen &&
			!deckTools.busy &&
			!store.isTransitioning &&
			!pendingKey &&
			!transitionState,
		changePage,
		jumpPage,
		firstPage,
	})
	const { changeSlide, goToFirstSlide, handleJumpToPage } = buildNavigation

	const visibleSlideIndices = getPptVisibleSlideIndices(
		store.slides,
		store.getConfigForExport().displayConfig?.hidden_slides,
	)
	const nextVisibleIndex = visibleSlideIndices.find((index) => index > store.activeIndex) ?? -1
	const visibilityKey = visibleSlideIndices.join(",")
	useEffect(() => {
		if (!(isPresentationFullscreen || isPresenterWindowOpen || isPlaybackMode)) return
		const indices = visibilityKey ? visibilityKey.split(",").map(Number) : []
		if (!indices.length) {
			if (isPresenterWindowOpen) closePresenterWindow()
			if (isPresentationFullscreen) void togglePresentationFullscreen()
			return
		}
		if (!indices.includes(store.activeIndex)) void preparePresentation()
	}, [
		visibilityKey,
		store.activeIndex,
		isPlaybackMode,
		isPresentationFullscreen,
		isPresenterWindowOpen,
		closePresenterWindow,
		togglePresentationFullscreen,
		preparePresentation,
	])
	useEffect(() => {
		if (isPresenterConsole && nextVisibleIndex >= 0)
			void store.ensureSlideContent(nextVisibleIndex)
	}, [isPresenterConsole, store, nextVisibleIndex])

	const isSidebarEffectivelyCollapsed = isSidebarCollapsed && !isPresenterView

	// 先于子组件的被动 effect 同步，避免退出全屏时侧栏恢复请求仍被旧状态丢弃。
	useLayoutEffect(() => {
		store.setFullscreen(isPresentationFullscreen)
	}, [isPresentationFullscreen, store])

	// 订阅下载事件
	useEffect(() => {
		const unsubscribe = onDownloadRequest((payload) => {
			onDownload?.(payload)
		})
		return unsubscribe
	}, [onDownload, onDownloadRequest])

	// 订阅全屏切换事件
	useEffect(() => {
		const unsubscribe = onFullscreenToggle(() => {
			if (onFileFullscreen) onFileFullscreen()
			else void togglePresenter()
		})
		return unsubscribe
	}, [onFileFullscreen, onFullscreenToggle, togglePresenter])

	// 发出全屏状态变化事件
	useEffect(() => {
		emitFullscreenStateChange(isPresentationFullscreen)
	}, [isPresentationFullscreen, emitFullscreenStateChange])

	// 在移动模式下禁用编辑功能
	const effectiveAllowEdit = allowEdit && !isMobile

	// 获取用于创建新幻灯片的项目 ID 和父级 ID
	const resolvedProjectId = selectedProject?.id || projectId
	const hiddenPaths = new Set(
		normalizeHiddenSlides(
			store.slidePaths,
			store.getConfigForExport().displayConfig?.hidden_slides,
		),
	)
	const deckTools = usePPTDeckTools({
		store,
		mainFileId,
		mainFileName,
		attachmentList,
		projectId: resolvedProjectId,
		allowEdit: allowEdit && !slideStructureAdapter && !isPlaybackMode && !isPresenterConsole,
		onDeckConfigSaved,
		beforeWrite: async () => {
			// Draft notes must be resolved before a structure write can unmount their editor.
			if (notesPending) {
				magicToast.warning(t("ppt.batch.saveNotesFirst"))
				return false
			}
			// Saving from the panel must not re-enter its own dirty-close guard.
			return savingTransitionsRef.current
				? checkBeforeNavigateGuard("jump", store.activeIndex)
				: checkBeforeNavigate("jump", store.activeIndex)
		},
	})
	const canConfigureTransitions = Boolean(
		effectiveAllowEdit &&
		!slideStructureAdapter &&
		!isPlaybackMode &&
		!isPresenterConsole &&
		!isPresentationFullscreen &&
		store.slides.length,
	)
	const transitionPreviewIndex = store.slides.findIndex(
		(slide) => slide.path === transitionTarget.path,
	)
	const transitionPreviousIndex = visibleSlideIndices
		.filter((index) => index < transitionPreviewIndex)
		.at(-1)
	const getTransitionPreviewSlide = (index: number | undefined) => {
		const slide = index === undefined ? undefined : store.slides[index]
		if (!transitionPanelOpen || !slide) return undefined
		const fileId = store.getFileIdByPath(slide.path)
		const relativeFilePath = store.getFullRelativePath(slide.path)
		// Read only two small records so MobX tracks loaded/refreshed HTML, without copying attachments.
		return {
			...slide,
			fileId,
			htmlRelativeFolderPath: getHtmlRelativeFolderPath({
				relative_file_path: relativeFilePath,
			}),
		}
	}
	useEffect(() => {
		if (!transitionPanelOpen || transitionPreviewIndex < 0) return
		// Use the existing content queue without changing the main stage's active page.
		void store.ensureSlideContent(transitionPreviewIndex, "preview")
		if (transitionPreviousIndex !== undefined)
			void store.ensureSlideContent(transitionPreviousIndex, "preview")
	}, [store, transitionPanelOpen, transitionPreviewIndex, transitionPreviousIndex])
	const openTransitions = useMemoizedFn(async (index?: number) => {
		if (!canConfigureTransitions || deckTools.busy) return
		if (transitionCloseGuardRef.current && !(await transitionCloseGuardRef.current())) return
		setBuildPanelOpen(false)
		const slide = store.slides[index ?? store.activeIndex]
		if (!slide) return
		// A new explicit opening starts a fresh draft after the previous guard resolved.
		setTransitionPanelSession((session) => session + 1)
		setTransitionTarget({
			path: slide.path,
			scope: index === undefined && deckTools.selected.size ? "selected" : "current",
		})
		setTransitionPanelOpen(true)
	})
	const toggleBuildPanel = useMemoizedFn(async () => {
		if (!canConfigureTransitions || deckTools.busy) return
		if (buildPanelOpen) {
			setBuildPanelOpen(false)
			return
		}
		if (transitionCloseGuardRef.current && !(await transitionCloseGuardRef.current())) return
		setTransitionPanelOpen(false)
		setBuildPanelOpen(true)
	})
	const saveTransitions = useMemoizedFn(async (edit: PPTTransitionEdit) => {
		savingTransitionsRef.current = true
		try {
			const saved = await deckTools.setTransitions(edit)
			if (saved)
				magicToast.success(
					t("ppt.transitions.applied", {
						count: edit.scope === "all" ? store.slides.length : edit.paths.length,
					}),
				)
			return saved
		} finally {
			savingTransitionsRef.current = false
		}
	})
	const parentId = useMemo(() => {
		if (!attachmentList?.length || !store.slidePaths.length) return undefined

		const firstSlidePath = store.slidePaths[0]
		const firstSlideFileId = store.getFileIdByPath(firstSlidePath)
		const firstSlideFile = attachmentList.find((item: any) => item.file_id === firstSlideFileId)
		return firstSlideFile?.parent_id
	}, [attachmentList, store])

	const {
		handleSlideClick,
		handleSortChange,
		handleInsertSlide,
		handleDuplicateSlide,
		handleDeleteSlide,
		handleRenameSlide,
		handleAddToCurrentChat,
		handleAddToNewChat,
		isDeleteModalOpen,
	} = usePPTSidebar({
		slides: store.slides,
		activeIndex: store.activeIndex,
		isTransitioning: store.isTransitioning,
		allowEdit: effectiveAllowEdit,
		attachments,
		attachmentList,
		mainFileId,
		mainFileName,
		projectId: resolvedProjectId,
		parentId,
		setActiveIndex: handleJumpToPage,
		setIsTransitioning: (value) => store.setIsTransitioning(value),
		onSortSave,
		store,
		isAnySlideEditing,
		slideStructureAdapter,
	})

	// Ordinary decks share a revision-checked writer; adapters retain their contract.
	const insertSlide = slideStructureAdapter ? handleInsertSlide : deckTools.insert
	const duplicateSlide = slideStructureAdapter
		? handleDuplicateSlide
		: (index: number) => {
				const id = store.getFileIdByPath(store.slides[index]?.path || "")
				if (id) return deckTools.duplicate(new Set([id]))
			}
	const removeSlide = slideStructureAdapter
		? handleDeleteSlide
		: (index: number) => {
				const id = store.getFileIdByPath(store.slides[index]?.path || "")
				if (!id || deckTools.busy) return
				MagicModal.confirm({
					title: t("ppt.batch.removeTitle", { count: 1 }),
					content: t("ppt.batch.removeDescription"),
					variant: "destructive",
					onOk: () => deckTools.remove(new Set([id])),
				})
			}
	const renameSlide = async (index: number, name: string) => {
		if (slideStructureAdapter) return handleRenameSlide(index, name)
		const fileId = store.getFileIdByPath(store.slides[index]?.path || "")
		let renamed = false
		await deckTools.run(async () => {
			// Editor confirmation can outlive a reorder; resolve the original file again.
			const currentIndex = store.slides.findIndex(
				(slide) => fileId && store.getFileIdByPath(slide.path) === fileId,
			)
			if (currentIndex >= 0) renamed = await handleRenameSlide(currentIndex, name)
		})
		return renamed
	}
	const handleGenerateSpeakerNotes = useMemoizedFn(
		async (
			action: PPTNotesAction,
			targetFileId: string,
			notes: string,
			signal: AbortSignal,
			instruction?: string,
		) => {
			const slideIndex = store.slides.findIndex(
				(item) => store.getFileIdByPath(item.path) === targetFileId,
			)
			const slide = store.slides[slideIndex]
			if (!effectiveAllowEdit || !slide?.rawContent) throw new Error("Slide is unavailable")
			return generateSpeakerNotes({
				action,
				rawContent: slide.rawContent,
				previousRawContent: store.slides[slideIndex - 1]?.rawContent,
				nextRawContent: store.slides[slideIndex + 1]?.rawContent,
				notes,
				instruction,
				signal,
			})
		},
	)

	const handleOpenNewTab = useMemoizedFn((fileId: string, path: string) => {
		const currentSlide =
			store.slides.find((slide) => store.getFileIdByPath(slide.path) === fileId) ||
			store.slides[store.activeIndex]
		const targetIndex = currentSlide
			? findPPTSlideIndex(
					// Runtime links use workspace paths; slide config paths are deck-relative.
					store.slides.map((slide) => ({
						path: store.getFullRelativePath(slide.path) ?? slide.path,
					})),
					store.getFullRelativePath(currentSlide.path) ?? currentSlide.path,
					path,
				)
			: -1

		if (targetIndex >= 0) {
			void handleJumpToPage(targetIndex)
			return
		}

		openNewTab?.(fileId, path)
	})

	// 键盘导航 - 依赖 usePPTSidebar 返回的 isDeleteModalOpen
	useEffect(() => {
		function handleKeyDown(event: KeyboardEvent) {
			if (
				event.repeat ||
				event.defaultPrevented ||
				(event.target &&
					(event.target as Element).nodeType === 1 &&
					Boolean(
						(event.target as Element).closest(
							event.key === " "
								? "input, textarea, select, [contenteditable], [role=menuitem], button, a"
								: "input, textarea, select, [contenteditable], [role=menuitem]",
						),
					))
			) {
				return
			}

			if (
				isPresenterStarting ||
				transitionPanelOpen ||
				isAnySlideEditing ||
				isDeleteModalOpen ||
				deckTools.busy
			)
				return

			switch (event.key) {
				case "ArrowLeft":
				case "ArrowUp":
				case "PageUp":
					changeSlide("prev")
					break
				case "ArrowRight":
				case "ArrowDown":
				case "PageDown":
					changeSlide("next")
					break
				case "Home":
					event.preventDefault()
					void goToFirstSlide()
					break
				case "Escape":
					if (isPresenterConsole) closePresenterWindow()
					break
				case " ":
					if (isPresentationFullscreen || isPresenterConsole || isPlaybackMode) {
						event.preventDefault()
						changeSlide("next")
					}
					break
			}
		}

		window.addEventListener("keydown", handleKeyDown)
		const companion = presenterConsoleContainer?.ownerDocument.defaultView
		companion?.addEventListener("keydown", handleKeyDown)
		return () => {
			window.removeEventListener("keydown", handleKeyDown)
			companion?.removeEventListener("keydown", handleKeyDown)
		}
	}, [
		presenterConsoleContainer,
		goToFirstSlide,
		isPlaybackMode,
		isPresenterStarting,
		changeSlide,
		isPresentationFullscreen,
		isPresenterConsole,
		closePresenterWindow,
		isAnySlideEditing,
		isDeleteModalOpen,
		deckTools.busy,
		transitionPanelOpen,
	])

	// iframe postMessage 导航 - 依赖 usePPTSidebar 返回的 isDeleteModalOpen
	useEffect(() => {
		function handleMessage(event: MessageEvent) {
			if (!event.data || event.data.type !== "keyboardEvent" || event.data.repeat) return
			if (
				store.slides[store.activeIndex]?.content?.includes(PPT_BUILD_ATTRIBUTE) &&
				!buildNavigation.acceptsMessage(event)
			)
				return
			if (
				event.data.direction === "escape" &&
				(isPresenterStarting || isPresenterWindowOpen)
			) {
				closePresenterWindow()
				return
			}
			if (
				isPresenterStarting ||
				transitionPanelOpen ||
				isAnySlideEditing ||
				store.isTransitioning ||
				isDeleteModalOpen ||
				deckTools.busy
			)
				return

			const { direction } = event.data
			switch (direction) {
				case "prev":
				case "pageup":
					changeSlide("prev")
					break
				case "next":
				case "pagedown":
					changeSlide("next")
					break
				case "first":
					goToFirstSlide()
					break
			}
		}

		window.addEventListener("message", handleMessage)
		return () => window.removeEventListener("message", handleMessage)
	}, [
		changeSlide,
		goToFirstSlide,
		isPresenterStarting,
		isPresenterWindowOpen,
		closePresenterWindow,
		store.isTransitioning,
		isAnySlideEditing,
		isDeleteModalOpen,
		deckTools.busy,
		transitionPanelOpen,
	])

	const slideContainerRef = useRef<HTMLDivElement>(null)
	const shouldShowButtonText = useContainerShowButtonText(slideContainerRef, 700)

	const [liveRenderCacheSize] = useState(() => getPPTLiveRenderCacheSize())
	const localRenderScopeId = useId()
	const liveRenderScopeKey = mainFileId || `local-ppt-render:${localRenderScopeId}`
	const [toolbarModels, setToolbarModels] = useState<Map<string, PPTSlideToolbarModel>>(
		() => new Map(),
	)
	const toolbarHostRef = useRef<HTMLDivElement>(null)
	const handleToolbarModelChange = useCallback(
		(ownerKey: string, model: PPTSlideToolbarModel | null, token: object) => {
			setToolbarModels((currentModels) =>
				reconcilePPTSlideToolbarModels(currentModels, ownerKey, model, token),
			)
		},
		[],
	)
	const pinnedSlideKeys = store.slides
		.filter((slide) => {
			const fileId = store.getFileIdByPath(slide.path)
			return Boolean(fileId && store.getSlideEditingState(fileId))
		})
		.map(getLiveRenderSlideKey)
	const {
		residentSlides,
		presentedKey,
		pendingKey,
		warmSlideIndices,
		onSlideReadyChange,
		transitionState,
		registerTransitionLayer,
	} = usePPTLiveRenderCache({
		slides: store.slides,
		activeIndex: store.activeIndex,
		capacity: isPresentationFullscreen
			? Math.max(5, liveRenderCacheSize)
			: isMobile
				? 3
				: liveRenderCacheSize,
		neighborRadius: isPresentationFullscreen ? 2 : 1,
		scopeKey: liveRenderScopeKey,
		pinnedKeys: pinnedSlideKeys,
		transition: {
			// The resident stage moves into the audience window; its console preview is separate.
			enabled:
				isTabActive !== false &&
				Boolean(
					isPresentationFullscreen ||
					isPresenterWindowOpen ||
					isPlaybackMode ||
					!allowEdit,
				),
			getTransition: (slide) => getPPTTransition(store.transitions, slide.path),
			lifecycleKey: `${isPresentationFullscreen}:${isPresenterWindowOpen}:${isPlaybackMode}:${isTabActive}`,
		},
	})
	const scopedPresentedKey = presentedKey?.startsWith(`${liveRenderScopeKey}::`)
		? presentedKey
		: null
	const presentedToolbarModel = scopedPresentedKey
		? toolbarModels.get(scopedPresentedKey)
		: undefined
	// 上下两个当前页刷新入口共用版本恢复、更新提示和刷新状态；预备页切换中不能刷新旧页。
	const handleRefreshCurrentSlide = useMemoizedFn(() => {
		const toolbar = presentedToolbarModel?.props
		if (pendingKey || !toolbar?.showRefresh || !toolbar.onRefresh || toolbar.isRefreshing)
			return
		void runGuardedAction(toolbar.beforeAction, toolbar.onRefresh)
	})
	// Slide template projects manage their own template manifest and should not
	// expose the regular PPT template replacement flow.
	const isSlidesTemplateProject = Boolean(slideStructureAdapter)
	const canReplaceTemplate =
		!isSlidesTemplateProject &&
		effectiveAllowEdit &&
		!deckTools.busy &&
		(presentedToolbarModel?.props.isNewestVersion ?? true)

	const handleOpenTemplateReplacement = useMemoizedFn(() => {
		if (!canReplaceTemplate) return
		setTemplateReplacementTarget({ scope: "deck" })
	})
	const handleOpenSlideTemplateReplacement = useMemoizedFn((slideIndex: number) => {
		if (!canReplaceTemplate) return
		setTemplateReplacementTarget({ scope: "slide", slideIndex })
	})
	const handleConfirmTemplateReplacement = useMemoizedFn(
		async (template: OptionItem, target: SlidesTemplateReplacementTarget) => {
			if (!mainFileId || !mainFileName || !resolvedProjectId) return
			if (!(await ensureFileSavesSynced())) return
			const mainFile =
				attachmentList?.find((item: any) => item.file_id === mainFileId) ||
				({
					file_id: mainFileId,
					file_name: mainFileName,
					relative_file_path: mainFileName,
				} as any)
			const parentFolder = mainFile.parent_id
				? attachmentList?.find((item: any) => item.file_id === mainFile.parent_id)
				: undefined
			const targetSlide =
				target.scope === "slide"
					? (() => {
							const slide = store.slides[target.slideIndex]
							const slideFileId = slide
								? store.getFileIdByPath(slide.path)
								: undefined
							return slideFileId
								? attachmentList?.find(
										(item: any) => item.file_id === slideFileId,
									) ||
										({
											file_id: slideFileId,
											file_name: slide?.title || slide?.path,
											relative_file_path: slide?.path,
										} as any)
								: undefined
						})()
					: undefined
			const payload = buildSlidesTemplateReplacementPayload({
				template,
				target,
				mainFile,
				parentFolder,
				targetSlide,
			})
			setTemplateReplacementTarget(null)
			pubsub.publish(PubSubEvents.Create_New_Topic, payload)
		},
	)

	useLayoutEffect(() => {
		activeInspectorPickingRef.current = Boolean(presentedToolbarModel?.props.isAppendPicking)
		activeInspectorExitRef.current = presentedToolbarModel?.props.beforeAction ?? null

		return () => {
			activeInspectorPickingRef.current = false
			activeInspectorExitRef.current = null
		}
	}, [presentedToolbarModel])

	useLayoutEffect(() => {
		const host = toolbarHostRef.current as (HTMLDivElement & { inert?: boolean }) | null
		if (!host) return

		host.inert = Boolean(pendingKey)
		if (pendingKey && host.contains(document.activeElement)) {
			;(document.activeElement as HTMLElement | null)?.blur?.()
		}
	}, [pendingKey, presentedToolbarModel])
	// Normal viewer mode explicitly prepares the two live neighbors without generating screenshots.
	// Fullscreen already owns a wider adaptive HTML preload window in PPTStore.
	useEffect(() => {
		if (isPresentationFullscreen || !store.isAutomaticLoadingEnabled) return

		warmSlideIndices.forEach((index) => {
			void store.ensureSlideContent(index, "preview")
		})
	}, [isPresentationFullscreen, store, store.isAutomaticLoadingEnabled, warmSlideIndices])

	const hasSlides = store.slideUrls.length > 0
	const activeSlideIndex = store.activeIndex

	// 识别“待初始化窗口”：slidePaths 已就绪，但 store 还未灌入 slides
	// 这个窗口出现在首帧渲染到 useDeepCompareEffect 触发之间
	const isPendingInit = slidePaths.length > 0 && store.slides.length === 0
	// 加载层优先级高于空态，避免初始化瞬间误显示“无 PPT 页面”
	const isLoadingOverlayVisible = !store.isReady || isPendingInit
	// 仅在真正初始化完成且无可用页面时展示空态
	const isNoSlidesFallbackVisible = store.isReady && !isPendingInit && !hasSlides

	// 手动保存处理函数 - 使用 useMemoizedFn 避免每次渲染重新创建
	const handleManualSave = useMemoizedFn(
		async (saveResult: ManualSaveResult | undefined, index: number) => {
			if (!saveResult) return
			const cleanContent = saveResult.cleanContent || ""

			if (saveResult.fileId) store.markSlideAsManuallySaved(saveResult.fileId)
			// 保存后的原始 HTML 需要先经过 PPT 资源路径处理，否则缩略图会用未解析的背景资源截图。
			const processedContent = await store.updateSlideContent(index, cleanContent)
			const thumbnailContent = processedContent || cleanContent
			// Thumbnail work must not block leaving edit mode or the next action.
			void store.generateSlideScreenshot(index, thumbnailContent).catch((error) => {
				console.error(error)
			})
		},
	)

	const registerCloseSaveHandler = useMemoizedFn((handler: (() => Promise<boolean>) | null) => {
		activeSlideCloseSaveHandlerRef.current = handler
	})

	const registerDiscardHandlerForClose = useMemoizedFn(
		(handler: (() => Promise<boolean>) | null) => {
			activeSlideDiscardHandlerRef.current = handler
		},
	)

	const registerDiscardHandler = useMemoizedFn((handler: (() => Promise<boolean>) | null) => {
		registerDiscardHandlerForNavigation(handler)
		registerDiscardHandlerForClose(handler)
	})

	const handleCheckBeforeClose = useMemoizedFn(async (): Promise<boolean> => {
		if (transitionCloseGuardRef.current && !(await transitionCloseGuardRef.current()))
			return false
		const flushUnsynced = () => ensureFileSavesSynced()

		if (!isAnySlideEditing) {
			return await flushUnsynced()
		}

		return await new Promise<boolean>((resolve) => {
			const fileName = mainFileName || t("common.untitledFile")

			const handleDirectClose = async () => {
				try {
					const didDiscard = activeSlideDiscardHandlerRef.current
						? await activeSlideDiscardHandlerRef.current()
						: true
					if (!didDiscard) return
					if (!(await flushUnsynced())) return

					modal.destroy()
					resolve(true)
				} catch (error) {
					console.error("Failed to discard slide changes before close:", error)
				}
			}

			const handleSaveAndClose = async () => {
				try {
					const didSave = activeSlideCloseSaveHandlerRef.current
						? await activeSlideCloseSaveHandlerRef.current()
						: true
					if (!didSave) return
					if (!(await flushUnsynced())) return

					modal.destroy()
					resolve(true)
				} catch (error) {
					console.error("Failed to save slide before close:", error)
				}
			}

			const menuItems: MenuProps["items"] = [
				{
					key: "directClose",
					label: t("detail.directClose"),
					onClick: () => {
						void handleDirectClose()
					},
				},
			]

			const modal = MagicModal.confirm({
				title: t("detail.closeEditingFilePrompt", { fileName }),
				content: t("detail.closeEditingFileContent"),
				cancelText: t("common.cancel"),
				closable: false,
				maskClosable: false,
				centered: true,
				footer: (_, { CancelBtn }) => (
					<div className={cn("flex items-center justify-end gap-2 px-4 pb-4")}>
						<CancelBtn />
						{activeSlideCloseSaveHandlerRef.current ? (
							<MagicDropdown menu={{ items: menuItems }} trigger={["hover"]}>
								<span>
									<Button onClick={() => void handleSaveAndClose()}>
										{t("detail.saveAndClose")}
										<ChevronDown className="ml-1 size-4" />
									</Button>
								</span>
							</MagicDropdown>
						) : (
							<Button onClick={() => void handleDirectClose()}>
								{t("common.confirm")}
							</Button>
						)}
					</div>
				),
				onCancel: () => {
					modal.destroy()
					resolve(false)
				},
			})
		})
	})

	useEffect(() => {
		if (!mainFileId || !onRegisterCheckBeforeClose) return

		onRegisterCheckBeforeClose(mainFileId, handleCheckBeforeClose)

		return () => {
			onUnregisterCheckBeforeClose?.(mainFileId)
		}
	}, [
		handleCheckBeforeClose,
		mainFileId,
		onRegisterCheckBeforeClose,
		onUnregisterCheckBeforeClose,
	])

	const speakerNotesPanel = store.currentSlide ? (
		<PPTSpeakerNotesPanel
			onPendingChangesChange={setNotesPending}
			layout={isPresenterConsole ? "presenter" : "default"}
			visible={isPresenterConsole || isPresenterView || pptNotesPreferenceStore.visible}
			slides={store.slides.map((slide, slideIndex) => ({
				key: store.getFileIdByPath(slide.path) || slide.path,
				fileId: store.getFileIdByPath(slide.path) || "",
				slideIndex,
				rawContent: slide.rawContent,
				loadingError: slide.loadingState === "error",
			}))}
			onLoadSlide={(key) => {
				const index = store.slides.findIndex(
					(slide) => (store.getFileIdByPath(slide.path) || slide.path) === key,
				)
				return store.ensureSlideContent(index)
			}}

			slideIndex={activeSlideIndex}
			rawContent={store.currentSlide.rawContent || ""}
			fileId={store.getFileIdByPath(store.currentSlide.path) || ""}
			getLatestRawContent={(fileId) =>
				store.slides.find((slide) => store.getFileIdByPath(slide.path) === fileId)
					?.rawContent || ""
			}
			allowEdit={
				effectiveAllowEdit && !deckTools.busy && !isPlaybackMode && !isPresenterConsole
			}
			saveEditContent={saveEditContent}
			onSaved={(nextContent, fileId) =>
				Promise.resolve(store.updateSlideNotes(fileId, nextContent)).then(() => undefined)
			}
			onGenerate={effectiveAllowEdit ? handleGenerateSpeakerNotes : undefined}
		/>
	) : null

	return (
		<>
			<div
				ref={containerRef}
				data-testid="ppt-render-container"
				data-presenter-console={isPresenterConsole ? "true" : undefined}
				data-mobile-fullscreen={
					isMobile && isSingleWindowFullscreen ? "landscape" : undefined
				}
				className={
					isSingleWindowFullscreen || isPresenterConsole
						? `fixed inset-0 ${TAILWIND_Z_INDEX_CLASSES.FULLSCREEN.CONTAINER} flex flex-row bg-black`
						: "relative h-full w-full overflow-hidden"
				}
			>
				{/* Fullscreen hides the regular bar; keep an always-visible exit target on touch screens. */}
				{isPresentationFullscreen && !isPresenterConsole && (
					<Button
						variant="ghost"
						size="icon"
						data-testid="ppt-render-fullscreen-exit-button"
						className="absolute right-3 top-3 z-50 h-9 w-9 bg-black/45 text-white hover:bg-black/65 hover:text-white"
						onClick={() => {
							if (isPresenterStarting || isPresenterWindowOpen) closePresenterWindow()
							else void togglePresentationFullscreen()
						}}
						aria-label={t("fileViewer.exitFullscreen")}
					>
						<Minimize className="h-4 w-4" />
					</Button>
				)}
				{isSidebarEffectivelyCollapsed &&
					!isSingleWindowFullscreen &&
					!isPresenterConsole && (
						<MagicTooltip title={t("fileViewer.expandSidebar")}>
							<Button
								variant="ghost"
								size="icon"
								data-testid="ppt-render-expand-sidebar-button"
								className={cn(
									"absolute z-10 h-8 w-8 shrink-0 border border-border bg-white text-foreground shadow-sm dark:bg-card",
									isMobile ? "bottom-2 left-2" : "left-2 top-2",
								)}
								onClick={() => setIsSidebarCollapsed(false)}
							>
								<PanelLeftOpen className="h-4 w-4" />
							</Button>
						</MagicTooltip>
					)}

				<div
					className={cn(
						"relative flex h-full w-full",
						isMobile ? "flex-col-reverse" : "flex-row",
					)}
				>
					{/* 侧边栏 - 桌面端在左侧，移动端在顶部 */}
					{!isPresenterConsole && (
						<div
							data-testid="ppt-render-sidebar"
							className={cn(
								"shrink-0 overflow-hidden",
								!isResizing && "transition-all duration-300 ease-in-out",
								isMobile
									? isSidebarEffectivelyCollapsed || isSingleWindowFullscreen
										? "h-0"
										: "h-[140px]"
									: "",
							)}
							style={{
								width: !isMobile
									? isSidebarEffectivelyCollapsed || isSingleWindowFullscreen
										? 0
										: sidebarWidth
									: undefined,
							}}
						>
							<div
								style={{
									width: isMobile ? "100%" : sidebarWidth,
									height: isMobile ? "140px" : "100%",
								}}
							>
								<PPTSidebar
									onOpenTransitions={
										canConfigureTransitions ? openTransitions : undefined
									}
									onOpenFile={openNewTab}
									tools={slideStructureAdapter ? undefined : deckTools}
									hiddenPaths={hiddenPaths}
									onSlideClick={handleSlideClick}
									onSortChange={
										effectiveAllowEdit && !deckTools.busy
											? slideStructureAdapter
												? handleSortChange
												: (slides) => {
														void deckTools.reorder(
															slides.map((slide) => slide.path),
														)
													}
											: undefined
									}
									onInsertSlide={
										effectiveAllowEdit && !deckTools.busy
											? insertSlide
											: undefined
									}
									onDuplicateSlide={
										effectiveAllowEdit && !deckTools.busy
											? duplicateSlide
											: undefined
									}
									onDeleteSlide={
										effectiveAllowEdit && !deckTools.busy
											? removeSlide
											: undefined
									}
									onRenameSlide={
										effectiveAllowEdit && !deckTools.busy
											? renameSlide
											: undefined
									}
									onRefreshSlide={
										effectiveAllowEdit ? handleRefreshSlide : undefined
									}
									onRegenerateScreenshot={handleRegenerateScreenshot}
									onAddToCurrentChat={handleAddToCurrentChat}
									onAddToNewChat={handleAddToNewChat}
									isMobile={isMobile}
									sidebarWidth={sidebarWidth}
									allowEdit={effectiveAllowEdit}
									canReplaceTemplate={canReplaceTemplate}
									onReplaceSlideTemplate={handleOpenSlideTemplateReplacement}
									isCollapsed={isSidebarEffectivelyCollapsed}
									isPreviewLoadingEnabled={
										!isSidebarEffectivelyCollapsed && !isSingleWindowFullscreen
									}
									onCollapsedChange={handleSidebarCollapsedChange}
								/>
							</div>
						</div>
					)}

					{/* Width handle stays below the canvas stacking context. */}
					{!isPresenterConsole &&
						!isMobile &&
						!isSidebarEffectivelyCollapsed &&
						!isSingleWindowFullscreen && (
							<div
								data-testid="ppt-render-sidebar-resize-handle"
								className={cn(
									"absolute bottom-0 top-0 w-4 -translate-x-1/2 cursor-col-resize bg-transparent",
									TAILWIND_Z_INDEX_CLASSES.BASE.SIDEBAR_RESIZE,
								)}
								style={{ left: sidebarWidth }}
								onMouseDown={handleResizeStart}
							/>
						)}

					{/* 主内容区 - flex-1 占据剩余空间 */}
					<div
						ref={slideContainerRef}
						data-testid="ppt-render-slide-content"
						className={cn(
							"flex min-h-0 min-w-0 flex-1",
							isMobile && "flex-col",
							isPresenterConsole && "bg-muted/30 p-4",
							!isSidebarEffectivelyCollapsed &&
								!isSingleWindowFullscreen &&
								`relative ${TAILWIND_Z_INDEX_CLASSES.BASE.SLIDE_CANVAS}`,
						)}
					>
						<div
							className={cn(
								"relative flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden",
								isPresenterConsole &&
									"grid grid-cols-[minmax(0,3fr)_minmax(0,2fr)] grid-rows-[minmax(0,1fr)_minmax(0,1fr)_auto] gap-4",
							)}
							tabIndex={0}
							aria-label={
								hasSlides
									? `Slide ${store.activeIndex + 1} of ${store.slideUrls.length}`
									: t("ppt.noSlidesAvailable")
							}
							data-testid="ppt-render-div"
							data-pending-slide={pendingKey || undefined}
						>
							{/* 加载状态覆盖工具栏和画布，保持初始化阶段的原有遮罩语义。 */}
							{isLoadingOverlayVisible && (
								<div
									data-testid="ppt-render-loading"
									className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-background/80 backdrop-blur-sm"
								>
									<div className="flex items-center gap-2">
										<MagicSpin spinning wrapperClassName="w-auto" />
										<TextAnimation dotwaveAnimation>
											{t("ppt.loading")}
										</TextAnimation>
										{store.loadingProgress > 0 && (
											<p className="text-xs text-muted-foreground">
												{store.loadingProgress}%
											</p>
										)}
									</div>
								</div>
							)}

							{presentedToolbarModel && !isPresenterConsole && (
								<div
									ref={toolbarHostRef}
									data-testid="ppt-render-edit-toolbar"
									data-toolbar-owner={scopedPresentedKey || undefined}
									aria-busy={Boolean(pendingKey) || deckTools.busy}
									className="min-w-0 flex-shrink-0"
									style={{
										pointerEvents:
											pendingKey || deckTools.busy ? "none" : "auto",
									}}
								>
									{/* Keep permission-based actions mounted while a deck write locks interaction. */}
									<fieldset
										disabled={deckTools.busy}
										className="min-w-0 border-0 p-0 disabled:opacity-50"
									>
										<EditToolbar
											key={liveRenderScopeKey}
											{...presentedToolbarModel.props}
											isFullscreen={
												onFileFullscreen
													? isFileFullscreen
													: isPresentationFullscreen ||
														isPresenterWindowOpen
											}
											getPopupContainer={() => containerRef.current}
											interactionDisabled={
												Boolean(pendingKey) || deckTools.busy
											}
											testIdsEnabled={isTabActive !== false}
										/>
									</fieldset>
								</div>
							)}

							{/* z-0 traps the control bar z-50 so overlay notes can cover it. */}
							<div
								ref={presentationStageRef}
								data-testid="ppt-render-slide-stage"
								data-hidden-slide={
									isPresenterConsole &&
									!visibleSlideIndices.includes(store.activeIndex)
										? "true"
										: undefined
								}
								className={cn(
									"relative z-0 min-h-0 w-full flex-1 overflow-hidden data-[hidden-slide=true]:[&>div]:invisible",
									!isPresenterView &&
										!isPresenterConsole &&
										"bg-[#eeeeee] dark:bg-[#2b2b2b]",
									isPresenterConsole &&
										"col-start-1 row-span-2 rounded-xl border border-border/60 bg-black",
									isPresenterView && "bg-black",
								)}
							>
								{/* 调整宽度时覆盖层防止 iframe 拦截鼠标事件 */}
								{isResizing && (
									<div className="absolute inset-0 z-50 bg-transparent" />
								)}

								{isNoSlidesFallbackVisible && (
									<div
										data-testid="ppt-render-empty"
										className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-6 bg-background/80 backdrop-blur-sm"
									>
										<div className="flex flex-col items-center gap-2 text-center">
											<Presentation className="h-16 w-16 text-foreground" />
											<h3 className="text-xl font-medium text-foreground">
												{t("fileViewer.noSlidesTitle")}
											</h3>
											<p className="max-w-[300px] text-sm text-muted-foreground">
												{effectiveAllowEdit
													? t("fileViewer.emptyStateDescription")
													: ""}
											</p>
										</div>

										{effectiveAllowEdit && (
											<Button
												data-testid="ppt-render-create-first-slide-button"
												onClick={() => insertSlide(0, "after")}
												className="gap-2"
												size="lg"
											>
												<Plus className="h-4 w-4" />
												{t("fileViewer.createFirstSlide")}
											</Button>
										)}
									</div>
								)}

								{residentSlides.map(({ slide, index, key, revision }) => {
									const slideFileId = store.getFileIdByPath(slide.path) || ""
									const slideFileItem = attachmentList?.find(
										(item) => item.file_id === slideFileId,
									)
									const slideHtmlRelativeFolderPath =
										getHtmlRelativeFolderPath(slideFileItem)
									return (
										<PPTLinkContext.Provider
											key={key}
											value={{
												currentSlidePath: slide.path,
												slides: store.slides,
											}}
										>
											<PPTSlide
												buildPanelOpen={
													buildPanelOpen && index === store.activeIndex
												}
												onBuildPanelOpenChange={setBuildPanelOpen}
												showRefresh={showRefresh}
												buildStartAtEnd={buildNavigation.startAtEnd.current}
												onBuildControllerChange={(controller) =>
													buildNavigation.register(slide.path, controller)
												}
												onBuildAction={() => void changeSlide("next")}
												index={index}
												isActive={index === store.activeIndex}
												isPresented={
													key === presentedKey &&
													(!(
														isPresentationFullscreen ||
														isPresenterWindowOpen ||
														isPlaybackMode
													) ||
														!hiddenPaths.has(slide.path))
												}
												isTabActive={isTabActive}
												toolbarOwnerKey={key}
												transitionRole={
													key === transitionState?.incomingKey
														? "incoming"
														: key === transitionState?.outgoingKey
															? "outgoing"
															: undefined
												}
												onTransitionLayerChange={registerTransitionLayer}
												onToolbarModelChange={handleToolbarModelChange}
												content={slide.content || ""}
												rawContent={slide.rawContent || ""}
												renderRevision={revision}
												loadingState={slide.loadingState}
												loadingError={slide.loadingError}
												isFullscreen={isPresentationFullscreen}
												isPlaybackMode={
													isPlaybackMode || isPresenterConsole
												}
												manualScale={
													isPresenterConsole ? null : manualScale
												}
												onManualScaleChange={handleManualScaleChange}
												onScaleRatioChange={setActiveSlideScaleRatio}
												onRenderReadyChange={(ready) =>
													onSlideReadyChange(key, revision, ready)
												}
												saveEditContent={saveEditContent}
												fileId={slideFileId}
												projectId={resolvedProjectId}
												filePathMapping={filePathMapping}
												openNewTab={handleOpenNewTab}
												htmlRelativeFolderPath={slideHtmlRelativeFolderPath}
												selectedProject={selectedProject}
												attachmentList={attachmentList}
												processSource={(sourceContent) =>
													store.processSlideSource(index, sourceContent)
												}
												fileApi={fileApi}
												attachments={attachments}
												updateSlideContents={(
													newContents: Map<number, string>,
												) => {
													store.updateSlideContents(newContents)
												}}
												allowEdit={
													effectiveAllowEdit && !isPresenterConsole
												}
												showButtonText={shouldShowButtonText}
												onEditModeChange={(isEditing) =>
													handleEditModeChange(slideFileId, isEditing)
												}
												onRegisterSaveHandler={
													index === store.activeIndex
														? registerSaveHandler
														: undefined
												}
												onRegisterDiscardHandler={
													index === store.activeIndex
														? registerDiscardHandler
														: undefined
												}
												onRegisterCloseSaveHandler={
													index === store.activeIndex
														? registerCloseSaveHandler
														: undefined
												}
												serverUpdatedContent={store.getSlideServerUpdate(
													slideFileId,
												)}
												onClearServerUpdate={() => {
													store.clearSlideServerUpdate(slideFileId)
												}}
												onRefreshSlide={handleRefreshSlide}
												onManualSave={handleManualSave}
												mainFileId={mainFileId}
												mainFileName={mainFileName}
												allowDownload={allowDownload}
												onSwipe={(direction) => {
													void changeSlide(direction)
												}}
											/>
										</PPTLinkContext.Provider>
									)
								})}

								{/* 控制栏只覆盖幻灯片画布，不覆盖画布下方的备注区域。 */}
								{!isPresenterConsole &&
									(!isAnySlideEditing || canConfigureTransitions) &&
									!isPresentationFullscreen &&
									presentedToolbarModel?.props.viewMode !== "code" &&
									store.isReady &&
									hasSlides && (
										<PPTControlBar
											rightInset={
												buildPanelOpen && canConfigureTransitions
													? "calc(min(18rem, 45%) + 0.5rem)"
													: undefined
											}
											animationOnly={isAnySlideEditing}
											buildPanelOpen={buildPanelOpen}
											onToggleBuildPanel={
												canConfigureTransitions
													? toggleBuildPanel
													: undefined
											}
											buildProgress={buildNavigation.progress}
											onOpenTransitions={
												canConfigureTransitions
													? () => openTransitions(store.activeIndex)
													: undefined
											}
											canGoPrevious={
												isPresentationFullscreen || isPlaybackMode
													? buildNavigation.progress.step > 0 ||
														visibleSlideIndices.some(
															(index) => index < store.activeIndex,
														)
													: undefined
											}
											canGoNext={
												isPresentationFullscreen || isPlaybackMode
													? buildNavigation.progress.step <
															buildNavigation.progress.total ||
														nextVisibleIndex >= 0
													: undefined
											}
											notesVisible={
												isPresenterView ||
												isPresenterWindowOpen ||
												pptNotesPreferenceStore.visible
											}
											onToggleNotes={
												store.currentSlide
													? pptNotesPreferenceStore.toggle
													: undefined
											}
											activeIndex={store.activeIndex}
											totalSlides={store.slideUrls.length}
											isTransitioning={
												store.isTransitioning || isPresenterStarting
											}
											isMobile={isMobile}
											isStarting={isPresenterStarting}
											isFullscreen={
												isPresentationFullscreen || isPresenterWindowOpen
											}
											onPrevSlide={() => changeSlide("prev")}
											onNextSlide={() => changeSlide("next")}
											onGoToFirstSlide={goToFirstSlide}
											onRefreshSlides={handleRefreshAllSlides}
											refreshAllProgress={refreshAllProgress}
											onRefreshCurrentSlide={
												!pendingKey &&
												presentedToolbarModel?.props.showRefresh
													? handleRefreshCurrentSlide
													: undefined
											}
											isRefreshingCurrentSlide={Boolean(
												presentedToolbarModel?.props.isRefreshing,
											)}
											onJumpToPage={handleJumpToPage}
											onToggleFullscreen={togglePresenter}
											presenterScreens={
												isPresenterWindowOpen ? presenterScreens : undefined
											}
											selectedPresenterScreen={selectedPresenterScreen}
											onSelectPresenterScreen={(index) => {
												// The companion delegates activation from its own click listener.
												if (!presenterConsoleContainer)
													void movePresenterToScreen(index)
											}}
											onReplaceTemplate={
												canReplaceTemplate
													? handleOpenTemplateReplacement
													: undefined
											}
											scaleRatio={activeSlideScaleRatio}
											isAutoScale={manualScale === null}
											portalContainer={containerRef.current}
											onScaleChange={handleManualScaleChange}
											onResetScale={() => handleManualScaleChange(null)}
											currentFileId={
												store.currentSlide
													? store.getFileIdByPath(store.currentSlide.path)
													: undefined
											}
										/>
									)}
							</div>

							{presenterConsoleContainer ? (
								createPortal(
									<PPTPresenterLayout
										current={
											<PPTPresenterNextSlide
												current
												content={store.currentSlide?.content}
												rawContent={store.currentSlide?.rawContent}
												isLastSlide={false}
											/>
										}
										next={
											<PPTPresenterNextSlide
												content={store.slides[nextVisibleIndex]?.content}
												loadingError={
													store.slides[nextVisibleIndex]?.loadingState ===
													"error"
												}
												onRetry={() =>
													void store.ensureSlideContent(nextVisibleIndex)
												}
												rawContent={
													store.slides[nextVisibleIndex]?.rawContent
												}
												isLastSlide={nextVisibleIndex < 0}
											/>
										}

										controls={
											(isPresenterStarting ||
												(store.isReady && hasSlides)) && (
												<PPTPresenterConsoleControls
													buildProgress={buildNavigation.progress}
													canGoPrevious={
														buildNavigation.progress.step > 0 ||
														visibleSlideIndices.some(
															(index) => index < store.activeIndex,
														)
													}
													canGoNext={
														buildNavigation.progress.step <
															buildNavigation.progress.total ||
														nextVisibleIndex >= 0
													}
													isStarting={isPresenterStarting}
													activeIndex={store.activeIndex}
													totalSlides={store.slideUrls.length}
													isTransitioning={store.isTransitioning}
													screens={presenterScreens}
													selectedScreen={selectedPresenterScreen}
													onPrevSlide={() => void changeSlide("prev")}
													onNextSlide={() => void changeSlide("next")}
													onJumpToPage={handleJumpToPage}
													onSelectScreen={(index) => {
														// The companion delegates activation from its own click listener.
														if (!presenterConsoleContainer)
															void movePresenterToScreen(index)
													}}
													onExit={closePresenterWindow}
												/>
											)
										}
										notes={speakerNotesPanel}
										filmstrip={
											<PPTPresenterFilmstrip
												slides={store.slides}
												indices={visibleSlideIndices}
												activeIndex={store.activeIndex}
												disabled={
													store.isTransitioning || isPresenterStarting
												}
												onSelect={handleJumpToPage}
												onLoad={(index) =>
													void store.ensureSlideContent(index)
												}
											/>
										}
									/>,
									presenterConsoleContainer,
								)
							) : (
								<>
									{!isSingleWindowFullscreen &&
										store.isReady &&
										hasSlides &&
										store.currentSlide &&
										speakerNotesPanel}
								</>
							)}
						</div>
						<PPTTransitionPanel
							key={transitionPanelSession}
							open={transitionPanelOpen}
							onOpenChange={setTransitionPanelOpen}
							deckKey={liveRenderScopeKey}
							slides={store.slides.map((slide, index) => ({
								path: slide.path,
								label: t("ppt.batch.page", { page: index + 1 }),
							}))}
							activePath={transitionTarget.path}
							previewSource={{
								current: getTransitionPreviewSlide(transitionPreviewIndex),
								previous: getTransitionPreviewSlide(transitionPreviousIndex),
								filePathMapping,
								projectId: resolvedProjectId,
							}}
							selectedPaths={store.slides
								.filter((slide) =>
									deckTools.selected.has(store.getFileIdByPath(slide.path) || ""),
								)
								.map((slide) => slide.path)}
							config={store.transitions}
							busy={deckTools.busy}
							initialScope={transitionTarget.scope}
							onSave={saveTransitions}
							registerBeforeClose={registerTransitionCloseGuard}
						/>
					</div>
				</div>
			</div>

			<Suspense fallback={null}>
				<SlidesTemplateReplacementDialog
					open={templateReplacementTarget !== null}
					target={templateReplacementTarget}
					onOpenChange={(open) => {
						if (!open) setTemplateReplacementTarget(null)
					}}
					onConfirm={handleConfirmTemplateReplacement}
				/>
			</Suspense>

			{/* 导航确认对话框 */}
			<AlertDialog open={showNavigationDialog} onOpenChange={setShowNavigationDialog}>
				<AlertDialogContent
					data-testid="ppt-render-navigation-dialog"
					onCloseAutoFocus={(event) => {
						// A controlled confirmation has no Trigger; return focus to its initiating control.
						event.preventDefault()
						if (navigationFocusRef.current?.isConnected)
							navigationFocusRef.current.focus()
					}}
				>
					<AlertDialogHeader>
						<AlertDialogTitle>{t("ppt.navigationConfirmTitle")}</AlertDialogTitle>
						<AlertDialogDescription>
							{t("ppt.navigationConfirmDescription", { page: targetPageNumber })}
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-end">
						<AlertDialogCancel
							data-testid="ppt-render-navigation-dialog-cancel"
							onClick={handleCancelNavigation}
							disabled={isSavingForNavigation}
						>
							{t("common.cancel")}
						</AlertDialogCancel>
						<AlertDialogAction
							data-testid="ppt-render-navigation-dialog-discard"
							onClick={handleDiscardAndNavigate}
							disabled={isSavingForNavigation}
							className="bg-secondary text-secondary-foreground hover:bg-secondary/80"
						>
							{t("ppt.discardAndNavigate")}
						</AlertDialogAction>
						<AlertDialogAction
							data-testid="ppt-render-navigation-dialog-save"
							onClick={handleSaveAndNavigate}
							disabled={isSavingForNavigation}
						>
							{isSavingForNavigation ? t("ppt.saving") : t("ppt.saveAndNavigate")}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	)
})

export default PPTRender
