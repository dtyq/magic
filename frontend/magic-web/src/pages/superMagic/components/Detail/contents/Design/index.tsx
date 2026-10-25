// import CanvasDesignHeader from "./components/CanvasDesignHeader"
import { createStyles } from "antd-style"
import { useState, useCallback, useRef, useEffect, lazy, Suspense, useMemo } from "react"
import { DesignData } from "./types"
import type { FileItem } from "@/pages/superMagic/components/Detail/components/FilesViewer/types"
import type { Topic, ProjectListItem } from "@/pages/superMagic/pages/Workspace/types"
import MagicModal from "@/components/base/MagicModal"
import MagicSpin from "@/components/base/MagicSpin"
import MagicToaster from "@/components/base/MagicToaster"
import { useTranslation } from "react-i18next"
import useShareRoute from "@/pages/superMagic/hooks/useShareRoute"
import { useFileAccess } from "@/pages/superMagic/fileAccess/FileAccessProvider"
import { shouldWaitForShareAccess } from "@/pages/superMagic/fileAccess/fileAccessContext"
import { useFileApi } from "@/pages/superMagic/fileAccess/fileApi"
import { useIsMobile } from "@/hooks/useIsMobile"
import { useDesignMethods } from "./hooks/useDesignMethods"
import { useDesignMarker } from "./hooks/useDesignMarker"
import pubsub from "@/utils/pubsub"
import { useSuperMagicMarkerManager } from "./marker-manager"
import { useDesignProjectManager } from "./hooks/useDesignProjectManager"
import {
	getDesignDirectoryInfo,
	fileItemsToProjectAttachmentMentionTree,
	normalizePath,
	normalizeMentionFolderId,
	resolveActualDesignCurrentFile,
	resolveDesignProjectBasePathFromAttachments,
} from "./utils/utils"
import { resolveDesignCanvasResourceFileItem } from "./utils/designResourceReferenceResolver"
import { FlexBox } from "@/components/base"
import { observer } from "mobx-react-lite"
import workspaceStore from "@/pages/superMagic/stores/core/workspace"
import type {
	CanvasDesignDataChangeMeta,
	CanvasDesignDataPatch,
	CanvasDesignRef,
	CanvasAccessMode,
	CanvasCapability,
} from "@/components/CanvasDesign/public/props"
import { useDesignFocusElement } from "./hooks/useDesignFocusElement"
import { useAttachments } from "./hooks/useAttachments"
import { useCanvasImageFileRenameSync } from "./hooks/useCanvasImageFileRenameSync"
import type {
	CanvasDeviceInfo,
	CanvasDocument,
	CanvasFileElement,
	LayerElement,
} from "@/components/CanvasDesign/runtime/document/types"
import { getDefaultCanvasDeviceInfo } from "@/components/CanvasDesign/runtime/shared/ids"
import CanvasDesignHeaderV2 from "./components/CanvasDesignHeaderV2"
import { useDesignHeaderProps } from "./components/CanvasDesignHeaderV2/useDesignHeaderProps"
import { CanvasDesignMentionDataService } from "./adapters/CanvasDesignMentionDataService"
import { CanvasDesignReferenceResourcePanel } from "./adapters/CanvasDesignReferenceResourcePanel"
import { MentionExtension } from "@/components/business/MentionPanel/tiptap-plugin"
import mentionPanelStore from "@/components/business/MentionPanel/builtin-store"
import { setCanvasElementResourceGetter } from "@/components/business/MentionPanel/runtime/builtin/domains/canvas-elements"
import { useDesignDownloadPolicy } from "./hooks/useDesignDownloadPolicy"
import { HISTORY_VERSION_BANNER_LAYOUT_HEIGHT_PX } from "@/pages/superMagic/components/Detail/components/CommonHeader/components/HistoryVersionBanner"
import { resolveDesignAccessMode, type DesignRemoteUpdateListenerMode } from "./managers/types"
import { useCanvasResourceRefresh } from "./hooks/useCanvasResourceRefresh"
import { waitForNextAttachmentsRefreshForProject } from "@/pages/superMagic/services/attachmentsTopicSync"
import { useNetwork } from "ahooks"
import { AlertTriangle, CloudOff } from "lucide-react"
import { CanvasUpgradeOverlay } from "./components/CanvasUpgradeBanner"
import { toast } from "sonner"
import { AssetsApi, buildAssetVisibility } from "@/apis"
import { assetLibrarySessionStore } from "@/components/CanvasDesign/runtime/resources/asset/AssetLibrarySessionStore"
import { AssetAgreementModal } from "@/pages/superMagic/components/AssetAgreementModal"
import { applyCanvasDocumentPatch } from "@/components/CanvasDesign/runtime/document"
import { prewarmCanvasDesignImageWorker } from "@/components/CanvasDesign/prewarm"
import { designBuiltinPlugins } from "./plugins/options"
import {
	UploadSubDir,
	type CanvasAssetResourceInfo,
	type CanvasLocalAssetUploadMode,
	type CanvasEditAssetTarget,
	type CanvasOpenSaveAssetDialogParams,
} from "@/components/CanvasDesign/public/magic-types"
import type { DesignDraftReason } from "./utils/designDraftStorage"
import type { DesignSaveMetadata } from "./managers"
import { canUseDesignPlugins } from "./utils/pluginAccess"
import { userStore } from "@/models/user"
import { getHydratedElementDetailsProvenance } from "./utils/elementDetailsIo"
import { useCanvasSelectionMentionPublisher } from "./hooks/useCanvasSelectionMentionPublisher"
import SaveAssetToLibraryDialog from "./components/SaveAssetToLibraryDialog"
import {
	bindMediaContentToAsset,
	type ImageContentAssetBindingParams,
} from "@/components/CanvasDesign/runtime/resources/asset/imageContentAssetBinding"
import { useTerminateGeneratingImages } from "./hooks/useTerminateGeneratingImages"

prewarmCanvasDesignImageWorker("super-magic-design-module")

const CanvasDesign = lazy(() => import("@/components/CanvasDesign"))

const REMOTE_CANVAS_UPDATE_SUPPRESS_MS = 500

const DESIGN_REMOTE_UPDATE_LISTENER_MODE: DesignRemoteUpdateListenerMode = "file-change" as const

const useStyles = createStyles(({ token }) => ({
	designViewerContainer: {
		width: "100%",
		height: "100%",
		display: "flex",
		flexDirection: "column",
		position: "relative",
	},
	designCanvasContainer: {
		flex: 1,
		width: "100%",
		height: "100%",
		position: "relative",
	},
	revokeOverlay: {
		position: "absolute",
		top: 0,
		left: 0,
		right: 0,
		bottom: 0,
		backgroundColor: "rgba(255, 255, 255, 0.3)",
		backdropFilter: "blur(2px)",
		display: "flex",
		alignItems: "center",
		justifyContent: "center",
		zIndex: 1000,
		pointerEvents: "all",
	},
	revokeOverlayContent: {
		display: "flex",
		flexDirection: "column",
		alignItems: "center",
		gap: "16px",
		color: "#fff",
	},
	offlineNotice: {
		position: "absolute",
		top: "16px",
		left: "50%",
		zIndex: 50,
		display: "flex",
		alignItems: "center",
		gap: "10px",
		maxWidth: "calc(100% - 32px)",
		padding: "10px 14px",
		borderRadius: "12px",
		border: `1px solid ${token.colorWarningBorder}`,
		backgroundColor: token.colorWarningBg,
		boxShadow: token.boxShadowSecondary,
		color: token.colorText,
		transform: "translateX(-50%)",
		pointerEvents: "none",
	},
	offlineIcon: {
		flex: "none",
		color: token.colorWarning,
	},
	offlineText: {
		display: "flex",
		flexDirection: "column",
		gap: "2px",
		minWidth: 0,
	},
	offlineTitle: {
		fontSize: "13px",
		fontWeight: 600,
		lineHeight: "18px",
		whiteSpace: "nowrap",
	},
	offlineDescription: {
		fontSize: "12px",
		lineHeight: "16px",
		color: token.colorTextSecondary,
		whiteSpace: "nowrap",
	},
	conflictNotice: {
		position: "absolute",
		top: "16px",
		left: "50%",
		zIndex: 70,
		display: "flex",
		alignItems: "center",
		gap: "12px",
		flexWrap: "wrap",
		width: "min(920px, calc(100% - 32px))",
		padding: "12px 14px",
		borderRadius: "8px",
		border: `1px solid ${token.colorWarningBorder}`,
		backgroundColor: token.colorWarningBg,
		boxShadow: token.boxShadowSecondary,
		color: token.colorText,
		transform: "translateX(-50%)",
	},
	conflictIcon: {
		flex: "none",
		color: token.colorWarning,
	},
	conflictContent: {
		display: "flex",
		flex: 1,
		flexDirection: "column",
		gap: "3px",
		minWidth: 0,
	},
	conflictTitle: {
		fontSize: "13px",
		fontWeight: 600,
		lineHeight: "18px",
	},
	conflictDescription: {
		fontSize: "12px",
		lineHeight: "16px",
		color: token.colorTextSecondary,
	},
	conflictActions: {
		display: "flex",
		flex: "none",
		alignItems: "center",
		gap: "8px",
		flexWrap: "wrap",
	},
	conflictActionButton: {
		height: "28px",
		padding: "0 10px",
		borderRadius: "6px",
		border: `1px solid ${token.colorBorder}`,
		backgroundColor: token.colorBgContainer,
		color: token.colorText,
		fontSize: "12px",
		fontWeight: 500,
		lineHeight: "26px",
		cursor: "pointer",
		whiteSpace: "nowrap",
		"&[data-variant='primary']": {
			borderColor: token.colorPrimary,
			backgroundColor: token.colorPrimary,
			color: token.colorWhite,
		},
		"&:disabled": {
			cursor: "not-allowed",
			opacity: 0.6,
		},
	},
}))

function resolveDesignPluginDirectories(options: {
	flatAttachments?: FileItem[]
	designProjectBasePath?: string
}) {
	const { flatAttachments, designProjectBasePath } = options
	if (!flatAttachments?.length) return []

	const pluginRootPath = normalizePath(
		[normalizePath(designProjectBasePath ?? ""), UploadSubDir.Plugins]
			.filter(Boolean)
			.join("/"),
	)
	const pluginRootPrefix = `${pluginRootPath}/`
	const directories = new Set<string>()

	flatAttachments.forEach((item) => {
		if (!item.is_directory || !item.relative_file_path) return
		const relativePath = normalizePath(item.relative_file_path)
		if (!relativePath.startsWith(pluginRootPrefix)) return

		const pluginDirectory = relativePath.slice(pluginRootPrefix.length)
		if (!pluginDirectory || pluginDirectory.includes("/")) return
		directories.add(pluginDirectory)
	})

	return Array.from(directories)
}

interface DesignViewerProps {
	attachments?: FileItem[]
	attachmentList?: FileItem[]
	/** 当前项目附件快照是否已完成首次加载。 */
	attachmentsReady?: boolean
	/** Project id forwarded by standalone/native preview when no selected topic exists. */
	projectId?: string
	currentFile?: {
		id: string
		name: string
		type: string
		url?: string
		projectId?: string
		projectName?: string
	}
	selectedTopic?: Topic | null
	selectedProject?: ProjectListItem | null
	/** 是否为话题回放模式 */
	isPlaybackMode?: boolean
	allowEdit: boolean
	showFileHeader: boolean
	showFooter: boolean
	allowDownload?: boolean
	isTabActive?: boolean
	isFullscreen?: boolean
	onFullscreen?: () => void
	onRegisterSaveHandler?: (handler: (() => Promise<void>) | null) => void
	data?: {
		project_path?: string
		elements?: LayerElement[]
	}
}

function DesignViewer(props: DesignViewerProps) {
	const {
		attachments,
		attachmentList,
		currentFile: currentFileProps,
		selectedTopic,
		selectedProject,
		projectId: projectIdProp,
		isPlaybackMode = false,
		allowEdit,
		showFileHeader,
		allowDownload,
		isTabActive,
		isFullscreen,
		onFullscreen,
		onRegisterSaveHandler,
	} = props
	// Prefer the topic project, then standalone preview, then the selected project.
	const projectId = selectedTopic?.project_id || projectIdProp || selectedProject?.id

	// 文件列表更新处理
	const { flatAttachments, attachmentsReady, attachmentIndex, updateAttachments } =
		useAttachments({
			attachments,
			attachmentList,
			projectId,
		})

	const propsElements = props.data?.elements

	const { styles } = useStyles()
	const { t } = useTranslation("super")
	const { t: canvasDesignT } = useTranslation("canvasDesign")
	const { i18n } = useTranslation()
	const { online } = useNetwork()
	const isOffline = online === false

	const hostUiLocale = i18n.resolvedLanguage ?? i18n.language

	const currentFile = useMemo(() => {
		const actualCurrentFile = resolveActualDesignCurrentFile({
			currentFile: currentFileProps,
			flatAttachments,
			attachments,
			projectPath: props.data?.project_path,
		})
		if (!actualCurrentFile) return currentFileProps
		return {
			...(currentFileProps ?? {}),
			...actualCurrentFile,
		}
	}, [attachments, currentFileProps, flatAttachments, props.data?.project_path])

	// 从 store 获取 selectedWorkspace（参考文件列表的实现）
	const selectedWorkspace = workspaceStore.selectedWorkspace

	// 检测是否是分享场景
	const { isShareRoute } = useShareRoute()
	const fileAccess = useFileAccess()
	const fileApi = useFileApi()

	// 检测是否是移动端
	const isMobile = useIsMobile()
	const initialAccessMode: CanvasAccessMode = resolveDesignAccessMode({
		allowEdit,
		isPlaybackMode,
		isShareRoute,
		isMobile,
		isOffline,
	})

	// 用于强制重新挂载 CanvasDesign 的 key
	const [canvasDesignKey, setCanvasDesignKey] = useState(0)
	const [isBasePathSwitching, setIsBasePathSwitching] = useState(false)

	const refreshCanvasDesign = useCallback(() => {
		setCanvasDesignKey((prev) => prev + 1)
	}, [])

	const prevDesignProjectBasePathRef = useRef<string | undefined>(undefined)
	const basePathSwitchTaskIdRef = useRef(0)

	// 获取目录信息
	const directoryInfo = useMemo(() => {
		return getDesignDirectoryInfo(currentFile, attachments)
	}, [currentFile, attachments])

	const defaultProjectAttachmentFolderId = useMemo(() => {
		return normalizeMentionFolderId(directoryInfo.path) || directoryInfo.id || undefined
	}, [directoryInfo.id, directoryInfo.path])

	const defaultProjectAttachmentFolderName = useMemo(() => {
		return directoryInfo.name || undefined
	}, [directoryInfo.name])

	// 相对于根目录的路径, 例如 "新建文件夹/新建画布"
	const designProjectBasePath = resolveDesignProjectBasePathFromAttachments({
		currentFile,
		flatAttachments,
		attachments,
	})

	// 与 MessageEditor @ 同源：整棵附件树（保留目录层级，由 MentionPanel 展开）
	const projectAttachmentMentionTree = useMemo(
		() => fileItemsToProjectAttachmentMentionTree(attachments, designProjectBasePath),
		[attachments, designProjectBasePath],
	)
	const canvasPluginConfig = useMemo(
		() => ({
			builtin: designBuiltinPlugins,
			user: {
				rootPath: `./${UploadSubDir.Plugins}`,
				directories: resolveDesignPluginDirectories({
					flatAttachments,
					designProjectBasePath,
				}),
			},
		}),
		[designProjectBasePath, flatAttachments],
	)

	// CanvasDesign ref（需在 designProjectManager 之前，onRemoteDesignDataUpdate 回调中使用）
	const canvasDesignRef = useRef<CanvasDesignRef | null>(null)
	const isApplyingRemoteCanvasUpdateRef = useRef(false)
	const remoteCanvasUpdateReleaseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
	const suppressCanvasDesignChangeEvents = useCallback((applyUpdate: () => void) => {
		if (remoteCanvasUpdateReleaseTimerRef.current) {
			clearTimeout(remoteCanvasUpdateReleaseTimerRef.current)
			remoteCanvasUpdateReleaseTimerRef.current = null
		}
		isApplyingRemoteCanvasUpdateRef.current = true
		try {
			applyUpdate()
		} finally {
			remoteCanvasUpdateReleaseTimerRef.current = setTimeout(() => {
				isApplyingRemoteCanvasUpdateRef.current = false
				remoteCanvasUpdateReleaseTimerRef.current = null
			}, REMOTE_CANVAS_UPDATE_SUPPRESS_MS)
		}
	}, [])

	// 初始加载按项目/画布身份去重；同一实例切换画布时，旧请求不能阻止新画布加载。
	const initialLoadIdentity = currentFile?.id
		? JSON.stringify([projectId ?? null, currentFile.id, fileApi.identityKey])
		: null
	const currentInitialLoadIdentityRef = useRef(initialLoadIdentity)
	const loadedInitialLoadIdentityRef = useRef<string | null>(null)
	currentInitialLoadIdentityRef.current = initialLoadIdentity
	const wasOfflineRef = useRef(isOffline)

	// magic.project.js 与 designData 集中管理器（含 autoSave、远端更新监听、版本管理）
	const designProjectManager = useDesignProjectManager({
		currentFile,
		attachments,
		flatAttachments,
		attachmentsReady,
		attachmentIndex,
		projectId,
		allowEdit,
		isPlaybackMode,
		isShareRoute,
		isMobile,
		isOffline,
		accessMode: initialAccessMode,
		projectPath: props.data?.project_path,
		designProjectId: directoryInfo.id || currentFile?.id,
		designProjectName: directoryInfo.name ?? "",
		selectedTopicId: selectedTopic?.id,
		remoteUpdateListenerMode: DESIGN_REMOTE_UPDATE_LISTENER_MODE,
		onRemoteDesignDataUpdate: useCallback(
			(_oldDesignData: DesignData, newDesignData: DesignData) => {
				const nextCanvas = newDesignData.canvas
				if (nextCanvas) {
					suppressCanvasDesignChangeEvents(() => {
						canvasDesignRef.current?.updateData(nextCanvas, {
							elementDetailsProvenance:
								getHydratedElementDetailsProvenance(newDesignData),
						})
					})
				}
			},
			[suppressCanvasDesignChangeEvents],
		),
		onVersionChange: useCallback(
			(_designData: DesignData, isViewingHistory: boolean) => {
				suppressCanvasDesignChangeEvents(() => {
					refreshCanvasDesign()
					if (isViewingHistory) refreshCanvasDesign()
				})
			},
			[refreshCanvasDesign, suppressCanvasDesignChangeEvents],
		),
	})

	const {
		designData,
		elementDetailsProvenance,
		setElementDetailsProvenance,
		updateDesignData,
		updateDesignDataAndScheduleSave,
		persistLocalDraft,
		persistLocalDraftAndWait,
		hasUnsavedChanges,
		magicProjectJsFileId,
		isInitialLoading,
		pendingDesignUpgrade,
		designLoadIssue,
		sidecarStatus,
		clearDesignLoadIssue,
		persistPendingDesignUpgrade,
		// isSaving - 迁移后不再用于头部保存状态指示器，暂时注释掉，如需使用可取消注释
		loadFromRemote,
		reloadPreservingLocalDraft,
		reloadCurrentVersion,
		reloadDiscardingLocalDraft,
		accessMode,
		fileVersionsList,
		fileVersion,
		isNewestVersion,
		handleChangeFileVersion,
		handleReturnLatest,
		handleVersionRollback,
		fetchFileVersions,
		conflictState,
		resolveElementConflictWithLocal,
		resolveElementConflictWithRemote,
		resolveConnectionConflictWithLocal,
		resolveConnectionConflictWithRemote,
		resolveBlockingConflictWithRemote,
		resolveBlockingConflictWithLocal,
		resolveEditedElementConflictsWithLocal,
		manualSave,
	} = designProjectManager

	const { isProcessingRevoke, revokeType } = designProjectManager

	const latestDesignDataRef = useRef(designData)
	const isInitialLoadingRef = useRef(isInitialLoading)
	const [isVersionActionLoading, setIsVersionActionLoading] = useState(false)

	useEffect(() => {
		latestDesignDataRef.current = designData
	}, [designData])

	useEffect(() => {
		isInitialLoadingRef.current = isInitialLoading
	}, [isInitialLoading])
	const [isUpgrading, setIsUpgrading] = useState(false)
	const [autoUpgradeFailed, setAutoUpgradeFailed] = useState(false)
	const [upgradeProgress, setUpgradeProgress] = useState(0)
	const autoUpgradeTaskKeyRef = useRef<string | null>(null)
	const upgradeProgressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

	const clearUpgradeProgressTimer = useCallback(() => {
		if (!upgradeProgressTimerRef.current) return
		clearInterval(upgradeProgressTimerRef.current)
		upgradeProgressTimerRef.current = null
	}, [])

	useEffect(() => clearUpgradeProgressTimer, [clearUpgradeProgressTimer])

	const shouldAutoUpgrade =
		!isInitialLoading &&
		!!pendingDesignUpgrade &&
		(accessMode === "edit" ||
			(accessMode === "readonly" && pendingDesignUpgrade.reason === "sidecar-retry")) &&
		isNewestVersion &&
		sidecarStatus !== "unsupported" &&
		!conflictState

	const automaticUpgradeKey = useMemo(() => {
		if (!shouldAutoUpgrade || !projectId || !magicProjectJsFileId || !pendingDesignUpgrade) {
			return null
		}
		return [
			projectId,
			magicProjectJsFileId,
			pendingDesignUpgrade.sourceVersion,
			pendingDesignUpgrade.targetVersion,
			designProjectBasePath ?? "",
		].join(":")
	}, [
		designProjectBasePath,
		magicProjectJsFileId,
		pendingDesignUpgrade,
		projectId,
		shouldAutoUpgrade,
	])

	useEffect(() => {
		setAutoUpgradeFailed(false)
		if (!automaticUpgradeKey) autoUpgradeTaskKeyRef.current = null
	}, [automaticUpgradeKey])

	const handleUpgrade = useCallback(async () => {
		if (!pendingDesignUpgrade || isUpgrading) return

		setIsUpgrading(true)
		setAutoUpgradeFailed(false)
		setUpgradeProgress(8)
		clearUpgradeProgressTimer()
		upgradeProgressTimerRef.current = setInterval(() => {
			setUpgradeProgress((current) => {
				if (current >= 92) return current
				return Math.min(92, current + Math.max(1, Math.ceil((92 - current) * 0.12)))
			})
		}, 350)

		try {
			const didPersist = await persistPendingDesignUpgrade()
			if (!didPersist) throw new Error("Canvas DSL upgrade was not fully persisted")

			clearUpgradeProgressTimer()
			setUpgradeProgress(100)
			await new Promise((resolve) => setTimeout(resolve, 300))
			updateAttachments()
			toast.success(t("design.upgrade.success"))
		} catch {
			clearUpgradeProgressTimer()
			setUpgradeProgress(0)
			setAutoUpgradeFailed(true)
			toast.error(t("design.upgrade.failed"))
		} finally {
			setIsUpgrading(false)
		}
	}, [
		clearUpgradeProgressTimer,
		isUpgrading,
		pendingDesignUpgrade,
		persistPendingDesignUpgrade,
		t,
		updateAttachments,
	])

	useEffect(() => {
		if (!automaticUpgradeKey || isOffline || isUpgrading || autoUpgradeFailed) return
		if (autoUpgradeTaskKeyRef.current === automaticUpgradeKey) return

		autoUpgradeTaskKeyRef.current = automaticUpgradeKey
		void handleUpgrade()
	}, [autoUpgradeFailed, automaticUpgradeKey, handleUpgrade, isOffline, isUpgrading])

	const isUpgradeBlockingCanvas = shouldAutoUpgrade && !isOffline
	const shouldShowUpgradeProgress =
		isUpgrading || (shouldAutoUpgrade && !isOffline && !autoUpgradeFailed)
	const shouldShowUpgradeFailed =
		shouldAutoUpgrade && !isOffline && autoUpgradeFailed && !isUpgrading
	const isBlockingDesignLoadIssue =
		!!designLoadIssue &&
		designLoadIssue.kind !== "unsupported-sidecar" &&
		designLoadIssue.kind !== "sidecar-persist-failed"
	const shouldShowUnsupportedSidecarNotice =
		designLoadIssue?.kind === "unsupported-sidecar" || sidecarStatus === "unsupported"
	const [isReloadingDesignIssue, setIsReloadingDesignIssue] = useState(false)
	const handleReloadDesignIssue = useCallback(async () => {
		if (isReloadingDesignIssue) return
		setIsReloadingDesignIssue(true)
		clearDesignLoadIssue()
		try {
			await reloadPreservingLocalDraft()
		} finally {
			setIsReloadingDesignIssue(false)
		}
	}, [clearDesignLoadIssue, isReloadingDesignIssue, reloadPreservingLocalDraft])

	// 当 designProjectBasePath 变化（目录改名）时，重新从远端加载 DSL（修复旧路径引用），再重挂载画布
	useEffect(() => {
		if (prevDesignProjectBasePathRef.current === undefined) {
			prevDesignProjectBasePathRef.current = designProjectBasePath
			return
		}

		if (prevDesignProjectBasePathRef.current !== designProjectBasePath) {
			const prevPath = prevDesignProjectBasePathRef.current
			const nextPath = designProjectBasePath
			// Tab switch can briefly drop attachments/currentFile, which makes the path empty.
			// That is not a directory rename; keep the last real path and skip reload.
			if (!prevPath || !nextPath) {
				if (nextPath) prevDesignProjectBasePathRef.current = nextPath
				return
			}

			prevDesignProjectBasePathRef.current = nextPath
			const taskId = basePathSwitchTaskIdRef.current + 1
			basePathSwitchTaskIdRef.current = taskId
			setIsBasePathSwitching(true)

			void (async () => {
				try {
					await waitForNextAttachmentsRefreshForProject(projectId, {
						timeoutMs: 15_000,
					})
					if (basePathSwitchTaskIdRef.current !== taskId) return

					await reloadDiscardingLocalDraft()
					if (basePathSwitchTaskIdRef.current !== taskId) return

					refreshCanvasDesign()
				} finally {
					if (basePathSwitchTaskIdRef.current === taskId) {
						setIsBasePathSwitching(false)
					}
				}
			})()
		}
	}, [designProjectBasePath, projectId, refreshCanvasDesign, reloadDiscardingLocalDraft])

	// 设计容器 ref
	const containerRef = useRef<HTMLDivElement>(null)
	const [floatingBoundary, setFloatingBoundary] = useState<HTMLElement | null>(null)
	const floatingBoundaryRef = useCallback((node: HTMLDivElement | null) => {
		setFloatingBoundary(node)
	}, [])

	// 获取显示名称，优先使用目录名称
	const displayName = directoryInfo.name || designData.name

	// 设计项目 ID
	const designProjectId = directoryInfo.id || currentFile?.id || ""
	const isCanvasSelectionMentionsEnabled = accessMode === "edit" && isTabActive !== false
	const resolveCanvasResourceFile = useCallback(
		(src: string) =>
			resolveDesignCanvasResourceFileItem(src, {
				flatAttachments,
				designProjectBasePath,
				attachmentIndex,
			}) ?? null,
		[attachmentIndex, designProjectBasePath, flatAttachments],
	)
	const getLatestCanvasDocument = useCallback(() => latestDesignDataRef.current.canvas, [])
	const publishCanvasSelectionMentions = useCanvasSelectionMentionPublisher({
		canvasDesignRef,
		designProjectId,
		enabled: isCanvasSelectionMentionsEnabled,
		scope: {
			workspaceId: selectedWorkspace?.id,
			projectId,
			topicId: selectedTopic?.id,
			designProjectId,
		},
		getFallbackDocument: getLatestCanvasDocument,
		resolveFileBySrc: resolveCanvasResourceFile,
	})
	useTerminateGeneratingImages(canvasDesignRef)

	const videoPointsEstimateCacheScope = useMemo(
		() =>
			[
				projectId ?? "",
				designProjectId ?? "",
				designProjectBasePath ?? "",
				currentFile?.id ?? "",
			].join(":"),
		[projectId, designProjectId, designProjectBasePath, currentFile?.id],
	)

	useEffect(() => {
		if (!designProjectId) {
			if (isTabActive !== false) {
				mentionPanelStore.clearActiveCanvasElementsContext()
			}
			setCanvasElementResourceGetter(designProjectId, null)
			return
		}

		if (isTabActive === false) {
			mentionPanelStore.clearActiveCanvasElementsContext(designProjectId)
			setCanvasElementResourceGetter(designProjectId, null)
			return
		}

		mentionPanelStore.setActiveCanvasElementsContext({
			designProjectId,
			canvasName: displayName || "当前画布",
			getCanvasDocument: () =>
				canvasDesignRef.current?.exportCurrentDocument?.() ??
				latestDesignDataRef.current.canvas ??
				null,
			resolveFileBySrc: resolveCanvasResourceFile,
		})
		setCanvasElementResourceGetter(
			designProjectId,
			() => canvasDesignRef.current?.getCanvasInstance() ?? null,
		)

		return () => {
			mentionPanelStore.clearActiveCanvasElementsContext(designProjectId)
			setCanvasElementResourceGetter(designProjectId, null)
		}
	}, [designProjectId, displayName, isTabActive, resolveCanvasResourceFile])

	const downloadPolicy = useDesignDownloadPolicy()
	const getContentViewElement = useCallback(
		(element: CanvasFileElement) =>
			canvasDesignRef.current?.getCanvasInstance()?.getElementForContentView(element) ??
			element,
		[],
	)

	const designCanvasMagicPermissions = useMemo(
		() => ({
			...downloadPolicy.permissions,
			allowFileDownload: allowDownload !== false && (allowEdit || allowDownload === true),
			elementMenuConversationActions: isNewestVersion && !isShareRoute,
			showPluginEntry: canUseDesignPlugins(userStore.user.organizationCode),
		}),
		[allowDownload, allowEdit, downloadPolicy.permissions, isNewestVersion, isShareRoute],
	)

	const handleExitFullscreen = useCallback(async () => {
		if (isFullscreen) {
			onFullscreen?.()
		}
	}, [isFullscreen, onFullscreen])

	// 使用 SuperMagic Marker Manager（需在 useDesignMethods 之前）
	const markerManager = useSuperMagicMarkerManager()

	// 缓存 markers 避免每次 render 都调用 getMarkers
	const [markersForCanvas, setMarkersForCanvas] = useState(() => {
		return markerManager.getMarkers(designProjectId ?? "")
	})
	type SaveAssetDialogSession =
		| { kind: "workspace"; params: CanvasOpenSaveAssetDialogParams }
		| {
				kind: "local-file"
				file: File
				mode: CanvasLocalAssetUploadMode
				onSaved: (asset: CanvasAssetResourceInfo) => void
				onClosed: () => void
		  }
		| {
				kind: "edit"
				asset: CanvasEditAssetTarget
				onUpdated: () => void
				onClosed: () => void
		  }
	const [saveAssetDialogSession, setSaveAssetDialogSession] =
		useState<SaveAssetDialogSession | null>(null)
	const saveAssetDialogSessionRef = useRef<SaveAssetDialogSession | null>(null)
	saveAssetDialogSessionRef.current = saveAssetDialogSession
	const [assetAgreementVisible, setAssetAgreementVisible] = useState(false)
	const assetAgreementResolverRef = useRef<((signed: boolean) => void) | null>(null)
	const assetAgreementSignedActionRef = useRef<(() => void) | null>(null)
	const openSaveAssetToLibraryDialog = useCallback(
		(params: CanvasOpenSaveAssetDialogParams) =>
			setSaveAssetDialogSession({ kind: "workspace", params }),
		[],
	)
	const openEditAssetDialog = useCallback(
		(params: { asset: CanvasEditAssetTarget; onUpdated: () => void; onClosed: () => void }) =>
			setSaveAssetDialogSession({ kind: "edit", ...params }),
		[],
	)
	const openSaveLocalAssetDialog = useCallback(
		(params: {
			file: File
			mode: CanvasLocalAssetUploadMode
			onSaved: (asset: CanvasAssetResourceInfo) => void
			onClosed: () => void
		}) => setSaveAssetDialogSession({ kind: "local-file", ...params }),
		[],
	)
	const closeSaveAssetDialog = useCallback(() => {
		const current = saveAssetDialogSessionRef.current
		if (current?.kind === "local-file" || current?.kind === "edit") current.onClosed()
		setSaveAssetDialogSession(null)
	}, [])
	const ensureAssetAgreementSigned = useCallback(async (options?: { onSigned?: () => void }) => {
		const signed = await assetLibrarySessionStore.getAssetAgreementSigned()
		if (signed) return true
		assetAgreementSignedActionRef.current = options?.onSigned ?? null
		return await new Promise<boolean>((resolve) => {
			assetAgreementResolverRef.current = resolve
			setAssetAgreementVisible(true)
		})
	}, [])
	const settleAssetAgreement = useCallback((signed: boolean) => {
		const resolve = assetAgreementResolverRef.current
		assetAgreementResolverRef.current = null
		setAssetAgreementVisible(false)
		resolve?.(signed)
	}, [])

	// 使用 hook 获取 methods 方法集合
	const baseMethods = useDesignMethods({
		getContentViewElement,
		projectId,
		designProjectId,
		selectedTopic,
		currentFile,
		flatAttachments,
		attachmentsReady,
		attachmentIndex,
		selectedProject,
		selectedWorkspace,
		onExitFullscreen: handleExitFullscreen,
		updateAttachments,
		downloadPolicy,
		openSaveAssetToLibraryDialog,
		openSaveLocalAssetDialog,
		openEditAssetDialog,
		ensureAssetAgreementSigned,
	})
	const getBaseFileInfo = baseMethods.getFileInfo

	const getSaveAssetPreviewUrl = useCallback(
		async (path: string) => {
			const isVideo = /\.(mp4|mov|webm)(?:$|[?#])/i.test(path)
			const fileInfo = await getBaseFileInfo(path, { useImageProcess: !isVideo })
			return fileInfo?.src
		},
		[getBaseFileInfo],
	)
	const bindSavedAssetToImageContent = useCallback((params: ImageContentAssetBindingParams) => {
		const canvas = canvasDesignRef.current?.getCanvasInstance()
		if (!canvas) return "target-missing" as const
		return bindMediaContentToAsset(canvas, params)
	}, [])

	// 注入 Manager 依赖（getCanvasElements、methods、pubsub 等）
	useEffect(() => {
		if (!designProjectId) return undefined
		return markerManager.registerDependencies(designProjectId, {
			getCanvasElements: (id) =>
				id === designProjectId ? { elements: designData.canvas?.elements } : null,
			getElementImageInfo: (elementId: string) => {
				// 尝试从画布获取图片信息（画布打开时优先使用）
				return (
					canvasDesignRef.current?.getElementImageInfo(elementId) ?? Promise.resolve(null)
				)
			},
			getFileInfo: baseMethods.getFileInfo,
			getAssetResourceInfo: baseMethods.getAssetResourceInfo,
			uploadPrivateFiles: baseMethods.uploadPrivateFiles,
			identifyImageMark: baseMethods.identifyImageMark,
			publishToMessageEditor: (event, payload) => pubsub.publish(event, payload),
			projectId,
			topicId: selectedTopic?.id,
			getImageOssUrl: (elementId: string) =>
				canvasDesignRef.current?.getImageOssUrl(elementId) ?? Promise.resolve(null),
		})
	}, [
		markerManager,
		designProjectId,
		designData.canvas?.elements,
		baseMethods.getFileInfo,
		baseMethods.getAssetResourceInfo,
		baseMethods.uploadPrivateFiles,
		baseMethods.identifyImageMark,
		projectId,
		selectedTopic?.id,
	])

	// 使用 hook 处理 marker 相关逻辑
	const { handleMarkerCreated, handleMarkerDeleted, handleMarkerUpdated, handleMarkerRestored } =
		useDesignMarker({
			canvas: designData.canvas,
			methods: baseMethods,
			projectId,
			designProjectId,
			markerManager,
			topicId: selectedTopic?.id,
			displayName, // marker 显示仍需要名称
			canvasDesignRef,
			selectedProject,
			selectedWorkspace,
			t,
		})

	useEffect(
		() => () => {
			if (remoteCanvasUpdateReleaseTimerRef.current) {
				clearTimeout(remoteCanvasUpdateReleaseTimerRef.current)
				remoteCanvasUpdateReleaseTimerRef.current = null
			}
		},
		[],
	)

	// 事件处理
	useDesignFocusElement({
		designProjectId,
		isInitialLoading,
		canvasDesignRef,
		isPlaybackMode,
		resolveFileBySrc: resolveCanvasResourceFile,
	})

	// 获取画布设备信息：布局沿用业务断点，输入能力由画布统一检测
	const getDevice = useCallback((): CanvasDeviceInfo => {
		return {
			...getDefaultCanvasDeviceInfo(),
			layout: isMobile ? "compact" : "regular",
		}
	}, [isMobile])

	const persistCanvasData = useCallback(
		(canvasData: CanvasDocument, metadata?: DesignSaveMetadata) => {
			updateDesignDataAndScheduleSave((draft) => {
				draft.canvas = canvasData
			}, metadata)
			latestDesignDataRef.current = {
				...latestDesignDataRef.current,
				canvas: canvasData,
			}
		},
		[updateDesignDataAndScheduleSave],
	)

	const persistCanvasDataPatch = useCallback(
		(patch: CanvasDesignDataPatch): CanvasDocument | undefined => {
			let nextCanvasData: CanvasDocument | undefined
			updateDesignDataAndScheduleSave(
				(draft) => {
					nextCanvasData = applyCanvasDocumentPatch(draft.canvas, patch)
					draft.canvas = nextCanvasData
				},
				{
					source: "canvas-patch",
					deletedElementIds: patch.deletedElementIds,
				},
			)
			if (nextCanvasData) {
				latestDesignDataRef.current = {
					...latestDesignDataRef.current,
					canvas: nextCanvasData,
				}
			}
			return nextCanvasData
		},
		[updateDesignDataAndScheduleSave],
	)

	const persistCanvasDataLocally = useCallback(
		(
			canvasData: CanvasDocument,
			options?: { immediate?: boolean; reason?: DesignDraftReason },
		) => {
			const nextDesignData: DesignData = {
				...latestDesignDataRef.current,
				canvas: canvasData,
			}
			latestDesignDataRef.current = nextDesignData
			updateDesignData(() => nextDesignData)
			persistLocalDraft(nextDesignData, options)
		},
		[persistLocalDraft, updateDesignData],
	)

	const persistCanvasPatchLocally = useCallback(
		(patch: CanvasDesignDataPatch): CanvasDocument | undefined => {
			const nextCanvasData = applyCanvasDocumentPatch(
				latestDesignDataRef.current.canvas,
				patch,
			)
			persistCanvasDataLocally(nextCanvasData)
			return nextCanvasData
		},
		[persistCanvasDataLocally],
	)

	const resolveEditedElementConflictsFromPatch = useCallback(
		(patch: CanvasDesignDataPatch, nextCanvasData: CanvasDocument | undefined) => {
			if (!nextCanvasData) return
			const editedElementIds = Array.from(
				new Set([...patch.changedElementIds, ...patch.deletedElementIds]),
			)
			if (editedElementIds.length === 0) return

			const nextDesignData: DesignData = {
				...latestDesignDataRef.current,
				canvas: nextCanvasData,
			}
			resolveEditedElementConflictsWithLocal(editedElementIds, nextDesignData, {
				source: "canvas-patch",
				deletedElementIds: patch.deletedElementIds,
			})
		},
		[resolveEditedElementConflictsWithLocal],
	)

	const persistCurrentCanvasDraftImmediately = useCallback(
		async (reason: DesignDraftReason = "pagehide") => {
			if (
				fileVersion !== undefined ||
				isVersionActionLoading ||
				isInitialLoadingRef.current
			) {
				return null
			}
			const currentCanvasData = canvasDesignRef.current?.exportCurrentDocument?.()
			const latestCanvasData = latestDesignDataRef.current.canvas
			const currentElementCount = currentCanvasData?.elements?.length ?? 0
			const latestElementCount = latestCanvasData?.elements?.length ?? 0
			// Canvas 在初始化/恢复期间可能暂时导出空文档。此时保留最近一次可信数据，
			// 避免 pagehide 把远端非空画布覆盖成本地空草稿。
			if (currentCanvasData && (currentElementCount > 0 || latestElementCount === 0)) {
				const nextDesignData: DesignData = {
					...latestDesignDataRef.current,
					canvas: currentCanvasData,
				}
				latestDesignDataRef.current = nextDesignData
				updateDesignData(() => nextDesignData)
				const writeResult = await persistLocalDraftAndWait(nextDesignData, {
					immediate: true,
					reason,
				})
				return { designData: nextDesignData, durable: writeResult?.durable ?? false }
			}
			const nextDesignData = latestDesignDataRef.current
			const writeResult = await persistLocalDraftAndWait(nextDesignData, {
				immediate: true,
				reason,
			})
			return { designData: nextDesignData, durable: writeResult?.durable ?? false }
		},
		[fileVersion, isVersionActionLoading, persistLocalDraftAndWait, updateDesignData],
	)

	const persistCurrentCanvasDraftImmediatelyRef = useRef(persistCurrentCanvasDraftImmediately)
	const manualSaveRef = useRef(manualSave)
	const hasUnsavedChangesRef = useRef(hasUnsavedChanges)

	useEffect(() => {
		persistCurrentCanvasDraftImmediatelyRef.current = persistCurrentCanvasDraftImmediately
	}, [persistCurrentCanvasDraftImmediately])

	useEffect(() => {
		manualSaveRef.current = manualSave
	}, [manualSave])

	useEffect(() => {
		hasUnsavedChangesRef.current = hasUnsavedChanges
	}, [hasUnsavedChanges])

	// 重新初始化页面（用于刷新按钮）
	const handleReinitialize = useCallback(async () => {
		// 先更新 markersForCanvas，并保留当前画布内尚未落远端的编辑。
		setMarkersForCanvas(markerManager.getMarkers(designProjectId ?? ""))
		if (fileVersion !== undefined) {
			await reloadCurrentVersion()
		} else {
			persistCurrentCanvasDraftImmediately("manual-refresh")
			await reloadPreservingLocalDraft()
		}
		refreshCanvasDesign()
		if (magicProjectJsFileId && fetchFileVersions && !isShareRoute) {
			await fetchFileVersions()
		}
	}, [
		fileVersion,
		reloadCurrentVersion,
		reloadPreservingLocalDraft,
		refreshCanvasDesign,
		magicProjectJsFileId,
		fetchFileVersions,
		isShareRoute,
		markerManager,
		designProjectId,
		persistCurrentCanvasDraftImmediately,
	])

	const runVersionActionWithLoading = useCallback(
		async (action: () => Promise<void>) => {
			if (isVersionActionLoading) return
			setIsVersionActionLoading(true)
			try {
				await action()
			} finally {
				setIsVersionActionLoading(false)
			}
		},
		[isVersionActionLoading],
	)

	const handleChangeFileVersionWithLoading = useCallback(
		(version: number, isNewestVersionTarget: boolean) =>
			runVersionActionWithLoading(() =>
				handleChangeFileVersion(version, isNewestVersionTarget),
			),
		[handleChangeFileVersion, runVersionActionWithLoading],
	)

	const handleReturnLatestWithLoading = useCallback(
		() => runVersionActionWithLoading(() => handleReturnLatest()),
		[handleReturnLatest, runVersionActionWithLoading],
	)

	const handleVersionRollbackWithLoading = useCallback(
		(version?: number) => runVersionActionWithLoading(() => handleVersionRollback(version)),
		[handleVersionRollback, runVersionActionWithLoading],
	)

	// 获取 CommonHeaderV2 的 props（定位到文件时定位到 magic.project.js）
	const headerProps = useDesignHeaderProps({
		locateFileId: magicProjectJsFileId ?? undefined,
		currentFile,
		projectId,
		selectedProject,
		attachments,
		fileVersion,
		isNewestVersion,
		fileVersionsList,
		allowEdit,
		allowDownload,
		isFullscreen,
		onFullscreen,
		handleReinitialize,
		handleChangeFileVersion: handleChangeFileVersionWithLoading,
		handleReturnLatest: handleReturnLatestWithLoading,
		handleVersionRollback: handleVersionRollbackWithLoading,
	})

	const imageRename = useCanvasImageFileRenameSync({
		canvasDesignRef,
		currentCanvasData: designData.canvas,
		flatAttachments,
		attachmentsReady,
		attachmentIndex,
		designProjectBasePath,
		projectId,
		persistCanvasData,
		updateAttachments,
	})

	const methods = useMemo(() => ({ ...baseMethods, imageRename }), [baseMethods, imageRename])

	// 处理画布数据变化（用户编辑，触发自动保存）
	const handleCanvasDesignDataChange = useCallback(
		(canvasData: CanvasDocument, meta?: CanvasDesignDataChangeMeta) => {
			mentionPanelStore.invalidateActiveCanvasElementsCache()
			if (isApplyingRemoteCanvasUpdateRef.current) {
				return
			}
			const metadata: DesignSaveMetadata = {
				source: "canvas-full-export",
				deletedElementIds: meta?.deletedElementIds,
			}
			if (isOffline) {
				persistCanvasDataLocally(canvasData)
				resolveEditedElementConflictsWithLocal(meta?.changedElementIds ?? [], {
					...latestDesignDataRef.current,
					canvas: canvasData,
				})
				return
			}

			persistCanvasData(canvasData, metadata)
			resolveEditedElementConflictsWithLocal(meta?.changedElementIds ?? [], {
				...latestDesignDataRef.current,
				canvas: canvasData,
			})
		},
		[
			isOffline,
			persistCanvasData,
			persistCanvasDataLocally,
			resolveEditedElementConflictsWithLocal,
		],
	)

	const handleCanvasDesignDataPatchChange = useCallback(
		(patch: CanvasDesignDataPatch) => {
			mentionPanelStore.invalidateActiveCanvasElementsCache()
			if (isApplyingRemoteCanvasUpdateRef.current) {
				return
			}
			if (isOffline) {
				const nextCanvasData = persistCanvasPatchLocally(patch)
				resolveEditedElementConflictsFromPatch(patch, nextCanvasData)
				return
			}

			const nextCanvasData = persistCanvasDataPatch(patch)
			resolveEditedElementConflictsFromPatch(patch, nextCanvasData)
		},
		[
			isOffline,
			persistCanvasDataPatch,
			persistCanvasPatchLocally,
			resolveEditedElementConflictsFromPatch,
		],
	)

	useEffect(() => {
		const handlePageLeave = () => {
			persistCurrentCanvasDraftImmediatelyRef.current()
		}

		window.addEventListener("pagehide", handlePageLeave)
		window.addEventListener("beforeunload", handlePageLeave)
		return () => {
			handlePageLeave()
			window.removeEventListener("pagehide", handlePageLeave)
			window.removeEventListener("beforeunload", handlePageLeave)
		}
	}, [])

	useCanvasResourceRefresh({
		canvasDesignRef,
		canvas: designData.canvas,
		flatAttachments,
		attachmentsReady,
		attachmentIndex,
		designProjectBasePath,
		projectId,
		isNewestVersion,
		isPlaybackMode,
	})

	// 处理名称变化（用户编辑，触发自动保存）
	// 注意：迁移到 CommonHeaderV2 后，头部不再有名称编辑器，此函数保留用于其他可能的用途
	// const handleNameChange = useCallback(
	// 	(name: string) => {
	// 		updateDesignDataAndScheduleSave((draft) => {
	// 			draft.name = name
	// 		})
	// 	},
	// 	[updateDesignDataAndScheduleSave],
	// )

	// 适配 CanvasDesign 的 TFunction 类型
	// 从 canvasDesign 命名空间加载翻译
	const canvasDesignTAdapter = useCallback(
		(key: string, options?: string | Record<string, unknown>) => {
			let result: string | object
			// 从 canvasDesign 命名空间加载翻译
			if (typeof options === "string") {
				result = canvasDesignT(key, { defaultValue: options, ns: "canvasDesign" })
			} else if (options && typeof options === "object") {
				// 如果 options 中有 defaultValue，使用它；否则使用 canvasDesign 命名空间的翻译
				const defaultValue = "defaultValue" in options ? options.defaultValue : undefined
				result = canvasDesignT(key, {
					...options,
					defaultValue: defaultValue || key,
					ns: "canvasDesign",
				})
			} else {
				result = canvasDesignT(key, { defaultValue: key, ns: "canvasDesign" })
			}
			// 确保返回值始终是字符串
			return typeof result === "string" ? result : String(result)
		},
		[canvasDesignT],
	)

	// 组件挂载时加载初始数据
	// 监听附件快照变化，确保附件数据准备完成后再加载
	// 这样可以避免在 attachments 未加载完成时就尝试查找文件，导致找不到文件但 isInitialLoading 被设置为 false
	// 同一项目/画布只加载一次；文件切换时以新身份重新加载。
	useEffect(() => {
		if (!initialLoadIdentity || loadedInitialLoadIdentityRef.current === initialLoadIdentity) {
			return
		}

		if (!attachmentsReady) {
			return
		}

		if (!currentFile?.id || !currentFile?.name) {
			return
		}

		if (shouldWaitForShareAccess(fileAccess)) {
			return
		}

		const requestIdentity = initialLoadIdentity
		void (async () => {
			try {
				const didLoad = await loadFromRemote()
				if (!didLoad || currentInitialLoadIdentityRef.current !== requestIdentity) {
					return
				}
				loadedInitialLoadIdentityRef.current = requestIdentity
				if (isMobile) {
					setTimeout(() => {
						canvasDesignRef.current?.fitToScreen()
					}, 1)
				}
				if (isPlaybackMode) {
					setTimeout(() => {
						if (propsElements) {
							canvasDesignRef.current?.focusElement(
								propsElements.map((element) => element.id),
								{
									animated: false,
									selectElement: false,
								},
							)
						} else {
							canvasDesignRef.current?.fitToScreen()
						}
					}, 100)
				}
			} catch {
				// 加载失败时保持 loading 状态，等待后续附件快照变化触发重试。
			}
		})()
	}, [
		attachments,
		attachmentsReady,
		currentFile?.id,
		currentFile?.name,
		fileAccess,
		flatAttachments,
		initialLoadIdentity,
		isMobile,
		isPlaybackMode,
		loadFromRemote,
		propsElements,
	])

	useEffect(() => {
		const wasOffline = wasOfflineRef.current
		wasOfflineRef.current = isOffline

		if (wasOffline && !isOffline && isNewestVersion && !isPlaybackMode) {
			void refreshCanvasDesign()
		}
	}, [
		allowEdit,
		isMobile,
		isNewestVersion,
		isOffline,
		isPlaybackMode,
		isShareRoute,
		refreshCanvasDesign,
	])

	const conflictNoticeText = useMemo(() => {
		if (!conflictState) return null
		if (
			conflictState.elementConflicts?.some(({ status }) => status === "unresolved") ||
			conflictState.connectionConflicts?.some(({ status }) => status === "unresolved")
		) {
			return null
		}
		const isDraftConflict = conflictState.reason === "draft-remote-advanced"
		return {
			title: t(
				isDraftConflict
					? "design.conflict.draftConflictTitle"
					: "design.conflict.syncPausedTitle",
			),
			description: t(
				isDraftConflict
					? "design.conflict.draftConflictDescription"
					: "design.conflict.syncPausedDescription",
			),
			remoteActionLabel: t(
				isDraftConflict ? "design.conflict.useRemote" : "design.conflict.useRemoteContinue",
			),
			localActionLabel: t(
				isDraftConflict
					? "design.conflict.restoreDraftAndSave"
					: "design.conflict.keepLocalAndSave",
			),
			localConfirmTitle: t(
				isDraftConflict
					? "design.conflict.restoreDraftConfirmTitle"
					: "design.conflict.keepLocalConfirmTitle",
			),
			localConfirmDescription: t(
				isDraftConflict
					? "design.conflict.restoreDraftConfirmDescription"
					: "design.conflict.keepLocalConfirmDescription",
			),
			localConfirmOkText: t(
				isDraftConflict
					? "design.conflict.restoreDraftAndSave"
					: "design.conflict.keepLocalAndSave",
			),
		}
	}, [conflictState, t])

	const unresolvedElementConflictIds = useMemo(
		() =>
			(conflictState?.elementConflicts ?? [])
				.filter(({ status }) => status === "unresolved")
				.map(({ elementId }) => elementId),
		[conflictState?.elementConflicts],
	)
	const unresolvedConnectionConflictIds = useMemo(
		() =>
			(conflictState?.connectionConflicts ?? [])
				.filter(({ status }) => status === "unresolved")
				.map(({ connectionId }) => connectionId),
		[conflictState?.connectionConflicts],
	)
	const [locallyResolvedElementConflictIds, setLocallyResolvedElementConflictIds] = useState<
		Set<string>
	>(() => new Set())
	const [locallyResolvedConnectionConflictIds, setLocallyResolvedConnectionConflictIds] =
		useState<Set<string>>(() => new Set())

	useEffect(() => {
		setLocallyResolvedElementConflictIds((prev) => {
			if (prev.size === 0) return prev

			const unresolvedElementIds = new Set(unresolvedElementConflictIds)
			const next = new Set(
				Array.from(prev).filter((elementId) => unresolvedElementIds.has(elementId)),
			)
			return next.size === prev.size ? prev : next
		})
	}, [unresolvedElementConflictIds])

	useEffect(() => {
		setLocallyResolvedConnectionConflictIds((prev) => {
			if (prev.size === 0) return prev

			const unresolvedConnectionIds = new Set(unresolvedConnectionConflictIds)
			const next = new Set(
				Array.from(prev).filter((connectionId) =>
					unresolvedConnectionIds.has(connectionId),
				),
			)
			return next.size === prev.size ? prev : next
		})
	}, [unresolvedConnectionConflictIds])

	const hasUnresolvedElementConflicts = unresolvedElementConflictIds.length > 0
	const hasUnresolvedConnectionConflicts = unresolvedConnectionConflictIds.length > 0
	const visibleElementConflicts = useMemo(
		() =>
			(conflictState?.elementConflicts ?? []).filter(
				({ elementId, status }) =>
					status === "unresolved" && !locallyResolvedElementConflictIds.has(elementId),
			),
		[conflictState?.elementConflicts, locallyResolvedElementConflictIds],
	)
	const visibleConnectionConflicts = useMemo(
		() =>
			(conflictState?.connectionConflicts ?? []).filter(
				({ connectionId, status }) =>
					status === "unresolved" &&
					!locallyResolvedConnectionConflictIds.has(connectionId),
			),
		[conflictState?.connectionConflicts, locallyResolvedConnectionConflictIds],
	)
	const elementActionHints = useMemo(
		() =>
			visibleElementConflicts.map(
				({ elementId, reason, status, localElement, remoteElement }) => ({
					elementId,
					reason,
					status,
					tone: "warning" as const,
					localExists: !!localElement,
					remoteExists: !!remoteElement,
				}),
			),
		[visibleElementConflicts],
	)
	const connectionActionHints = useMemo(
		() =>
			visibleConnectionConflicts.map(
				({
					connectionId,
					reason,
					status,
					baseConnection,
					localConnection,
					remoteConnection,
				}) => {
					const anchorConnection = localConnection ?? remoteConnection ?? baseConnection
					return {
						connectionId,
						sourceElementId: anchorConnection?.sourceElementId,
						targetElementId: anchorConnection?.targetElementId,
						reason,
						status,
						tone: "warning" as const,
						localExists: !!localConnection,
						remoteExists: !!remoteConnection,
					}
				},
			),
		[visibleConnectionConflicts],
	)
	const shouldBlockCanvasForConflict =
		!!conflictState && !hasUnresolvedElementConflicts && !hasUnresolvedConnectionConflicts
	const shouldShowCanvasConflictNotice = shouldBlockCanvasForConflict && !!conflictNoticeText
	const canvasAccessMode: CanvasAccessMode = accessMode

	useEffect(() => {
		if (!onRegisterSaveHandler) return
		if (canvasAccessMode !== "edit" || isInitialLoading) {
			onRegisterSaveHandler(null)
			return
		}

		const saveCanvasBeforeClose = async () => {
			// Export the runtime document again because the last Canvas interaction may not
			// have reached the host change callback before the user closes the tab.
			const prepared = await persistCurrentCanvasDraftImmediatelyRef.current("manual-refresh")
			if (!prepared) return

			const saveInBackground = () =>
				manualSaveRef.current(prepared.designData).catch(() => undefined)
			if (!hasUnsavedChangesRef.current(prepared.designData)) return

			// The local draft is the close-time recovery boundary. Once it is durable, the remote
			// save may continue after the Canvas component unmounts without delaying the tab close.
			if (prepared.durable) {
				saveInBackground()
				return
			}

			// If every local fallback failed, retain the old blocking behavior for this rare case;
			// otherwise a page close could leave the user without either recovery or remote data.
			await manualSaveRef.current(prepared.designData)
		}

		onRegisterSaveHandler(saveCanvasBeforeClose)
		return () => onRegisterSaveHandler(null)
	}, [canvasAccessMode, isInitialLoading, onRegisterSaveHandler])

	const canvasCapabilities = useMemo<Partial<Record<CanvasCapability, boolean>>>(() => {
		const runtimeWriteBlocked =
			isUpgradeBlockingCanvas || isBlockingDesignLoadIssue || shouldBlockCanvasForConflict
		return {
			...(allowDownload === true ? { "sideEffect.download": true } : {}),
			...(runtimeWriteBlocked
				? {
						"document.write": false,
						"document.delete": false,
						"sideEffect.generate": false,
					}
				: {}),
		}
	}, [
		allowDownload,
		isBlockingDesignLoadIssue,
		isUpgradeBlockingCanvas,
		shouldBlockCanvasForConflict,
	])
	const [blockingConflictResolveAction, setBlockingConflictResolveAction] = useState<
		"remote" | "local" | null
	>(null)

	const handleUseRemoteBlockingConflict = useCallback(() => {
		if (blockingConflictResolveAction) return
		setBlockingConflictResolveAction("remote")
		try {
			const didResolve = resolveBlockingConflictWithRemote()
			if (!didResolve) {
				toast.error(t("design.conflict.blockingResolveFailed"))
			}
		} finally {
			setBlockingConflictResolveAction(null)
		}
	}, [blockingConflictResolveAction, resolveBlockingConflictWithRemote, t])

	const handleUseLocalBlockingConflict = useCallback(() => {
		if (blockingConflictResolveAction || !conflictNoticeText) return

		MagicModal.confirm({
			title: conflictNoticeText.localConfirmTitle,
			content: conflictNoticeText.localConfirmDescription,
			okText: conflictNoticeText.localConfirmOkText,
			cancelText: t("common.cancel"),
			variant: "destructive",
			showIcon: true,
			closable: false,
			maskClosable: false,
			centered: true,
			onOk: () => {
				void (async () => {
					setBlockingConflictResolveAction("local")
					try {
						const didResolve = await resolveBlockingConflictWithLocal()
						if (!didResolve) {
							toast.error(t("design.conflict.blockingResolveFailed"))
						}
					} finally {
						setBlockingConflictResolveAction(null)
					}
				})()
			},
		})
	}, [blockingConflictResolveAction, conflictNoticeText, resolveBlockingConflictWithLocal, t])

	const handleUseLocalElementConflict = useCallback(
		(elementId: string) => {
			const didResolve = resolveElementConflictWithLocal(elementId)
			if (!didResolve) {
				toast.error(t("design.conflict.elementResolveFailed"))
				return
			}
			setLocallyResolvedElementConflictIds((prev) => new Set(prev).add(elementId))
		},
		[resolveElementConflictWithLocal, t],
	)

	const handleUseRemoteElementConflict = useCallback(
		(elementId: string) => {
			const didResolve = resolveElementConflictWithRemote(elementId)
			if (!didResolve) {
				toast.error(t("design.conflict.elementResolveFailed"))
				return
			}
			setLocallyResolvedElementConflictIds((prev) => new Set(prev).add(elementId))
		},
		[resolveElementConflictWithRemote, t],
	)

	const handleUseLocalConnectionConflict = useCallback(
		(connectionId: string) => {
			const didResolve = resolveConnectionConflictWithLocal(connectionId)
			if (!didResolve) {
				toast.error(t("design.conflict.elementResolveFailed"))
				return
			}
			setLocallyResolvedConnectionConflictIds((prev) => new Set(prev).add(connectionId))
		},
		[resolveConnectionConflictWithLocal, t],
	)

	const handleUseRemoteConnectionConflict = useCallback(
		(connectionId: string) => {
			const didResolve = resolveConnectionConflictWithRemote(connectionId)
			if (!didResolve) {
				toast.error(t("design.conflict.elementResolveFailed"))
				return
			}
			setLocallyResolvedConnectionConflictIds((prev) => new Set(prev).add(connectionId))
		},
		[resolveConnectionConflictWithRemote, t],
	)

	const handleElementActionHintAction = useCallback(
		(elementId: string, actionKey: string) => {
			if (actionKey === "use-local") {
				handleUseLocalElementConflict(elementId)
				return
			}
			if (actionKey === "use-remote") {
				handleUseRemoteElementConflict(elementId)
			}
		},
		[handleUseLocalElementConflict, handleUseRemoteElementConflict],
	)

	const handleConnectionActionHintAction = useCallback(
		(connectionId: string, actionKey: string) => {
			if (actionKey === "use-local") {
				handleUseLocalConnectionConflict(connectionId)
				return
			}
			if (actionKey === "use-remote") {
				handleUseRemoteConnectionConflict(connectionId)
			}
		},
		[handleUseLocalConnectionConflict, handleUseRemoteConnectionConflict],
	)

	// 显示历史版本 banner 时预留顶部空间，避免遮挡画布（与 HISTORY_VERSION_BANNER_LAYOUT_HEIGHT_PX 一致）
	const showVersionBanner = !isNewestVersion && !isMobile && !!fileVersionsList?.length
	const shouldShowInitialLoading =
		isInitialLoading || isBasePathSwitching || isVersionActionLoading

	return (
		<>
			<MagicToaster />
			<div
				ref={containerRef}
				className={styles.designViewerContainer}
				style={
					showVersionBanner
						? { paddingTop: HISTORY_VERSION_BANNER_LAYOUT_HEIGHT_PX }
						: undefined
				}
			>
				{shouldShowInitialLoading ? (
					<FlexBox justify="center" align="center" style={{ height: "100%" }}>
						<MagicSpin spinning />
					</FlexBox>
				) : (
					<>
						{showFileHeader && (
							<>
								{/* 旧组件已注释，使用 CommonHeaderV2 替代 */}
								{/* <CanvasDesignHeader
									designData={designData}
									name={displayName}
									onNameChange={handleNameChange}
									isSaving={isSaving}
									attachments={attachments}
									currentFile={currentFile}
									containerRef={containerRef}
									onReinitialize={handleReinitialize}
									// 版本控制相关
									fileVersionsList={fileVersionsList}
									fileVersion={fileVersion}
									isNewestVersion={isNewestVersion}
									onChangeFileVersion={handleChangeFileVersion}
									onReturnLatest={handleReturnLatest}
									onVersionRollback={handleVersionRollback}
									isMobile={isMobile}
									allowEdit={allowEdit}
									updateAttachments={updateAttachments}
									allowDownload={allowDownload}
								/> */}
								<CanvasDesignHeaderV2 {...headerProps} />
							</>
						)}
						<div ref={floatingBoundaryRef} className={styles.designCanvasContainer}>
							{shouldShowCanvasConflictNotice && (
								<div
									className={styles.conflictNotice}
									role="status"
									aria-live="polite"
								>
									<AlertTriangle className={styles.conflictIcon} size={20} />
									<div className={styles.conflictContent}>
										<div className={styles.conflictTitle}>
											{conflictNoticeText.title}
										</div>
										<div className={styles.conflictDescription}>
											{conflictNoticeText.description}
										</div>
									</div>
									<div className={styles.conflictActions}>
										<button
											type="button"
											className={styles.conflictActionButton}
											onClick={handleUseRemoteBlockingConflict}
											disabled={!!blockingConflictResolveAction}
										>
											{conflictNoticeText.remoteActionLabel}
										</button>
										<button
											type="button"
											className={styles.conflictActionButton}
											data-variant="primary"
											onClick={handleUseLocalBlockingConflict}
											disabled={!!blockingConflictResolveAction}
										>
											{conflictNoticeText.localActionLabel}
										</button>
									</div>
								</div>
							)}
							{isOffline && (
								<div
									className={styles.offlineNotice}
									style={
										shouldShowCanvasConflictNotice
											? { top: "104px" }
											: undefined
									}
									role="status"
									aria-live="polite"
								>
									<CloudOff className={styles.offlineIcon} size={20} />
									<div className={styles.offlineText}>
										<div className={styles.offlineTitle}>
											{t("design.offlineNotice.title")}
										</div>
										<div className={styles.offlineDescription}>
											{t("design.offlineNotice.description")}
										</div>
									</div>
								</div>
							)}
							{shouldShowUnsupportedSidecarNotice && (
								<div
									className={styles.conflictNotice}
									style={
										shouldShowCanvasConflictNotice
											? { top: "104px" }
											: undefined
									}
									role="status"
									aria-live="polite"
								>
									<AlertTriangle className={styles.conflictIcon} size={20} />
									<div className={styles.conflictContent}>
										<div className={styles.conflictTitle}>
											{t("design.upgrade.unsupportedSidecarTitle")}
										</div>
										<div className={styles.conflictDescription}>
											{t("design.upgrade.unsupportedSidecarDescription")}
										</div>
									</div>
								</div>
							)}
							{isBlockingDesignLoadIssue && (
								<CanvasUpgradeOverlay
									percent={0}
									status="error"
									title={t("design.upgrade.loadFailedTitle")}
									subtitle={t("design.upgrade.loadFailedSubtitle", {
										stage: designLoadIssue.stage,
										reason: designLoadIssue.message,
									})}
									actionLabel={t("design.upgrade.reload")}
									actionDisabled={isReloadingDesignIssue}
									onAction={() => void handleReloadDesignIssue()}
								/>
							)}
							{shouldShowUpgradeProgress && (
								<CanvasUpgradeOverlay
									percent={upgradeProgress}
									title={t("design.upgrade.autoUpgradingTitle")}
									subtitle={t("design.upgrade.autoUpgradingSubtitle")}
								/>
							)}
							{shouldShowUpgradeFailed && (
								<CanvasUpgradeOverlay
									percent={0}
									status="error"
									title={t("design.upgrade.failedTitle")}
									subtitle={t("design.upgrade.failedSubtitle")}
									actionLabel={t("design.upgrade.retry")}
									actionDisabled={isUpgrading}
									onAction={() => void handleUpgrade()}
								/>
							)}
							<Suspense fallback={null}>
								<CanvasDesign
									key={`${designProjectId}:${canvasDesignKey}:${designProjectBasePath}`}
									id={designProjectId}
									ref={canvasDesignRef}
									accessMode={canvasAccessMode}
									capabilities={canvasCapabilities}
									magic={{
										methods,
										permissions: designCanvasMagicPermissions,
										hostUiLocale,
										videoPointsEstimateCacheScope,
									}}
									plugins={canvasPluginConfig}
									viewport={{
										autoLoadCacheViewport: !isPlaybackMode && !isMobile,
										floatingBoundary,
									}}
									data={{
										defaultData: designData.canvas,
										elementDetailsProvenance,
										onElementDetailsProvenanceChange:
											setElementDetailsProvenance,
										onCanvasDesignDataChange: handleCanvasDesignDataChange,
										onCanvasDesignDataPatchChange:
											handleCanvasDesignDataPatchChange,
										elementActionHints,
										onElementActionHintAction: handleElementActionHintAction,
										connectionActionHints,
										onConnectionActionHintAction:
											handleConnectionActionHintAction,
										projectAttachmentMentionTree,
										defaultProjectAttachmentFolderId,
										defaultProjectAttachmentFolderName,
										mentionDataServiceCtor: CanvasDesignMentionDataService,
										mentionExtension: MentionExtension,
										onSelectionChange: isCanvasSelectionMentionsEnabled
											? publishCanvasSelectionMentions
											: undefined,
										referenceResourcePanelRenderer:
											CanvasDesignReferenceResourcePanel,
									}}
									marker={{
										defaultMarkers: markersForCanvas,
										onMarkerCreated: handleMarkerCreated,
										onMarkerDeleted: handleMarkerDeleted,
										onMarkerUpdated: handleMarkerUpdated,
										onMarkerRestored: handleMarkerRestored,
									}}
									t={canvasDesignTAdapter}
									getDevice={getDevice}
									shareHostBottomChrome={isShareRoute}
								/>
							</Suspense>
							{/* 撤回/恢复遮罩层 */}
							{isProcessingRevoke && (
								<div className={styles.revokeOverlay}>
									<div className={styles.revokeOverlayContent}>
										<MagicSpin spinning size="large" />
										<div>
											{revokeType === "restore"
												? t("warningCard.processingRestore")
												: t("warningCard.processingRevoke")}
										</div>
									</div>
								</div>
							)}
						</div>
					</>
				)}
			</div>
			{/* 与项目文件列表复用同一套 AI 图片无水印协议。 */}
			{downloadPolicy.agreementModal}
			{methods.saveAssetToLibrary ? (
				<SaveAssetToLibraryDialog
					open={Boolean(saveAssetDialogSession)}
					source={
						saveAssetDialogSession?.kind === "workspace"
							? saveAssetDialogSession.params
							: saveAssetDialogSession?.kind === "local-file"
								? saveAssetDialogSession
								: saveAssetDialogSession?.kind === "edit"
									? saveAssetDialogSession.asset
									: null
					}
					onClose={closeSaveAssetDialog}
					getPreviewUrl={getSaveAssetPreviewUrl}
					onSave={methods.saveAssetToLibrary}
					onUpdateAsset={async (assetId, params) => {
						const updatedAsset = await AssetsApi.updateAsset(assetId, {
							name: params.name,
							description: params.description,
							visibility:
								params.userIds !== undefined || params.departmentIds !== undefined
									? buildAssetVisibility(params.userIds, params.departmentIds)
									: undefined,
							tag_ids: params.tagIds,
						})
						assetLibrarySessionStore.upsertAsset(updatedAsset)
						const session = saveAssetDialogSessionRef.current
						if (session?.kind === "edit") session.onUpdated()
					}}
					onSaveLocalFile={async (params) => {
						if (!methods.saveLocalAssetToLibrary) {
							throw new Error(t("assetLibrarySave.saveFailed"))
						}
						const asset = await methods.saveLocalAssetToLibrary(params)
						const session = saveAssetDialogSessionRef.current
						if (session?.kind === "local-file") session.onSaved(asset)
						return asset
					}}
					onBindSavedAsset={bindSavedAssetToImageContent}
				/>
			) : null}
			<AssetAgreementModal
				visible={assetAgreementVisible}
				onClose={() => {
					assetAgreementSignedActionRef.current = null
					settleAssetAgreement(false)
				}}
				onConfirm={async () => {
					try {
						await AssetsApi.signAssetAgreement()
					} catch (error) {
						toast.error(
							error instanceof Error
								? error.message
								: t("assetLibrarySave.saveFailed"),
						)
						throw error
					}
					const continueAfterSign = assetAgreementSignedActionRef.current
					assetAgreementSignedActionRef.current = null
					assetLibrarySessionStore.markAssetAgreementSigned()
					settleAssetAgreement(true)
					continueAfterSign?.()
				}}
			/>
		</>
	)
}

export default observer(DesignViewer)
