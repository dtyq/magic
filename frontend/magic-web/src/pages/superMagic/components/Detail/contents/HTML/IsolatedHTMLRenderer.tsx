import { createStyles } from "antd-style"
import {
	type Ref,
	useEffect,
	useRef,
	useState,
	forwardRef,
	useImperativeHandle,
	useMemo,
	useLayoutEffect,
	useCallback,
} from "react"
import { useDeepCompareEffect, useMemoizedFn } from "ahooks"
import { filterInjectedTags, preserveOriginalTrailingNewline } from "./utils"
import { getHtmlSandboxRuntimeUrl } from "./utils/html-sandbox-runtime-url"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import { useIsMobile } from "@/hooks/useIsMobile"
import { superMagicUploadTokenService } from "@/pages/superMagic/components/MessageEditor/services/UploadTokenService"
import { genFileData } from "@/pages/chatNew/components/MessageEditor/components/InputFiles/utils"
import { useUpload } from "@/hooks/useUploadFiles"
import { useFileAccess } from "@/pages/superMagic/fileAccess/FileAccessProvider"
import { useFileApi } from "@/pages/superMagic/fileAccess/fileApi"
import { useTranslation } from "react-i18next"
import { addContentToChat } from "@/pages/superMagic/components/Detail/components/AIOptimization/utils"
import { decodeHTMLEntities, getFullContent } from "./utils/full-content"
import { syncDevicePreviewScrollbars } from "./utils/device-preview-scrollbars"
import { extractStaticDependencies } from "./utils/extractDependencies"
import {
	buildHtmlVirtualStorageNamespace,
	createVirtualStorageContext,
	virtualStorageRegistry,
	type VirtualStorageRuntimeContext,
} from "./utils/virtual-storage"
import {
	clearIframeRenderLifecycleTimeout,
	createIframeRenderLifecycleState,
	mapSandboxTelemetryToLifecycleReport,
	reportIframeRenderLifecycleStage,
	startIframeRenderLifecycleSession,
	type IframeRenderLifecycleStage,
	type IframeRenderLifecycleContext,
} from "./telemetry/iframeRenderLifecycle"
import {
	HTML_SANDBOX_TELEMETRY_MESSAGE,
	normalizeHtmlSandboxTelemetryMessage,
} from "@dtyq/html-sandbox"
import { useMediaScenario } from "./media/useMediaScenario"
import { handleMediaImageUrlRequest, MEDIA_MESSAGE_TYPES } from "./media/utils"
import { cn } from "@/utils/cn"
import { StylePanel } from "./components/StylePanel"
import type { HTMLEditorV2Ref, SaveResult } from "./iframe-bridge/types/props"
import type {
	ImageUploadRequestPayload,
	ImageUploadResultPayload,
} from "./iframe-bridge/types/messages"
import { useHTMLEditorV2 } from "./hooks/useHTMLEditorV2"
import { preserveSlideNotesFromSource } from "../../components/PPTRender/utils/slideNotes"
import { useImageDrop } from "./hooks/useImageDrop"
import { SelectionOverlay } from "./components/SelectionOverlay"
import { DropOverlay } from "./components/DropOverlay"
import { useZoomControls } from "./hooks/useZoomControls"
import { StylePanelStoreProvider } from "./iframe-bridge/contexts/StylePanelContext"
import { DevConsolePanel } from "./components/DevConsole"
import { ElementContextPanel } from "./components/ElementContextPanel"
import { DOMTreePanel } from "./components/DOMTreePanel"
import { EditorSidebar } from "./components/EditorSidebar"
import { shouldCollapseStylesOnBlur } from "./components/EditorSidebar/sidebarSelection"
import { MoreStylesPanel } from "./components/StylePanel/MoreStylesPanel"
import type { DevConsoleLayout } from "./components/DevConsole/types"
import { useDevConsole } from "./hooks/useDevConsole"
import { usePreviewDocumentRevision } from "./hooks/usePreviewDocumentRevision"
import { platformKey } from "@/utils/storage"
import { waitForProjectAttachmentChange } from "@/pages/superMagic/utils/projectAttachments/attachmentMutationWaiter"
import { useCurrentHtmlFileInfo } from "./hooks/useCurrentHtmlFileInfo"
import { useInspectorToolbarMode } from "./hooks/useInspectorToolbarMode"
import {
	useElementInspector,
	ElementInspectorOverlay,
} from "@/components/business/ElementInspector"
import type { CanonicalContentDimensions } from "./utils/slide-dimensions"
import { DevicePreviewViewport } from "../../components/DevicePreview/DevicePreviewViewport"
import { DEFAULT_DEVICE_PREVIEW } from "../../components/DevicePreview/constants"
import type { DevicePreviewControls } from "../../components/DevicePreview/types"
import { getIframeFileList } from "./utils/file-utils"

/**
 * Nested HTML documents may relay navigation directly to the host window. Check
 * that such a source actually belongs to the current iframe before accepting it.
 */
function isNestedIframeSource(
	rootWindow: Window | null | undefined,
	source: MessageEventSource | null,
): boolean {
	if (!rootWindow || !source || source === rootWindow) return false

	const visited = new Set<Window>()
	const visit = (currentWindow: Window): boolean => {
		if (visited.has(currentWindow)) return false
		visited.add(currentWindow)

		try {
			for (let index = 0; index < currentWindow.frames.length; index += 1) {
				const childWindow = currentWindow.frames[index]
				if (childWindow === source) return true
				if (visit(childWindow)) return true
			}
		} catch {
			// Cross-origin frame trees expose only a restricted WindowProxy surface.
			// If the tree cannot be inspected, fail closed for nested messages.
			return false
		}

		return false
	}

	return visit(rootWindow)
}

export interface IsolatedHTMLRendererRef {
	getIframeElement: () => HTMLIFrameElement | null
	getEditorRef: () => React.RefObject<HTMLEditorV2Ref> | null
	/** Close the element context panel without leaving HTML edit mode. */
	closeElementContextPanel?: () => boolean
	resetContent: () => void
	/** Recreate the iframe document so page scripts and animations run from the start. */
	restartDocument?: () => void
	updateContent: (
		newContent: string,
		options?: {
			restoreSelectionMode?: boolean
		},
	) => void
	getContent: () => Promise<string | null>
	getFetchInterceptedCallback: () => OnFetchIntercepted | undefined
	toggleDevConsole: () => void
	/** Start element inspector in toolbar mode (no info card; selection creates new topic) */
	startInspector: () => void
	/** Stop element inspector mode */
	stopInspector: () => void
	/** Ask the user before discarding pending AI selection targets. */
	requestInspectorExit?: () => Promise<boolean>
	/** Consume Escape when the AI selection flow is active. */
	consumeInspectorEscape?: () => boolean
	/** Start element inspector in append mode (selection enters the multi-target draft flow) */
	startInspectorAppend: () => void
	/** Start immediate element selection and append the Tiptap detail node to the input. */
	startInspectorQuickSelect?: () => void
}
//HTML预览增强组件 iframe里面的内容尺寸，用于计算缩放比例
export interface IsolatedHTMLRendererContentMetrics {
	contentWidth: number
	contentHeight: number
	phase?: "initial" | "settled"
	hasHorizontalOverflow?: boolean
	hasVerticalOverflow?: boolean
	verticalScrollbarWidth?: number
}
import magicToast from "@/components/base/MagicToaster/utils"
import {
	resolveUploadPath,
	cleanPath,
	getHtmlDirectoryPath,
	resolveHtmlRelativePath,
	findAttachmentByFileId,
	findDirectoryByRelativePath,
	normalizeProjectPath,
	deduplicateFilePath,
	type ProjectAttachmentNode,
} from "./utils/file-utils"
import { logger as Logger } from "@/infrastructure/logger"
import { useFetchInterceptionCache } from "./hooks/useFetchInterceptionCache"
import {
	KEYBOARD_MESSAGE_TYPES,
	POST_MESSAGE_TARGET_STRATEGIES,
	type OnFetchIntercepted,
} from "./utils/fetchInterceptor"
import { getHtmlNavigationKey, isHtmlPreviewShellNavigation } from "./utils/html-navigation"
import {
	HtmlNavigationRuntimeService,
	type HtmlNavigationRuntimeRequest,
} from "./utils/html-navigation-runtime"
import { useIframeI18n } from "./iframe-api/hooks/useIframeI18n"
import { useIframeFS } from "./iframe-api/hooks/useIframeFS"
import { useIframeLLM } from "./iframe-api/hooks/useIframeLLM"
import { useIframeDatabase } from "./iframe-api/hooks/useIframeDatabase"
import { useIframeAgent } from "./iframe-api/hooks/useIframeAgent"
import { useIframeUserInfo } from "./iframe-api/hooks/useIframeUserInfo"
import { useMagicFiles } from "./iframe-api/hooks/useMagicFiles"
import { useIframeAgentActions } from "./hooks/useIframeAgentActions"
import {
	useHtmlAppPermissions,
	type HtmlAppPermissionController,
} from "./hooks/useHtmlAppPermissions"
import {
	saveIframeFileContent,
	createIframeFile,
	deleteIframeFile,
	deleteIframeFiles,
	moveIframeFile,
	renameIframeFile,
	getIframeFileInfo,
} from "./iframe-api/iframeApi"

import { env } from "@/utils/env"
import { userStore } from "@/models/user"
import { ContactApi } from "@/apis"
import MagicModal from "@/components/base/MagicModal"
import {
	getHtmlNavigationIntent,
	type HtmlNavigationIntent,
	type HtmlNavigationRequest,
} from "./utils/html-navigation"
import type { HtmlPermissionScope } from "./iframe-api/types"
import { PPTBuildPanel } from "./components/PPTBuildPanel/PPTBuildPanel"
import { useHostConversation } from "@/pages/superMagic/contexts/HostConversationContext"

const ignoreDevicePreviewChange = () => undefined

interface IsolatedHTMLRendererProps {
	buildPanelOpen?: boolean
	onBuildPanelOpenChange?: (open: boolean) => void
	onBuildSave?: () => Promise<boolean>
	devicePreview?: DevicePreviewControls & { enabled: boolean }
	onDeviceContentScaledChange?: (scaled: boolean) => void
	content: string
	/** API 返回的最原始 HTML 内容（未经 processHtmlContent 处理） */
	rawSourceCode?: string
	sandboxType?: "iframe" | "shadow-dom"
	className?: string
	isPptRender?: boolean
	/** A visible PPT transition layer must paint without resuming its media yet. */
	isPlaybackPaused?: boolean
	isFullscreen?: boolean
	/** Expands a pure-share iframe into the page instead of a viewport-scrolling shell. */
	documentFlowFullscreen?: boolean
	/** Latest content height reported by the injected iframe runtime. */
	documentFlowContentHeight?: number
	isEditMode?: boolean
	isSaving?: boolean
	saveEditContent?: (
		content: any,
		fileId?: string,
		enable_shadow?: boolean,
		fetchFileVersions?: (fileId: string) => void,
		isPPTEditMode?: boolean,
	) => Promise<boolean | void>
	onSaveReady?: (triggerSave: () => Promise<SaveResult | undefined>) => void
	fileId?: string
	/** HTML 内部导航请求的运行时 URL 状态。 */
	htmlNavigation?: HtmlNavigationRequest
	/** 跨多个 HTML 文件共享存储时使用的稳定标记；未传时继续按当前文件隔离。 */
	virtualStorageMarkerId?: string
	filePathMapping: Map<string, string>
	/** 当前 HTML 所在目录，用于相对资源解析、上传默认目录等历史逻辑。 */
	htmlRelativeFolderPath?: string
	openNewTab: (
		fileId: string,
		path: string,
		autoEdit?: boolean,
		intent?: HtmlNavigationIntent,
	) => void
	/** origin 项目 ID：文件/库所在项目。host 来自 HostConversationProvider。 */
	projectId?: string
	/** 发布微应用身份，由宿主注入，用于自动添加可信 @micro_app mention。 */
	microAppId?: string
	microAppName?: string
	attachmentList?: any[]
	setSlideContents?: (slideContents: Map<number, string>) => void
	slideIndex?: number
	setProcessedContent?: (processedContent: string) => void
	isPlaybackMode?: boolean
	toolbarClassName?: string
	/** Mount target for `createPortal` (e.g. save/cancel) at style toolbar’s right */
	toolbarEndRef?: Ref<HTMLDivElement | null>
	isVisible?: boolean
	/** Hide portaled chrome when this instance is not interactive. */
	isTabActive?: boolean
	iframeClassName?: string
	containIframeOverscroll?: boolean //控制HTML预览增强组件内部是否启用
	hideVerticalScroll?: boolean
	enableScalingHeightCalculation?: boolean
	scaleContentDimensions?: CanonicalContentDimensions | null
	waitForSettledContentMetrics?: boolean
	autoFitScalePaddingFactor?: number
	autoFitVerticalPadding?: number
	manualScale?: number | null
	onManualScaleChange?: (scale: number | null) => void
	onScaleRatioChange?: (scale: number) => void
	disableDynamicResourceInterception?: boolean
	disableIframeDocumentClickBridge?: boolean // **重要** 控制HTML预览增强组件内部是否禁用 iframe 到父层的通用 DOM_CLICK 桥接
	onRenderReady?: () => void //控制HTML预览组件的skeleton结束时机
	onContentMetrics?: (metrics: IsolatedHTMLRendererContentMetrics) => void //计算HTML预览组件内部内容尺寸
	onInterrupt?: () => void //新增：中断回调
	/** 调试控制台关闭时回调（用于同步父组件状态）*/
	onDevConsoleClose?: () => void
	/** Parent-controlled DevTools state, kept in sync across iframe remounts. */
	devConsoleEnabled?: boolean
	/** AI 选取（appendToEditor）状态变化回调 */
	onAppendPickingChange?: (picking: boolean) => void
	/** 即时元素选取状态变化回调 */
	onQuickSelectionChange?: (picking: boolean) => void
	/** 元素选取状态变化回调 */
	onInspectorActiveChange?: (active: boolean) => void
	/** Enable content-level inspector fallback for renderers without runtime support. */
	enableInlineInspectorFallback?: boolean
	/** Parent-owned controller used by the HTML detail toolbar and runtime. */
	permissionController?: HtmlAppPermissionController
	/** Comparison previews render HTML but must not request or use app permissions. */
	disableHtmlAppPermissions?: boolean
}

function isProjectScopedPermission(scope: HtmlPermissionScope): boolean {
	return scope.startsWith("project.") || scope.startsWith("fs.project.")
}

function isHtmlImagesUploadPath(path: string): boolean {
	const normalized = normalizeProjectPath(path.trim().replace(/^\.\//, ""))
	return normalized === "images" || normalized.startsWith("images/")
}

/**
 * 根据目录和文件名，生成上传文件路径
 * @param path
 * @param fileName
 * @returns
 */
function resolveImageUploadRequestPath(path: string, fileName: string): string {
	const trimmedPath = path.trim() || "./images"
	const pathWithoutTrailingSlash = trimmedPath.replace(/\/+$/, "")
	const normalized = normalizeProjectPath(pathWithoutTrailingSlash.replace(/^\.\//, ""))
	const isDirectoryPath = trimmedPath.endsWith("/") || normalized === "images"

	if (!isDirectoryPath) return trimmedPath

	const uploadDirectory = normalized === "images" ? "./images" : pathWithoutTrailingSlash
	return `${uploadDirectory}/${fileName}`
}

interface MagicI18nLangSubscribeRequest {
	type: "MAGIC_I18N_LANG_SUBSCRIBE"
	requestId?: string
}

interface MagicContextGetRequest {
	type: "MAGIC_CONTEXT_GET_REQUEST"
	requestId?: string
}

interface MagicContextUser {
	user_id: string
	magic_id?: string
	organization_code?: string
	nickname?: string
	real_name?: string
	avatar_url?: string
	phone?: string
	email?: string | null
	job_title?: string
	path_nodes?: unknown[]
}

interface MagicContextPayload {
	userId: string
	userName: string
	user: MagicContextUser
	organizationCode: string
	language: string
}

interface LegacyImageUploadRequestData {
	targetSelector: string
}

const useStyles = createStyles(({ css }) => {
	return {
		rendererContainer: css`
			width: 100%;
			height: 100%;
			overflow: auto;
		`,
		hiddenScrollbar: css`
			scrollbar-width: none;
			-ms-overflow-style: none;

			&::-webkit-scrollbar {
				display: none;
				width: 0;
				height: 0;
			}
		`,
		pptManualZoomScrollbar: css`
			scrollbar-width: thin;
			scrollbar-color: rgb(var(--muted-foreground-rgb) / 0.45) transparent;

			&::-webkit-scrollbar {
				width: 8px;
				height: 8px;
			}

			&::-webkit-scrollbar-track {
				background: transparent;
			}

			&::-webkit-scrollbar-thumb {
				border: 2px solid transparent;
				border-radius: 9999px;
				background-color: rgb(var(--muted-foreground-rgb) / 0.45);
				background-clip: content-box;
			}

			&::-webkit-scrollbar-thumb:hover {
				background-color: rgb(var(--muted-foreground-rgb) / 0.7);
			}
		`,
		iframe: css`
			width: 100%;
			height: 100%;
			display: block;
		`,
		shadowHost: css`
			width: 100%;
			height: 100%;
			display: block;
			position: relative;
		`,
		loadingContainer: css`
			width: 100%;
			height: 100%;
			display: flex;
			align-items: center;
			justify-content: center;
		`,
	}
})

const logger = Logger.createLogger("IsolatedHTMLRenderer")

function normalizeContextUser(
	profile: any,
	fallback: any,
	userId: string,
	organizationCode: string,
): MagicContextUser {
	return {
		user_id: profile?.user_id || fallback?.user_id || userId,
		magic_id: profile?.magic_id || fallback?.magic_id,
		organization_code:
			profile?.organization_code || fallback?.organization_code || organizationCode,
		nickname: profile?.nickname || fallback?.nickname,
		real_name: profile?.real_name || fallback?.real_name,
		avatar_url: profile?.avatar_url || fallback?.avatar,
		phone: profile?.phone || fallback?.phone,
		email: profile?.email || fallback?.email,
		job_title: profile?.job_title,
		path_nodes: profile?.path_nodes,
	}
}

function getContextUserName(user: MagicContextUser): string {
	return (user.real_name || user.nickname || "").trim()
}

// Internal component that uses the StylePanelStore context
const IsolatedHTMLRendererInner = forwardRef<IsolatedHTMLRendererRef, IsolatedHTMLRendererProps>(
	(props, ref) => {
		const fileAccess = useFileAccess()
		const fileApi = useFileApi()
		const getFileAccess = useMemoizedFn(() => fileAccess)
		const {
			devicePreview,
			onDeviceContentScaledChange,
			content,
			rawSourceCode,
			sandboxType = "iframe",
			className,
			isPptRender,
			buildPanelOpen = false,
			onBuildPanelOpenChange,
			onBuildSave,
			isPlaybackPaused = false,
			isFullscreen,
			documentFlowFullscreen = false,
			documentFlowContentHeight = 0,
			isEditMode,
			isSaving = false,
			saveEditContent,
			onSaveReady,
			fileId,
			htmlNavigation,
			virtualStorageMarkerId,
			filePathMapping,
			openNewTab,
			htmlRelativeFolderPath,
			projectId,
			microAppId,
			microAppName,
			attachmentList,
			isPlaybackMode,
			toolbarClassName,
			toolbarEndRef,
			iframeClassName,
			isVisible,
			isTabActive,
			containIframeOverscroll = false,
			hideVerticalScroll = false,
			enableScalingHeightCalculation = false,
			scaleContentDimensions,
			waitForSettledContentMetrics = false,
			autoFitScalePaddingFactor = 1,
			autoFitVerticalPadding = 0,
			manualScale,
			onManualScaleChange,
			onScaleRatioChange,
			disableDynamicResourceInterception = false,
			disableIframeDocumentClickBridge = false,
			onRenderReady,
			onContentMetrics,
			onDevConsoleClose,
			devConsoleEnabled,
			onAppendPickingChange,
			onQuickSelectionChange,
			onInspectorActiveChange,
			enableInlineInspectorFallback = false,
			permissionController,
			disableHtmlAppPermissions = false,
		} = props
		// host：用户当前所在项目；发布页通过 Provider 按需创建运行项目。
		const {
			selectedProject,
			topicStore: scopedTopicStore,
			ensureConversation,
			requestPreviewMode,
			requireAuthentication,
		} = useHostConversation()
		// origin：文件/库所在项目。发布预览传微应用原项目，普通预览回落到 host。
		const runtimeProjectId = projectId ?? selectedProject?.id
		const externalRenderSiteUrl = useMemo(() => env("MAGIC_HTML_SANDBOX_URL"), [])
		// The shared shell can load the runtime bundle built by this host deployment.
		const htmlSandboxRuntimeUrl = useMemo(() => getHtmlSandboxRuntimeUrl(), [])
		const htmlSandboxShellUrl = useMemo(
			() => externalRenderSiteUrl || "/husky.html",
			[externalRenderSiteUrl],
		)
		const externalRenderSiteOrigin = useMemo(() => {
			if (!externalRenderSiteUrl) return ""

			try {
				return new URL(externalRenderSiteUrl).origin
			} catch {
				return ""
			}
		}, [externalRenderSiteUrl])

		const iframeTargetOrigin = useMemo(
			() => externalRenderSiteOrigin || window.location.origin,
			[externalRenderSiteOrigin],
		)
		const contentMetricsTargetOrigin = useMemo(() => window.location.origin, [])

		const postMessageTargetStrategy = useMemo(
			() =>
				externalRenderSiteUrl
					? POST_MESSAGE_TARGET_STRATEGIES.CROSS_ORIGIN_PARENT
					: POST_MESSAGE_TARGET_STRATEGIES.SAME_ORIGIN_ANCESTOR,
			[externalRenderSiteUrl],
		)

		const { styles, cx } = useStyles()
		const isMobile = useIsMobile()
		const documentFlowIframeStyle = useMemo(() => {
			if (!documentFlowFullscreen) return undefined
			// Mobile keeps the HTML document inside a viewport-sized iframe so native touch
			// scrolling remains owned by the iframe. Desktop expands the iframe into the page
			// document, which is required for whole-page capture extensions to discover its height.
			if (isMobile) return { height: "100dvh" }
			return {
				height:
					documentFlowContentHeight > 0
						? `${Math.ceil(documentFlowContentHeight)}px`
						: "100dvh",
			}
		}, [documentFlowContentHeight, documentFlowFullscreen, isMobile])
		const containerRef = useRef<HTMLDivElement>(null)
		// Inspector controls belong to the visible canvas column, outside the zoomable
		// scroll container, so manual zoom and its scroll correction cannot move them.
		const inspectorViewportRef = useRef<HTMLDivElement>(null)
		// Keep the scaling viewport limited to the canvas column. The DOM tree is a
		// sibling column and must not be included in PPT auto-fit measurements.
		const canvasViewportRef = useRef<HTMLDivElement>(null)
		const deviceContentRef = useRef<HTMLDivElement>(null)
		const [deviceDisplayScale, setDeviceDisplayScale] = useState(1)
		const devicePreviewEnabled = devicePreview?.enabled === true
		const contentWrapperRef = useRef<HTMLDivElement>(null)
		const scrollContainerRef = useRef<HTMLDivElement>(null)
		const iframeRef = useRef<HTMLIFrameElement>(null)
		const supportsDevicePreview = devicePreview !== undefined
		const syncDeviceScrollbars = useMemoizedFn(() => {
			if (!supportsDevicePreview || sandboxType !== "iframe") return
			syncDevicePreviewScrollbars(iframeRef.current, iframeTargetOrigin, devicePreviewEnabled)
		})
		// 模式只同步呈现状态；文档重新注入后由 contentLoaded 再应用，不能为此刷新 iframe。
		useEffect(() => {
			syncDeviceScrollbars()
		}, [devicePreviewEnabled, supportsDevicePreview, sandboxType, syncDeviceScrollbars])
		const inspectorCapturePrewarmRef = useRef<(() => Promise<boolean>) | null>(null)
		const registerInspectorCapturePrewarm = useCallback(
			(prewarm: (() => Promise<boolean>) | null) => {
				inspectorCapturePrewarmRef.current = prewarm
			},
			[],
		)
		// Keep the editor bridge ref above callbacks and effects that reference it.
		// Declaring it later would put those dependency arrays in the temporal dead zone.
		const editorRef = useRef<HTMLEditorV2Ref>(null)
		const navigationRequestSequenceRef = useRef(0)
		const lastPreparedContentKeyRef = useRef<string | null>(null)
		const navigationRuntimeService = useMemo(
			() =>
				new HtmlNavigationRuntimeService({
					send: (request: HtmlNavigationRuntimeRequest) => {
						const contentWindow = iframeRef.current?.contentWindow
						if (!contentWindow) {
							throw new Error("iframe contentWindow is unavailable")
						}

						contentWindow.postMessage(
							{
								type: "setContent",
								content: request.content,
								locationSearch: request.locationSearch,
								locationAnchor: request.locationAnchor,
								runtimeUrl: request.runtimeUrl,
								navigationRequestId: request.requestId,
							},
							iframeTargetOrigin,
						)
					},
				}),
			[iframeTargetOrigin],
		)
		const htmlNavigationKey = useMemo(
			() => getHtmlNavigationKey(htmlNavigation),
			[htmlNavigation],
		)

		const [iframeLoaded, setIframeLoaded] = useState(false)
		const [sidebarOpen, setSidebarOpen] = useState(false)
		const [structureExpanded, setStructureExpanded] = useState(true)
		const [stylesExpanded, setStylesExpanded] = useState(true)
		const [domTreeRevision, setDomTreeRevision] = useState(0)
		const handleToggleSidebar = useCallback(() => {
			onBuildPanelOpenChange?.(false)
			setSidebarOpen((open) => !open)
		}, [onBuildPanelOpenChange])
		const handleRevealMoreStyles = useCallback(() => {
			onBuildPanelOpenChange?.(false)
			setSidebarOpen(true)
			setStylesExpanded(true)
		}, [onBuildPanelOpenChange])
		const [contentInjected, setContentInjected] = useState(false) // 标记内容是否已注入到 iframe
		const { revision: previewDocumentRevision, restart: restartPreviewDocument } =
			usePreviewDocumentRevision(content, isEditMode)
		const iframeRuntimeKey = `${fileId || "html"}:${sandboxType}:${htmlSandboxShellUrl}:${htmlNavigationKey}:${previewDocumentRevision}`
		const [loadedDocumentRevision, setLoadedDocumentRevision] = useState(iframeRuntimeKey)
		// Reset readiness in the same render as the new iframe key; no effect may
		// inject into a newly created Window using the preceding shell's readiness.
		if (loadedDocumentRevision !== iframeRuntimeKey) {
			setLoadedDocumentRevision(iframeRuntimeKey)
			setIframeLoaded(false)
			setContentInjected(false)
		}
		useEffect(() => {
			const iframe = iframeRef.current
			if (!iframe) return
			// Legacy fullscreen attributes for old WebKit/Firefox engines.
			iframe.setAttribute("allowfullscreen", "true")
			iframe.setAttribute("webkitallowfullscreen", "true")
			iframe.setAttribute("mozallowfullscreen", "true")
		}, [iframeRuntimeKey])
		const [processedSourceCode, setProcessedSourceCode] = useState<string | undefined>(
			undefined,
		) // 预处理后的 HTML 源码（供 DevConsole Sources 面板展示）
		const [virtualStorageContext, setVirtualStorageContext] =
			useState<VirtualStorageRuntimeContext | null>(null)
		const hasRenderedOnceRef = useRef(false) // 跟踪 iframe 是否至少已渲染一次
		const hasNotifiedRenderReadyRef = useRef(false)
		const renderLifecycleRef = useRef(createIframeRenderLifecycleState())
		// Fallback timer: unblocks scaling when sandbox never sends contentMetrics
		const contentMetricsFallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

		// Track selected element for zoom centering
		const [selectedElementRect, setSelectedElementRect] = useState<{
			top: number
			left: number
			width: number
			height: number
		} | null>(null)
		const [selectedElementViewportRect, setSelectedElementViewportRect] = useState<{
			top: number
			left: number
			width: number
			height: number
			selector?: string
		} | null>(null)
		const [isContextPanelDismissed, setIsContextPanelDismissed] = useState(false)
		const selectedElementSelector = selectedElementViewportRect?.selector
		const previousSelectedSelectorRef = useRef<string | undefined>(undefined)

		useEffect(() => {
			const nextSelector = selectedElementSelector
			if (shouldCollapseStylesOnBlur(previousSelectedSelectorRef.current, nextSelector)) {
				setStylesExpanded(false)
			}
			previousSelectedSelectorRef.current = nextSelector
		}, [selectedElementSelector])

		// Keep the selected element and edit mode when the user dismisses the panel.
		// A different selection starts a fresh contextual-panel session.
		useEffect(() => {
			setIsContextPanelDismissed(false)
		}, [isEditMode, selectedElementSelector])

		const closeElementContextPanel = useMemoizedFn(() => {
			if (!isEditMode || !selectedElementSelector || isContextPanelDismissed) return false
			setIsContextPanelDismissed(true)
			return true
		})

		const handleCanvasPointerDown = useCallback(
			(event: React.PointerEvent<HTMLDivElement>) => {
				if (!isEditMode || !selectedElementSelector) return
				const target = event.target
				if (!(target instanceof Element)) return
				// Selection handles and the iframe own their pointer interactions. Only
				// clicks on the canvas area outside the iframe should clear selection.
				if (
					target.closest(
						"iframe, [data-html-selection-overlay], [data-html-context-panel], [data-html-drop-overlay]",
					)
				) {
					return
				}
				void editorRef.current?.resetEditorState()
			},
			[editorRef, isEditMode, selectedElementSelector],
		)

		// Escape pressed while focus is in the parent document (for example, a panel
		// input) should have the same local-dismiss behavior as Escape from the iframe.
		useEffect(() => {
			const handleKeyDown = (event: KeyboardEvent) => {
				if (event.key !== "Escape") return
				if (!closeElementContextPanel()) return
				event.preventDefault()
				event.stopImmediatePropagation()
			}

			window.addEventListener("keydown", handleKeyDown, true)
			return () => window.removeEventListener("keydown", handleKeyDown, true)
		}, [closeElementContextPanel])
		const [scalingContentMetrics, setScalingContentMetrics] = useState<{
			contentWidth: number
			contentHeight: number
			phase?: "initial" | "settled"
		} | null>(null)
		const shouldWaitForSettledContentMetrics =
			waitForSettledContentMetrics && !scaleContentDimensions

		// 使用缩放控制 hook 处理 PPT 渲染模式
		const {
			scaleRatio,
			shouldApplyScaling,
			isScaleReady,
			isManualZoom,
			handleScaleChange,
			getContentWrapperStyle,
			getIframeStyle,
		} = useZoomControls({
			containerRef,
			measurementRef: devicePreviewEnabled ? deviceContentRef : canvasViewportRef,
			iframeRef,
			isPptRender,
			isFullscreen,
			iframeLoaded,
			contentInjected,
			isVisible,
			isEditMode,
			selectedElementRect,
			enableHeightCalculation: enableScalingHeightCalculation,
			scaleContentDimensions,
			contentMetricsOverride: scalingContentMetrics,
			waitForSettledContentMetrics: shouldWaitForSettledContentMetrics,
			autoFitScalePaddingFactor,
			autoFitVerticalPadding,
			manualScale,
			onManualScaleChange,
		})
		// 内容适配仍用原 scaleRatio；宿主指针与浮层使用内容比例 × 设备显示比例。
		const effectiveScaleRatio = devicePreviewEnabled
			? (shouldApplyScaling ? scaleRatio : 1) * deviceDisplayScale
			: scaleRatio
		const deviceLayoutKey =
			devicePreviewEnabled && devicePreview
				? `${devicePreview.config.width}:${devicePreview.config.height}:${devicePreview.config.showFrame}:${devicePreview.config.profile}:${devicePreview.config.fold?.posture}:${deviceDisplayScale}`
				: ""
		useEffect(() => {
			onDeviceContentScaledChange?.(shouldApplyScaling)
		}, [shouldApplyScaling, onDeviceContentScaledChange])

		useEffect(() => {
			if (isPptRender && isScaleReady) {
				onScaleRatioChange?.(scaleRatio)
			}
		}, [isPptRender, isScaleReady, onScaleRatioChange, scaleRatio])

		const buildRenderLifecycleContext = useMemoizedFn((): IframeRenderLifecycleContext => {
			const lifecycle = renderLifecycleRef.current

			return {
				sessionId: lifecycle.sessionId,
				elapsedMs: Date.now() - lifecycle.startedAt,
				sandboxType,
				renderMode: externalRenderSiteUrl ? "cross-origin" : "same-origin",
				shellUrl: htmlSandboxShellUrl,
				shellOrigin: externalRenderSiteOrigin || window.location.origin,
				targetOrigin: iframeTargetOrigin,
				postMessageTargetStrategy,
				source: {
					depth: 0,
					fileId: fileId || "",
					path: htmlRelativeFolderPath || "",
				},
				fileId: fileId || "",
				relativeFilePath: htmlRelativeFolderPath || "",
				isPptRender: Boolean(isPptRender),
				isFullscreen: Boolean(isFullscreen),
				isEditMode: Boolean(isEditMode),
				isPlaybackMode: Boolean(isPlaybackMode),
				isVisible: Boolean(isVisible),
				shouldApplyScaling,
				isScaleReady,
				iframeLoaded,
				contentInjected,
				contentLength: content.length,
			}
		})

		const reportRenderLifecycleStage = useMemoizedFn(
			(
				stage: IframeRenderLifecycleStage,
				extra: Record<string, unknown> = {},
				options: { once?: boolean } = { once: true },
			) => {
				reportIframeRenderLifecycleStage({
					logger,
					lifecycle: renderLifecycleRef.current,
					getContext: buildRenderLifecycleContext,
					stage,
					extra,
					options,
				})
			},
		)

		const clearRenderLifecycleTimeout = useMemoizedFn(() => {
			clearIframeRenderLifecycleTimeout(renderLifecycleRef.current)
		})

		const startRenderLifecycleSession = useMemoizedFn((reason: string) => {
			startIframeRenderLifecycleSession({
				logger,
				lifecycleRef: renderLifecycleRef,
				getContext: buildRenderLifecycleContext,
				reason,
			})
		})

		// 跟踪缩放准备就绪时机以避免后续渲染时闪烁
		useEffect(() => {
			if (isScaleReady && isVisible) {
				hasRenderedOnceRef.current = true
				reportRenderLifecycleStage("scale_ready")
			}
		}, [isScaleReady, isVisible, reportRenderLifecycleStage])
		//控制HTML预览组件的skeleton结束时机
		useEffect(() => {
			hasNotifiedRenderReadyRef.current = false
			if (content) {
				startRenderLifecycleSession("content_changed")
			} else {
				clearRenderLifecycleTimeout()
			}
			setScalingContentMetrics(null)
			if (contentMetricsFallbackTimerRef.current) {
				clearTimeout(contentMetricsFallbackTimerRef.current)
				contentMetricsFallbackTimerRef.current = null
			}
		}, [clearRenderLifecycleTimeout, content, iframeRuntimeKey, startRenderLifecycleSession])

		const notifyRenderReady = useMemoizedFn(() => {
			if (hasNotifiedRenderReadyRef.current) return

			hasNotifiedRenderReadyRef.current = true
			reportRenderLifecycleStage("render_ready")
			reportRenderLifecycleStage("render_success")
			clearRenderLifecycleTimeout()
			onRenderReady?.()
		})

		useEffect(() => {
			return () => {
				clearRenderLifecycleTimeout()
			}
		}, [clearRenderLifecycleTimeout])

		// Handle zoom request from iframe (trackpad pinch-to-zoom)
		const handleIframeZoomRequest = useMemoizedFn((delta: number) => {
			const scaleFactor = 0.002 // Sensitivity adjustment
			const scaleChange = delta * scaleFactor
			const newScale = scaleRatio + scaleChange
			handleScaleChange(newScale)
		})
		const handleEditorContentChanged = useMemoizedFn(() => {
			setDomTreeRevision((current) => current + 1)
		})

		const prepareVisualSaveContent = useMemoizedFn((nextContent: string) => {
			// Notes can be saved while this iframe retains a body draft. Keep the latest
			// host metadata without rewriting the document or resetting that draft.
			const contentWithNotes =
				isPptRender && typeof rawSourceCode === "string"
					? preserveSlideNotesFromSource(nextContent, rawSourceCode)
					: nextContent
			return preserveOriginalTrailingNewline(contentWithNotes, rawSourceCode)
		})

		// V2 编辑机制相关
		// The legacy iframe save message also needs the host's current metadata.
		const savePreparedEditContent = useMemoizedFn(
			async (
				nextContent: string,
				nextFileId?: string,
				enableShadow?: boolean,
				fetchFileVersions?: (fileId: string) => void,
				isPPTEditMode?: boolean,
			) => {
				if (!saveEditContent) return
				return saveEditContent(
					prepareVisualSaveContent(nextContent),
					nextFileId,
					enableShadow,
					fetchFileVersions,
					isPPTEditMode,
				)
			},
		)
		const { isEditorReady } = useHTMLEditorV2({
			iframeRef,
			isEditMode: isEditMode && !buildPanelOpen,
			isPPTBuildMode:
				Boolean(isPptRender && buildPanelOpen) &&
				isVisible !== false &&
				isTabActive !== false,
			sandboxType,
			iframeLoaded,
			contentInjected,
			targetOrigin: iframeTargetOrigin,
			scaleRatio: effectiveScaleRatio,
			saveEditContent,
			prepareSaveContent: prepareVisualSaveContent,
			fileId,
			filePathMapping,
			editorRef,
			isPptRender,
			onZoomRequest: handleIframeZoomRequest,
			onContentChanged: handleEditorContentChanged,
		})

		// 使用 media scenario hook
		const {
			isMediaScenario,
			injectMediaScript,
			handleMediaSpeakerEdit,
			saveMediaConfiguration,
		} = useMediaScenario({
			attachmentList,
			fileId,
		})

		const { t, i18n } = useTranslation("super")
		const contextCacheRef = useRef<{
			key: string
			value?: MagicContextPayload
			promise?: Promise<MagicContextPayload>
		} | null>(null)

		const buildContextPayload = useMemoizedFn(async (): Promise<MagicContextPayload> => {
			const fallbackUser = userStore.user.userInfo
			const userId = fallbackUser?.user_id || ""
			const organizationCode = userStore.user.organizationCode?.trim() || ""
			const language = i18n.resolvedLanguage || i18n.language || "zh-CN"

			if (!userId) {
				throw new Error("Current user is not available")
			}
			if (!organizationCode) {
				throw new Error("Current organization is not available")
			}

			const cacheKey = `${organizationCode}:${userId}:${language}`
			const cached = contextCacheRef.current
			if (cached?.key === cacheKey && cached.value) return cached.value
			if (cached?.key === cacheKey && cached.promise) return cached.promise

			const promise = ContactApi.getUsersInfo({
				user_ids: [userId],
				query_type: 2,
				page_token: "",
			}).then((response) => {
				const profile = response?.items?.[0]
				if (!profile) {
					throw new Error("Current user profile is not available")
				}

				const user = normalizeContextUser(profile, fallbackUser, userId, organizationCode)
				const userName = getContextUserName(user)
				if (!userName) {
					throw new Error("Current user display name is not available")
				}

				const runtime = {
					userId,
					userName,
					user,
					organizationCode,
					language,
				}
				contextCacheRef.current = { key: cacheKey, value: runtime }
				return runtime
			})

			contextCacheRef.current = { key: cacheKey, promise }
			return promise
		})

		const handleContextMessage = useMemoizedFn(async (payload: MagicContextGetRequest) => {
			const { requestId } = payload
			if (!requestId) return

			try {
				const context = await buildContextPayload()
				iframeRef.current?.contentWindow?.postMessage(
					{
						type: "MAGIC_CONTEXT_GET_RESPONSE",
						requestId,
						success: true,
						content: context,
					},
					"*",
				)
			} catch (error) {
				logger.error({
					eventKey: "get_html_context_failed",
					errorKind: "unknown",
					error,
					message: "获取 HTML context 失败",
				})
				iframeRef.current?.contentWindow?.postMessage(
					{
						type: "MAGIC_CONTEXT_GET_RESPONSE",
						requestId,
						success: false,
						error: error instanceof Error ? error.message : "Failed to get context",
					},
					"*",
				)
			}
		})

		const currentHtmlFileInfo = useCurrentHtmlFileInfo({
			attachmentList: attachmentList as ProjectAttachmentNode[] | undefined,
			fileId,
		})
		// DevTools console — resolve the full file path (with filename) for the current HTML file
		const currentHtmlFilePath = currentHtmlFileInfo.relativeFilePath
		const htmlEntryFilePath = currentHtmlFilePath || ""
		const devConsoleFilePath = currentHtmlFilePath
		const devConsole = useDevConsole({
			iframeRef,
			fileId,
			relativeFilePath: devConsoleFilePath,
		})
		const setDevConsoleEnabled = devConsole.setEnabled
		const [devConsoleLayout, setDevConsoleLayout] = useState<DevConsoleLayout>(() => {
			return localStorage.getItem(platformKey("devConsole_layout")) === "right"
				? "right"
				: "bottom"
		})
		const handleDevConsoleLayoutChange = useCallback((layout: DevConsoleLayout) => {
			setDevConsoleLayout(layout)
			localStorage.setItem(platformKey("devConsole_layout"), layout)
		}, [])

		useEffect(() => {
			if (devConsoleEnabled !== undefined) {
				setDevConsoleEnabled(devConsoleEnabled)
			}
		}, [devConsoleEnabled, setDevConsoleEnabled])

		// Element inspector (independent, can be triggered from DevConsole or elsewhere)
		const elementInspector = useElementInspector({
			iframeRef,
			targetOrigin: iframeTargetOrigin,
		})
		const inspectorFileInfo = useMemo(() => {
			if (!fileId) return undefined
			const file = findAttachmentByFileId(
				attachmentList as ProjectAttachmentNode[] | undefined,
				fileId,
			)
			if (!file?.file_name) return undefined
			return { fileId, fileName: file.file_name, filePath: file.relative_file_path ?? "" }
		}, [fileId, attachmentList])
		const {
			hideInfoCard: inspectorHideInfoCard,
			startInToolbarMode,
			startInAppendMode,
			startInQuickSelectionMode,
			selectionMode: inspectorSelectionMode,
			updateSelectionMode: updateInspectorSelectionMode,
			captureScreenshotTarget: captureInspectorScreenshotTarget,
			attachElementScreenshot: attachInspectorElementScreenshot,
			isAppendPicking,
			isQuickSelecting,
			activeTarget: inspectorActiveTarget,
			draftInstruction: inspectorDraftInstruction,
			setDraftInstruction: setInspectorDraftInstruction,
			confirmTarget: confirmInspectorTarget,
			cancelTarget: cancelInspectorTarget,
			pendingTargets: inspectorPendingTargets,
			submitState: inspectorSubmitState,
			submitError: inspectorSubmitError,
			editPendingTarget: editInspectorPendingTarget,
			removePendingTarget: removeInspectorPendingTarget,
			submitPendingTargets: submitInspectorPendingTargets,
			resetSelection: resetInspectorSelection,
			requestExit: requestInspectorExit,
			consumeEscape: consumeInspectorEscape,
		} = useInspectorToolbarMode(elementInspector, t, inspectorFileInfo, {
			disableTargetScroll: Boolean(isPptRender),
		})

		useEffect(() => {
			onAppendPickingChange?.(isAppendPicking)
		}, [isAppendPicking, onAppendPickingChange])

		useEffect(() => {
			onQuickSelectionChange?.(isQuickSelecting)
		}, [isQuickSelecting, onQuickSelectionChange])

		useEffect(() => {
			onInspectorActiveChange?.(elementInspector.active)
		}, [elementInspector.active, onInspectorActiveChange])

		const { upload } = useUpload<any>({
			url: superMagicUploadTokenService.getUploadTokenUrl,
			body: {
				project_id: runtimeProjectId ?? "",
				expires: 3600,
			},
			rewriteFileName: false,
			useSnowflakeId: true,
		})

		const toStoredRelativePath = useMemoizedFn((uploadedRelativePath: string) => {
			return resolveHtmlRelativePath(uploadedRelativePath, currentHtmlFilePath)
		})

		const ensureHtmlImagesDirectoryId = useMemoizedFn(async () => {
			if (!runtimeProjectId) throw new Error("No project selected")

			const htmlDirectoryPath = getHtmlDirectoryPath(currentHtmlFilePath)
			const imagesDirectoryPath = `${htmlDirectoryPath}images`
			const htmlDirectory = findDirectoryByRelativePath(
				attachmentList as ProjectAttachmentNode[] | undefined,
				htmlDirectoryPath,
			)
			const existingDirectory = findDirectoryByRelativePath(
				attachmentList as ProjectAttachmentNode[] | undefined,
				imagesDirectoryPath,
			)
			if (existingDirectory?.file_id) return existingDirectory.file_id

			const res = await createIframeFile({
				project_id: runtimeProjectId,
				parent_id: currentHtmlFileInfo.parentId || htmlDirectory?.file_id || "",
				file_name: "images",
				is_directory: true,
				ignore_duplicate: true,
			})
			if (!res?.file_id) throw new Error("Failed to create images directory")
			return res.file_id
		})

		const uploadImageFileToProject = useMemoizedFn(
			async ({
				file,
				path,
				fileSize,
				parentId,
			}: {
				file: File
				path: string
				fileSize?: number
				parentId?: string
			}) => {
				if (!runtimeProjectId) {
					throw new Error("No project selected")
				}

				const resolvedPath = deduplicateFilePath(
					resolveUploadPath(path, currentHtmlFilePath),
					attachmentList as ProjectAttachmentNode[] | undefined,
				)
				const cleanPathValue = cleanPath(resolvedPath)
				const resolvedParentId =
					parentId ??
					(isHtmlImagesUploadPath(path) ? await ensureHtmlImagesDirectoryId() : undefined)

				const token = await superMagicUploadTokenService.getUploadToken(
					runtimeProjectId,
					cleanPathValue || "",
				)
				const newFiles = Array.from([file]).map(genFileData)
				const { fullfilled } = await upload(newFiles, token)
				if (fullfilled.length === 0) {
					throw new Error("Upload failed")
				}

				// 使用上传 SDK 返回的真实 OSS 路径（雪花 ID key），而非拼接的 dir + file.name，
				// 避免 file_key 与 OSS 实际对象路径不一致导致后端访问 404。
				const uploadedKey = fullfilled[0].value.key

				// 从去重后的路径中提取实际文件名
				const deduplicatedFileName = resolvedPath.includes("/")
					? resolvedPath.slice(resolvedPath.lastIndexOf("/") + 1)
					: resolvedPath

				const saveRes = await superMagicUploadTokenService.saveFileToProject({
					project_id: runtimeProjectId,
					parent_id: resolvedParentId,
					file_key: uploadedKey,
					file_name: deduplicatedFileName || file.name,
					file_size: fileSize || file.size,
					file_type: "user_upload",
					source: 2,
					storage_type: "workspace",
					relative_file_path: resolvedPath,
				})

				if (!saveRes?.relative_file_path) {
					throw new Error("Uploaded file path is empty")
				}

				return {
					file_id: saveRes.file_id,
					relative_file_path: saveRes.relative_file_path,
					uploadedRelativeFilePath: saveRes.relative_file_path,
					storedRelativeFilePath: toStoredRelativePath(saveRes.relative_file_path),
				}
			},
		)

		// 拖拽插入图片 hook
		const { isDragOver, isGlobalDragActive, dragOverHandlers } = useImageDrop({
			iframeRef,
			isEditMode,
			scaleRatio: effectiveScaleRatio,
			relative_file_path: htmlRelativeFolderPath,
			attachmentList,
			filePathMapping,
			uploadImageFileToProject,
			targetOrigin: iframeTargetOrigin,
			onUploadSuccess: () => {
				pubsub.publish(PubSubEvents.Update_Attachments)
			},
		})

		// 消息列表预览这类只依赖预处理结果的场景，不需要再启用运行时相对路径拦截，
		// 避免把不在附件树里的原始相对路径也带进通用业务拦截链。
		// 扁平化 attachmentList，供 IframeFS 使用
		const flatFileList = useMemo(() => getIframeFileList(attachmentList), [attachmentList])
		const fallbackPermissionController = useHtmlAppPermissions({
			content,
			rawSourceCode,
			relativeFilePath: htmlEntryFilePath,
			projectId: runtimeProjectId,
			fileList: flatFileList,
			enabled: !permissionController && !disableHtmlAppPermissions,
		})
		const { htmlAppConfig, authorizeHtmlPermission, authorizeHtmlPermissions } =
			permissionController || fallbackPermissionController
		const authorizeRuntimePermission = useMemoizedFn(async (scope: HtmlPermissionScope) => {
			if (disableHtmlAppPermissions) return false
			return authorizeHtmlPermission(scope)
		})
		const projectContextUnavailableError = t("htmlEditor.projectContextUnavailable")
		const previewModeCancelledError = t("microAppPage.conversation.switchToPreviewCancelled")
		const authorizeProjectPermission = useMemoizedFn(async (scope: HtmlPermissionScope) => {
			if (disableHtmlAppPermissions) return false
			// Login confirmation precedes app permissions and never creates a runtime project.
			if (scope === "project.message.write") await requireAuthentication?.()
			if (scope === "project.message.write" && requestPreviewMode) {
				if (!(await requestPreviewMode())) throw new Error(previewModeCancelledError)
				return true
			}
			// 分享页没有可授权的项目上下文，先返回明确原因，避免先弹授权再失败。
			if (!runtimeProjectId && isProjectScopedPermission(scope)) {
				throw new Error(projectContextUnavailableError)
			}
			return authorizeRuntimePermission(scope)
		})

		const { handleFSMessage } = useIframeFS({
			iframeRef,
			runtimeRevision: iframeRuntimeKey,
			targetOrigin: iframeTargetOrigin,
			entryPath: htmlEntryFilePath,
			fileList: flatFileList,
			appConfig: htmlAppConfig,
			projectId: runtimeProjectId,
			projectContextUnavailableError: !runtimeProjectId
				? projectContextUnavailableError
				: undefined,
			uploadFn: uploadImageFileToProject,
			saveContentFn: ({ file_id, content }) => saveIframeFileContent([{ file_id, content }]),
			mkdirFn: useMemoizedFn(async ({ name, parentId }) => {
				if (!runtimeProjectId) throw new Error("No project selected")
				const res = await createIframeFile({
					project_id: runtimeProjectId,
					parent_id: parentId,
					file_name: name,
					is_directory: true,
				})
				const fileId = res?.file_id
				if (!fileId) throw new Error(`Failed to create directory: ${name}`)
				return { file_id: fileId }
			}),
			deleteFn: useMemoizedFn(async ({ file_id, project_id }) => {
				await deleteIframeFile(file_id, project_id)
			}),
			deleteFilesFn: useMemoizedFn(async ({ file_ids, project_id }) => {
				await deleteIframeFiles(file_ids, project_id)
			}),
			moveFileFn: useMemoizedFn(async ({ file_id, target_parent_id, project_id }) => {
				await moveIframeFile({ file_id, target_parent_id, project_id })
			}),
			renameFileFn: useMemoizedFn(async ({ file_id, target_name }) => {
				await renameIframeFile({ file_id, target_name })
			}),
			verifyFileFn: useMemoizedFn(async ({ file_id, project_id }) =>
				getIframeFileInfo(file_id, project_id),
			),
			authorizePermission: authorizeProjectPermission,
			confirmProjectDeleteFn: useMemoizedFn(
				({ path, isDirectory, appRootDir, operation }) =>
					new Promise<boolean>((resolve) => {
						const operationText = t(
							`htmlEditor.projectFileOperationConfirm.operations.${operation || "delete"}`,
						)
						const targetTypeText = t(
							`htmlEditor.projectFileOperationConfirm.targetTypes.${isDirectory ? "directory" : "file"}`,
						)
						const displayAppRootDir =
							appRootDir || t("htmlEditor.projectFileOperationConfirm.projectRoot")
						const modal = MagicModal.confirm({
							title: t("htmlEditor.projectFileOperationConfirm.title", {
								operation: operationText,
							}),
							content: t("htmlEditor.projectFileOperationConfirm.content", {
								operation: operationText,
								targetType: targetTypeText,
								path,
								appRootDir: displayAppRootDir,
							}),
							okText: operationText,
							cancelText: t("htmlEditor.projectFileOperationConfirm.cancel"),
							closable: false,
							maskClosable: false,
							centered: true,
							onOk: () => {
								modal.destroy()
								resolve(true)
							},
							onCancel: () => {
								modal.destroy()
								resolve(false)
							},
						})
					}),
			),
			getFileAccess,
		})

		const { handleLLMMessage } = useIframeLLM({
			iframeRef,
			runtimeRevision: iframeRuntimeKey,
			targetOrigin: iframeTargetOrigin,
			baseUrl: (env("MAGIC_SERVICE_BASE_URL") as string) || "",
			getAuthorization: () => userStore.user.authorization?.trim() || "",
			getOrganizationCode: () => userStore.user.organizationCode?.trim() || "",
			authorizePermission: authorizeRuntimePermission,
		})

		const { handleDatabaseMessage } = useIframeDatabase({
			iframeRef,
			projectId: runtimeProjectId,
			projectContextUnavailableError: !runtimeProjectId
				? projectContextUnavailableError
				: undefined,
			getFileAccess,
		})

		// origin + 传入的 store + host 项目；hook 内不再读全局 store
		const { getAgentList, createTopicAndSend, sendMessage } = useIframeAgentActions(
			runtimeProjectId,
			scopedTopicStore,
			selectedProject,
			{ microAppId, microAppName },
			ensureConversation,
		)

		// 会话写操作按 host 鉴权：分享页没有当前项目时不可发消息
		const { handleAgentMessage } = useIframeAgent({
			iframeRef,
			targetOrigin: iframeTargetOrigin,
			getAgentList,
			createTopicAndSend,
			sendMessage,
			enableWriteOperations: true,
			projectId: selectedProject?.id || (ensureConversation ? "runtime-pending" : undefined),
			projectContextUnavailableError:
				!selectedProject?.id && !ensureConversation
					? projectContextUnavailableError
					: undefined,
			authorizePermission: authorizeProjectPermission,
		})

		const { handleUserInfoMessage } = useIframeUserInfo({
			iframeRef,
			targetOrigin: iframeTargetOrigin,
			getUserInfo: useMemoizedFn(() => {
				const info = userStore.user.userInfo
				if (!info) return null
				const realName = info.real_name || ""
				const nickname = info.nickname || ""
				return {
					user_id: info.user_id || "",
					magic_id: info.magic_id || "",
					nickname,
					real_name: realName,
					name: realName || nickname,
					avatar: info.avatar || "",
					organization_code: info.organization_code || "",
				}
			}),
			authorizeUserInfo: useMemoizedFn(({ scopes, reason }) =>
				disableHtmlAppPermissions
					? Promise.resolve(false)
					: authorizeHtmlPermissions(scopes, {
							reason,
							presentation: "userInfo",
						}),
			),
		})

		const isDynamicInterceptionEnabled = !disableDynamicResourceInterception
		const dynamicResourceInterceptionConfig = useMemo(() => {
			return {
				enable: isDynamicInterceptionEnabled,
				fileId: fileId || "",
				postMessageTargetStrategy,
			}
		}, [fileId, isDynamicInterceptionEnabled, postMessageTargetStrategy])

		// upload/download 走 origin；addFilesToMessage 走 host + 传入的 store
		const { handleMagicUploadFiles, handleMagicAddFilesToMessage, handleMagicDownloadFiles } =
			useMagicFiles({
				iframeRef,
				targetOrigin: iframeTargetOrigin,
				selectedProject,
				projectId: runtimeProjectId,
				projectContextUnavailableError: !runtimeProjectId
					? projectContextUnavailableError
					: undefined,
				topicStore: scopedTopicStore,
				ensureConversation,
				attachmentList,
				htmlRelativeFolderPath,
				uploadImageFileToProject,
				authorizePermission: authorizeProjectPermission,
			})

		// 监听 iframe 准备就绪并初始化内容
		useEffect(() => {
			try {
				const iframe = iframeRef.current
				if (!iframe) return

				setIframeLoaded(false)
				setContentInjected(false)
				navigationRuntimeService.resetShell()
				lastPreparedContentKeyRef.current = null
				// 业务 query/hash 不拼接到远程 shell URL：远程 shell 可能对 query 做签名校验。
				// 导航状态变化时通过 key 创建新的 shell 实例，避免复用旧 document 的 History 状态。
				if (iframe.getAttribute("src") !== htmlSandboxShellUrl) {
					iframe.src = htmlSandboxShellUrl
				}
			} catch (error) {
				console.error("初始化iframe内容时出错:", error)
			}
		}, [htmlNavigationKey, htmlSandboxShellUrl, navigationRuntimeService, iframeRuntimeKey])

		const getMarkerId = useMemoizedFn(() => {
			if (!attachmentList || !fileId) return fileId

			// 查找当前文件信息
			const currentFile = attachmentList.find((item: any) => item.file_id === fileId)
			if (currentFile?.parent_id) {
				// 查找父目录信息
				const parentDirectory = attachmentList.find(
					(item: any) => item.file_id === currentFile.parent_id,
				)
				// 如果父目录存在display_config，返回父目录ID
				if (parentDirectory?.display_config) {
					return currentFile.parent_id
				}
			}
			// 默认返回文件ID
			return fileId
		})
		const getStorageMarkerId = useMemoizedFn(() => virtualStorageMarkerId || getMarkerId())

		// 虚拟存储按 project + file 隔离，不按话题隔离：切换/新建话题不应重建沙箱存储。
		useEffect(() => {
			let cancelled = false
			const markerId = getStorageMarkerId()
			const namespace = buildHtmlVirtualStorageNamespace({
				projectId: runtimeProjectId,
				fileId: markerId || fileId,
			})

			setVirtualStorageContext(null)
			void createVirtualStorageContext({
				namespace,
				targetOrigin: window.location.origin,
			}).then((context) => {
				if (!cancelled) setVirtualStorageContext(context)
			})

			return () => {
				cancelled = true
			}
		}, [
			// attachmentList,
			fileId,
			getStorageMarkerId,
			runtimeProjectId,
			virtualStorageMarkerId,
			iframeRuntimeKey,
		])

		useEffect(() => {
			if (!virtualStorageContext) return
			const iframeWindow = iframeRef.current?.contentWindow
			if (!iframeWindow) return

			const registeredContext = {
				...virtualStorageContext,
				source: iframeWindow,
				origin: iframeTargetOrigin,
				expiresAt: undefined,
			}
			virtualStorageRegistry.register(registeredContext)
			return () => {
				virtualStorageRegistry.unregister(registeredContext)
			}
		}, [iframeLoaded, iframeTargetOrigin, virtualStorageContext, iframeRuntimeKey])

		const reloadIframeContent = () => {
			resetInspectorSelection()
			pubsub.publish(PubSubEvents.Super_Magic_Detail_Refresh)
		}

		const notifyIframeI18nLang = useIframeI18n({
			iframeRef,
			targetOrigin: iframeTargetOrigin,
			i18n,
			enabled: sandboxType === "iframe",
		})

		const handleIframeElementLoad = useMemoizedFn(() => {
			reportRenderLifecycleStage("shell_loaded")
		})

		const handleIframeElementError = useMemoizedFn(() => {
			reportRenderLifecycleStage("shell_load_failed", {
				reason: "iframe_element_error",
			})
		})

		const refreshIframeContent = useMemoizedFn((options?: { force?: boolean }) => {
			if (!virtualStorageContext) return
			// 解码HTML实体
			let decodedContent = decodeHTMLEntities(content)

			// 如果是media场景，注入media脚本
			if (isMediaScenario) {
				decodedContent = injectMediaScript(decodedContent)
			}

			// 根据HTML文件上下文确定标记ID：如果父目录存在metadata则使用父目录ID，否则使用文件ID
			const markerId = getStorageMarkerId()
			const contentKey = [
				content,
				htmlNavigationKey,
				markerId || "",
				virtualStorageContext.renderId || "",
			].join("\u0000")

			if (!options?.force && lastPreparedContentKeyRef.current === contentKey) {
				return
			}

			navigationRequestSequenceRef.current += 1
			const navigationRequestId = `${fileId || "html"}:${navigationRequestSequenceRef.current}`
			// 创建完整HTML内容
			const fullContent = getFullContent(decodedContent, markerId, {
				devicePreviewScrollbars: supportsDevicePreview ? devicePreviewEnabled : undefined,
				dynamicInterception: dynamicResourceInterceptionConfig,
				containOverscroll: containIframeOverscroll,
				hideVerticalScroll,
				reportContentMetrics: documentFlowFullscreen,
				contentMetricsTargetOrigin,
				disableParentClickBridge: disableIframeDocumentClickBridge,
				enableTouchPinchZoom: isPptRender,
				enableInlineInspectorFallback,
				postMessageTargetStrategy,
				virtualStorage: virtualStorageContext,
				locationSearch: htmlNavigation?.search || "",
				locationAnchor: htmlNavigation?.hash || "",
				navigationRequestId,
				navigationBasePath: htmlEntryFilePath,
			})
			const request = {
				requestId: navigationRequestId,
				content: fullContent,
				locationSearch: htmlNavigation?.search || "",
				locationAnchor: htmlNavigation?.hash || "",
				runtimeUrl: htmlSandboxRuntimeUrl,
			}
			lastPreparedContentKeyRef.current = contentKey
			// shell 未 ready 时只保存最新请求，ready 后再发送。
			try {
				const sendResult = navigationRuntimeService.submit(request)
				if (sendResult === "sent") {
					reportRenderLifecycleStage("set_content_sent", {
						fullContentLength: fullContent.length,
						markerId,
						dynamicInterceptionEnabled: Boolean(
							dynamicResourceInterceptionConfig?.enable,
						),
					})
				}
			} catch (postError) {
				reportRenderLifecycleStage("set_content_failed", {
					reason: "post_message_failed",
					errorMessage:
						postError instanceof Error ? postError.message : String(postError),
					errorStack: postError instanceof Error ? postError.stack : undefined,
				})
				console.error("发送消息到iframe时出错:", postError)
			}
			setProcessedSourceCode(fullContent)
		})

		// 使用 fetch 拦截缓存 hook（必须在 refreshIframeContent 定义之后）
		const { handleFetchIntercepted, dynamicDependencyEntries } = useFetchInterceptionCache({
			attachmentList,
			sandboxType,
			isEditMode,
			iframeRef,
			content,
			refreshIframeContent,
			setContentInjected,
		})

		// Combine static + dynamic dependency entries for the DevConsole
		const staticDependencyEntries = useMemo(() => extractStaticDependencies(content), [content])
		const allDependencyEntries = useMemo(
			() => [...staticDependencyEntries, ...dynamicDependencyEntries],
			[staticDependencyEntries, dynamicDependencyEntries],
		)

		// Enrich network entries with originalUrl/resolvedUrl from dependency mapping
		const enrichedNetworkEntries = useMemo(() => {
			if (allDependencyEntries.length === 0) return devConsole.networkEntries
			const urlMap = new Map<string, string>()
			for (const dep of allDependencyEntries) {
				if (dep.originalUrl !== dep.resolvedUrl) {
					urlMap.set(dep.originalUrl, dep.resolvedUrl)
				}
			}
			if (urlMap.size === 0) return devConsole.networkEntries
			return devConsole.networkEntries.map((entry) => {
				const resolvedUrl = urlMap.get(entry.url)
				return resolvedUrl ? { ...entry, originalUrl: entry.url, resolvedUrl } : entry
			})
		}, [devConsole.networkEntries, allDependencyEntries])

		// Expose iframe element and editor ref via ref
		useImperativeHandle(
			ref,
			() => ({
				getIframeElement: () => iframeRef.current,
				getEditorRef: () => editorRef,
				closeElementContextPanel,
				requestInspectorExit,
				consumeInspectorEscape,
				restartDocument: restartPreviewDocument,
				resetContent: () => {
					// Clear edit history
					if (editorRef.current) {
						editorRef.current.clearHistory().catch((error) => {
							console.error("清除编辑历史失败:", error)
						})
					}
					// Explicit reset discards the current document, including script state.
					restartPreviewDocument()
				},
				updateContent: async (
					newContent: string,
					options?: {
						// 允许调用方在取消/放弃时禁用选择模式恢复
						restoreSelectionMode?: boolean
					},
				) => {
					// Save current edit mode state before updating content
					const wasInEditMode = isEditMode
					// 默认恢复；仅显式传 false 时不恢复
					const shouldRestoreSelectionMode = options?.restoreSelectionMode !== false

					// Clear edit history and reset editor state
					if (editorRef.current) {
						await editorRef.current.clearHistory().catch((error) => {
							console.error("清除编辑历史失败:", error)
						})
						await editorRef.current.resetEditorState().catch((error) => {
							console.error("重置编辑器状态失败:", error)
						})
					}
					// Update iframe with new content
					let decodedContent = decodeHTMLEntities(newContent)

					// 如果是media场景，注入media脚本
					if (isMediaScenario) {
						decodedContent = injectMediaScript(decodedContent)
					}

					// 根据HTML文件上下文确定标记ID
					const markerId = getStorageMarkerId()
					if (!virtualStorageContext) return
					navigationRequestSequenceRef.current += 1
					const navigationRequestId = `${fileId || "html"}:${navigationRequestSequenceRef.current}`
					// 创建完整HTML内容
					const fullContent = getFullContent(decodedContent, markerId, {
						devicePreviewScrollbars: supportsDevicePreview
							? devicePreviewEnabled
							: undefined,
						dynamicInterception: dynamicResourceInterceptionConfig,
						containOverscroll: containIframeOverscroll,
						hideVerticalScroll,
						reportContentMetrics: documentFlowFullscreen,
						contentMetricsTargetOrigin,
						disableParentClickBridge: disableIframeDocumentClickBridge,
						enableTouchPinchZoom: isPptRender,
						enableInlineInspectorFallback,
						postMessageTargetStrategy,
						virtualStorage: virtualStorageContext,
						locationSearch: htmlNavigation?.search || "",
						locationAnchor: htmlNavigation?.hash || "",
						navigationRequestId,
						navigationBasePath: htmlEntryFilePath,
					})
					const request = {
						requestId: navigationRequestId,
						content: fullContent,
						locationSearch: htmlNavigation?.search || "",
						locationAnchor: htmlNavigation?.hash || "",
						runtimeUrl: htmlSandboxRuntimeUrl,
					}

					try {
						if (iframeRef.current?.contentWindow) {
							console.log("更新html内容为新版本")
							navigationRuntimeService.submit(request)

							// Re-enter selection mode after iframe content is replaced
							// Wait for iframe runtime to be ready, then restore edit mode
							if (wasInEditMode && shouldRestoreSelectionMode && editorRef.current) {
								// Wait a bit for iframe runtime to initialize
								setTimeout(async () => {
									try {
										await editorRef.current?.enableSelectionMode()
									} catch (error) {
										console.error("重新进入选择模式失败:", error)
									}
								}, 500)
							}
						} else {
							console.error("iframe或contentWindow不可用")
						}
					} catch (postError) {
						console.error("发送消息到iframe时出错:", postError)
					}
				},
				getContent: async () => {
					if (editorRef.current) {
						try {
							return await editorRef.current.getContent()
						} catch (error) {
							console.error("获取内容失败:", error)
							return null
						}
					}
					return null
				},
				getFetchInterceptedCallback: () => handleFetchIntercepted,
				toggleDevConsole: devConsole.toggle,
				startInspector: () => {
					startInToolbarMode()
				},
				stopInspector: () => {
					elementInspector.stop()
					resetInspectorSelection()
				},
				startInspectorAppend: () => {
					void (async () => {
						const prepare = inspectorCapturePrewarmRef.current
						const ready = prepare ? await prepare() : true
						if (!ready) return
						startInAppendMode()
					})()
				},
				startInspectorQuickSelect: () => {
					void (async () => {
						const prepare = inspectorCapturePrewarmRef.current
						const ready = prepare ? await prepare() : true
						if (!ready) return
						startInQuickSelectionMode()
					})()
				},
			}),
			[
				containIframeOverscroll,
				closeElementContextPanel,
				contentMetricsTargetOrigin,
				disableIframeDocumentClickBridge,
				devicePreviewEnabled,
				supportsDevicePreview,
				documentFlowFullscreen,
				dynamicResourceInterceptionConfig,
				fileId,
				htmlSandboxRuntimeUrl,
				getStorageMarkerId,
				hideVerticalScroll,
				injectMediaScript,
				isEditMode,
				isMediaScenario,
				isPptRender,
				htmlNavigation?.hash,
				htmlNavigation?.search,
				refreshIframeContent,
				restartPreviewDocument,
				htmlEntryFilePath,
				editorRef,
				handleFetchIntercepted,
				navigationRuntimeService,
				postMessageTargetStrategy,
				requestInspectorExit,
				devConsole.toggle,
				elementInspector,
				enableInlineInspectorFallback,
				consumeInspectorEscape,
				startInAppendMode,
				startInQuickSelectionMode,
				startInToolbarMode,
				resetInspectorSelection,
				virtualStorageContext,
			],
		)

		// 处理iframe中的图片上传请求
		const handleImageUploadRequest = (
			data: ImageUploadRequestPayload | LegacyImageUploadRequestData,
		) => {
			const isStructuredRequest = (
				requestData: ImageUploadRequestPayload | LegacyImageUploadRequestData,
			): requestData is ImageUploadRequestPayload => {
				return (
					"requestId" in requestData &&
					"action" in requestData &&
					"selector" in requestData &&
					"suggestedPath" in requestData
				)
			}

			const postStructuredImageUploadResult = (payload: ImageUploadResultPayload) => {
				iframeRef.current?.contentWindow?.postMessage(
					{
						type: "IMAGE_UPLOAD_RESULT",
						data: payload,
					},
					iframeTargetOrigin,
				)
			}

			const fileInput = document.createElement("input")
			fileInput.type = "file"
			fileInput.accept = "image/*"
			fileInput.style.display = "none"
			document.body.appendChild(fileInput)

			fileInput.addEventListener("change", async (e) => {
				const file = (e.target as HTMLInputElement).files?.[0]
				if (!file) {
					if (isStructuredRequest(data)) {
						postStructuredImageUploadResult({
							requestId: data.requestId,
							action: data.action,
							selector: data.selector,
							success: false,
							cancelled: true,
						})
					}
					document.body.removeChild(fileInput)
					return
				}

				try {
					magicToast.loading({
						content: t("topicFiles.fileUploading"),
						duration: 0,
					})

					const suggestedUploadPath = isStructuredRequest(data)
						? data.suggestedPath
						: "./images"
					const uploadPath = resolveImageUploadRequestPath(suggestedUploadPath, file.name)
					const uploadResult = await uploadImageFileToProject({
						file,
						path: uploadPath,
						fileSize: file.size,
					})
					const previewUrl = await fileToBase64(file)

					if (isStructuredRequest(data)) {
						postStructuredImageUploadResult({
							requestId: data.requestId,
							action: data.action,
							selector: data.selector,
							success: true,
							previewUrl,
							relativeFilePath: uploadResult.storedRelativeFilePath,
						})
					} else {
						iframeRef.current?.contentWindow?.postMessage(
							{
								type: "IMAGE_UPLOAD_RESULT",
								src: previewUrl,
								dataSrc: uploadResult.storedRelativeFilePath,
								targetSelector: data.targetSelector,
							},
							iframeTargetOrigin,
						)
					}

					void waitForProjectAttachmentChange(runtimeProjectId, {
						operations: ["add"],
						matchMode: "project-any-apply",
						fallback: "full-refresh",
						reason: "html-isolated-image-upload",
						callback: () => {
							magicToast.destroy()
							magicToast.success(t("topicFiles.fileUploadSuccess"))
						},
					})
					console.log(
						"图片已转换为base64并发送给iframe",
						iframeRef.current?.contentWindow,
					)
				} catch (error) {
					console.error("转换图片失败:", error)
					if (isStructuredRequest(data)) {
						postStructuredImageUploadResult({
							requestId: data.requestId,
							action: data.action,
							selector: data.selector,
							success: false,
							error: error instanceof Error ? error.message : "图片转换失败",
						})
					} else {
						iframeRef.current?.contentWindow?.postMessage(
							{
								type: "IMAGE_UPLOAD_RESULT",
								error: "图片转换失败",
								targetSelector: data.targetSelector,
							},
							iframeTargetOrigin,
						)
					}
					magicToast.destroy()
					magicToast.error(t("topicFiles.fileUploadError", "文件上传失败"))
				} finally {
					document.body.removeChild(fileInput)
				}
			})

			// 触发文件选择
			try {
				fileInput.click()
			} catch (error) {
				console.error("触发文件选择失败:", error)
				if (isStructuredRequest(data)) {
					postStructuredImageUploadResult({
						requestId: data.requestId,
						action: data.action,
						selector: data.selector,
						success: false,
						error: error instanceof Error ? error.message : "触发文件选择失败",
					})
				}
				document.body.removeChild(fileInput)
			}
		}

		// 将文件转换为base64的工具函数
		const fileToBase64 = (file: File): Promise<string> => {
			return new Promise((resolve, reject) => {
				const reader = new FileReader()
				reader.onload = () => resolve(reader.result as string)
				reader.onerror = () => reject(new Error("文件读取失败"))
				reader.readAsDataURL(file)
			})
		}

		const buildMessageLogContext = useMemoizedFn(
			(
				event: MessageEvent,
				messageType: string,
				extra: Record<string, unknown> = {},
			): Record<string, unknown> => {
				const href = typeof event.data?.href === "string" ? event.data.href : ""
				const autoEdit = event.data?.autoEdit === true

				return {
					messageType,
					href,
					autoEdit,
					origin: event.origin,
					fileId: fileId || "",
					relativeFilePath: htmlEntryFilePath,
					isPlaybackMode: Boolean(isPlaybackMode),
					userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
					...extra,
				}
			},
		)

		const handleMessage = useMemoizedFn(async (event: MessageEvent) => {
			const messageType = typeof event.data?.type === "string" ? event.data.type : ""
			const messageRequestId =
				typeof event.data?.navigationRequestId === "string"
					? event.data.navigationRequestId
					: ""
			const isExpectedSource = event.source === iframeRef.current?.contentWindow
			const isExpectedOrigin = event.origin === iframeTargetOrigin
			const isAllowedTelemetryOrigin =
				messageType === HTML_SANDBOX_TELEMETRY_MESSAGE &&
				Boolean(event.origin) &&
				(event.origin === iframeTargetOrigin || event.origin === window.location.origin)
			// Nested same-origin documents relay navigation through the host window. They
			// also report telemetry. Both cases must come from a verified descendant;
			// nested documents cannot invoke host capabilities that mutate the application.
			const isExpectedNestedSource =
				(messageType === "linkClicked" || messageType === HTML_SANDBOX_TELEMETRY_MESSAGE) &&
				isNestedIframeSource(iframeRef.current?.contentWindow, event.source)
			const isTrustedNestedMessage =
				isExpectedNestedSource &&
				((messageType === "linkClicked" && isExpectedOrigin) || isAllowedTelemetryOrigin)
			const isTrustedMessage =
				(isExpectedSource && isExpectedOrigin) || isTrustedNestedMessage

			// All host capabilities require the exact iframe source and origin. The only
			// exceptions are verified nested navigation and telemetry, whose source is a
			// descendant window rather than the top-level iframe window.
			if (!isTrustedMessage) {
				if (messageType === "linkClicked" || Boolean(event.data?.href)) {
					logger.report(
						"忽略 iframe 消息：source 或 origin 不匹配",
						buildMessageLogContext(event, messageType, {
							isExpectedSource,
							isExpectedOrigin,
						}),
					)
				}
				return
			}

			// 回收站 HTML 只展示保留内容，不授予嵌入页面操作宿主项目或会话的能力。
			if (
				fileAccess?.kind === "recycle-bin" &&
				([
					"MAGIC_FS_",
					"MAGIC_DB_",
					"MAGIC_LLM_",
					"MAGIC_CREATE_TOPIC_",
					"MAGIC_SEND_MESSAGE_",
					"MAGIC_UPLOAD_FILES_",
					"MAGIC_ADD_FILES_TO_MESSAGE_",
					"MAGIC_DOWNLOAD_FILES_",
				].some((prefix) => messageType.startsWith(prefix)) ||
					messageType === "MAGIC_SET_INPUT_MESSAGE")
			) {
				if (messageType.endsWith("_REQUEST"))
					iframeRef.current?.contentWindow?.postMessage(
						{
							type: messageType.replace(/_REQUEST$/, "_RESPONSE"),
							requestId: event.data.requestId,
							success: false,
							error: "Recycle bin content is read-only",
						},
						iframeTargetOrigin,
					)
				return
			}
			const requestBoundMessageTypes = [
				"contentLoaded",
				"domReady",
				"renderComplete",
				"pageFullyLoaded",
				"contentMetrics",
			]
			if (
				requestBoundMessageTypes.includes(messageType) &&
				messageRequestId &&
				navigationRuntimeService.getCurrentRequestId() &&
				!navigationRuntimeService.acceptsMessage(messageRequestId)
			) {
				return
			}

			// 检查是否是 EditorBridge 协议消息（由 MessageBridge 处理）
			// MessageBridge 的监听器会先处理新协议消息（有 version 字段的）
			// 这里只处理旧协议消息（没有 version 字段的）
			if (event.data?.version === "1.0.0") {
				// 新协议消息，由 MessageBridge 处理，这里跳过
				// 注意：MessageBridge 的监听器和这个监听器都会收到消息
				// MessageBridge 会处理新协议消息，这里只处理旧协议消息
				return
			}

			// The legacy iframe keyboard bridge sends Escape as a cancel message.
			// Dismiss the contextual style panel first; only the next Escape should
			// reach the page-level edit cancel handler.
			if (
				messageType === KEYBOARD_MESSAGE_TYPES.CANCEL &&
				event.data?.source === KEYBOARD_MESSAGE_TYPES.SOURCE &&
				closeElementContextPanel()
			) {
				event.stopImmediatePropagation()
				return
			}

			try {
				// 处理旧协议消息（没有 version 字段的）

				if (event.data && event.data.type === HTML_SANDBOX_TELEMETRY_MESSAGE) {
					const telemetryMessage = normalizeHtmlSandboxTelemetryMessage(event.data)
					if (!telemetryMessage || !isAllowedTelemetryOrigin) return
					const lifecycleReport = mapSandboxTelemetryToLifecycleReport(
						telemetryMessage.payload,
						event.origin,
					)

					if (lifecycleReport) {
						reportRenderLifecycleStage(lifecycleReport.stage, lifecycleReport.extra, {
							once: false,
						})
					}
					return
				}

				if (event.data && event.data.type === "iframeReady") {
					// iframe已准备好接收内容
					reportRenderLifecycleStage("iframe_ready", {
						origin: event.origin,
					})
					navigationRuntimeService.markShellReady()
					setIframeLoaded(true)
				} else if (event.data && event.data.type === "pageLoaded") {
					// Shell load 后再次兜底置为 ready，避免早期 iframeReady 丢失。
					reportRenderLifecycleStage("page_loaded", {
						origin: event.origin,
						isExpectedSource,
					})
					navigationRuntimeService.markShellReady()
					setIframeLoaded(true)
				} else if (event.data && event.data.type === "contentLoaded") {
					syncDeviceScrollbars()
					// 内容已写入iframe，但可能还未完成渲染
					reportRenderLifecycleStage("content_loaded")
					// 如果处于编辑模式，重置 contentInjected 状态以触发脚本重新注入
					// 因为 setContent 会清除 iframe 中的所有脚本，需要重新注入编辑脚本
					if (isEditMode) {
						// 重置 contentInjected 状态，这会触发 useHTMLEditorV2 中的 effect 重新运行
						// 从而重新注入编辑脚本并恢复编辑模式
						setContentInjected(false)
						// 使用 setTimeout 确保状态更新后立即重新设置为 true，触发 effect
						setTimeout(() => {
							setContentInjected(true)
						}, 0)
					}
				} else if (event.data && event.data.type === "domReady") {
					// DOM树构建完成
					reportRenderLifecycleStage("dom_ready")
				} else if (event.data && event.data.type === "renderComplete") {
					// iframe渲染真正完成，现在可以安全地计算缩放比例
					reportRenderLifecycleStage("render_complete")
					notifyRenderReady()
				} else if (event.data && event.data.type === "pageFullyLoaded") {
					// 页面完全加载完成（包括图片、样式表等）
					reportRenderLifecycleStage("page_fully_loaded")
					notifyRenderReady()
					// When sandbox doesn't support contentMetrics, unblock scaling after timeout
					if (shouldWaitForSettledContentMetrics) {
						if (contentMetricsFallbackTimerRef.current) {
							clearTimeout(contentMetricsFallbackTimerRef.current)
						}
						contentMetricsFallbackTimerRef.current = setTimeout(() => {
							setScalingContentMetrics((prev) => {
								if (prev?.phase === "settled") return prev
								const w = iframeRef.current?.offsetWidth ?? 0
								const h = iframeRef.current?.offsetHeight ?? 0
								if (w <= 0 || h <= 0) return prev
								return { contentWidth: w, contentHeight: h, phase: "settled" }
							})
						}, 1000)
					}
				} else if (event.data && event.data.type === "contentMetrics") {
					const contentWidth = Number(event.data?.contentWidth)
					const contentHeight = Number(event.data?.contentHeight)

					if (
						Number.isFinite(contentWidth) &&
						contentWidth > 0 &&
						Number.isFinite(contentHeight) &&
						contentHeight > 0
					) {
						const metricsPhase = event.data?.phase === "settled" ? "settled" : "initial"
						reportRenderLifecycleStage(
							metricsPhase === "settled"
								? "content_metrics_settled"
								: "content_metrics_initial",
							{
								contentWidth,
								contentHeight,
								hasHorizontalOverflow: event.data?.hasHorizontalOverflow === true,
								hasVerticalOverflow: event.data?.hasVerticalOverflow === true,
								verticalScrollbarWidth: Math.max(
									0,
									Number(event.data?.verticalScrollbarWidth) || 0,
								),
							},
						)
						// Real settled metrics arrived — cancel fallback timer
						if (metricsPhase === "settled" && contentMetricsFallbackTimerRef.current) {
							clearTimeout(contentMetricsFallbackTimerRef.current)
							contentMetricsFallbackTimerRef.current = null
						}
						const metricsPayload = {
							contentWidth,
							contentHeight,
							phase: metricsPhase,
							hasHorizontalOverflow: event.data?.hasHorizontalOverflow === true,
							hasVerticalOverflow: event.data?.hasVerticalOverflow === true,
							verticalScrollbarWidth: Math.max(
								0,
								Number(event.data?.verticalScrollbarWidth) || 0,
							),
						}

						if (!scaleContentDimensions) {
							setScalingContentMetrics((prev) => {
								if (prev?.phase === "settled" && metricsPhase !== "settled") {
									return prev
								}

								return {
									contentWidth,
									contentHeight,
									phase: metricsPhase,
								}
							})
						}
						onContentMetrics?.({
							contentWidth,
							contentHeight,
							phase: metricsPhase,
							hasHorizontalOverflow: metricsPayload.hasHorizontalOverflow,
							hasVerticalOverflow: metricsPayload.hasVerticalOverflow,
							verticalScrollbarWidth: metricsPayload.verticalScrollbarWidth,
						})
					}
				} else if (event.data && event.data.type === "linkClicked") {
					// 如果是回放模式，不处理链接点击
					if (isPlaybackMode) {
						logger.report(
							"回放模式忽略 iframe 链接点击",
							buildMessageLogContext(event, messageType, {
								isExpectedSource,
								isExpectedOrigin,
							}),
						)
						return
					}

					const href = typeof event.data?.href === "string" ? event.data.href : ""
					const autoEdit = event.data?.autoEdit === true
					// Ignore husky/shell rewrites after cancel resetContent.
					if (isHtmlPreviewShellNavigation(href, htmlSandboxShellUrl)) {
						logger.report(
							"忽略 iframe 预览壳重写导航",
							buildMessageLogContext(event, messageType, {
								isExpectedSource,
								isExpectedOrigin,
								href,
							}),
						)
						return
					}
					try {
						openNewTab(
							fileId || "",
							href,
							autoEdit,
							getHtmlNavigationIntent(event.data),
						)
					} catch (error) {
						logger.error({
							eventKey: "process_iframe_failed",
							errorKind: "render",
							error: error,
							message: "处理 iframe 链接点击失败",
							// 保留历史上报中的完整链接和错误详情，便于定位 iframe 跳转失败。
							context: buildMessageLogContext(event, messageType, {
								isExpectedSource,
								isExpectedOrigin,
								href,
								autoEdit,
							}),
						})
					}
				} else if (event.data && event.data.type === "DOWNLOAD_IMAGE") {
					console.log("下载图片", event.data)
					if (!event.data?.data?.dataUrl) {
						return
					}
					const link = document.createElement("a")
					link.download = event.data?.data?.fileName || ""
					link.href = event.data?.data?.dataUrl || ""

					// 触发下载
					document.body.appendChild(link)
					link.click()
					document.body.removeChild(link)
					console.log("图片下载成功")
				} else if (event.data && event.data.type === "REQUEST_IMAGE_UPLOAD") {
					if (!isExpectedSource) {
						logger.report(
							"忽略跨实例图片上传消息：source 不匹配",
							buildMessageLogContext(event, messageType, {
								isExpectedSource,
								isExpectedOrigin,
							}),
						)
						return
					}
					console.log("iframe请求图片上传", event.data)
					handleImageUploadRequest(event.data.data)
				} else if (event.data && event.data.type === "AI_OPTIMIZATION_ACTION") {
					console.log("AI优化操作", event.data)
					addContentToChat({
						attachmentList,
						file_id: fileId,
						t,
						payload: event.data,
					})
				} else if (event.data.type === "DOM_CLICK") {
					// console.log("DOM点击", event.data)
					// 关闭所有下拉菜单
					pubsub.publish(PubSubEvents.Close_All_Dropdowns)
					containerRef?.current?.click?.()
				} else if (event.data && event.data.type === "saveContent") {
					// Note: Legacy save mechanism (V1 editing script)
					// V2 editing mechanism uses MessageBridge and editorRef.current.save() instead
					// This is kept for backward compatibility if V1 script is still used somewhere
					console.log("收到旧版保存消息 (V1)", event.data)
					if (saveEditContent && typeof saveEditContent === "function") {
						const newContent = filterInjectedTags(event.data.content, filePathMapping)
						savePreparedEditContent(newContent, String(fileId))
					}
				} else if (event.data && event.data.type === MEDIA_MESSAGE_TYPES.SPEAKER_EDITED) {
					// 处理媒体说话人编辑事件
					handleMediaSpeakerEdit(event.data.detail)
				} else if (
					event.data &&
					event.data.type === MEDIA_MESSAGE_TYPES.IMAGE_URL_REQUEST
				) {
					// 处理marked.js图片路径解析请求
					await handleMediaImageUrlRequest(
						event,
						attachmentList || [],
						fileId || "",
						fileApi,
					)
				} else if (event.data?.type?.startsWith("MAGIC_FS_")) {
					// 处理 window.Magic.fs.* 请求
					await handleFSMessage(event.data.type, event.data)
				} else if (event.data?.type?.startsWith("MAGIC_LLM_")) {
					// 处理 window.Magic.llm.* 请求
					await handleLLMMessage(event.data.type, event.data)
				} else if (event.data?.type?.startsWith("MAGIC_DB_")) {
					// 处理 window.Magic.db.* 请求
					await handleDatabaseMessage(event.data.type, event.data)
				} else if (event.data && event.data.type === "MAGIC_CONTEXT_GET_REQUEST") {
					// 处理 window.Magic.getContext() 请求
					await handleContextMessage(event.data)
				} else if (
					event.data?.type?.startsWith("MAGIC_GET_AGENTS_") ||
					event.data?.type?.startsWith("MAGIC_CREATE_TOPIC_AND_SEND_") ||
					event.data?.type?.startsWith("MAGIC_SEND_MESSAGE_")
				) {
					// 处理 window.Magic.getAgents / createTopicAndSend / sendMessage 请求
					await handleAgentMessage(event.data.type, event.data)
				} else if (event.data?.type?.startsWith("MAGIC_GET_USER_INFO_")) {
					// 处理 window.Magic.user.getInfo() 请求
					await handleUserInfoMessage(event.data.type, event.data)
				} else if (event.data && event.data.type === "MAGIC_RELOAD_REQUEST") {
					// Reload only the requesting document, even when its source is unchanged.
					// Reuse the fresh-Window lifecycle instead of refreshing unrelated file tabs.
					resetInspectorSelection()
					restartPreviewDocument()
				} else if (event.data && event.data.type === "MAGIC_SET_INPUT_MESSAGE") {
					// 处理 window.Magic.setInputMessage() 请求
					const message = event.data.message
					if (typeof message === "string") {
						pubsub.publish(PubSubEvents.Set_Input_Message, message)
					}
				} else if (event.data && event.data.type === "MAGIC_UPLOAD_FILES_REQUEST") {
					// 处理 window.Magic.uploadFiles() 请求
					handleMagicUploadFiles(event.data)
				} else if (event.data && event.data.type === "MAGIC_ADD_FILES_TO_MESSAGE_REQUEST") {
					// 处理 window.Magic.addFilesToMessage() 请求
					handleMagicAddFilesToMessage(event.data)
				} else if (event.data && event.data.type === "MAGIC_DOWNLOAD_FILES_REQUEST") {
					// 处理 window.Magic.downloadFiles() 请求
					handleMagicDownloadFiles(event.data)
				} else if (event.data && event.data.type === "MAGIC_I18N_LANG_SUBSCRIBE") {
					// 处理 window.Magic.i18n.subscribe() 请求
					const payload = event.data as MagicI18nLangSubscribeRequest
					notifyIframeI18nLang("subscribe_ack", payload.requestId)
				}

				if (event.data && event.data.originalKey === "Escape") {
					if (!closeElementContextPanel()) {
						pubsub.publish(PubSubEvents.Exit_Fullscreen)
					}
				}
			} catch (error) {
				logger.error({
					eventKey: "process_iframe_message_failed",
					errorKind: "render",
					error: error,
					message: "处理 iframe message 失败",
					context: buildMessageLogContext(event, messageType, {
						isExpectedSource,
						isExpectedOrigin,
					}),
				})
			}
		})
		// 处理 iframe 内容更新：同源 /husky.html 和跨域渲染站都必须等 shell ready。
		const injectIframeContent = useMemoizedFn(
			(reason: "content_changed" | "visible_resume") => {
				hasRenderedOnceRef.current = false
				try {
					refreshIframeContent()
					setContentInjected(true)
					reportRenderLifecycleStage(
						"content_injected",
						{
							reason,
						},
						{ once: reason !== "visible_resume" },
					)
				} catch (error) {
					reportRenderLifecycleStage("content_inject_failed", {
						reason: "refresh_iframe_content_failed",
						errorMessage: error instanceof Error ? error.message : String(error),
						errorStack: error instanceof Error ? error.stack : undefined,
					})
					console.error("处理iframe内容时出错:", error)
					setContentInjected(false)
				}
			},
		)

		useDeepCompareEffect(() => {
			if (sandboxType !== "iframe" || !iframeRef.current || !content) return
			if (!iframeLoaded) return
			if (!virtualStorageContext) return

			injectIframeContent("content_changed")
		}, [
			content,
			htmlNavigation,
			iframeLoaded,
			htmlSandboxShellUrl,
			injectIframeContent,
			sandboxType,
			virtualStorageContext,
		])

		const previousIsVisibleRef = useRef(Boolean(isVisible))
		useEffect(() => {
			const wasVisible = previousIsVisibleRef.current
			const nextVisible = Boolean(isVisible)
			previousIsVisibleRef.current = nextVisible

			if (!isPptRender) return
			if (!nextVisible || wasVisible) return
			if (hasNotifiedRenderReadyRef.current) return
			if (sandboxType !== "iframe" || !iframeRef.current || !content) return
			if (!iframeLoaded) return
			if (!virtualStorageContext) return

			injectIframeContent("visible_resume")
		}, [
			content,
			iframeLoaded,
			injectIframeContent,
			isPptRender,
			isVisible,
			sandboxType,
			virtualStorageContext,
		])

		useEffect(() => {
			if (!isPptRender) return
			if (sandboxType !== "iframe") return
			if (!iframeRef.current?.contentWindow) return
			if (!contentInjected) return
			// Pause animations when slide is not visible
			iframeRef.current.contentWindow.postMessage(
				{
					type: "setAnimationState",
					paused: !isVisible || isPlaybackPaused,
				},
				iframeTargetOrigin,
			)
		}, [
			contentInjected,
			iframeTargetOrigin,
			isPptRender,
			isVisible,
			isPlaybackPaused,
			sandboxType,
		])

		useLayoutEffect(() => {
			window.addEventListener("message", handleMessage, true)
			return () => {
				window.removeEventListener("message", handleMessage, true)
			}
			//eslint-disable-next-line react-hooks/exhaustive-deps
		}, [])

		// 提供手动保存方法
		const triggerSave = useMemoizedFn(async () => {
			if (isMediaScenario) {
				// Media场景直接保存说话人配置
				saveMediaConfiguration()
			} else if ((isEditMode || buildPanelOpen) && editorRef.current) {
				// 使用新的编辑机制 V2 保存
				try {
					const saveResult = await editorRef.current.save()
					console.log("[IsolatedHTMLRenderer] 保存结果:", {
						success: saveResult.success,
						fileId: saveResult.fileId,
						contentLength: saveResult.cleanContent.length,
					})

					if (!saveResult.success) {
						console.error("[IsolatedHTMLRenderer] 保存失败")
					}

					// Return the exact saved content so conflict detection uses the correct baseline.
					return saveResult
				} catch (error) {
					console.error("保存内容时出错:", error)
					throw error
				}
			}
		})

		// 将保存方法暴露给父组件
		useEffect(() => {
			if (onSaveReady && iframeLoaded) {
				onSaveReady(triggerSave)
			}
		}, [iframeLoaded, onSaveReady, isMediaScenario, triggerSave])

		return (
			<div
				ref={scrollContainerRef}
				className={cx(
					styles.rendererContainer,
					hideVerticalScroll && styles.hiddenScrollbar,
					"relative flex min-h-0 w-full flex-1 bg-muted/25 dark:bg-muted/10",
					className,
				)}
				style={{
					display: "flex",
					flexDirection: "column",
					width: "100%",
					height: documentFlowFullscreen ? "auto" : "100%",
					minHeight: documentFlowFullscreen ? "100dvh" : undefined,
					overflow: documentFlowFullscreen
						? "visible"
						: hideVerticalScroll
							? "hidden"
							: undefined,
				}}
			>
				<div className="flex min-h-0 min-w-0 flex-1 flex-col">
					{/* 顶部工具栏与下方工作区共享同一个编辑器外框。 */}
					{sandboxType === "iframe" &&
						isEditMode &&
						!buildPanelOpen &&
						isVisible !== false &&
						isTabActive !== false && (
							<>
								<StylePanel
									variant="global"
									editorRef={editorRef as React.RefObject<HTMLEditorV2Ref>}
									disabled={isSaving}
									sidebarOpen={sidebarOpen}
									onToggleSidebar={handleToggleSidebar}
									toolbarEndRef={toolbarEndRef}
									className={cn(
										"!w-auto flex-shrink-0 border-b border-border/70 bg-card",
										toolbarClassName,
									)}
								/>
								<ElementContextPanel
									editorRef={editorRef as React.RefObject<HTMLEditorV2Ref>}
									anchor={selectedElementViewportRect}
									selector={selectedElementViewportRect?.selector}
									open={!isContextPanelDismissed}
									disabled={isSaving}
									boundaryRef={canvasViewportRef}
									onRevealMoreStyles={handleRevealMoreStyles}
								/>
							</>
						)}

					<div className="relative flex min-h-0 min-w-0 flex-1">
						<div
							ref={inspectorViewportRef}
							className="relative flex min-h-0 min-w-0 flex-1 flex-col"
						>
							{/* 可滚动内容容器 */}
							<div
								ref={containerRef}
								className={cx(
									hideVerticalScroll && styles.hiddenScrollbar,
									isPptRender && isManualZoom && styles.pptManualZoomScrollbar,
									cn(
										documentFlowFullscreen
											? "relative w-full"
											: "relative flex min-h-0 w-full flex-1 flex-col",
										devConsole.enabled && devConsoleLayout === "right"
											? "flex-row"
											: "flex-col",
										shouldApplyScaling && isFullscreen && "bg-black",
										shouldApplyScaling &&
											isEditMode &&
											!isFullscreen &&
											"bg-muted/45 dark:bg-muted/20",
										!shouldApplyScaling &&
											isEditMode &&
											"bg-muted/25 dark:bg-muted/10",
									),
								)}
								style={{
									overflow: documentFlowFullscreen
										? "visible"
										: hideVerticalScroll
											? "hidden"
											: shouldApplyScaling
												? isManualZoom
													? "auto"
													: "hidden"
												: "auto",
									minHeight: documentFlowFullscreen ? "100dvh" : 0,
								}}
							>
								{/* 工作区按真实列布局，DOM 树不会覆盖或参与画布缩放计算。 */}
								<div className="flex min-h-0 min-w-0 flex-1">
									<div
										ref={canvasViewportRef}
										onPointerDown={handleCanvasPointerDown}
										data-testid={
											isVisible !== false ? "html-editor-canvas" : undefined
										}
										className={
											documentFlowFullscreen
												? "relative w-full min-w-0"
												: "relative min-h-0 min-w-0 flex-1"
										}
									>
										<DevicePreviewViewport
											enabled={devicePreviewEnabled}
											config={devicePreview?.config ?? DEFAULT_DEVICE_PREVIEW}
											setConfig={
												devicePreview?.setConfig ??
												ignoreDevicePreviewChange
											}
											active={
												devicePreviewEnabled &&
												devicePreview?.active !== false &&
												isTabActive !== false &&
												isVisible !== false
											}
											identity={devicePreview?.identity || fileId || ""}
											contentRef={deviceContentRef}
											onDisplayScaleChange={setDeviceDisplayScale}
										>
											{/* 内容包装器，使用 flex 居中 iframe */}
											<div
												ref={contentWrapperRef}
												className={
													documentFlowFullscreen
														? "relative w-full"
														: "relative min-h-0 w-full flex-1"
												}
												style={
													documentFlowFullscreen
														? undefined
														: getContentWrapperStyle()
												}
											>
												{sandboxType === "iframe" ? (
													<>
														{/*
														 * 远程 shell URL 不能携带业务 query，因为 shell 服务可能会校验这些参数。
														 * 每次导航状态变化时重新创建 shell：复用同一个 iframe 并调用
														 * document.open/document.write 可能保留旧的 History URL，导致下一个
														 * HTML 文档仍然读取到之前的 query。
														 */}
														<iframe
															key={iframeRuntimeKey}
															ref={iframeRef}
															className={cn(
																styles.iframe,
																documentFlowFullscreen
																	? "w-full flex-shrink-0 border-none"
																	: "h-full w-full flex-shrink-0 border-none",
																iframeClassName,
															)}
															title="Isolated HTML Content"
															src={htmlSandboxShellUrl}
															onLoad={handleIframeElementLoad}
															onError={handleIframeElementError}
															sandbox="allow-scripts allow-modals allow-forms allow-same-origin allow-popups allow-downloads allow-pointer-lock allow-orientation-lock allow-presentation"
															allow="fullscreen; autoplay; microphone; camera; picture-in-picture; encrypted-media; web-share; clipboard-write"
															allowFullScreen
															translate="no"
															style={
																documentFlowIframeStyle ||
																getIframeStyle(
																	hasRenderedOnceRef.current,
																)
															}
															data-testid={
																isVisible !== false
																	? "isolated-html-content-iframe"
																	: undefined
															}
														/>
														{/* 拖拽放置覆盖层 - 拖拽图片时显示 */}
														{isEditMode &&
															isVisible !== false &&
															isGlobalDragActive && (
																<DropOverlay
																	visible={isDragOver}
																	onDragEnter={
																		dragOverHandlers.onDragEnter
																	}
																	onDragOver={
																		dragOverHandlers.onDragOver
																	}
																	onDragLeave={
																		dragOverHandlers.onDragLeave
																	}
																	onDrop={dragOverHandlers.onDrop}
																/>
															)}
													</>
												) : (
													<div
														className={styles.shadowHost}
														translate="no"
													/>
												)}
											</div>
										</DevicePreviewViewport>
										{sandboxType === "iframe" && (
											<>
												{/* 选择覆盖层 - 在父窗口中渲染元素高亮 */}
												{(isEditMode || buildPanelOpen) &&
													isVisible !== false && (
														<SelectionOverlay
															containerRef={
																devicePreviewEnabled
																	? canvasViewportRef
																	: contentWrapperRef
															}
															readOnly={buildPanelOpen || !isEditMode}
															scrollContainerRef={scrollContainerRef}
															iframeRef={iframeRef}
															editorRef={editorRef}
															scaleRatio={effectiveScaleRatio}
															isPptRender={
																shouldApplyScaling ||
																devicePreviewEnabled
															}
															layoutKey={deviceLayoutKey}
															disabled={isSaving}
															onSelectedElementChange={
																setSelectedElementRect
															}
															onSelectedElementViewportChange={
																setSelectedElementViewportRect
															}
															onElementMoveStart={() =>
																setIsContextPanelDismissed(true)
															}
															onElementMoveEnd={() =>
																setIsContextPanelDismissed(true)
															}
														/>
													)}
												{/* 元素检查覆盖层 - 独立于编辑模式 */}
												{isVisible !== false && (
													<ElementInspectorOverlay
														layoutKey={deviceLayoutKey}
														active={elementInspector.active}
														iframeRef={iframeRef}
														hoveredElement={
															elementInspector.hoveredElement
														}
														selectedElement={
															elementInspector.selectedElement
														}
														trackedRects={elementInspector.trackedRects}
														iframeScrollOffset={
															elementInspector.iframeScrollOffset ??
															undefined
														}
														onClearSelection={
															elementInspector.clearSelection
														}
														onInsertToConsole={(code) => {
															devConsole.executeCode(code)
														}}
														onSendToAgent={(content) => {
															pubsub.publish(
																PubSubEvents.Set_Input_Message,
																content,
															)
														}}
														hideInfoCard={inspectorHideInfoCard}
														multiSelectionActive={isAppendPicking}
														activeTarget={inspectorActiveTarget}
														draftInstruction={inspectorDraftInstruction}
														onDraftInstructionChange={
															setInspectorDraftInstruction
														}
														onConfirmTarget={confirmInspectorTarget}
														onCancelTarget={cancelInspectorTarget}
														pendingTargets={inspectorPendingTargets}
														submitState={inspectorSubmitState}
														submitError={inspectorSubmitError}
														onEditPendingTarget={
															isAppendPicking
																? editInspectorPendingTarget
																: undefined
														}
														onRemovePendingTarget={
															isAppendPicking
																? removeInspectorPendingTarget
																: undefined
														}
														onSubmitPendingTargets={
															isAppendPicking
																? submitInspectorPendingTargets
																: undefined
														}
														selectionMode={inspectorSelectionMode}
														onSelectionModeChange={
															updateInspectorSelectionMode
														}
														pendingPanelTopOffset={16}
														panelContainerRef={inspectorViewportRef}
														iframeTargetOrigin={iframeTargetOrigin}
														screenshotSupported
														onCaptureScreenshot={
															captureInspectorScreenshotTarget
														}
														onCaptureElementScreenshot={
															isAppendPicking || isQuickSelecting
																? attachInspectorElementScreenshot
																: undefined
														}
														onCapturePrewarmReady={
															registerInspectorCapturePrewarm
														}
														onExitMultiSelection={
															isAppendPicking
																? resetInspectorSelection
																: undefined
														}
														scaleRatio={effectiveScaleRatio}
													/>
												)}
											</>
										)}
									</div>
								</div>
								{/* DevTools 调试台 - 根据用户选择停靠在 iframe 底部或右侧 */}
								{sandboxType === "iframe" && devConsole.enabled && (
									<DevConsolePanel
										consoleEntries={devConsole.consoleEntries}
										networkEntries={enrichedNetworkEntries}
										apiCallEntries={devConsole.apiCallEntries}
										messageEntries={devConsole.messageEntries}
										storageSnapshot={devConsole.storageSnapshot}
										storageLoading={devConsole.storageLoading}
										sourceCode={content}
										rawSourceCode={rawSourceCode}
										processedSourceCode={processedSourceCode}
										dependencyEntries={allDependencyEntries}
										activeTab={devConsole.activeTab}
										onTabChange={devConsole.setActiveTab}
										onClearConsole={devConsole.clearConsole}
										onClearNetwork={devConsole.clearNetwork}
										onClearApiCalls={devConsole.clearApiCalls}
										onClearMessages={devConsole.clearMessages}
										onSendErrorToAgent={devConsole.sendErrorToAgent}
										onExecuteCode={devConsole.executeCode}
										onRequestCompletions={devConsole.requestCompletions}
										onRequestStorageSnapshot={devConsole.requestStorageSnapshot}
										onRefreshHtml={reloadIframeContent}
										consoleErrorCount={devConsole.consoleErrorCount}
										networkErrorCount={devConsole.networkErrorCount}
										apiCallErrorCount={devConsole.apiCallErrorCount}
										layout={devConsoleLayout}
										onLayoutChange={handleDevConsoleLayoutChange}
										onClose={() => {
											setDevConsoleEnabled(false)
											onDevConsoleClose?.()
										}}
										inspectorActive={elementInspector.active}
										onToggleInspector={elementInspector.toggle}
									/>
								)}
							</div>
						</div>
						{sandboxType === "iframe" &&
						isPptRender &&
						isVisible !== false &&
						isTabActive !== false &&
						buildPanelOpen &&
						isEditorReady ? (
							<PPTBuildPanel
								editorRef={editorRef}
								contentRevision={domTreeRevision}
								disabled={isSaving}
								onCommit={isEditMode ? undefined : onBuildSave}
								onClose={() => onBuildPanelOpenChange?.(false)}
							/>
						) : null}
						{!buildPanelOpen &&
						sandboxType === "iframe" &&
						isEditMode &&
						isVisible !== false &&
						sidebarOpen ? (
							<EditorSidebar
								structureExpanded={structureExpanded}
								stylesExpanded={stylesExpanded}
								onStructureExpandedChange={setStructureExpanded}
								onStylesExpandedChange={setStylesExpanded}
								structure={
									<DOMTreePanel
										editorRef={editorRef as React.RefObject<HTMLEditorV2Ref>}
										visible
										selectedSelector={selectedElementSelector}
										contentRevision={domTreeRevision}
									/>
								}
								styles={
									<MoreStylesPanel
										editorRef={editorRef as React.RefObject<HTMLEditorV2Ref>}
										disabled={isSaving}
									/>
								}
							/>
						) : null}
					</div>
				</div>
			</div>
		)
	},
)

// 包装组件，提供 StylePanelStore 上下文
const IsolatedHTMLRendererComponent = forwardRef<
	IsolatedHTMLRendererRef,
	IsolatedHTMLRendererProps
>((props, ref) => {
	return (
		<StylePanelStoreProvider>
			<IsolatedHTMLRendererInner ref={ref} {...props} />
		</StylePanelStoreProvider>
	)
})

export default IsolatedHTMLRendererComponent
