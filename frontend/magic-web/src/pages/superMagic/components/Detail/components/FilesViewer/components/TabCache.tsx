import {
	useFileAccess as useRequestFileAccess,
	FileAccessProvider as RequestFileAccessProvider,
} from "@/pages/superMagic/fileAccess/FileAccessProvider"
import { lazy, Suspense, memo, useCallback, useEffect, useRef } from "react"
import { useTranslation } from "react-i18next"
import MagicSpin from "@/components/base/MagicSpin"
import { cn } from "@/utils/cn"
import useFullscreenMode from "@/hooks/useFullscreenMode"
import Render from "../../../Render"
import PlaybackTabContent, { type PlaybackTabContentProps } from "./PlaybackTabContent"
import MicroAppTabContent from "./MicroAppTabContent"
import WebsiteIframeTabContent from "./WebsiteIframeTabContent"
import { getWebsiteTabData } from "../utils/websiteTabs"
import type { TabItem, FileManagerContext, FileManagerStateChangeOptions } from "../types"
import type { FileManagerSnapshot } from "@/models/config/repositories/SuperProjectStateTypes"
import type { KnowledgeBaseTabData } from "../hooks/useKnowledgeBaseTab"
import type { PublishedMicroAppTabData } from "../hooks/usePublishedMicroAppTab"
import { getFileViewerTabType } from "../utils/tabType"
import { shouldSyncWithAttachments } from "../hooks/previewPolicy"
import {
	FILE_VIEWER_DOCUMENT_FLOW_FULLSCREEN_TAB_CONTENT_CLASS_NAME,
	FILE_VIEWER_FULLSCREEN_BROWSER_TAB_CONTENT_CLASS_NAME,
	FILE_VIEWER_FULLSCREEN_TAB_CONTENT_CLASS_NAME,
	shouldUseFileViewerFullscreenSafeArea,
} from "../utils/fullscreenSafeArea"

import type { ProjectFileManagerProps } from "../../../../TopicFilesButton/components/ProjectFileManager"
const ProjectFileManager = lazy(
	() => import("../../../../TopicFilesButton/components/ProjectFileManager"),
)
const ProjectRecycleBin = lazy(
	() => import("../../../../TopicFilesButton/components/ProjectRecycleBin"),
)
const UserSpaceFileManager = lazy(() => import("../../../../UserSpace/UserSpaceFileManager"))
// 普通项目文件不需要知识库来源预览，保留标签后再加载对应内容。
const KnowledgeBaseTabContent = lazy(() => import("./KnowledgeBaseTabContent"))

type CachedTab = Partial<TabItem> & {
	id: string
	refreshKey?: string
	[key: string]: unknown
}

interface TabCacheProps {
	onOpenProjectRecycle?: (projectId: string) => void
	managerProps: Omit<ProjectFileManagerProps, "projectId" | "initialDirectoryId">
	getFileManagerState: (context: FileManagerContext) => FileManagerSnapshot | undefined
	onFileManagerStateChange: (
		id: string,
		state: FileManagerSnapshot,
		options: FileManagerStateChangeOptions,
	) => void
	tab: CachedTab
	isActive: boolean
	renderProps: Record<string, unknown>
	onActiveFileChange?: (fileId: string | null) => void
	isFullscreen?: boolean
	/** Allows the active pure-share tab to contribute height to the document. */
	documentFlowFullscreen?: boolean
	openFileTab?: (fileId: string, autoEdit?: boolean) => void
	playbackProps?: PlaybackTabContentProps
	/** When true, content fills the viewer without reserving tab bar height */
	hideTabBar?: boolean
	knowledgeBaseData?: KnowledgeBaseTabData
	microAppData?: PublishedMicroAppTabData
	/** The tab is rendered inside a stable surface that already owns its geometry. */
	fillPortalSurface?: boolean
	onCloseTab?: (tabId: string) => void
}

/**
 * TabCache - 单个 Tab 的缓存组件
 * 通过 CSS 控制显隐，保持组件实例挂载状态
 */
const TabCache = memo(
	({
		tab,
		managerProps,
		onOpenProjectRecycle,
		getFileManagerState,
		onFileManagerStateChange,
		isActive,
		renderProps,
		onActiveFileChange,
		isFullscreen,
		documentFlowFullscreen = false,
		openFileTab,
		playbackProps,
		hideTabBar = false,
		knowledgeBaseData,
		microAppData,
		fillPortalSurface = false,
		onCloseTab,
	}: TabCacheProps) => {
		const { t } = useTranslation("super")
		const tabType = getFileViewerTabType(tab)
		const managerState = tab.fileManager
			? (getFileManagerState(tab.fileManager) ?? tab.fileManagerState)
			: undefined
		const isPlaybackTab = tabType === "playback"
		const isWebsite = tabType === "website"
		const isKnowledgeBaseTab = tabType === "knowledge_base"
		const isMicroAppTab = tabType === "micro_app"
		const tabContentRef = useRef<HTMLDivElement>(null)
		const isFullscreenMode = useFullscreenMode()

		// 使用 useMemo 缓存渲染属性，避免不必要的重新渲染

		// 处理文件激活状态变化
		const handleActiveFileChange = useCallback(
			(fileId: string | null) => {
				onActiveFileChange?.(fileId)
			},
			[onActiveFileChange],
		)

		const handleMicroAppLeave = useCallback(() => {
			onCloseTab?.(tab.id)
		}, [onCloseTab, tab.id])

		// 监听 tab 激活状态变化，当 tab 变为非激活时暂停音频播放
		useEffect(() => {
			if (!isActive && tabContentRef.current) {
				// 查找所有 iframe 元素
				const iframes = tabContentRef.current.querySelectorAll("iframe")
				iframes.forEach((iframe) => {
					try {
						// 向 iframe 发送暂停消息
						iframe.contentWindow?.postMessage(
							{
								type: "tabDeactivated",
							},
							"*",
						)
					} catch (error) {
						console.error("发送 tab 切换消息失败:", error)
					}
				})
			}
		}, [isActive])

		// For playback tab, use isFullscreen from playbackProps; for other tabs, use URL parameter
		const effectiveIsFullscreen = isPlaybackTab
			? playbackProps?.isFullscreen === true
			: isFullscreenMode || isFullscreen
		const fillsViewerWithoutTabBar = hideTabBar && !effectiveIsFullscreen
		const isDocumentFlowFullscreen = documentFlowFullscreen && effectiveIsFullscreen
		// Magic App WebView needs safe-area bounded content, while browsers keep the legacy viewport-fixed layer.
		const fullscreenTabContentClassName = shouldUseFileViewerFullscreenSafeArea()
			? FILE_VIEWER_FULLSCREEN_TAB_CONTENT_CLASS_NAME
			: FILE_VIEWER_FULLSCREEN_BROWSER_TAB_CONTENT_CLASS_NAME

		const inheritedRequestAccess = useRequestFileAccess()
		const recycleBin = tab.fileData?.recycleBin
		// 只替换尚未解析的项目文件占位；已显示的预览不因后台清单刷新而卸载。
		const isPendingProjectFile =
			tabType === "file" &&
			tab.isLoading &&
			!recycleBin &&
			tab.fileData?.space_type !== "user" &&
			shouldSyncWithAttachments(tab.fileData)
		const attachmentLoadState = managerProps.attachmentLoadState
		const hasAttachmentLoadError =
			attachmentLoadState?.projectId === managerProps.selectedProject?.id &&
			attachmentLoadState?.status === "error"
		const filePreview = isPendingProjectFile ? (
			<div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground">
				{hasAttachmentLoadError ? (
					<span role="alert">{t("detail.unknownFileLoadFailed")}</span>
				) : (
					<>
						<MagicSpin spinning />
						<span role="status">{t("topicFiles.loadingFiles")}</span>
					</>
				)}
			</div>
		) : (
			<Render
				key={tab.refreshKey || tab.id}
				{...renderProps}
				onActiveFileChange={recycleBin ? undefined : handleActiveFileChange}
				openFileTab={openFileTab}
				isTabActive={isActive}
			/>
		)
		const renderContent = (
			<RequestFileAccessProvider
				value={
					recycleBin
						? {
								kind: "recycle-bin",
								recycleBinId: recycleBin.id,
								fileId: tab.fileData!.file_id,
								identityKey: recycleBin.identityKey,
								projectId: recycleBin.projectId,
							}
						: inheritedRequestAccess
				}
			>
				{filePreview}
			</RequestFileAccessProvider>
		)

		return (
			<div
				ref={tabContentRef}
				className={cn(
					"left-0 w-full transition-[opacity,visibility] duration-200",
					fillPortalSurface
						? "absolute inset-0 h-full"
						: isDocumentFlowFullscreen && isActive
							? FILE_VIEWER_DOCUMENT_FLOW_FULLSCREEN_TAB_CONTENT_CLASS_NAME
							: effectiveIsFullscreen
								? fullscreenTabContentClassName
								: fillsViewerWithoutTabBar
									? "absolute top-0 h-full"
									: "absolute top-11 h-[calc(100%-44px)]",
					isPlaybackTab ? "z-[9]" : isActive ? "z-10" : "z-0",
					isActive
						? "pointer-events-auto visible opacity-100"
						: "pointer-events-none invisible opacity-0",
					(isPlaybackTab || isKnowledgeBaseTab || isMicroAppTab) &&
						"bg-white dark:bg-background",
				)}
			>
				{tabType === "file_manager" && tab.fileManager ? (
					<Suspense fallback={null}>
						{tab.fileManager.spaceType === "user" ? (
							<UserSpaceFileManager
								initialState={
									managerState?.spaceType === "user" ? managerState : undefined
								}
								onStateChange={(state, options) =>
									onFileManagerStateChange(tab.id, state, options)
								}
								isActive={isActive}
								context={tab.fileManager}
								onPreviewFile={managerProps.onPreviewFile}
								onPreviewRemoved={managerProps.onPreviewRemoved}
								onFileClick={managerProps.onFileClick}
								projectId={managerProps.selectedProject?.id}
								projectName={managerProps.selectedProject?.project_name}
								topicId={managerProps.selectedTopic?.id}
							/>
						) : tab.fileManager.area === "recycle" ? (
							<ProjectRecycleBin
								projectId={tab.fileManager.projectId}
								onPreviewFile={managerProps.onPreviewFile}
								onPreviewRemoved={managerProps.onPreviewRemoved}
							/>
						) : (
							<ProjectFileManager
								{...managerProps}
								onOpenRecycle={() => {
									if (tab.fileManager?.spaceType === "project")
										onOpenProjectRecycle?.(tab.fileManager.projectId)
								}}
								initialState={
									managerState?.spaceType === "project" ? managerState : undefined
								}
								onStateChange={(state, options) =>
									onFileManagerStateChange(tab.id, state, options)
								}
								isActive={isActive}
								projectId={tab.fileManager.projectId}
								areaRequest={tab.fileManagerAreaRequest}
								initialDirectoryId={tab.fileManager.directoryId}
							/>
						)}
					</Suspense>
				) : isPlaybackTab && playbackProps ? (
					<PlaybackTabContent {...playbackProps} />
				) : isWebsite ? (
					<WebsiteIframeTabContent {...getWebsiteTabData(tab)} isActive={isActive} />
				) : isKnowledgeBaseTab && knowledgeBaseData ? (
					<Suspense fallback={null}>
						<KnowledgeBaseTabContent data={knowledgeBaseData} />
					</Suspense>
				) : isMicroAppTab && microAppData ? (
					<MicroAppTabContent data={microAppData} onLeave={handleMicroAppLeave} />
				) : (
					renderContent
				)}
			</div>
		)
	},
)

TabCache.displayName = "TabCache"

export default TabCache
