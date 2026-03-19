import { useState, useCallback, useEffect, useReducer, useRef, useMemo } from "react"
import { useMemoizedFn } from "ahooks"
import { useTranslation } from "react-i18next"
import { useSearchParams } from "react-router-dom"
import { ProjectStateRepository } from "@/models/config/repositories/SuperProjectStateRepository"
import { useOrganization } from "@/models/user/hooks/useOrganization"

// Types
import type { FilesViewerProps, TabItem, FileItem, TabAction } from "../types"
import { TabActionType } from "../types"
import { getFileType } from "@/pages/superMagic/utils/handleFIle"
import { copyFileContent } from "@/pages/superMagic/utils/share"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import { handleDuplicateTabNames, convertFileToTabItem, getFileTabTitle } from "../utils/tabUtils"
import { DetailType } from "../../../types"
import useShareRoute from "@/pages/superMagic/hooks/useShareRoute"
import mentionPanelStore from "@/components/business/MentionPanel/store"
import { DownloadImageMode } from "@/pages/superMagic/pages/Workspace/types"
import { usePlaybackTab, PLAYBACK_TAB_ID } from "./usePlaybackTab"
import { detectContentTypeRender } from "../utils/preview"
import magicToast from "@/components/base/MagicToaster/utils"

// Utils
// Temporarily disable imports to avoid compilation issues
// import { getFileType } from "@/pages/superMagic/utils/handleFIle"
// import {
// 	getTemporaryDownloadUrl,
// 	downloadFileContent,
// } from "@/pages/superMagic/utils/api"

// Tab reducer function
function tabReducer(state: TabItem[], action: TabAction): TabItem[] {
	const now = Date.now() // Timestamp for all operations

	switch (action.type) {
		case TabActionType.ADD_TAB:
			if (!action.payload?.tab) return state

			// Check if tab already exists
			const existingTabIndex = state.findIndex((tab) => tab.id === action.payload!.tab!.id)
			if (existingTabIndex !== -1) {
				// Switch to existing tab and update active_at
				const newState = state.map((tab) => ({
					...tab,
					active: tab.id === action.payload!.tab!.id,
					active_at: tab.id === action.payload!.tab!.id ? now : tab.active_at,
				}))
				return newState
			}

			// Prepare new tab with filePath and timestamps
			const newTab = {
				...action.payload.tab,
				active: true,
				filePath:
					action.payload.tab.fileData.relative_file_path || action.payload.tab.filePath,
				create_at: now,
				active_at: now,
			}

			// Handle duplicate names and add new tab
			const addedState = handleDuplicateTabNames(state, newTab)
			return addedState

		case TabActionType.REMOVE_TAB:
			if (!action.payload?.tabId) return state

			// If only one tab left, clear all tabs but don't auto-open
			if (state.length === 1) {
				return []
			}

			const filteredTabs = state.filter((tab) => tab.id !== action.payload!.tabId)

			// If removing active tab, activate the most recently active tab
			const removedTab = state.find((tab) => tab.id === action.payload!.tabId)
			if (removedTab?.active && filteredTabs.length > 0) {
				// Find the most recently active tab (highest active_at timestamp)
				const mostRecentTab = filteredTabs.reduce((mostRecent, current) => {
					// 如果当前 tab 没有 active_at，使用 create_at 或者当前时间
					const currentActiveAt = current.active_at || current.create_at || 0
					const mostRecentActiveAt = mostRecent.active_at || mostRecent.create_at || 0

					return currentActiveAt > mostRecentActiveAt ? current : mostRecent
				})

				const removedState = filteredTabs.map((tab) => ({
					...tab,
					active: tab.id === mostRecentTab.id,
					active_at: tab.id === mostRecentTab.id ? now : tab.active_at,
				}))
				return removedState
			}

			return filteredTabs

		case TabActionType.SWITCH_TAB:
			if (!action.payload?.tabId) return state

			return state.map((tab) => ({
				...tab,
				active: tab.id === action.payload!.tabId,
				active_at: tab.id === action.payload!.tabId ? now : tab.active_at,
			}))

		case TabActionType.UPDATE_TAB:
			if (!action.payload?.tab) return state

			const updatedState = state.map((tab) =>
				tab.id === action.payload!.tab!.id ? { ...tab, ...action.payload!.tab } : tab,
			)
			return updatedState

		case TabActionType.CLEAR_TABS:
			const clearedState: TabItem[] = []
			return clearedState

		case TabActionType.CLOSE_OTHER_TABS:
			if (!action.payload?.tabId) return state

			// Keep only the specified tab
			const keepTab = state.find((tab) => tab.id === action.payload!.tabId)
			if (!keepTab) return state

			return [{ ...keepTab, active: true, active_at: now }]

		case TabActionType.CLOSE_TABS_TO_RIGHT:
			if (!action.payload?.tabId) return state

			// Find the index of the specified tab
			const targetIndex = state.findIndex((tab) => tab.id === action.payload!.tabId)
			if (targetIndex === -1) return state

			// Keep tabs from start to target index (inclusive)
			const tabsToRightClosedState = state.slice(0, targetIndex + 1)
			return tabsToRightClosedState

		case TabActionType.SYNC_TABS_DATA:
			if (!action.payload?.tabs) return state

			return action.payload.tabs

		case TabActionType.REORDER_TABS:
			if (action.payload?.fromIndex === undefined || action.payload?.toIndex === undefined) {
				return state
			}

			const { fromIndex, toIndex } = action.payload

			// 禁止拖拽演示模式tab（固定在第一位）
			if (state[fromIndex]?.id === PLAYBACK_TAB_ID) {
				return state
			}

			// 禁止将其他tab拖拽到演示模式tab的位置（如果演示模式tab存在且在第一位）
			if (state[0]?.id === PLAYBACK_TAB_ID && toIndex === 0) {
				return state
			}

			if (
				fromIndex === toIndex ||
				fromIndex < 0 ||
				toIndex < 0 ||
				fromIndex >= state.length ||
				toIndex >= state.length
			) {
				return state
			}

			const reorderedState = [...state]
			const [movedTab] = reorderedState.splice(fromIndex, 1)
			reorderedState.splice(toIndex, 0, movedTab)

			return reorderedState

		case TabActionType.DEACTIVATE_ALL:
			// 将所有tab设置为非激活状态
			return state.map((tab) => ({
				...tab,
				active: false,
			}))

		default:
			return state
	}
}

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
		currentTopicStatus,
		messages,
		autoDetail,
		showPlaybackControl,
		isFileShare,
		onActiveTabChange,
		topicName,
		projectId,
	} = props

	const { t } = useTranslation("super")

	const { shareParams, isShareRoute } = useShareRoute()
	const [searchParams] = useSearchParams()

	// Store checkBeforeClose functions for each file
	const checkBeforeCloseMapRef = useRef<Map<string, () => Promise<boolean>>>(new Map())

	// State
	const [tabs, dispatchTabs] = useReducer(tabReducer, [])
	const [loading] = useState(false)
	const [error] = useState<string>()
	const [favoriteFiles, setFavoriteFiles] = useState<Set<string>>(new Set())
	const [fullscreenFileId, setFullscreenFileId] = useState<string | null>(null)

	// 拖拽相关状态
	const [draggedTab, setDraggedTab] = useState<TabItem | null>(null)
	const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)
	const [dragDirection, setDragDirection] = useState<"left" | "right" | null>(null)

	// 计算当前是否有激活的文件tab
	const hasActiveFileTab = useMemo(() => tabs.some((tab) => tab.active), [tabs])
	const viewerProjectId = selectedProject?.id || projectId || ""

	// 文件状态缓存相关 - 需要在 openPlaybackTab 之前声明
	const { organizationCode } = useOrganization()
	const projectStateRepository = useRef(new ProjectStateRepository()).current
	const [cacheLoaded, setCacheLoaded] = useState(false)
	const [isAwaitingProjectAttachments, setIsAwaitingProjectAttachments] = useState(
		Boolean(viewerProjectId),
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
		topicName, // 传递话题名称（用于分享场景）
		messages,
		currentTopicStatus,
		autoDetail,
		hasActiveFileTab, // 传递当前是否有激活的文件tab
	})

	// 包装openPlaybackTab，在需要激活时将所有文件tab设置为非激活状态
	const openPlaybackTab = useCallback(
		(options?: { toolData?: unknown; forceActivate?: boolean }) => {
			const { toolData, forceActivate } = options || {}

			// 如果用户正在预览文件，且不是强制打开，则不打开playbackTab
			// 这样切换话题时不会干扰用户当前的文件预览
			if (forceActivate === undefined && hasActiveFileTab) {
				console.log("🚫 用户正在预览文件，不打开 playbackTab")
				return
			}

			// 如果有 toolData，设置 userSelectDetail 为 toolData
			if (toolData) {
				setUserSelectDetail?.(toolData)
			}

			// 判断是否需要激活playbackTab
			const shouldActivate = forceActivate !== undefined ? forceActivate : !hasActiveFileTab

			// 如果需要激活playbackTab，则将所有文件tab设置为非激活状态
			if (shouldActivate) {
				dispatchTabs({ type: TabActionType.DEACTIVATE_ALL })
			}

			// 打开playback tab
			openPlaybackTabOriginal(options)
		},
		[openPlaybackTabOriginal, hasActiveFileTab, setUserSelectDetail],
	)

	// Use ref to track clearing state to avoid race conditions
	const isRestoringCacheRef = useRef(false)
	const lastProjectIdRef = useRef(viewerProjectId)
	const manuallyClosedLastTabRef = useRef(false)
	const lastFileListRef = useRef<FileItem[]>([])
	const lastNotifiedActiveFileIdRef = useRef<string | null | undefined>(undefined)
	const lastNotifiedTabTypeRef = useRef<"playback" | "file" | null | undefined>(undefined)
	// 存储 tab 打开后的回调函数（key: fileId）
	const tabCallbacksRef = useRef<Map<string, () => void>>(new Map())
	const isProjectSwitching = viewerProjectId !== lastProjectIdRef.current

	// 合并tabs：演示模式tab在第一位
	const allTabs = useMemo(() => {
		return playbackTab ? [playbackTab, ...tabs] : tabs
	}, [playbackTab, tabs])
	const visibleTabs = useMemo(() => {
		return isProjectSwitching ? [] : allTabs
	}, [allTabs, isProjectSwitching])
	const activeTab = useMemo(() => {
		if (isProjectSwitching) return undefined

		return allTabs.find((tab) => tab.active)
	}, [allTabs, isProjectSwitching])

	useEffect(() => {
		mentionPanelStore.setCurrentTabs(visibleTabs)

		return () => {
			mentionPanelStore.setCurrentTabs([])
		}
	}, [visibleTabs])

	// Collect all files (non-directory) and flatten
	const collectFiles = useCallback((items: FileItem[]): FileItem[] => {
		let files: FileItem[] = []
		if (!items || !Array.isArray(items)) return files

		items.forEach((item) => {
			if (item.is_directory && Array.isArray(item.children)) {
				files = [...files, ...collectFiles(item.children)]
			} else if (!item.is_directory) {
				files.push(item)
			}
		})
		return files
	}, [])

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

	// Get all previewable files
	const allFiles = useCallback(() => {
		return collectFiles(attachments || []).reverse()
	}, [attachments, collectFiles])

	const fileList = allFiles()
	const shouldUseCurrentProjectAttachments =
		!isAwaitingProjectAttachments &&
		(fileList.length === 0 ||
			fileList.every((file) => !file.project_id || file.project_id === viewerProjectId))

	// Tab operations
	const openFileTab = useMemoizedFn((fileItem: any, autoEdit?: boolean) => {
		const fileList = allFiles()

		// Reset manual close flag when opening new tab
		manuallyClosedLastTabRef.current = false

		const file = fileList.find((f) => f.file_id === (fileItem?.file_id || fileItem?.fileId))

		const attachmentFile = attachmentList?.find(
			(f) => f.file_id === (fileItem?.file_id || fileItem?.fileId),
		)

		// 如果找不到文件，但传入的是文件夹且有 file_id，直接使用传入的 fileItem（用于支持 design 类型的文件夹）
		const targetFile =
			file ||
			(attachmentFile?.is_directory && attachmentFile?.file_id ? attachmentFile : null)

		if (!targetFile) {
			return
		}

		const newTab = convertFileToTabItem(targetFile, attachments, {
			...fileItem,
			metadata: fileItem?.metadata || targetFile.metadata,
		})

		if (!newTab) {
			return
		}

		// 当打开文件tab时，将playback tab设置为非激活状态
		if (playbackTab?.active) {
			updatePlaybackTab({ active: false })
		}

		// 如果需要自动进入编辑模式，存储回调函数
		if (autoEdit && targetFile) {
			tabCallbacksRef.current.set(targetFile.file_id, () => {
				pubsub.publish(PubSubEvents.Enter_Edit_Mode, targetFile.file_id)
			})
		}

		dispatchTabs({ type: TabActionType.ADD_TAB, payload: { tab: newTab } })
	})

	const closeFileTab = useMemoizedFn((tabId: string) => {
		// 如果是关闭playback tab
		if (tabId === PLAYBACK_TAB_ID) {
			closePlaybackTab()
			// 关闭playback tab后，如果有文件tabs，激活最近使用的文件tab
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
			}
			return
		}

		// 检查是否正在关闭当前激活的tab
		const closingTab = tabs.find((tab) => tab.id === tabId)
		const isClosingActiveTab = closingTab?.active

		// Check if this is the last tab
		if (tabs.length === 1) {
			manuallyClosedLastTabRef.current = true
		}

		dispatchTabs({ type: TabActionType.REMOVE_TAB, payload: { tabId } })

		// 如果关闭的是激活的tab，且关闭后没有文件tab了，但有playbackTab，则切换到playbackTab
		if (isClosingActiveTab && tabs.length === 1 && playbackTab) {
			// 使用setTimeout确保dispatch完成后再切换
			setTimeout(() => {
				updatePlaybackTab({ active: true })
			}, 0)
		}
	})

	const switchToTab = useMemoizedFn((tabId: string) => {
		// 如果切换到playback tab
		if (tabId === PLAYBACK_TAB_ID) {
			// 将所有文件tab设置为非激活状态
			dispatchTabs({ type: TabActionType.DEACTIVATE_ALL })
			// 激活playback tab
			if (playbackTab) {
				updatePlaybackTab({ active: true })
			}
		} else {
			// 切换到文件tab时，将playback tab设置为非激活状态
			if (playbackTab?.active) {
				updatePlaybackTab({ active: false })
			}
			dispatchTabs({ type: TabActionType.SWITCH_TAB, payload: { tabId } })
		}
	})

	const clearAllTabs = useCallback(() => {
		// Set flag to prevent auto-opening after clearing all tabs
		manuallyClosedLastTabRef.current = true
		dispatchTabs({ type: TabActionType.CLEAR_TABS })
		// 同时关闭 playbackTab
		closePlaybackTab()
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
			copyFileContent(fileList, t, fileId, fileContent, fileVersion)
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
		} else {
			setFullscreenFileId(fileId)
		}
	})

	const handleExitFullscreen = useMemoizedFn(() => {
		setFullscreenFileId(null)
	})

	// 拖拽处理函数
	const handleTabDragStart = useMemoizedFn((e: React.DragEvent, tab: TabItem) => {
		setDraggedTab(tab)
		e.dataTransfer.effectAllowed = "move"
		e.dataTransfer.setData("text/plain", tab.id)
	})

	const handleTabDragEnd = useMemoizedFn((e: React.DragEvent) => {
		setDraggedTab(null)
		setDragOverIndex(null)
		setDragDirection(null)
	})

	const handleTabDragOver = useMemoizedFn((e: React.DragEvent, index: number) => {
		e.preventDefault()
		e.dataTransfer.dropEffect = "move"
		setDragOverIndex(index)

		// 计算拖拽方向
		if (draggedTab) {
			const dragIndex = tabs.findIndex((tab) => tab.id === draggedTab.id)
			if (dragIndex !== -1) {
				// 如果有playbackTab，需要调整索引（因为UI中的index包含了playbackTab）
				const adjustedIndex = playbackTab ? index - 1 : index
				const adjustedDragIndex = dragIndex
				// 如果拖拽到前面，显示左边框；拖拽到后面，显示右边框
				setDragDirection(adjustedIndex < adjustedDragIndex ? "left" : "right")
			}
		}
	})

	const handleTabDrop = useMemoizedFn((e: React.DragEvent, dropIndex: number) => {
		e.preventDefault()

		if (!draggedTab) return

		const dragIndex = tabs.findIndex((tab) => tab.id === draggedTab.id)
		if (dragIndex === -1) return

		// 如果有playbackTab，需要调整dropIndex（因为UI中的index包含了playbackTab）
		const adjustedDropIndex = playbackTab ? dropIndex - 1 : dropIndex

		if (dragIndex === adjustedDropIndex) return

		// 执行拖拽排序
		dispatchTabs({
			type: TabActionType.REORDER_TABS,
			payload: {
				fromIndex: dragIndex,
				toIndex: adjustedDropIndex,
			},
		})

		setDraggedTab(null)
		setDragOverIndex(null)
		setDragDirection(null)
	})

	// Generate file detail for rendering
	const getFileDetail = useCallback(
		(file: FileItem) => {
			const fileName = file.display_filename || file.file_name || file.filename

			// 1. 优先检查是否是内容类型渲染（不依赖文件内容，有自己的 detail render content）
			const contentTypeConfig = detectContentTypeRender(file)

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
						content: null, // 内容类型渲染不依赖文件内容
						metadata: file?.metadata,
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
						file_name: fileName,
						file_id: file.file_id,
						file_extension: file.file_extension,
						file_size: file.file_size,
						metadata: file?.metadata,
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
						file_name: fileName,
						file_id: file.file_id,
						file_extension: file.file_extension,
						file_size: file.file_size,
						metadata: file?.metadata,
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
						content: null, // 文件内容延迟加载
						metadata: file?.metadata,
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
		pubsub.subscribe("exit_fullscreen", handleExitFullscreen)
		return () => {
			pubsub.unsubscribe("exit_fullscreen", handleExitFullscreen)
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [])

	useEffect(() => {
		const handleAttachmentsLoading = (loading: boolean) => {
			if (!loading) {
				setIsAwaitingProjectAttachments(false)
			}
		}

		pubsub.subscribe(PubSubEvents.Update_Attachments_Loading, handleAttachmentsLoading)
		return () => {
			pubsub.unsubscribe(PubSubEvents.Update_Attachments_Loading, handleAttachmentsLoading)
		}
	}, [])

	useEffect(() => {
		if (!viewerProjectId) {
			setIsAwaitingProjectAttachments(false)
			return
		}

		const hasCurrentProjectFiles = fileList.some(
			(file) => !file.project_id || file.project_id === viewerProjectId,
		)

		if (hasCurrentProjectFiles) {
			setIsAwaitingProjectAttachments(false)
		}
	}, [fileList, viewerProjectId])

	// Clear tabs when selectedProject changes
	// 加载缓存状态
	useEffect(() => {
		if (
			cacheLoaded ||
			isRestoringCacheRef.current ||
			!organizationCode ||
			!selectedProject?.id
		) {
			return
		}

		const loadCacheState = async () => {
			try {
				const cachedState = await projectStateRepository.getProjectState(
					organizationCode,
					selectedProject.id,
				)

				if (cachedState?.fileState?.tabs && cachedState.fileState.tabs.length > 0) {
					// 处理缓存的文件，保留所有tab但标记不存在的文件
					const processedTabs: TabItem[] = cachedState.fileState.tabs
						.filter((tab) => {
							try {
								// 只过滤掉数据完整性有问题的 tab
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
								const shouldHydrateFromCurrentAttachments =
									shouldUseCurrentProjectAttachments
								let file: FileItem | undefined

								if (shouldHydrateFromCurrentAttachments) {
									// 先在文件列表中查找（只包含文件）
									file = fileList.find((f) => f.file_id === tab.id)

									// 如果没找到，可能是文件夹，在 attachments 树中递归查找
									if (!file && attachments) {
										file = findItemInAttachments(attachments, tab.id)
									}
								}

								const isDeleted = shouldHydrateFromCurrentAttachments
									? !file
									: false

								let metadata
								if (file?.metadata || tab.fileData.metadata) {
									metadata = {
										...tab.fileData.metadata,
										...file?.metadata,
									}
								}

								return {
									...tab,
									closeable: true,
									isDeleted: isDeleted || false, // 确保类型为boolean
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
											}
											: {}),
										metadata,
									},
									metadata,
								} as TabItem
							} catch (error) {
								return null
							}
						})
						.filter((tab): tab is TabItem => tab !== null)

					// 如果没有任何可用的 tabs，才清理缓存
					if (processedTabs.length === 0) {
						try {
							await projectStateRepository.updateFileState(
								organizationCode,
								selectedProject.id,
								{ tabs: [] },
							)
						} catch (cleanupError) {
							console.error(cleanupError)
						}
						return
					}

					if (processedTabs.length > 0) {
						// 恢复处理过的 tabs
						dispatchTabs({
							type: TabActionType.SYNC_TABS_DATA,
							payload: { tabs: processedTabs },
						})

						// 如果缓存中有 activeTabId，尝试切换到该 tab
						if (cachedState.fileState?.activeTabId) {
							const activeTab = processedTabs.find(
								(tab) => tab.id === cachedState.fileState?.activeTabId,
							)
							if (activeTab) {
								dispatchTabs({
									type: TabActionType.SWITCH_TAB,
									payload: { tabId: cachedState.fileState.activeTabId },
								})
								// 如果激活的tab文件已被删除，给出提示但保持激活状态
								if (activeTab.isDeleted) {
									console.warn(
										"⚠️ 激活的文件已不存在，但保持激活状态:",
										activeTab.fileData.file_name,
									)
								}

								// 通过 PubSub 通知 Workspace 组件更新 activeFileId（activeFileId = activeTabId）
								console.log(
									"🟢 Restoring cached activeFileId (from activeTabId):",
									cachedState.fileState.activeTabId,
								)
								pubsub.publish(
									PubSubEvents.Update_Active_File_Id,
									cachedState.fileState.activeTabId,
								)
							} else {
								// 激活第一个tab
								if (processedTabs[0]) {
									dispatchTabs({
										type: TabActionType.SWITCH_TAB,
										payload: { tabId: processedTabs[0].id },
									})
									// 通知 Workspace 更新 activeFileId
									pubsub.publish(
										PubSubEvents.Update_Active_File_Id,
										processedTabs[0].id,
									)
								}
							}
						} else {
							// 没有缓存的激活tab，激活第一个tab
							if (processedTabs[0]) {
								dispatchTabs({
									type: TabActionType.SWITCH_TAB,
									payload: { tabId: processedTabs[0].id },
								})
								// 通知 Workspace 更新 activeFileId
								pubsub.publish(
									PubSubEvents.Update_Active_File_Id,
									processedTabs[0].id,
								)
							}
						}
					}

					// 检查是否需要恢复playback tab
					if (cachedState.fileState?.playbackTabExists) {
						// 恢复playbackTab，根据缓存的激活状态决定是否激活
						openPlaybackTab({
							forceActivate: cachedState.fileState.playbackTabActive || false,
						})
					}
				}

				setCacheLoaded(true)
			} catch (error) {
				setCacheLoaded(true)
			}
		}

		isRestoringCacheRef.current = true
		void loadCacheState().finally(() => {
			isRestoringCacheRef.current = false
		})
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [
		organizationCode,
		selectedProject?.id,
		cacheLoaded,
		projectStateRepository,
		openPlaybackTab,
	])

	useEffect(() => {
		if (viewerProjectId !== lastProjectIdRef.current) {
			lastProjectIdRef.current = viewerProjectId
			isRestoringCacheRef.current = false
			setIsAwaitingProjectAttachments(Boolean(viewerProjectId))
			manuallyClosedLastTabRef.current = false // Reset manual close flag on project change
			lastFileListRef.current = []
			tabCallbacksRef.current.clear()
			checkBeforeCloseMapRef.current.clear()
			setFullscreenFileId(null)
			setCacheLoaded(false) // Reset cache loaded state
			clearAllTabs()
		}
	}, [clearAllTabs, viewerProjectId])

	// Sync tab data when fileList changes
	useEffect(() => {
		if (!shouldUseCurrentProjectAttachments) {
			return
		}

		const currentFileList = fileList
		const lastFileList = lastFileListRef.current

		// 检查 fileList 是否真的变化了
		if (
			JSON.stringify(
				currentFileList.map((f) => ({
					id: f.file_id,
					name: f.file_name,
					updated: f.updated_at,
				})),
			) ===
			JSON.stringify(
				lastFileList.map((f) => ({
					id: f.file_id,
					name: f.file_name,
					updated: f.updated_at,
				})),
			)
		) {
			return // 没有变化，跳过
		}

		lastFileListRef.current = currentFileList

		// 如果没有 tabs 为空，跳过同步
		if (tabs.length === 0) return

		let hasUpdates = false
		const updatedTabs = tabs.map((tab) => {
			// 检查是否是自定义渲染类型（如 design）
			// 自定义渲染类型可能是文件夹，不会出现在 fileList 中
			const isCustomRenderType = detectContentTypeRender(tab.fileData) !== null

			// 对于自定义渲染类型，需要在 attachments 树中查找（支持文件夹）
			// 对于普通文件，在 fileList 中查找（只包含文件）
			let updatedFile: FileItem | undefined

			if (isCustomRenderType) {
				// 自定义渲染类型：在 attachments 树中递归查找（支持文件夹）
				updatedFile = findItemInAttachments(attachments || [], tab.fileData.file_id)
			} else {
				// 普通文件：在 fileList 中查找（只包含文件）
				updatedFile = currentFileList.find((file) => file.file_id === tab.fileData.file_id)
			}

			// 文件已被删除
			if (!updatedFile) {
				if (!tab.isDeleted) {
					hasUpdates = true
					return {
						...tab,
						isDeleted: true,
					}
				}
				return tab // 如果已经标记为删除，保持不变
			}

			// 文件存在，检查是否需要同步数据
			if (JSON.stringify(updatedFile) !== JSON.stringify(tab.fileData)) {
				hasUpdates = true

				// 使用 getFileTabTitle 获取正确的 tab title（处理 index.html 的情况）
				const tabTitle = getFileTabTitle(updatedFile, attachments, updatedFile.metadata)

				return {
					...tab,
					title: tabTitle, // 同步更新标题
					fileData: updatedFile, // 同步更新文件数据
					isDeleted: false, // 确保删除状态被清除（如果文件恢复了）
				}
			}

			// 如果文件之前被标记为删除但现在又存在了，恢复状态
			if (tab.isDeleted) {
				hasUpdates = true

				// 使用 getFileTabTitle 获取正确的 tab title（处理 index.html 的情况）
				const tabTitle = getFileTabTitle(updatedFile, attachments, updatedFile.metadata)

				return {
					...tab,
					title: tabTitle, // 恢复正常标题
					fileData: updatedFile,
					isDeleted: false,
				}
			}

			return tab
		})

		if (hasUpdates) {
			// 批量同步所有 tabs 数据
			dispatchTabs({
				type: TabActionType.SYNC_TABS_DATA,
				payload: { tabs: updatedTabs },
			})
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [fileList, attachments, findItemInAttachments]) // 添加 attachments 和 findItemInAttachments 依赖，用于自定义渲染类型。不包含 tabs 以避免循环依赖

	// 保存文件状态到缓存
	const saveCacheState = useCallback(async () => {
		if (!organizationCode || !selectedProject?.id || !cacheLoaded || isProjectSwitching) {
			return
		}

		try {
			// 获取当前的文件状态，保持现有的其他状态不变
			const currentState = await projectStateRepository.getProjectState(
				organizationCode,
				selectedProject?.id,
			)

			// 获取当前所有 tabs 的 file_id 集合
			const currentFileIds = new Set(tabs.map((tab) => tab.fileData.file_id))

			// 清理 pptActiveIndexMap 中不再存在于 tabs 的文件
			const cleanedPptActiveIndexMap: Record<string, number> = {}
			if (currentState?.fileState?.pptActiveIndexMap) {
				Object.entries(currentState.fileState.pptActiveIndexMap).forEach(
					([fileId, index]) => {
						// 只保留当前仍在 tabs 中的文件的索引缓存
						if (currentFileIds.has(fileId)) {
							cleanedPptActiveIndexMap[fileId] = index
						} else {
							console.log("🧹 清理已关闭 tab 的 PPT 索引缓存:", fileId)
						}
					},
				)
			}

			// 只更新文件状态，不影响其他状态
			const fileState = {
				...currentState?.fileState,
				tabs: tabs.map((tab) => ({
					id: tab.id,
					title: tab.title,
					fileData: {
						file_id: tab.fileData.file_id,
						file_name: tab.fileData.file_name,
						filename: tab.fileData.filename,
						display_filename: tab.fileData.display_filename,
						file_extension: tab.fileData.file_extension,
						relative_file_path: tab.fileData.relative_file_path,
						metadata: tab.fileData.metadata,
						updated_at: tab.fileData.updated_at,
					},
					active: tab.active,
					filePath: tab.filePath,
					metadata: tab.metadata,
				})),
				activeTabId: activeTab?.id,
				pptActiveIndexMap: cleanedPptActiveIndexMap,
				playbackTabExists: !!playbackTab, // 保存playback tab是否存在
				playbackTabActive: playbackTab?.active || false, // 保存playback tab的激活状态
			}

			await projectStateRepository.updateFileState(
				organizationCode,
				selectedProject.id,
				fileState,
			)
		} catch (error) {
			console.error("Failed to save file state to cache:", error)
		}
	}, [
		organizationCode,
		selectedProject?.id,
		tabs,
		activeTab,
		cacheLoaded,
		isProjectSwitching,
		projectStateRepository,
		playbackTab,
	])

	// 当 tabs 状态变化时保存缓存
	useEffect(() => {
		if (cacheLoaded && tabs.length >= 0) {
			// 使用防抖避免频繁保存
			const timer = setTimeout(() => {
				saveCacheState()
			}, 500)

			return () => clearTimeout(timer)
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [saveCacheState, cacheLoaded]) // 不包含 tabs.length 以避免频繁保存

	const handleRefresh = useMemoizedFn(() => {
		// 如果有活跃的 tab，强制刷新其内容
		if (activeTab) {
			// 重新获取文件数据
			const file = fileList.find((f) => f.file_id === activeTab.id)
			if (file) {
				// 使用 getFileTabTitle 获取正确的 tab title（处理 index.html 的情况）
				const tabTitle = getFileTabTitle(file, attachments, file.metadata)

				// 生成新的 refreshKey 以强制 Render 组件重新挂载
				const refreshKey = `${activeTab.id}-${Date.now()}`

				// 更新 tab 数据，这会触发重新渲染和 getRenderProps
				const updatedTab: TabItem = {
					...activeTab,
					title: tabTitle,
					fileData: {
						...file,
						// 清除缓存的内容，强制重新加载
						content: undefined,
					},
					filePath: file.relative_file_path,
					metadata: file.metadata,
					refreshKey, // 添加刷新键以强制重新挂载
				}

				dispatchTabs({
					type: TabActionType.UPDATE_TAB,
					payload: { tab: updatedTab },
				})
			}
		}
	})

	useEffect(() => {
		pubsub.subscribe(PubSubEvents.Super_Magic_Detail_Refresh, handleRefresh)
		return () => {
			pubsub.unsubscribe(PubSubEvents.Super_Magic_Detail_Refresh, handleRefresh)
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [])

	const activeTabFileId = activeTab?.fileData?.file_id || null
	const activeTabId = activeTab?.id

	// Notify parent when active tab changes
	useEffect(() => {
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
		onActiveFileChange?.(currentActiveFileId)
	}, [activeTabFileId, onActiveFileChange])

	// Notify parent with current active tab type
	useEffect(() => {
		if (!onActiveTabChange) return

		const currentActiveTabType: "playback" | "file" | null = !activeTabId
			? null
			: isPlaybackTab(activeTabId)
				? "playback"
				: "file"
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
	}, [activeTabId, isPlaybackTab, onActiveTabChange])

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

			// 如果URL参数包含fullscreen=true，自动全屏对应文件
			if (fullscreen === "true" && shareParams.fileId) {
				handleFileFullscreen(shareParams.fileId)
			}
		}
	}, [isFileShare, searchParams, shareParams.fileId, handleFileFullscreen])

	return {
		// State
		tabs: visibleTabs, // 返回包含演示模式tab的完整tabs列表
		activeTab,
		fileList,
		loading,
		error,
		favoriteFiles,
		fullscreenFileId,

		// Tab operations
		openFileTab,
		closeFileTab,
		switchToTab,
		clearAllTabs,
		closeOtherTabs,
		closeTabsToRight,

		// Playback tab operations
		openPlaybackTab,
		closePlaybackTab,
		isPlaybackTab,

		// 拖拽相关函数
		handleTabDragStart,
		handleTabDragEnd,
		handleTabDragOver,
		handleTabDrop,
		draggedTab,
		dragOverIndex,
		dragDirection,

		handleRefresh,

		// File operations
		handleCopy,
		handleFavorite,
		handleShare,
		handleFileFullscreen,
		handleExitFullscreen,
		getFileDetail,

		// Computed props for Render component
		getRenderProps: (tab?: TabItem) => {
			if (!tab) return {}

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

			const showFileHeader = searchParams.get("showFileHeader") !== "false"

			return {
				type,
				data: fileDetail.data,
				updatedAt: fileDetail.updatedAt,
				attachments,
				setUserSelectDetail,
				currentIndex: 0,
				onPrevious: () => {
					// TODO: Implement previous file navigation
				},
				onNext: () => {
					// TODO: Implement next file navigation
				},
				onFullscreen: () => handleFileFullscreen(tab.fileData.file_id),
				onDownload: (fileId?: string, fileVersion?: number, mode?: DownloadImageMode) =>
					onDownload?.(fileId || tab.fileData.file_id, fileVersion, mode),
				totalFiles: fileList.length,
				hasUserSelectDetail: false,
				isFromNode: false,
				userSelectDetail,
				isFullscreen: fullscreenFileId === tab.fileData.file_id,
				attachmentList,
				viewMode,
				onViewModeChange: (mode: "code" | "desktop" | "phone") =>
					handleViewModeChange?.(tab.fileData.file_id, mode),
				onCopy: (fileVersion?: number, fileId?: string) => {
					handleCopy(
						fileId || tab.fileData.file_id,
						fileVersion ? tab.fileData.content : undefined,
						fileVersion,
					)
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
				},
				allowEdit,
				selectedTopic,
				selectedProject,
				projectId,
				detailMode: "files",
				metadata: tab.metadata,
				showFileHeader,
				onRefreshFile: handleRefresh,
				activeFileId,
				showFooter: showFileFooter,
				// Register checkBeforeClose callback
				onRegisterCheckBeforeClose: (fileId: string, callback: () => Promise<boolean>) => {
					checkBeforeCloseMapRef.current.set(fileId, callback)
				},
				onUnregisterCheckBeforeClose: (fileId: string) => {
					checkBeforeCloseMapRef.current.delete(fileId)
				},
				allowDownload: props.allowDownload,
			}
		},
		// Expose method to get checkBeforeClose for a file
		getCheckBeforeClose: (fileId: string) => {
			return checkBeforeCloseMapRef.current.get(fileId)
		},
	}
}
