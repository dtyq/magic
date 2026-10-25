import { useState, useCallback, useEffect, useReducer, useRef, useMemo } from "react"
import { useMemoizedFn } from "ahooks"
import { useTranslation } from "react-i18next"
import { useSearchParams } from "react-router-dom"
import { ProjectStateRepository } from "@/models/config/repositories/SuperProjectStateRepository"
import type {
	CachedMicroAppTab,
	CachedTabItem,
	FileManagerSnapshot,
	ProjectFileManagerSnapshot,
} from "@/models/config/repositories/SuperProjectStateTypes"
import { useOrganization } from "@/models/user/hooks/useOrganization"
import { MAGIC_WIDGET_DISMISS_PREVIEW_EVENT } from "@/providers/MagicWidgetProvider/config"

// Types
import type {
	FilesViewerProps,
	TabItem,
	FileItem,
	WebsitePreset,
	PlaybackTabItem,
	ActiveDetailTabType,
	TabFileContext,
	TabAction,
	FileManagerContext,
	FileManagerStateChangeOptions,
} from "../types"
import type { AttachmentItem } from "../../../../TopicFilesButton/hooks/types"
import { TabActionType } from "../types"
import { getFileType } from "@/pages/superMagic/utils/handleFIle"
import { copyFileContent } from "@/pages/superMagic/utils/share"
import { createFileApi, useFileApi } from "@/pages/superMagic/fileAccess/fileApi"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import {
	convertFileToTabItem,
	getFileTabTitle,
	normalizeProjectTabItem,
	dedupeTabsById,
	mergeAttachmentFileForTab,
	canRestoreTab,
	createTabRestoreState,
	recordTabRestoreAction,
} from "../utils/tabUtils"
import { DetailType } from "../../../types"
import useShareRoute from "@/pages/superMagic/hooks/useShareRoute"
import mentionPanelStore from "@/components/business/MentionPanel/builtin-store"
import { DownloadImageMode } from "@/pages/superMagic/pages/Workspace/types"
import { usePlaybackTab } from "./usePlaybackTab"
import {
	buildKnowledgeBaseTabId,
	useKnowledgeBaseTab,
	type KnowledgeBaseTabItem,
} from "./useKnowledgeBaseTab"
import {
	buildPublishedMicroAppTabId,
	usePublishedMicroAppTab,
	type PublishedMicroAppTabItem,
} from "./usePublishedMicroAppTab"
import { detectContentTypeRender } from "../utils/preview"
import magicToast from "@/components/base/MagicToaster/utils"
import { manualPerfLogger, measureManualPerfOperation } from "@/utils/manualPerfLogger"
import { resolvePreviewExitAction, shouldAutoEnterPreviewFullscreen } from "../utils/previewMode"
import {
	normalizeAttachmentPath,
	isStandalonePreviewFile,
	isTemporaryPreviewFile,
	resolvePendingAttachmentFile,
	resolvePersistableTabs,
	resolvePersistedActiveTabId,
	resolvePreviewContent,
	shouldSyncWithAttachments,
} from "./previewPolicy"
import { getAppEntryFile } from "@/pages/superMagic/components/MessageList/components/MessageAttachment/utils"
import { buildWebsiteTab, isWebsiteTab } from "../utils/websiteTabs"
import { getFileViewerTabType, hasActivePreviewTab } from "../utils/tabType"
import { PLAYBACK_TAB_ID } from "../utils/tabConstants"
import { tabReducer } from "./tabReducer"
import { resolvePlaybackTabFallback } from "../utils/playbackTabFallback"
import { createFileManagerTab, getFileManagerRequest } from "../utils/fileManagerTabs"
import userFilesStore from "@/stores/userFiles"
import {
	getFileReferenceIdentityKey,
	resolveFileReference,
} from "@/pages/superMagic/services/userFileReferenceResolver"
import { useUserFileTabsPersistence } from "./useUserFileTabsPersistence"
import { createUserFilePreview } from "@/pages/superMagic/components/UserSpace/services/userSpaceFileService"

function normalizeFileId(value: unknown): string | undefined {
	if (typeof value === "string" && value.trim()) return value.trim()
	if (typeof value === "number" && Number.isFinite(value)) return String(value)
	return undefined
}

/**
 * 统一收集 openFileTab 入参`。
 * 来源：附件行、PubSub fileId、详情 currentFileId、mention 的 data.file_id / data.fileId。
 */
function normalizeFileItemForTab(fileItem: unknown): {
	normalizedFileItem?: Record<string, unknown>
	fileId?: string
} {
	if (!fileItem || typeof fileItem !== "object") {
		return { normalizedFileItem: undefined, fileId: undefined }
	}

	const record = fileItem as Record<string, unknown>
	const nestedRecord =
		record.data && typeof record.data === "object" && record.data !== null
			? (record.data as Record<string, unknown>)
			: undefined
	const sourceRecord = nestedRecord ? { ...nestedRecord, ...record } : record

	const fileId =
		normalizeFileId(record.file_id) ||
		normalizeFileId(record.fileId) ||
		normalizeFileId(record.currentFileId) ||
		normalizeFileId(nestedRecord?.file_id ?? nestedRecord?.fileId)

	if (!fileId) {
		return { normalizedFileItem: record, fileId: undefined }
	}

	let relativeFilePath: string | undefined
	if (
		typeof sourceRecord.relative_file_path === "string" &&
		sourceRecord.relative_file_path.trim()
	) {
		relativeFilePath = sourceRecord.relative_file_path
	} else if (typeof sourceRecord.file_path === "string" && sourceRecord.file_path.trim()) {
		relativeFilePath = sourceRecord.file_path
	}

	const recordDisplayConfig = sourceRecord.display_config as
		FileItem["display_config"] | undefined
	let hiddenPreviewPolicy = recordDisplayConfig
	if (sourceRecord.is_hidden === true) {
		hiddenPreviewPolicy = {
			...(recordDisplayConfig || {}),
			previewPolicy: {
				...(recordDisplayConfig?.previewPolicy || {}),
				syncWithAttachments: false,
				persistTab: false,
				restoreAsActive: false,
			},
		}
	}

	const normalizedRecord = {
		...sourceRecord,
		file_id: fileId,
		...(relativeFilePath ? { relative_file_path: relativeFilePath } : {}),
		...(hiddenPreviewPolicy ? { display_config: hiddenPreviewPolicy } : {}),
	}

	// 后续逻辑统一只读取 file_id，避免在主流程散落多种字段匹配。
	return { normalizedFileItem: normalizedRecord, fileId }
}

function isHiddenProjectFile(file: FileItem | undefined): file is FileItem {
	return Boolean(file?.is_hidden && file.file_id && file.file_name)
}

// Utils
// Temporarily disable imports to avoid compilation issues
// import { getFileType } from "@/pages/superMagic/utils/handleFIle"
// import {
// 	getTemporaryDownloadUrl,
// 	downloadFileContent,
// } from "@/pages/superMagic/utils/api"

/**
 * useFilesViewer - FilesViewer组件主要逻辑Hook
 *
 * @param props - FilesViewer组件属性
 * @returns 组件状态和处理函数
 */
export function useFilesViewer(props: FilesViewerProps) {
	const {
		attachments,
		attachmentList,
		attachmentLoadState,
		setUserSelectDetail,
		userSelectDetail,
		onDownload,
		handleViewModeChange,
		getFileViewMode,
		topicId,
		baseShareUrl,
		allowEdit,
		selectedTopic,
		selectedProject,
		onActiveFileChange,
		activeFileId,
		showFileFooter,
		forceFullscreenMode,
		showFileHeader: showFileHeaderProp,
		currentTopicStatus,
		messages,
		autoDetail,
		showPlaybackControl,
		isFileShare,
		onActiveTabChange,
		topicName,
		projectId,
		onFileTabsCacheLoaded,
		nonClosableFileIds,
		previewMode = "split",
		previewSessionKey = 0,
		onPreviewDismiss,
		onPreviewOpen,
		persistFileTabs = true,
	} = props
	const nonClosableFileIdsKey = (nonClosableFileIds || []).map(String).sort().join("|")
	const nonClosableFileIdSet = useMemo(
		() => new Set(nonClosableFileIdsKey ? nonClosableFileIdsKey.split("|") : []),
		[nonClosableFileIdsKey],
	)

	const onFileTabsCacheLoadedRef = useRef(onFileTabsCacheLoaded)
	onFileTabsCacheLoadedRef.current = onFileTabsCacheLoaded
	const notifyFileTabsCacheLoaded = useMemoizedFn((pid: string) => {
		onFileTabsCacheLoadedRef.current?.(pid)
	})

	const { t } = useTranslation("super")
	const fileApi = useFileApi()

	const { shareParams, isShareRoute, isMagicShareRoute } = useShareRoute()
	const [searchParams] = useSearchParams()

	// Prop takes precedence; URL ?showFileHeader=false remains as legacy fallback.
	const resolvedShowFileHeader = useMemo(() => {
		if (showFileHeaderProp !== undefined) return showFileHeaderProp
		return searchParams.get("showFileHeader") !== "false"
	}, [showFileHeaderProp, searchParams])

	// Store checkBeforeClose functions for each file
	const checkBeforeCloseMapRef = useRef<Map<string, () => Promise<boolean>>>(new Map())

	// State
	const [tabs, restoreTabs] = useReducer(tabReducer, [])
	const tabActionListenerRef = useRef<(action: TabAction) => void>(() => undefined)
	const dispatchTabs = useCallback((action: TabAction) => {
		if (action.type !== TabActionType.DEACTIVATE_ALL) tabActionListenerRef.current(action)
		restoreTabs(action)
	}, [])
	useEffect(() => {
		if (!tabs.length) props.onTabsEmpty?.()
	}, [tabs.length, props.onTabsEmpty])
	const tabsRef = useRef(tabs)
	tabsRef.current = tabs
	const userIdentityKey = getFileReferenceIdentityKey()
	const userMutationVersion = userFilesStore.mutationVersion
	const isCurrentUserTab = useCallback(
		(tab: TabItem | PlaybackTabItem | KnowledgeBaseTabItem | PublishedMicroAppTabItem) =>
			"userIdentityKey" in tab &&
			tab.userIdentityKey === userIdentityKey &&
			(tab.fileData.space_type === "user" || tab.fileManager?.spaceType === "user"),
		[userIdentityKey],
	)
	const [loading] = useState(false)
	const [error] = useState<string>()
	const [favoriteFiles, setFavoriteFiles] = useState<Set<string>>(new Set())
	const [fullscreenFileId, setFullscreenFileId] = useState<string | null>(null)
	const activePreviewModeRef = useRef(previewMode)

	const viewerProjectId = selectedProject?.id || projectId || ""

	// 文件状态缓存相关 - 需要在 openPlaybackTab 之前声明
	const { organizationCode } = useOrganization()
	const projectStateRepository = useRef(new ProjectStateRepository()).current
	const [cacheLoaded, setCacheLoaded] = useState(false)
	const cacheReadSucceeded = useRef(false)
	const projectRestoreState = useRef(createTabRestoreState())
	const preserveUserActiveOnProjectRestore = useRef(false)
	const lastUserIdentity = useRef(userIdentityKey)
	const projectManagerState = useRef<ProjectFileManagerSnapshot>()
	const saveQueue = useRef(Promise.resolve())
	const saveBeforeProjectChange = useRef<() => Promise<void>>()
	const scheduleCacheSaveRef = useRef<(deferred?: boolean) => void>(() => undefined)

	/** Keeps the active preview inside one fullscreen shell without re-entering during tab switches. */
	const activatePreviewFullscreen = useMemoizedFn((tabId: string, allowAutomaticEntry = true) => {
		if (fullscreenFileId) {
			setFullscreenFileId(tabId)
			return
		}
		if (allowAutomaticEntry && shouldAutoEnterPreviewFullscreen(previewMode)) {
			activePreviewModeRef.current = previewMode
			setFullscreenFileId(tabId)
		}
	})

	// 使用知识库Tab hook
	const {
		knowledgeBaseTabs,
		openKnowledgeBaseTab: openKnowledgeBaseTabOriginal,
		closeKnowledgeBaseTab: closeKnowledgeBaseTabOriginal,
		isKnowledgeBaseTab,
		deactivateAllKnowledgeBaseTabs,
	} = useKnowledgeBaseTab()

	// 使用已发布微应用 Tab hook
	const {
		publishedMicroAppTabs,
		openPublishedMicroAppTab: openPublishedMicroAppTabOriginal,
		closePublishedMicroAppTab: closePublishedMicroAppTabOriginal,
		isPublishedMicroAppTab,
		deactivateAllPublishedMicroAppTabs,
		restorePublishedMicroAppTabs,
	} = usePublishedMicroAppTab(viewerProjectId)

	// 当前是否有激活的预览 tab（文件 / 知识库 / 微应用）
	const hasActiveFileTab = useMemo(
		() => hasActivePreviewTab(tabs, knowledgeBaseTabs, publishedMicroAppTabs),
		[knowledgeBaseTabs, publishedMicroAppTabs, tabs],
	)

	// 使用playbackTab hook
	const {
		playbackTab,
		openPlaybackTab: openPlaybackTabOriginal,
		closePlaybackTab,
		updatePlaybackTab,
		isPlaybackTab,
	} = usePlaybackTab({
		selectedTopic,
		topicName,
		messages,
		currentTopicStatus,
		autoDetail,
		hasActiveFileTab,
	})

	// 包装openPlaybackTab，在需要激活时将所有文件tab设置为非激活状态
	const openPlaybackTab = useCallback(
		(
			options?: { toolData?: unknown; forceActivate?: boolean },
			source: "user" | "restore" = "user",
		) => {
			const { toolData, forceActivate } = options || {}

			// 如果用户正在预览，且不是强制打开，则不打开 playbackTab
			// 这样切换话题时不会干扰用户当前的预览
			if (forceActivate === undefined && hasActiveFileTab) {
				return
			}

			// 如果有 toolData，设置 userSelectDetail 为 toolData
			if (toolData) {
				tabActionListenerRef.current({ type: TabActionType.DEACTIVATE_ALL })
				setUserSelectDetail?.(toolData)
			}

			// 判断是否需要激活playbackTab
			const shouldActivate = forceActivate !== undefined ? forceActivate : !hasActiveFileTab

			// 如果需要激活playbackTab，则将所有文件tab设置为非激活状态
			if (shouldActivate) {
				// 恢复缓存不展开；加载期间用户主动打开回放仍应立即展开。
				if (forceActivate === true && source === "user") onPreviewOpen?.()
				dispatchTabs({ type: TabActionType.DEACTIVATE_ALL })
				deactivateAllKnowledgeBaseTabs()
				deactivateAllPublishedMicroAppTabs()
				// Only an explicit tool-preview action may automatically promote playback fullscreen.
				activatePreviewFullscreen(PLAYBACK_TAB_ID, forceActivate === true)
			}

			// 打开playback tab
			openPlaybackTabOriginal(options)
		},
		[
			activatePreviewFullscreen,
			deactivateAllKnowledgeBaseTabs,
			deactivateAllPublishedMicroAppTabs,
			hasActiveFileTab,
			openPlaybackTabOriginal,
			setUserSelectDetail,
			onPreviewOpen,
			dispatchTabs,
		],
	)

	// 包装openKnowledgeBaseTab，打开知识库tab时取消其他文件tab的激活
	const openKnowledgeBaseTab = useCallback(
		(data: Parameters<typeof openKnowledgeBaseTabOriginal>[0]) => {
			onPreviewOpen?.()
			tabActionListenerRef.current({ type: TabActionType.DEACTIVATE_ALL })
			// Keep knowledge-base previews in the configured fullscreen shell when required.
			activatePreviewFullscreen(buildKnowledgeBaseTabId(data))
			// 取消所有文件tab的激活
			dispatchTabs({ type: TabActionType.DEACTIVATE_ALL })
			// 无条件取消playback tab的激活（updatePlaybackTab 内部已做幂等处理）
			updatePlaybackTab({ active: false })
			deactivateAllPublishedMicroAppTabs()
			openKnowledgeBaseTabOriginal(data)
		},
		[
			openKnowledgeBaseTabOriginal,
			updatePlaybackTab,
			activatePreviewFullscreen,
			deactivateAllPublishedMicroAppTabs,
			onPreviewOpen,
			dispatchTabs,
		],
	)

	const openMicroAppTab = useCallback(
		(data: Parameters<typeof openPublishedMicroAppTabOriginal>[0]) => {
			onPreviewOpen?.()
			tabActionListenerRef.current({ type: TabActionType.DEACTIVATE_ALL })
			activatePreviewFullscreen(buildPublishedMicroAppTabId(data.appId.trim()))
			dispatchTabs({ type: TabActionType.DEACTIVATE_ALL })
			updatePlaybackTab({ active: false })
			deactivateAllKnowledgeBaseTabs()
			openPublishedMicroAppTabOriginal(data)
		},
		[
			activatePreviewFullscreen,
			deactivateAllKnowledgeBaseTabs,
			openPublishedMicroAppTabOriginal,
			updatePlaybackTab,
			onPreviewOpen,
			dispatchTabs,
		],
	)

	// Use ref to track clearing state to avoid race conditions
	const isRestoringCacheRef = useRef(false)
	const lastProjectIdRef = useRef(viewerProjectId)
	const manuallyClosedLastTabRef = useRef(false)
	const lastFileListRef = useRef<FileItem[]>([])
	const lastFileListSignatureRef = useRef("")
	const lastNotifiedActiveFileIdRef = useRef<string | null | undefined>(undefined)
	const lastNotifiedTabTypeRef = useRef<ActiveDetailTabType | undefined>(undefined)
	// 存储 tab 打开后的回调函数（key: fileId）
	const tabCallbacksRef = useRef<Map<string, () => void>>(new Map())
	const isProjectSwitching = viewerProjectId !== lastProjectIdRef.current

	// 合并tabs：演示模式tab固定第一位，知识库tabs与文件tabs按创建时间混排
	const allTabs = useMemo(() => {
		const result: Array<
			PlaybackTabItem | KnowledgeBaseTabItem | PublishedMicroAppTabItem | TabItem
		> = []
		if (playbackTab) result.push(playbackTab)
		const mixed = [...knowledgeBaseTabs, ...publishedMicroAppTabs, ...tabs]
		result.push(...mixed)
		return result
	}, [playbackTab, knowledgeBaseTabs, publishedMicroAppTabs, tabs])
	const visibleTabs = useMemo(() => {
		return allTabs.filter(
			(tab) =>
				(!("userIdentityKey" in tab) ||
					tab.userIdentityKey === undefined ||
					tab.userIdentityKey === userIdentityKey) &&
				(!isProjectSwitching || isCurrentUserTab(tab)),
		)
	}, [allTabs, isProjectSwitching, userIdentityKey, isCurrentUserTab])
	const activeTab = useMemo(() => {
		return visibleTabs.find((tab) => tab.active)
	}, [visibleTabs])
	const {
		loaded: userFileTabsLoaded,
		save: saveUserFileTabs,
		recordAction,
		mergeWithUserTabs,
		getFileManagerState: getUserFileManagerState,
		setFileManagerState: setUserFileManagerState,
	} = useUserFileTabsPersistence({
		enabled: persistFileTabs && !isShareRoute && !isFileShare,
		identityKey: userIdentityKey,
		tabsRef,
		dispatchTabs: restoreTabs,
		onRestoreActive: () => {
			deactivateAllPublishedMicroAppTabs()
			updatePlaybackTab({ active: false })
			deactivateAllKnowledgeBaseTabs()
		},
	})
	tabActionListenerRef.current = (action) => {
		recordAction(action)
		recordTabRestoreAction(projectRestoreState.current, action, tabsRef.current)
	}
	const getFileManagerState = useMemoizedFn((context: FileManagerContext) => {
		if (context.spaceType === "user") return getUserFileManagerState()
		const state = projectManagerState.current
		return state?.identityKey === userIdentityKey && state.projectId === context.projectId
			? state
			: undefined
	})
	const updateFileManagerState = useMemoizedFn(
		(
			tabId: string,
			state: FileManagerSnapshot,
			options: FileManagerStateChangeOptions = {},
		) => {
			const tab = tabsRef.current.find((item) => item.id === tabId)
			if (!tab || tab.type !== "file_manager" || state.identityKey !== userIdentityKey) return
			if (state.spaceType !== tab.fileManager?.spaceType) return
			if (state.spaceType === "project") {
				if (state.projectId !== viewerProjectId) return
				projectManagerState.current = state
			} else setUserFileManagerState(state)
			// 滚动不让整个预览器逐帧渲染；最新位置仍同步进入 ref，关闭与离开时可以立即保存。
			if (options.deferred) {
				if (options.userInteraction)
					tabActionListenerRef.current?.({
						type: TabActionType.UPDATE_TAB,
						payload: { tab, userInteraction: true },
					})
				scheduleCacheSaveRef.current(true)
				return
			}
			dispatchTabs({
				type: TabActionType.UPDATE_TAB,
				payload: {
					tab: { ...tab, fileManagerState: state },
					userInteraction: options.userInteraction,
				},
			})
		},
	)

	useEffect(() => {
		mentionPanelStore.setCurrentTabs(
			visibleTabs.filter(
				(tab) => tab.type !== "file_manager" && !tab.fileData.recycleBin,
			) as TabItem[],
		)

		return () => {
			mentionPanelStore.setCurrentTabs([])
		}
	}, [visibleTabs])

	// Collect all files and flatten
	const collectFiles = useCallback((items: FileItem[]): FileItem[] => {
		const files: FileItem[] = []
		if (!items || !Array.isArray(items)) return files

		function collect(nextItems: FileItem[]) {
			nextItems.forEach((item) => {
				if (item.is_directory && Array.isArray(item.children)) {
					collect(item.children)
					if (item.display_config) {
						files.push(item)
					}
				} else if (!item.is_directory) {
					files.push(item)
				}
			})
		}

		collect(items)
		return files
	}, [])

	const fileList = useMemo(() => {
		return measureManualPerfOperation(
			"files_viewer_collect_files_ms",
			() => collectFiles(attachments || []).reverse(),
			(result) => ({
				attachments_root_count: attachments?.length || 0,
				file_count: result.length,
			}),
		)
	}, [attachments, collectFiles])

	const fileById = useMemo(() => {
		return measureManualPerfOperation(
			"files_viewer_file_index_build_ms",
			() => {
				const map = new Map<string, FileItem>()
				fileList.forEach((file) => {
					if (file.file_id) {
						map.set(String(file.file_id), file)
					}
				})
				return map
			},
			(result) => ({
				file_count: fileList.length,
				index_entry_count: result.size,
			}),
		)
	}, [fileList])

	const fileListSignature = useMemo(() => {
		return measureManualPerfOperation(
			"files_viewer_file_list_signature_ms",
			() =>
				fileList
					.map((file) =>
						[
							file.file_id || "",
							file.file_name || "",
							file.updated_at || "",
							file.parent_id || "",
							file.relative_file_path || "",
							file.display_config?.type || "",
						].join(":"),
					)
					.join("|"),
			(result) => ({
				file_count: fileList.length,
				signature_length: result.length,
			}),
		)
	}, [fileList])

	const getTabFileContext = useMemoizedFn((tabId: string): TabFileContext | undefined => {
		const tab = tabs.find((item) => item.id === tabId)
		if (!tab || getFileViewerTabType(tab) !== "file" || isProjectSwitching) return undefined

		// 独立预览有自己的文件空间，不能用当前项目中同 ID 的文件覆盖它。
		const standalone =
			tab.fileData.space_type === "user" ||
			isStandalonePreviewFile(tab.fileData) ||
			Boolean(tab.fileData.display_config?.previewPolicy?.fileScope)
		const indexedFile = standalone ? undefined : fileById.get(String(tab.fileData.file_id))
		const file = indexedFile || tab.fileData
		const item: TabFileContext["item"] = {
			...file,
			parent_id: file.parent_id === undefined ? undefined : String(file.parent_id),
			// 信息面板只读子节点，保留附件引用，避免为打开菜单深拷贝整棵树。
			children: file.children as AttachmentItem[] | undefined,
		}
		const path = file.relative_file_path?.trim()
		const available = !tab.isDeleted && !tab.isLoading
		return {
			item,
			fileName:
				file.file_name ||
				file.filename ||
				path?.split("/").filter(Boolean).pop() ||
				file.display_filename ||
				"",
			canShowInfo: available,
			canCopyPath: !tab.isDeleted && Boolean(path),
			canLocate: Boolean(props.canLocateFile && available && indexedFile),
		}
	})

	// 递归查找文件或文件夹（包括文件夹）
	const findItemInAttachments = useCallback(
		(items: FileItem[], fileId: string): FileItem | undefined => {
			if (!items || !Array.isArray(items)) return undefined

			for (const item of items) {
				if (item.file_id === fileId) {
					return item
				}
				if (item.is_directory && Array.isArray(item.children)) {
					const found = findItemInAttachments(item.children, fileId)
					if (found) return found
				}
			}
			return undefined
		},
		[],
	)

	const hasCurrentProjectAttachmentSnapshot =
		fileList.length === 0 ||
		fileList.every((file) => !file.project_id || file.project_id === viewerProjectId)
	// 空清单、部分结果和请求失败均不能证明文件已删除；只接受当前项目的完整成功结果。
	const isAwaitingProjectAttachments =
		Boolean(viewerProjectId) &&
		!isShareRoute &&
		!(
			attachmentLoadState?.projectId === viewerProjectId &&
			attachmentLoadState.status === "ready" &&
			hasCurrentProjectAttachmentSnapshot
		)
	const getAttachmentContext = useMemoizedFn(() => ({
		fileList,
		attachments,
		isAwaitingProjectAttachments,
	}))

	const notifyActiveFileOpen = useMemoizedFn((fileId: unknown) => {
		const normalizedFileId = normalizeFileId(fileId)
		if (!normalizedFileId) return

		lastNotifiedActiveFileIdRef.current = normalizedFileId
		onActiveFileChange?.(normalizedFileId)
	})

	// Tab operations
	const fileManagerAreaRequestId = useRef(0)
	const openFileTab = useMemoizedFn((fileItem: any, autoEdit?: boolean, activate = true) => {
		// Every tab open (preview links, refs, message cards) funnels here, so hosts such as the
		// research studio can route their own file types before a generic tab is created.
		if (props.interceptFileOpen?.(fileItem)) return
		// Reset manual close flag when opening new tab
		manuallyClosedLastTabRef.current = false

		const managerContext = getFileManagerRequest(fileItem)
		if (managerContext) {
			if (
				isShareRoute ||
				(managerContext.spaceType === "project" &&
					managerContext.projectId !== viewerProjectId)
			)
				return
			const isProjectRecycle =
				managerContext.spaceType === "project" && managerContext.area === "recycle"
			const title = isProjectRecycle
				? t("fileManager.recycle.title")
				: managerContext.spaceType === "user"
					? t("userSpace.title")
					: t("topicFiles.title")
			const manager = createFileManagerTab(
				managerContext,
				title,
				isProjectRecycle
					? activeTab?.id
					: activeTab?.type === "file_manager"
						? activeTab.returnTabId
						: activeTab?.id,
			)
			// 回收站有自己的标签和查询状态，不能改写文件目录、选择及滚动快照。
			if (manager.returnTabId === manager.id)
				manager.returnTabId = tabsRef.current.find(
					(tab) => tab.id === manager.id,
				)?.returnTabId
			if (!isProjectRecycle) manager.fileManagerState = getFileManagerState(managerContext)
			if (
				managerContext.spaceType === "project" &&
				managerContext.area &&
				!isProjectRecycle
			) {
				// 每次点击都产生新请求：在内部返回文件后，再点同一入口仍要进入回收站。
				manager.fileManagerAreaRequest = {
					requestId: ++fileManagerAreaRequestId.current,
					area: managerContext.area,
				}
			}
			if (
				managerContext.spaceType === "user" &&
				manager.fileManagerState?.spaceType === "user"
			) {
				manager.fileManagerState = {
					...manager.fileManagerState,
					view: managerContext.view,
				}
				setUserFileManagerState(manager.fileManagerState)
			}
			if (!isProjectRecycle && !manager.fileManagerState && userIdentityKey) {
				if (managerContext.spaceType === "project") {
					manager.fileManagerState = {
						spaceType: "project",
						identityKey: userIdentityKey,
						projectId: managerContext.projectId,
					}
					projectManagerState.current = manager.fileManagerState
				} else {
					manager.fileManagerState = {
						spaceType: "user",
						identityKey: userIdentityKey,
						view: managerContext.view,
					}
					setUserFileManagerState(manager.fileManagerState)
				}
			}
			manager.userIdentityKey = userIdentityKey
			onPreviewOpen?.()
			updatePlaybackTab({ active: false })
			deactivateAllKnowledgeBaseTabs()
			deactivateAllPublishedMicroAppTabs()
			dispatchTabs({ type: TabActionType.ADD_TAB, payload: { tab: manager } })
			return
		}

		const { normalizedFileItem, fileId } = normalizeFileItemForTab(fileItem)
		const normalizedPreviewFile = normalizedFileItem as FileItem | undefined
		const file = fileId ? fileById.get(fileId) : undefined

		const attachmentFile = attachmentList?.find((f) => String(f.file_id) === fileId)
		const pendingAttachmentFile = resolvePendingAttachmentFile({
			file,
			fileId,
			filePayload: normalizedPreviewFile,
			isAwaitingProjectAttachments,
		})
		const isPendingAttachmentOpen = Boolean(pendingAttachmentFile)

		// Use real attachment first; otherwise use a loading placeholder.
		let targetFile =
			(normalizedPreviewFile?.recycleBin ? normalizedPreviewFile : null) ||
			file ||
			(attachmentFile?.is_directory && attachmentFile?.file_id ? attachmentFile : null) ||
			(isHiddenProjectFile(normalizedPreviewFile) ? normalizedPreviewFile : null) ||
			(isStandalonePreviewFile(normalizedPreviewFile) ? normalizedPreviewFile : null) ||
			(isTemporaryPreviewFile(normalizedPreviewFile) ? normalizedPreviewFile : null) ||
			pendingAttachmentFile

		if (!targetFile) {
			return
		}

		if (
			targetFile.is_directory &&
			targetFile.display_config &&
			targetFile.children &&
			!detectContentTypeRender(targetFile as any)
		) {
			targetFile = getAppEntryFile(targetFile.children, targetFile.display_config) as FileItem
		}

		const targetDisplayConfig = isPendingAttachmentOpen
			? targetFile.display_config
			: normalizedPreviewFile?.display_config || targetFile.display_config

		const mergedTargetFile = {
			...(normalizedFileItem || {}),
			...targetFile,
			display_config: targetDisplayConfig,
			htmlNavigation: normalizedPreviewFile?.htmlNavigation,
		}

		const newTab = convertFileToTabItem(mergedTargetFile, attachments, {
			display_config: mergedTargetFile.display_config,
			active: activate,
		})

		if (!newTab) {
			return
		}
		if (newTab.fileData.space_type === "user" || newTab.fileData.recycleBin)
			newTab.userIdentityKey = userIdentityKey
		onPreviewOpen?.()
		newTab.closeable = !(
			nonClosableFileIdSet.has(newTab.id) ||
			nonClosableFileIdSet.has(String(newTab.fileData.file_id))
		)

		if (isPendingAttachmentOpen) {
			newTab.isLoading = true
			newTab.isDeleted = false
		}
		if (newTab.fileData.recycleBin) {
			// 回收站内容独立于正常附件及删除占位；不通知正常文件树选中，也不触发编辑。
			newTab.isDeleted = false
			if (newTab.active) {
				updatePlaybackTab({ active: false })
				deactivateAllKnowledgeBaseTabs()
				deactivateAllPublishedMicroAppTabs()
			}
			dispatchTabs({ type: TabActionType.ADD_TAB, payload: { tab: newTab } })
			return
		}
		const openedFileId = newTab.fileData.file_id || newTab.id

		// 当打开文件tab时，将playback tab和知识库tabs设置为非激活状态
		if (playbackTab?.active) {
			updatePlaybackTab({ active: false })
		}
		deactivateAllKnowledgeBaseTabs()
		deactivateAllPublishedMicroAppTabs()

		// 临时预览重复打开时复用同一个 tab，并同步最新内容，避免生成一串临时标签页。
		const existingTab = tabs.find((tab) => tab.id === newTab.id)
		if (existingTab && isTemporaryPreviewFile(newTab.fileData)) {
			dispatchTabs({
				type: TabActionType.UPDATE_TAB,
				payload: {
					tab: {
						...existingTab,
						title: newTab.title,
						fileData: newTab.fileData,
						display_config: newTab.display_config,
						active: true,
					},
				},
			})
			dispatchTabs({ type: TabActionType.SWITCH_TAB, payload: { tabId: newTab.id } })
			activatePreviewFullscreen(newTab.id)
			notifyActiveFileOpen(openedFileId)
			return
		}

		// 如果需要自动进入编辑模式，存储回调函数
		if (autoEdit && targetFile) {
			tabCallbacksRef.current.set(targetFile.file_id, () => {
				pubsub.publish(PubSubEvents.Enter_Edit_Mode, targetFile.file_id)
			})
		}

		dispatchTabs({ type: TabActionType.ADD_TAB, payload: { tab: newTab } })
		activatePreviewFullscreen(newTab.id)
		notifyActiveFileOpen(openedFileId)
	})

	const openWebsiteTab = useMemoizedFn((preset: WebsitePreset) => {
		onPreviewOpen?.()
		if (playbackTab?.active) {
			updatePlaybackTab({ active: false })
		}
		deactivateAllKnowledgeBaseTabs()
		deactivateAllPublishedMicroAppTabs()

		const websiteTab = buildWebsiteTab(preset)
		dispatchTabs({ type: TabActionType.ADD_TAB, payload: { tab: websiteTab } })
		activatePreviewFullscreen(websiteTab.id)
	})

	const closeFileTab = useMemoizedFn((tabId: string) => {
		if (fullscreenFileId === tabId) {
			// Closing the preview is an explicit request to restore the inline host layout.
			setFullscreenFileId(null)
		}
		// 如果是关闭playback tab
		if (tabId === PLAYBACK_TAB_ID) {
			closePlaybackTab()
			// 关闭回放后，恢复最近使用的其他预览，避免所有标签都处于非激活状态。
			const fallback = resolvePlaybackTabFallback({
				fileTabs: tabs,
				knowledgeBaseTabs,
				publishedMicroAppTabs,
			})
			if (fallback?.type === "file") {
				dispatchTabs({
					type: TabActionType.SWITCH_TAB,
					payload: { tabId: fallback.tab.id },
				})
			} else if (fallback?.type === "knowledge_base") {
				openKnowledgeBaseTabOriginal(fallback.tab.data)
			} else if (fallback?.type === "micro_app") {
				openPublishedMicroAppTabOriginal(fallback.tab.data)
			}
			return
		}

		// 如果是关闭知识库tab
		if (isKnowledgeBaseTab(tabId)) {
			const wasActive = knowledgeBaseTabs.find((t) => t.id === tabId)?.active
			closeKnowledgeBaseTabOriginal(tabId)
			// 关闭的是激活的知识库tab时，尝试激活最近的文件tab或playbackTab
			if (wasActive) {
				if (tabs.length > 0) {
					const mostRecentTab = tabs.reduce((mostRecent, current) => {
						const currentActiveAt = current.active_at || current.create_at || 0
						const mostRecentActiveAt = mostRecent.active_at || mostRecent.create_at || 0
						return currentActiveAt > mostRecentActiveAt ? current : mostRecent
					})
					dispatchTabs({
						type: TabActionType.SWITCH_TAB,
						payload: { tabId: mostRecentTab.id },
					})
				} else if (publishedMicroAppTabs.length > 0) {
					const mostRecentMicroAppTab = publishedMicroAppTabs.reduce(
						(mostRecent, current) => {
							return (current.create_at || 0) > (mostRecent.create_at || 0)
								? current
								: mostRecent
						},
					)
					openPublishedMicroAppTabOriginal(mostRecentMicroAppTab.data)
				} else if (playbackTab) {
					updatePlaybackTab({ active: true })
				}
			}
			return
		}

		if (isPublishedMicroAppTab(tabId)) {
			const wasActive = publishedMicroAppTabs.find((t) => t.id === tabId)?.active
			closePublishedMicroAppTabOriginal(tabId)
			if (wasActive) {
				if (tabs.length > 0) {
					const mostRecentTab = tabs.reduce((mostRecent, current) => {
						const currentActiveAt = current.active_at || current.create_at || 0
						const mostRecentActiveAt = mostRecent.active_at || mostRecent.create_at || 0
						return currentActiveAt > mostRecentActiveAt ? current : mostRecent
					})
					dispatchTabs({
						type: TabActionType.SWITCH_TAB,
						payload: { tabId: mostRecentTab.id },
					})
				} else if (knowledgeBaseTabs.length > 0) {
					const mostRecentKBTab = knowledgeBaseTabs.reduce((mostRecent, current) => {
						return (current.create_at || 0) > (mostRecent.create_at || 0)
							? current
							: mostRecent
					})
					openKnowledgeBaseTabOriginal(mostRecentKBTab.data)
				} else if (playbackTab) {
					updatePlaybackTab({ active: true })
				}
			}
			return
		}

		if (tabs.find((tab) => tab.id === tabId)?.closeable === false) return

		// 检查是否正在关闭当前激活的tab
		const closingTab = tabs.find((tab) => tab.id === tabId)
		const isClosingActiveTab = closingTab?.active

		if (
			isClosingActiveTab &&
			closingTab?.type === "file_manager" &&
			closingTab.returnTabId &&
			allTabs.some((tab) => tab.id === closingTab.returnTabId)
		) {
			dispatchTabs({ type: TabActionType.REMOVE_TAB, payload: { tabId } })
			switchToTab(closingTab.returnTabId)
			return
		}

		// Check if this is the last tab (only when no KB tabs remain)
		if (
			tabs.length === 1 &&
			knowledgeBaseTabs.length === 0 &&
			publishedMicroAppTabs.length === 0
		) {
			manuallyClosedLastTabRef.current = true
		}

		dispatchTabs({ type: TabActionType.REMOVE_TAB, payload: { tabId } })

		// 如果关闭的是激活的tab，且关闭后没有文件tab了，尝试激活知识库tab或playbackTab
		if (isClosingActiveTab && tabs.length === 1) {
			if (knowledgeBaseTabs.length > 0) {
				const mostRecentKBTab = knowledgeBaseTabs.reduce((mostRecent, current) => {
					return (current.create_at || 0) > (mostRecent.create_at || 0)
						? current
						: mostRecent
				})
				openKnowledgeBaseTabOriginal(mostRecentKBTab.data)
			} else if (publishedMicroAppTabs.length > 0) {
				const mostRecentMicroAppTab = publishedMicroAppTabs.reduce(
					(mostRecent, current) => {
						return (current.create_at || 0) > (mostRecent.create_at || 0)
							? current
							: mostRecent
					},
				)
				openPublishedMicroAppTabOriginal(mostRecentMicroAppTab.data)
			} else if (playbackTab) {
				// 使用setTimeout确保dispatch完成后再切换
				setTimeout(() => {
					updatePlaybackTab({ active: true })
				}, 0)
			}
		}
	})

	const switchToTab = useMemoizedFn((tabId: string) => {
		// 如果切换到playback tab
		if (tabId === PLAYBACK_TAB_ID) {
			dispatchTabs({ type: TabActionType.DEACTIVATE_ALL })
			deactivateAllKnowledgeBaseTabs()
			deactivateAllPublishedMicroAppTabs()
			if (playbackTab) {
				updatePlaybackTab({ active: true })
				activatePreviewFullscreen(PLAYBACK_TAB_ID)
			}
		} else if (isKnowledgeBaseTab(tabId)) {
			const kbTab = knowledgeBaseTabs.find((t) => t.id === tabId)
			if (!kbTab) return
			dispatchTabs({ type: TabActionType.DEACTIVATE_ALL })
			updatePlaybackTab({ active: false })
			deactivateAllPublishedMicroAppTabs()
			openKnowledgeBaseTabOriginal(kbTab.data)
			activatePreviewFullscreen(kbTab.id)
		} else if (isPublishedMicroAppTab(tabId)) {
			const microAppTab = publishedMicroAppTabs.find((t) => t.id === tabId)
			if (!microAppTab) return
			dispatchTabs({ type: TabActionType.DEACTIVATE_ALL })
			updatePlaybackTab({ active: false })
			deactivateAllKnowledgeBaseTabs()
			openPublishedMicroAppTabOriginal(microAppTab.data)
			activatePreviewFullscreen(microAppTab.id)
		} else {
			if (playbackTab?.active) {
				updatePlaybackTab({ active: false })
			}
			deactivateAllKnowledgeBaseTabs()
			deactivateAllPublishedMicroAppTabs()
			dispatchTabs({ type: TabActionType.SWITCH_TAB, payload: { tabId } })
			activatePreviewFullscreen(tabId)
		}
	})

	const clearAllTabs = useCallback(() => {
		// Set flag to prevent auto-opening after clearing all tabs
		manuallyClosedLastTabRef.current = true
		dispatchTabs({ type: TabActionType.CLEAR_TABS })
		// 同时关闭 playbackTab
		closePlaybackTab()
		setFullscreenFileId(null)
	}, [dispatchTabs, closePlaybackTab])

	// 关闭指定 tab 外的所有 tab
	const closeOtherTabs = useMemoizedFn((tabId: string) => {
		// 如果传入的是 playbackTab，关闭所有文件 tabs，保留 playbackTab
		if (tabId === PLAYBACK_TAB_ID) {
			dispatchTabs({ type: TabActionType.CLEAR_TABS })
			// 确保 playbackTab 保持激活状态
			if (playbackTab) {
				updatePlaybackTab({ active: true })
			}
			return
		}

		// 如果是文件 tab，关闭其他文件 tabs，但保留 playbackTab（如果存在）
		// 如果 playbackTab 当前激活，将其设置为非激活，因为用户选择了保留某个文件 tab
		if (playbackTab?.active) {
			updatePlaybackTab({ active: false })
		}
		dispatchTabs({ type: TabActionType.CLOSE_OTHER_TABS, payload: { tabId } })
	})

	// 关闭指定 tab 右侧的所有 tab
	const closeTabsToRight = useMemoizedFn((tabId: string) => {
		// 如果传入的是 playbackTab，关闭所有文件 tabs（因为 playbackTab 在第一位，右侧都是文件 tabs）
		if (tabId === PLAYBACK_TAB_ID) {
			dispatchTabs({ type: TabActionType.CLEAR_TABS })
			// 确保 playbackTab 保持激活状态
			if (playbackTab) {
				updatePlaybackTab({ active: true })
			}
			return
		}

		// 如果是文件 tab，需要找到它在 allTabs 中的位置（考虑 playbackTab 在第一位）
		// 但 reducer 只操作 tabs，所以需要计算正确的索引
		const fileTabIndex = tabs.findIndex((tab) => tab.id === tabId)
		if (fileTabIndex === -1) return

		// 如果 playbackTab 当前激活，将其设置为非激活，因为用户选择了操作某个文件 tab
		if (playbackTab?.active) {
			updatePlaybackTab({ active: false })
		}

		// 关闭该文件 tab 右侧的所有文件 tabs，并激活该文件 tab
		dispatchTabs({ type: TabActionType.CLOSE_TABS_TO_RIGHT, payload: { tabId } })
		// 激活指定的文件 tab
		dispatchTabs({ type: TabActionType.SWITCH_TAB, payload: { tabId } })
	})

	// File content handlers
	const handleCopy = useMemoizedFn(
		async (fileId: string, fileContent?: string, fileVersion?: number) => {
			copyFileContent(fileList, t, fileId, fileContent, fileVersion, fileApi)
		},
	)

	const handleFavorite = useMemoizedFn((fileId: string) => {
		setFavoriteFiles((prev) => {
			const newSet = new Set(prev)
			if (newSet.has(fileId)) {
				newSet.delete(fileId)
				magicToast.success(t("common.removeFavoriteSuccess"))
			} else {
				newSet.add(fileId)
				magicToast.success(t("common.addFavoriteSuccess"))
			}
			return newSet
		})
	})

	const handleShare = useMemoizedFn((fileId: string) => {
		console.log("Share triggered for file:", fileId)
	})

	// Fullscreen handlers
	const handleFileFullscreen = useMemoizedFn((fileId: string) => {
		if (fullscreenFileId === fileId) {
			setFullscreenFileId(null)
			if (resolvePreviewExitAction(activePreviewModeRef.current) === "dismiss") {
				onPreviewDismiss?.()
			}
		} else {
			activePreviewModeRef.current = previewMode
			setFullscreenFileId(fileId)
		}
	})

	/** Promotes the active preview tab without reopening or replacing its cached renderer. */
	const enterPreviewFullscreen = useMemoizedFn(() => {
		if (!activeTab?.id) return
		activePreviewModeRef.current = previewMode
		setFullscreenFileId(activeTab.id)
	})

	/** Restores the current preview layout without applying mode-specific dismissal behavior. */
	const exitPreviewFullscreen = useMemoizedFn(() => {
		setFullscreenFileId(null)
	})

	/** Dismisses the preview surface while retaining tabs for a later reopen. */
	const dismissPreview = useMemoizedFn(() => {
		setFullscreenFileId(null)
		onPreviewDismiss?.()
	})

	const handleExitFullscreen = useMemoizedFn(() => {
		setFullscreenFileId(null)
		if (resolvePreviewExitAction(activePreviewModeRef.current) === "dismiss") {
			onPreviewDismiss?.()
		}
	})

	// 视觉预览由 useTabDrag 管理；释放后按最新 ID 解析索引，只提交一次正式顺序。
	const reorderTabs = useMemoizedFn((sourceId: string, targetId: string) => {
		const fromIndex = tabs.findIndex((tab) => tab.id === sourceId)
		const toIndex = tabs.findIndex((tab) => tab.id === targetId)
		dispatchTabs({
			type: TabActionType.REORDER_TABS,
			payload: { fromIndex, toIndex },
		})
	})

	// Generate file detail for rendering
	const getFileDetail = useCallback(
		(file: FileItem) => {
			const fileName = file.display_filename || file.file_name || file.filename

			// 1. 优先检查是否是内容类型渲染（不依赖文件内容，有自己的 detail render content）
			const contentTypeConfig =
				file.space_type === "user" ? null : detectContentTypeRender(file)

			if (contentTypeConfig) {
				// 内容类型渲染：不依赖文件内容，直接使用对应的 detail render content
				const transformedData = contentTypeConfig.dataTransformer
					? contentTypeConfig.dataTransformer(file)
					: file

				return {
					type: contentTypeConfig.detailType,
					data: {
						...transformedData,
						file_name: fileName,
						file_id: file.file_id,
						file_extension: file.file_extension,
						file_size: file.file_size,
						content: resolvePreviewContent(file),
						display_config: file?.display_config,
						file_key: file.file_key,
						project_id: file.project_id,
					},
					updatedAt: file.updated_at,
					currentFileId: file.file_id,
					attachments: attachments,
				}
			}

			// 2. 文件预览模式：基于文件扩展名（默认行为）
			if (file.is_directory) {
				// 文件夹但没有内容类型渲染配置，返回不支持
				return {
					type: DetailType.NotSupport,
					data: {
						is_directory: true,
						file_name: fileName,
						file_id: file.file_id,
						file_extension: file.file_extension,
						file_size: file.file_size,
						display_config: file?.display_config,
						file_key: file.file_key,
						project_id: file.project_id,
					},
					updatedAt: file.updated_at,
					currentFileId: file.file_id,
					attachments: attachments,
				}
			}

			// 普通文件：使用文件扩展名检测
			const type = getFileType(file.file_extension || "")

			if (type === "notSupport") {
				return {
					type: DetailType.NotSupport,
					data: {
						is_directory: false,
						updated_at: file.updated_at,
						resource_version: file.resource_version,
						version: file.version,
						file_name: fileName,
						file_id: file.file_id,
						file_extension: file.file_extension,
						file_size: file.file_size,
						display_config: file?.display_config,
						file_key: file.file_key,
						project_id: file.project_id,
					},
					updatedAt: file.updated_at,
					currentFileId: file.file_id,
					attachments: attachments,
				}
			}

			if (type) {
				return {
					type,
					data: {
						file_name: fileName,
						file_id: file.file_id,
						file_extension: file.file_extension,
						file_size: file.file_size,
						content: resolvePreviewContent(file),
						display_config: file?.display_config,
						file_key: file.file_key,
						project_id: file.project_id,
					},
					updatedAt: file.updated_at,
					currentFileId: file.file_id,
					attachments: attachments,
				}
			} else {
				return {
					type: "empty",
					data: {
						text: t("detail.fileNotSupported"),
					},
				}
			}
		},
		[attachments, t],
	)

	// ESC key handler for fullscreen
	useEffect(() => {
		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape" && fullscreenFileId) {
				handleExitFullscreen()
			}
		}

		if (fullscreenFileId) {
			document.addEventListener("keydown", handleKeyDown)
			return () => document.removeEventListener("keydown", handleKeyDown)
		}
	}, [fullscreenFileId, handleExitFullscreen])

	useEffect(() => {
		pubsub.subscribe(PubSubEvents.Exit_Fullscreen, handleExitFullscreen)
		window.addEventListener(MAGIC_WIDGET_DISMISS_PREVIEW_EVENT, dismissPreview)
		return () => {
			pubsub.unsubscribe(PubSubEvents.Exit_Fullscreen, handleExitFullscreen)
			window.removeEventListener(MAGIC_WIDGET_DISMISS_PREVIEW_EVENT, dismissPreview)
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [])

	// Clear tabs when selectedProject changes
	// 加载缓存状态
	useEffect(() => {
		if (
			cacheLoaded ||
			isRestoringCacheRef.current ||
			!selectedProject?.id ||
			isShareRoute ||
			isProjectSwitching
		) {
			return
		}

		if (!persistFileTabs) {
			// Embedded preview sessions must always start from the conversation surface.
			setCacheLoaded(true)
			notifyFileTabsCacheLoaded(selectedProject.id)
			return
		}

		// 无组织上下文时无法读写本地 tab 缓存；对 `onFileTabsCacheLoaded` 订阅方仍视为「tabs 决策已结束」
		if (!organizationCode) {
			notifyFileTabsCacheLoaded(selectedProject.id)
			return
		}

		// 个人本地记录先建立占位 Tab；不等待文件鉴权请求，项目恢复再统一应用完整顺序。
		if (userIdentityKey && !isFileShare && !userFileTabsLoaded) return

		const loadCacheState = async () => {
			const restoreIdentity = userIdentityKey
			const restoreProjectId = selectedProject.id
			try {
				const cachedState = await projectStateRepository.getProjectState(
					organizationCode,
					selectedProject.id,
					{ indexedDBOnly: true },
				)
				if (
					restoreIdentity !== getFileReferenceIdentityKey() ||
					restoreProjectId !== lastProjectIdRef.current
				)
					return
				// 本地缓存读取期间清单可能已更新；恢复时使用最新的一次附件上下文。
				const {
					fileList: restoredFileList,
					attachments: restoredAttachments,
					isAwaitingProjectAttachments: awaitingRestoredAttachments,
				} = getAttachmentContext()

				const savedManager = cachedState?.fileState?.fileManagerState
				if (
					!projectRestoreState.current.interacted &&
					savedManager?.identityKey === restoreIdentity &&
					savedManager.projectId === restoreProjectId
				)
					projectManagerState.current = savedManager
				if (cachedState?.fileState) {
					// Keep cached tabs; unresolved tabs stay loading until the first attachment pass completes.
					const processedTabs: TabItem[] = cachedState.fileState.tabs
						.filter((tab) => {
							try {
								// 只过滤掉数据完整性有问题的 tab
								if (tab.type === "file_manager")
									return tab.area === "recycle"
										? tab.identityKey === restoreIdentity
										: Boolean(
												savedManager?.identityKey === restoreIdentity &&
												savedManager.projectId === restoreProjectId,
											)
								if (!tab.id || !tab.fileData?.file_id) {
									return false
								}
								return true
							} catch (error) {
								return false
							}
						})
						.map((tab) => {
							try {
								if (tab.type === "file_manager") {
									const manager = createFileManagerTab(
										{
											spaceType: "project",
											projectId: restoreProjectId,
											area: tab.area,
										},
										tab.area === "recycle"
											? t("fileManager.recycle.title")
											: t("topicFiles.title"),
										tab.returnTabId,
									)
									return {
										...manager,
										active: false,
										userIdentityKey: restoreIdentity,
										fileManagerState:
											tab.area === "recycle" ? undefined : savedManager,
									}
								}
								let file: FileItem | undefined

								// 先在文件列表中查找（只包含文件）
								file = restoredFileList.find((f) => f.file_id === tab.id)

								// 如果没找到，可能是文件夹，在 attachments 树中递归查找
								if (!file && restoredAttachments) {
									file = findItemInAttachments(restoredAttachments, tab.id)
								}
								const isLoading =
									awaitingRestoredAttachments &&
									!file &&
									shouldSyncWithAttachments(tab.fileData)
								const isCachedWebsiteTab = isWebsiteTab({
									id: tab.id,
									type: tab.type,
								})
								const isDeleted =
									!file &&
									!isLoading &&
									!isCachedWebsiteTab &&
									shouldSyncWithAttachments(tab.fileData)

								let displayConfig
								// 这里需要兼容一下缓存的tab，用的是旧的 metadata 字段
								if (
									file?.display_config ||
									tab.fileData.display_config ||
									// @ts-ignore
									file?.metadata ||
									// @ts-ignore
									tab.fileData.metadata
								) {
									displayConfig = {
										// @ts-ignore
										...tab?.fileData?.metadata,
										// @ts-ignore
										...file?.metadata,
										...tab.fileData.display_config,
										...file?.display_config,
									}
								}

								return {
									...tab,
									type: tab.type || (isCachedWebsiteTab ? "website" : "file"),
									closeable: !nonClosableFileIdSet.has(String(tab.id)),
									isDeleted: isDeleted || false, // 确保类型为boolean
									isLoading,
									fileData: {
										...tab.fileData,
										file_name:
											tab.fileData.file_name ||
											tab.fileData.filename ||
											tab.fileData.display_filename ||
											"未命名文件",
										// 恢复文件夹相关属性
										...(file
											? {
													is_directory: file.is_directory,
													children: file.children,
													file_key: file?.file_key,
												}
											: {}),
										display_config: displayConfig,
									},
									display_config: displayConfig,
								} as TabItem
							} catch (error) {
								return null
							}
						})
						.filter((tab): tab is TabItem => tab !== null)
					const restoredTabs = dedupeTabsById(
						processedTabs
							.map((tab) => normalizeProjectTabItem(tab, restoredAttachments))
							.filter((tab) => canRestoreTab(projectRestoreState.current, tab.id)),
					)
					const cachedActiveTabId = cachedState.fileState?.activeTabId
					const activeSourceTab = cachedActiveTabId
						? processedTabs.find((tab) => tab.id === cachedActiveTabId)
						: undefined
					const restoredActiveTabId = activeSourceTab
						? normalizeProjectTabItem(activeSourceTab, restoredAttachments).id
						: cachedActiveTabId

					const canRestoreActive =
						!projectRestoreState.current.interacted &&
						!preserveUserActiveOnProjectRestore.current
					// 微应用 Tab 不在文件 reducer 内；它是缓存中的激活项时，文件 Tab 不再抢占激活态。
					const microAppRestoresActive =
						canRestoreActive &&
						Boolean(cachedState.fileState.microAppTabs?.some((tab) => tab.active))
					const restoreActive = canRestoreActive && !microAppRestoresActive
					if (cachedState.fileState.microAppTabs?.length) {
						restorePublishedMicroAppTabs(cachedState.fileState.microAppTabs, {
							restoreActive: microAppRestoresActive,
						})
						if (microAppRestoresActive) {
							updatePlaybackTab({ active: false })
							deactivateAllKnowledgeBaseTabs()
						}
					}
					dispatchTabs({
						type: TabActionType.RESTORE_PROJECT_TABS,
						payload: {
							tabs: restoredTabs.map((tab) => ({ ...tab, active: false })),
							tabOrder: projectRestoreState.current.interacted
								? undefined
								: (cachedState.fileState.tabOrder ??
									mergeWithUserTabs(restoredTabs).map((tab) => tab.id)),
							restoredActiveTabId,
							restoreActive,
						},
					})
					const activeTab = restoredTabs.find((tab) => tab.id === restoredActiveTabId)
					const tabToActivate = restoreActive
						? (activeTab ?? (!restoredActiveTabId ? restoredTabs[0] : undefined))
						: undefined

					if (tabToActivate) {
						if (tabToActivate.isDeleted) {
							console.warn(
								"⚠️ 激活的文件已不存在，但保持激活状态:",
								tabToActivate.fileData.file_name,
							)
						}

						// 网页 tab 可恢复为 active，但不是项目文件，不向外层同步 activeFileId。
						if (!isWebsiteTab(tabToActivate) && tabToActivate.type !== "file_manager") {
							if (activeTab) {
								console.log(
									"🟢 Restoring cached activeFileId (from activeTabId):",
									tabToActivate.id,
								)
							}
							pubsub.publish(PubSubEvents.Update_Active_File_Id, tabToActivate.id)
						}
					}

					// 检查是否需要恢复playback tab
					if (cachedState.fileState?.playbackTabExists) {
						// 恢复playbackTab，根据缓存的激活状态决定是否激活
						openPlaybackTab(
							{
								forceActivate:
									restoreActive &&
									(cachedState.fileState.playbackTabActive || false),
							},
							"restore",
						)
					}
				}

				cacheReadSucceeded.current = true
				setCacheLoaded(true)
			} catch (error) {
				if (
					restoreIdentity !== getFileReferenceIdentityKey() ||
					restoreProjectId !== lastProjectIdRef.current
				)
					return
				console.error("Failed to restore project file tabs", error)
				setCacheLoaded(true)
			}
		}
		// 空项目仍可以打开管理器；本地 Tab 恢复不以附件是否非空作为前置条件。
		isRestoringCacheRef.current = true
		void loadCacheState().finally(() => {
			if (
				selectedProject.id !== lastProjectIdRef.current ||
				userIdentityKey !== getFileReferenceIdentityKey()
			)
				return
			isRestoringCacheRef.current = false
			notifyFileTabsCacheLoaded(selectedProject.id)
		})
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [
		organizationCode,
		selectedProject?.id,
		cacheLoaded,
		projectStateRepository,
		openPlaybackTab,
		restorePublishedMicroAppTabs,
		updatePlaybackTab,
		deactivateAllKnowledgeBaseTabs,
		userFileTabsLoaded,
		userIdentityKey,
		isProjectSwitching,
		fileList,
		isAwaitingProjectAttachments,
		isShareRoute,
		persistFileTabs,
	])

	useEffect(() => {
		if (viewerProjectId !== lastProjectIdRef.current) {
			void saveBeforeProjectChange.current?.()
			lastProjectIdRef.current = viewerProjectId
			projectRestoreState.current = createTabRestoreState()
			projectManagerState.current = undefined
			cacheReadSucceeded.current = false
			isRestoringCacheRef.current = false
			manuallyClosedLastTabRef.current = false // Reset manual close flag on project change
			lastFileListRef.current = []
			lastFileListSignatureRef.current = ""
			tabCallbacksRef.current.clear()
			const userTabs = tabsRef.current.filter(isCurrentUserTab)
			preserveUserActiveOnProjectRestore.current = userTabs.some((tab) => tab.active)
			for (const id of checkBeforeCloseMapRef.current.keys()) {
				if (!userTabs.some((tab) => tab.fileData.file_id === id))
					checkBeforeCloseMapRef.current.delete(id)
			}
			setFullscreenFileId(null)
			setCacheLoaded(false) // Reset cache loaded state
			dispatchTabs({ type: TabActionType.SYNC_TABS_DATA, payload: { tabs: userTabs } })
		}
	}, [viewerProjectId, isCurrentUserTab, dispatchTabs])

	useEffect(() => {
		let hasUpdates = false
		const updatedTabs = tabs.map((tab) => {
			const closeable = !(
				nonClosableFileIdSet.has(tab.id) ||
				nonClosableFileIdSet.has(String(tab.fileData.file_id))
			)
			if (tab.closeable === closeable) return tab

			hasUpdates = true
			return { ...tab, closeable }
		})

		if (hasUpdates) {
			dispatchTabs({
				type: TabActionType.SYNC_TABS_DATA,
				payload: { tabs: updatedTabs },
			})
		}
	}, [nonClosableFileIdSet, tabs, dispatchTabs])

	useEffect(() => {
		if (lastUserIdentity.current !== userIdentityKey) {
			lastUserIdentity.current = userIdentityKey
			projectManagerState.current = undefined
			projectRestoreState.current = createTabRestoreState()
			preserveUserActiveOnProjectRestore.current = false
			cacheReadSucceeded.current = false
			isRestoringCacheRef.current = false
			setCacheLoaded(false)
		}
		const currentTabs = tabsRef.current
		const oldUserTabs = currentTabs.filter(
			(tab) => tab.userIdentityKey !== undefined && tab.userIdentityKey !== userIdentityKey,
		)
		if (oldUserTabs.length) {
			dispatchTabs({
				type: TabActionType.SYNC_TABS_DATA,
				payload: { tabs: currentTabs.filter((tab) => !oldUserTabs.includes(tab)) },
			})
		}
	}, [userIdentityKey, dispatchTabs])

	useEffect(() => {
		if (!userMutationVersion) return
		const files = tabsRef.current.filter(
			(tab) =>
				isCurrentUserTab(tab) && tab.type !== "file_manager" && !tab.fileData.recycleBin,
		)
		if (!files.length) return
		const controller = new AbortController()
		void Promise.all(
			files.map(
				async (tab) =>
					[
						tab.fileData.file_id,
						await resolveFileReference(
							{ file_id: tab.fileData.file_id },
							controller.signal,
						),
					] as const,
			),
		)
			.then((entries) => {
				if (controller.signal.aborted || userIdentityKey !== getFileReferenceIdentityKey())
					return
				dispatchTabs({
					type: TabActionType.SYNC_USER_FILE_REFERENCES,
					payload: { userFileResults: Object.fromEntries(entries) },
				})
			})
			.catch(() => undefined)
		return () => controller.abort()
	}, [userMutationVersion, userIdentityKey, isCurrentUserTab, dispatchTabs])

	// Sync tab data when fileList changes
	useEffect(() => {
		if (!hasCurrentProjectAttachmentSnapshot) {
			return
		}

		const syncStartedAt = manualPerfLogger.now()
		const currentFileList = fileList
		const hasLoadingTabs = tabs.some((tab) => tab.isLoading)
		const syncSignature = `${isAwaitingProjectAttachments ? "pending" : "ready"}:${fileListSignature}`

		// Skip empty tabs without recording the signature, so restored cache can still sync once.
		if (tabs.length === 0) {
			manualPerfLogger.recordDuration("files_viewer_tab_sync_ms", syncStartedAt, {
				file_count: currentFileList.length,
				tab_count: 0,
				skipped: true,
			})
			return
		}

		// Skip unchanged lists unless a loading tab needs sync.
		if (syncSignature === lastFileListSignatureRef.current && !hasLoadingTabs) {
			manualPerfLogger.recordDuration("files_viewer_tab_sync_ms", syncStartedAt, {
				file_count: currentFileList.length,
				tab_count: tabs.length,
				skipped: true,
			})
			return
		}

		lastFileListRef.current = currentFileList
		lastFileListSignatureRef.current = syncSignature

		let hasUpdates = false
		let updatedTabs = tabs
			.map((tab): TabItem | null => {
				// Leave opt-out previews untouched.
				if (!shouldSyncWithAttachments(tab.fileData)) {
					return tab
				}

				// Custom renders may be folders outside fileList.
				const isCustomRenderType = detectContentTypeRender(tab.fileData) !== null

				// Resolve folders from the tree; files from fileList.
				let updatedFile: FileItem | undefined

				const awaitAttachmentPath =
					tab.fileData.display_config?.previewPolicy?.awaitAttachmentPath

				if (awaitAttachmentPath) {
					updatedFile = fileList.find(
						(file) =>
							normalizeAttachmentPath(file.relative_file_path) ===
							awaitAttachmentPath,
					)
				} else if (isCustomRenderType) {
					// Custom render: search folders too.
					updatedFile = findItemInAttachments(attachments || [], tab.fileData.file_id)
				} else {
					// Regular file: use the flat list.
					updatedFile = fileById.get(String(tab.fileData.file_id))
				}

				const isWaitingForAttachmentSync =
					tab.fileData.display_config?.previewPolicy?.awaitAttachmentSync === true

				// Keep pending tabs loading while attachments sync.
				if (!updatedFile) {
					if (isWaitingForAttachmentSync) {
						if (!isAwaitingProjectAttachments) {
							hasUpdates = true
							return null
						}

						if (!tab.isLoading || tab.isDeleted) {
							hasUpdates = true
							return {
								...tab,
								isDeleted: false,
								isLoading: true,
							}
						}
						return tab
					}

					if (isAwaitingProjectAttachments) {
						if (tab.isDeleted) {
							hasUpdates = true
							return { ...tab, isDeleted: false, isLoading: true }
						}
						return tab
					}

					if (!tab.isDeleted || tab.isLoading) {
						hasUpdates = true
						return {
							...tab,
							isDeleted: true,
							isLoading: false,
						}
					}
					return tab
				}

				const syncedFileData = mergeAttachmentFileForTab(tab, updatedFile)
				const syncedDisplayConfig = syncedFileData.display_config

				// Refresh real file data, while retaining memory-only template metadata.
				if (
					JSON.stringify(syncedFileData) !== JSON.stringify(tab.fileData) ||
					tab.isLoading
				) {
					hasUpdates = true

					// Handles index.html title fallback.
					const tabTitle = getFileTabTitle(
						syncedFileData,
						attachments,
						syncedDisplayConfig,
					)

					return {
						...tab,
						id: updatedFile.file_id,
						title: tabTitle,
						fileData: syncedFileData,
						display_config: syncedDisplayConfig,
						filePath: updatedFile.relative_file_path,
						isDeleted: false,
						isLoading: false,
					}
				}

				// Restore reappeared files.
				if (tab.isDeleted) {
					hasUpdates = true

					// Handles index.html title fallback.
					const tabTitle = getFileTabTitle(
						syncedFileData,
						attachments,
						syncedDisplayConfig,
					)

					return {
						...tab,
						id: updatedFile.file_id,
						title: tabTitle,
						fileData: syncedFileData,
						display_config: syncedDisplayConfig,
						filePath: updatedFile.relative_file_path,
						isDeleted: false,
						isLoading: false,
					}
				}

				return tab
			})
			.filter((tab): tab is TabItem => tab != null)

		const normalizedTabs = dedupeTabsById(
			updatedTabs.map((tab) => normalizeProjectTabItem(tab, attachments)),
		)
		if (
			normalizedTabs.length !== updatedTabs.length ||
			normalizedTabs.some((tab, index) => tab.id !== updatedTabs[index]?.id)
		) {
			hasUpdates = true
		}
		updatedTabs = normalizedTabs

		if (hasUpdates && updatedTabs.length > 0 && !updatedTabs.some((tab) => tab.active)) {
			const mostRecentTab = updatedTabs.reduce((mostRecent, current) => {
				const currentActiveAt = current.active_at || current.create_at || 0
				const mostRecentActiveAt = mostRecent.active_at || mostRecent.create_at || 0
				return currentActiveAt > mostRecentActiveAt ? current : mostRecent
			})
			updatedTabs = updatedTabs.map((tab) => ({
				...tab,
				active: tab.id === mostRecentTab.id,
			}))
		}

		if (hasUpdates) {
			// Sync tabs in one reducer update.
			dispatchTabs({
				type: TabActionType.SYNC_TABS_DATA,
				payload: { tabs: updatedTabs },
			})
		}

		manualPerfLogger.recordDuration("files_viewer_tab_sync_ms", syncStartedAt, {
			file_count: currentFileList.length,
			tab_count: tabs.length,
			has_updates: hasUpdates,
		})
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [
		fileList,
		fileById,
		fileListSignature,
		attachments,
		findItemInAttachments,
		hasCurrentProjectAttachmentSnapshot,
		isAwaitingProjectAttachments,
		tabs.length,
	]) // Include attachment deps for custom render types; omit full tabs to avoid loops.

	// 保存文件状态到缓存
	const saveCacheState = useCallback((): Promise<void> => {
		// 所有仓储投影都来自同一次 UI 快照；异步等待之后不再读取另一份 tabs。
		const snapshot = [...tabs]
		const identity = userIdentityKey
		const savedProjectId = selectedProject?.id
		const savedOrganization = organizationCode
		const manager = projectManagerState.current
		const userManager = getUserFileManagerState()
		const canSaveProject = Boolean(
			persistFileTabs &&
			!isShareRoute &&
			!isFileShare &&
			savedOrganization &&
			savedProjectId &&
			cacheLoaded &&
			cacheReadSucceeded.current &&
			!isProjectSwitching,
		)
		const persistableTabs = snapshot.filter(
			(tab) => tab.fileData.display_config?.previewPolicy?.persistTab !== false,
		)
		const persistedActiveTabId = resolvePersistedActiveTabId(
			persistableTabs,
			activeTab as TabItem | undefined,
		)
		const projectTabs = resolvePersistableTabs(persistableTabs)
		const cachedTabs: CachedTabItem[] = projectTabs.map((tab): CachedTabItem => {
			const type = getFileViewerTabType(tab) ?? "file"
			if (type === "file_manager")
				return {
					id: tab.id,
					type,
					title: tab.title,
					returnTabId: tab.returnTabId,
					identityKey: identity ?? undefined,
					area:
						tab.fileManager?.spaceType === "project" &&
						tab.fileManager.area === "recycle"
							? "recycle"
							: undefined,
					active: tab.id === persistedActiveTabId,
				}
			return {
				id: tab.id,
				type,
				title: tab.title,
				fileData: {
					file_id: tab.fileData.file_id,
					file_name: tab.fileData.file_name,
					filename: tab.fileData.filename,
					display_filename: tab.fileData.display_filename,
					file_extension: tab.fileData.file_extension,
					file_reference: tab.fileData.file_reference,
					space_type: tab.fileData.space_type,
					project_id: tab.fileData.project_id,
					relative_file_path: tab.fileData.relative_file_path,
					url: tab.fileData.url,
					/** 刷新恢复后解析 custom icon、合并 metadata 等需要 */
					parent_id: tab.fileData.parent_id,
					is_directory: tab.fileData.is_directory,
					display_config: tab.fileData.display_config,
					updated_at: tab.fileData.updated_at,
					source: tab.fileData.source,
				},
				active: tab.id === persistedActiveTabId,
				filePath: tab.filePath,
				display_config: tab.display_config,
			}
		})
		const cachedMicroAppTabs: CachedMicroAppTab[] = publishedMicroAppTabs.map((tab) => ({
			appId: tab.data.appId,
			appName: tab.data.appName,
			active: tab.active,
			createdAt: tab.create_at,
		}))
		const savedPlaybackExists = Boolean(playbackTab)
		const savedPlaybackActive = playbackTab?.active || false
		const preservePositions = Boolean(viewerProjectId && (!cacheLoaded || isProjectSwitching))
		const write = saveQueue.current
			.catch(() => undefined)
			.then(async () => {
				if (identity !== getFileReferenceIdentityKey()) return
				try {
					await saveUserFileTabs(preservePositions, snapshot, userManager)
				} catch (error) {
					console.error("Failed to save user file tabs", error)
				}
				if (!canSaveProject || !savedOrganization || !savedProjectId) return
				const currentState = await projectStateRepository.getProjectState(
					savedOrganization,
					savedProjectId,
					{ indexedDBOnly: true },
				)
				if (identity !== getFileReferenceIdentityKey()) return
				// 管理器是界面状态，PPT 页码清理仅使用真实项目文件 ID。
				const currentFileIds = new Set(
					projectTabs
						.filter((tab) => tab.type !== "file_manager")
						.map((tab) => tab.fileData.file_id),
				)
				const cleanedPptActiveIndexMap = Object.fromEntries(
					Object.entries(currentState?.fileState?.pptActiveIndexMap || {}).filter(
						([fileId]) => currentFileIds.has(fileId),
					),
				)
				await projectStateRepository.updateFileState(savedOrganization, savedProjectId, {
					tabs: cachedTabs,
					microAppTabs: cachedMicroAppTabs,
					tabOrder: persistableTabs.map((tab) => tab.id),
					activeTabId: persistedActiveTabId,
					fileManagerState:
						manager?.identityKey === identity && manager.projectId === savedProjectId
							? manager
							: undefined,
					pptActiveIndexMap: cleanedPptActiveIndexMap,
					playbackTabExists: savedPlaybackExists,
					playbackTabActive: savedPlaybackActive,
				})
			})
		saveQueue.current = write
		return write.catch((error) => console.error("Failed to save file state to cache:", error))
	}, [
		saveUserFileTabs,
		getUserFileManagerState,
		viewerProjectId,
		userIdentityKey,
		organizationCode,
		selectedProject?.id,
		tabs,
		activeTab,
		cacheLoaded,
		isProjectSwitching,
		projectStateRepository,
		playbackTab,
		publishedMicroAppTabs,
		persistFileTabs,
		isShareRoute,
		isFileShare,
	])

	const pendingCacheSave = useRef<ReturnType<typeof setTimeout>>()
	const scheduleCacheSave = useMemoizedFn((deferred = false) => {
		if (pendingCacheSave.current) clearTimeout(pendingCacheSave.current)
		pendingCacheSave.current = undefined
		if (deferred) {
			pendingCacheSave.current = setTimeout(() => {
				pendingCacheSave.current = undefined
				void saveCacheState()
			}, 500)
		} else void saveCacheState()
	})
	scheduleCacheSaveRef.current = scheduleCacheSave
	useEffect(() => {
		if (cacheLoaded || userFileTabsLoaded) scheduleCacheSave()
		saveBeforeProjectChange.current = saveCacheState
	}, [saveCacheState, cacheLoaded, userFileTabsLoaded, scheduleCacheSave])
	useEffect(() => {
		const flush = () => scheduleCacheSave()
		const onVisibilityChange = () => {
			if (document.visibilityState === "hidden") flush()
		}
		window.addEventListener("pagehide", flush)
		document.addEventListener("visibilitychange", onVisibilityChange)
		return () => {
			window.removeEventListener("pagehide", flush)
			document.removeEventListener("visibilitychange", onVisibilityChange)
			flush()
		}
	}, [scheduleCacheSave])

	const handleRefresh = useMemoizedFn(async () => {
		if (activeTab?.type === "file_manager") return
		let refreshedUserFile: FileItem | undefined
		if (activeTab?.fileData.space_type === "user" && !activeTab.fileData.recycleBin) {
			const identity = userIdentityKey
			if (!(await userFilesStore.confirmFileChanges([activeTab.fileData.file_id]))) return
			if (
				identity !== getFileReferenceIdentityKey() ||
				!tabsRef.current.some((tab) => tab.id === activeTab.id && tab.active)
			)
				return
			try {
				const result = await resolveFileReference({ file_id: activeTab.fileData.file_id })
				if (
					identity !== getFileReferenceIdentityKey() ||
					!tabsRef.current.some((tab) => tab.id === activeTab.id && tab.active)
				)
					return
				dispatchTabs({
					type: TabActionType.SYNC_USER_FILE_REFERENCES,
					payload: {
						userFileResults: { [activeTab.fileData.file_id]: result },
					},
				})
				if (result.status !== "resolved" || result.reference.space_type !== "user") return
				refreshedUserFile = createUserFilePreview(result.reference)
			} catch {
				if (identity === getFileReferenceIdentityKey())
					magicToast.error(t("common.fileNotFoundOrLoadFailed"))
				return
			}
		}
		const refreshStartedAt = manualPerfLogger.now()
		let refreshed = false

		// 如果有活跃的 tab，强制刷新其内容
		if (activeTab) {
			// 项目文件使用附件索引；独立预览文件使用 Tab 自身数据重新拉取内容。
			const indexedFile = activeTab.fileData.recycleBin
				? undefined
				: fileById.get(String(activeTab.id))
			const file =
				refreshedUserFile ||
				indexedFile ||
				(isStandalonePreviewFile(activeTab.fileData) ? activeTab.fileData : undefined)
			if (file) {
				// 使用 getFileTabTitle 获取正确的 tab title（处理 index.html 的情况）
				const tabTitle = getFileTabTitle(file, attachments, file.display_config)

				// 生成新的 refreshKey 以强制 Render 组件重新挂载
				const refreshKey = `${activeTab.id}-${Date.now()}`

				// 更新 tab 数据，这会触发重新渲染和 getRenderProps
				const updatedTab: TabItem = {
					...activeTab,
					...(refreshedUserFile ? { isDeleted: false, isLoading: false } : {}),
					title: tabTitle,
					fileData: {
						...file,
						htmlNavigation: activeTab.fileData.htmlNavigation,
						// 清除缓存的内容，强制重新加载
						content: undefined,
					},
					filePath: file.relative_file_path,
					display_config: file.display_config,
					refreshKey, // 添加刷新键以强制重新挂载
				}

				dispatchTabs({
					type: TabActionType.UPDATE_TAB,
					payload: { tab: updatedTab },
				})
				refreshed = true
			}
		}

		manualPerfLogger.recordDuration("files_viewer_refresh_ms", refreshStartedAt, {
			active_tab_id: activeTab?.id,
			file_count: fileList.length,
			refreshed,
		})
	})

	useEffect(() => {
		pubsub.subscribe(PubSubEvents.Super_Magic_Detail_Refresh, handleRefresh)
		return () => {
			pubsub.unsubscribe(PubSubEvents.Super_Magic_Detail_Refresh, handleRefresh)
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [])

	const activeTabFileId =
		getFileViewerTabType(activeTab) === "file" ? activeTab?.fileData.file_id || null : null
	const activeTabId = activeTab?.id
	const activeTabType = getFileViewerTabType(activeTab)

	// Notify parent when active tab changes
	useEffect(() => {
		// Playback/KB clear parent activeFileId separately. Reset lastNotified so
		// switching back to the same file tab re-syncs the parent.
		if (
			activeTabType === "knowledge_base" ||
			activeTabType === "playback" ||
			activeTabType === "micro_app"
		) {
			lastNotifiedActiveFileIdRef.current = undefined
			return
		}

		const currentActiveFileId = activeTabFileId
		const lastNotifiedActiveFileId = lastNotifiedActiveFileIdRef.current

		// Skip initial null notification on first mount to avoid overriding parent open intent.
		if (lastNotifiedActiveFileId === undefined && currentActiveFileId === null) {
			lastNotifiedActiveFileIdRef.current = currentActiveFileId
			return
		}

		if (lastNotifiedActiveFileId === currentActiveFileId) {
			return
		}

		lastNotifiedActiveFileIdRef.current = currentActiveFileId
		onActiveFileChange?.(activeTab?.fileData.recycleBin ? null : currentActiveFileId)
	}, [activeTabFileId, activeTabId, activeTabType, onActiveFileChange])

	// Notify parent with current active tab type
	useEffect(() => {
		if (!onActiveTabChange) return

		const currentActiveTabType: ActiveDetailTabType = activeTabType
		const lastNotifiedTabType = lastNotifiedTabTypeRef.current

		// Skip initial null notification on first mount to avoid overriding parent open intent.
		if (lastNotifiedTabType === undefined && currentActiveTabType === null) {
			lastNotifiedTabTypeRef.current = currentActiveTabType
			return
		}

		if (lastNotifiedTabType === currentActiveTabType) {
			return
		}

		lastNotifiedTabTypeRef.current = currentActiveTabType
		onActiveTabChange(currentActiveTabType)
	}, [activeTabType, onActiveTabChange, previewSessionKey])

	// 执行 tab 打开后的回调
	useEffect(() => {
		const currentActiveFileId = activeTab?.fileData?.file_id
		if (!currentActiveFileId) return
		const callback = tabCallbacksRef.current.get(currentActiveFileId)
		if (callback) {
			callback()
			// 执行后清除回调，只执行一次
			tabCallbacksRef.current.delete(currentActiveFileId)
		}
	}, [activeTab?.fileData?.file_id])

	useEffect(() => {
		if (isFileShare) {
			const fullscreen = searchParams.get("fullscreen")

			const defaultOpenFileId = shareParams.fileId || searchParams.get("fileId")

			// 如果URL参数包含fullscreen=true，自动全屏对应文件
			if (fullscreen === "true" && defaultOpenFileId) {
				handleFileFullscreen(defaultOpenFileId)
			}
		}
	}, [isFileShare, searchParams, shareParams.fileId, handleFileFullscreen])

	return {
		// State
		tabs: visibleTabs, // 返回包含演示模式tab的完整tabs列表
		isShareRoute,
		isMagicShareRoute,
		activeTab,
		fileList,
		loading,
		isRestoringFileTabs: Boolean(activeTab && "isLoading" in activeTab && activeTab.isLoading),
		isAwaitingProjectAttachments,
		error,
		favoriteFiles,
		fullscreenFileId,

		// Tab operations
		openFileTab,
		openWebsiteTab,
		closeFileTab,
		switchToTab,
		clearAllTabs,
		closeOtherTabs,
		closeTabsToRight,

		// Playback tab operations
		openPlaybackTab,
		closePlaybackTab,
		isPlaybackTab,

		// Knowledge base tab operations
		openKnowledgeBaseTab,
		closeKnowledgeBaseTab: closeKnowledgeBaseTabOriginal,
		isKnowledgeBaseTab,
		openMicroAppTab,
		closeMicroAppTab: closePublishedMicroAppTabOriginal,
		isPublishedMicroAppTab,

		// 拖拽相关函数
		reorderTabs,

		handleRefresh,

		// File operations
		getTabFileContext,
		handleCopy,
		handleFavorite,
		handleShare,
		handleFileFullscreen,
		handleExitFullscreen,
		enterPreviewFullscreen,
		exitPreviewFullscreen,
		getFileDetail,

		// Computed props for Render component
		getRenderProps: (tab?: TabItem | PlaybackTabItem | KnowledgeBaseTabItem) => {
			if (!tab || tab.type === "file_manager" || tab.type === "knowledge_base") return {}

			// 如果文件已被删除，删除详情预览
			if (tab.isDeleted) {
				return {
					type: DetailType.Deleted,
					data: {
						file_id: tab.fileData.file_id,
						file_name: tab.title,
						file_extension: tab.fileData.file_extension || "",
						updatedAt: tab.fileData.updated_at || "",
						content: null,
					},
				}
			}

			const fileDetail = getFileDetail(tab.fileData)
			const viewMode = getFileViewMode?.(tab.fileData.file_id) || "desktop"

			// 类型已经在 getFileDetail 中处理，直接使用
			const type = fileDetail.type
			const renderData =
				type === DetailType.Html && fileDetail.data && typeof fileDetail.data === "object"
					? {
							...fileDetail.data,
							htmlNavigation: tab.fileData.htmlNavigation,
						}
					: fileDetail.data

			return {
				type,
				data:
					tab.fileData.space_type === "user"
						? {
								...renderData,
								file_reference: tab.fileData.file_reference,
								space_type: "user",
								relative_file_path: tab.fileData.relative_file_path,
							}
						: renderData,
				updatedAt: fileDetail.updatedAt,
				attachments,
				attachmentLoadState: props.attachmentLoadState,
				setUserSelectDetail,
				currentIndex: 0,
				onPrevious: () => {
					// TODO: Implement previous file navigation
				},
				onNext: () => {
					// TODO: Implement next file navigation
				},
				onFullscreen: () => handleFileFullscreen(tab.id),
				onDownload: (fileId?: string, fileVersion?: number, mode?: DownloadImageMode) =>
					onDownload?.(fileId || tab.fileData.file_id, fileVersion, mode),
				totalFiles: fileList.length,
				hasUserSelectDetail: false,
				isFromNode: false,
				userSelectDetail,
				isFullscreen: Boolean(forceFullscreenMode) || fullscreenFileId === tab.id,
				attachmentList,
				viewMode,
				onViewModeChange: (mode: "code" | "desktop" | "phone") =>
					handleViewModeChange?.(tab.fileData.file_id, mode),
				onCopy: (fileVersion?: number, fileId?: string) => {
					// 保留本地内容的预览直接复制当前 tab 的源码内容。
					const copySourceContent = tab.fileData.display_config?.previewPolicy
						?.keepLocalContent
						? tab.fileData.content
						: fileVersion
							? tab.fileData.content
							: undefined

					const recycleBin = tab.fileData.recycleBin
					if (recycleBin) {
						void copyFileContent(
							[],
							t,
							tab.fileData.file_id,
							undefined,
							undefined,
							createFileApi({
								kind: "recycle-bin",
								recycleBinId: recycleBin.id,
								fileId: tab.fileData.file_id,
								identityKey: recycleBin.identityKey,
								projectId: recycleBin.projectId,
							}),
						)
						return
					}
					handleCopy(fileId || tab.fileData.file_id, copySourceContent, fileVersion)
				},
				onShare: () => handleShare(tab.fileData.file_id),
				onFavorite: () => handleFavorite(tab.fileData.file_id),
				fileContent: tab.fileData.content || "",
				isFavorited: favoriteFiles.has(tab.fileData.file_id),
				topicId,
				baseShareUrl,
				currentFile: {
					id: tab.fileData.file_id || "",
					name: tab.title || "",
					type: tab.fileData.file_extension || "",
					url: tab.fileData.file_url || tab.fileData.url || "",
					source: tab.fileData.source,
					projectId:
						tab.fileData.space_type === "user"
							? undefined
							: selectedProject?.id || projectId,
					projectName:
						tab.fileData.space_type === "user"
							? undefined
							: selectedProject?.project_name,
				},
				allowEdit: tab.fileData.space_type === "user" ? !isShareRoute : allowEdit,
				selectedTopic,
				selectedProject,
				projectId,
				detailMode: "files",
				displayConfig: tab.display_config,
				showFileHeader: resolvedShowFileHeader,
				onRefreshFile: handleRefresh,
				activeFileId,
				showFooter: showFileFooter,
				// Register checkBeforeClose callback
				onRegisterCheckBeforeClose: (fileId: string, callback: () => Promise<boolean>) => {
					checkBeforeCloseMapRef.current.set(fileId, callback)
					if (tab.fileData.space_type === "user")
						userFilesStore.registerFileGuard(
							fileId,
							tab.fileData.file_reference?.space_relative_path ??
								tab.fileData.relative_file_path ??
								"",
							callback,
						)
				},
				onUnregisterCheckBeforeClose: (fileId: string) => {
					checkBeforeCloseMapRef.current.delete(fileId)
					if (tab.fileData.space_type === "user")
						userFilesStore.unregisterFileGuard(fileId)
				},
				allowDownload: props.allowDownload,
			}
		},
		// Expose method to get checkBeforeClose for a file
		getFileManagerState,
		updateFileManagerState,
		getCheckBeforeClose: (fileId: string) => {
			return checkBeforeCloseMapRef.current.get(fileId)
		},
	}
}
