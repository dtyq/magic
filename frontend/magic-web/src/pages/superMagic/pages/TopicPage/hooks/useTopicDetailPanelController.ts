import { useMemoizedFn } from "ahooks"
import { useEffect, useMemo, useRef, useState, type RefObject } from "react"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import type { DetailRef } from "../../../components/Detail"
import type { ActiveDetailTabType } from "../../../components/Detail/components/FilesViewer/types"
import type { AttachmentItem } from "../../../components/TopicFilesButton/hooks/types"
import { downloadFileWithAnchor } from "../../../utils/handleFIle"
import { useFileApi } from "@/pages/superMagic/fileAccess/fileApi"

interface UseTopicDetailPanelControllerOptions {
	detailRef: RefObject<DetailRef>
	isReadOnly: boolean
	activeFileId: string | null
	setActiveFileId: (fileId: string | null) => void
	handleFileClick: (fileItem?: unknown) => void
	topicFilesProps: {
		onFileClick?: (fileItem?: unknown) => void
		[key: string]: unknown
	}
	/** 附件列表，用于 Open_File_Tab_By_Path 事件中按路径查找文件 */
	attachmentList?: AttachmentItem[]
	/** 为 false 时由移动端 popup 消费 Open_Micro_App_Tab */
	subscribeMicroAppTab?: boolean
	/**
	 * Takes over "open tool playback" requests; return true when handled, and the detail panel's
	 * playback tab is left alone. The AI canvas shows playbacks in a floating panel instead.
	 */
	onOpenPlayback?: (toolData: unknown) => boolean
}

interface UseTopicDetailPanelControllerReturn {
	shouldShowDetailPanel: boolean
	hasActiveDetailTab: boolean
	activeDetailTabType: ActiveDetailTabType
	isDetailPanelCollapsed: boolean
	collapseDetailPanel: () => void
	expandDetailPanel: () => void
	handleFileClickWithPanel: (fileItem?: unknown) => void
	topicFilesPropsWithPanel: {
		onFileClick?: (fileItem?: unknown) => void
		[key: string]: unknown
	}
	handleActiveDetailTabChange: (tabType: DetailTabType) => void
	clearActiveDetailTabType: (options?: { preservePublishedMicroApp?: boolean }) => void
}

type DetailTabType = ActiveDetailTabType

const DETAIL_OPEN_DELAY_MS = 100
const FILE_OPEN_FALLBACK_DELAY_MS = 300

export function useTopicDetailPanelController({
	detailRef,
	isReadOnly,
	activeFileId,
	setActiveFileId,
	handleFileClick,
	topicFilesProps,
	attachmentList = [],
	subscribeMicroAppTab = true,
	onOpenPlayback,
}: UseTopicDetailPanelControllerOptions): UseTopicDetailPanelControllerReturn {
	// Stable wrapper, so a new handler from the host does not resubscribe every event.
	const handleOpenPlaybackOverride = useMemoizedFn(
		(toolData: unknown) => onOpenPlayback?.(toolData) ?? false,
	)
	const fileApi = useFileApi()
	const [activeDetailTabTypeState, setActiveDetailTabType] = useState<DetailTabType>(null)
	// 收起只改变布局，不清空活动文件；展开继续使用原标签和编辑实例。
	const [isDetailPanelCollapsed, setIsDetailPanelCollapsed] = useState(false)
	const fileOpenFallbackTimerRef = useRef<number | null>(null)
	const activeFileIdRef = useRef<string | null>(activeFileId)
	const activeDetailTabTypeRef = useRef<DetailTabType>(null)

	const activeDetailTabType = useMemo<DetailTabType>(() => {
		if (activeDetailTabTypeState && activeDetailTabTypeState !== "file") {
			return activeDetailTabTypeState
		}
		return activeFileId ? "file" : activeDetailTabTypeState
	}, [activeDetailTabTypeState, activeFileId])
	const hasActiveDetailTab = useMemo(
		() => Boolean(activeFileId) || Boolean(activeDetailTabType),
		[activeDetailTabType, activeFileId],
	)
	const shouldShowDetailPanel = useMemo(() => {
		if (isReadOnly) {
			return true
		}
		return !isDetailPanelCollapsed && (Boolean(activeFileId) || Boolean(activeDetailTabType))
	}, [activeDetailTabType, activeFileId, isReadOnly, isDetailPanelCollapsed])

	const collapseDetailPanel = useMemoizedFn(() => {
		if (!isReadOnly) setIsDetailPanelCollapsed(true)
	})
	const expandDetailPanel = useMemoizedFn(() => {
		setIsDetailPanelCollapsed(false)
	})

	useEffect(() => {
		activeFileIdRef.current = activeFileId
	}, [activeFileId])

	useEffect(() => {
		activeDetailTabTypeRef.current = activeDetailTabType
	}, [activeDetailTabType])

	const scheduleFileOpenFallback = useMemoizedFn((fallbackTabType: DetailTabType = null) => {
		if (fileOpenFallbackTimerRef.current) {
			window.clearTimeout(fileOpenFallbackTimerRef.current)
		}

		fileOpenFallbackTimerRef.current = window.setTimeout(() => {
			if (!activeFileIdRef.current) {
				setActiveDetailTabType((prev) => (prev === "file" ? fallbackTabType : prev))
			}
			fileOpenFallbackTimerRef.current = null
		}, FILE_OPEN_FALLBACK_DELAY_MS)
	})

	useEffect(() => {
		return () => {
			if (fileOpenFallbackTimerRef.current) {
				window.clearTimeout(fileOpenFallbackTimerRef.current)
			}
		}
	}, [])

	const handleFileClickWithPanel = useMemoizedFn((fileItem?: unknown) => {
		expandDetailPanel()
		const fallbackTabType = activeDetailTabTypeRef.current
		setActiveDetailTabType("file")
		handleFileClick(fileItem)
		scheduleFileOpenFallback(fallbackTabType)
	})

	const topicFilesPropsWithPanel = useMemo(
		() => ({
			...topicFilesProps,
			onFileClick: handleFileClickWithPanel,
		}),
		[handleFileClickWithPanel, topicFilesProps],
	)

	useEffect(() => {
		const handleOpenFileTab = (data: unknown) => {
			const payload = data as { fileId: string; fileData?: unknown }
			// On open failure, restore the prior tab type instead of clearing the panel.
			const fallbackTabType = activeDetailTabTypeRef.current
			setActiveDetailTabType("file")
			window.setTimeout(() => {
				// Allow messages to pass temporary fileData through the detail panel open flow.
				detailRef.current?.openFileTab?.(
					payload.fileData ?? payload.fileData ?? { file_id: payload.fileId },
				)
			}, DETAIL_OPEN_DELAY_MS)
			scheduleFileOpenFallback(fallbackTabType)
		}

		const handleOpenPlaybackTab = (toolData: unknown) => {
			if (handleOpenPlaybackOverride(toolData)) return
			setActiveFileId(null)
			setActiveDetailTabType("playback")
			window.setTimeout(() => {
				detailRef.current?.openPlaybackTab?.({ toolData, forceActivate: true })
			}, DETAIL_OPEN_DELAY_MS)
		}

		const handleOpenFileTabByPath = (data: unknown) => {
			// Resolve the target file by relative_file_path from attachmentList.
			const payload = data as {
				filePath: string
				fileName: string
				action?: "open" | "download"
			}
			const normPath = (p: string) => p.replace(/^\//, "")
			const targetPath = normPath(payload.filePath)
			const matched = attachmentList.find(
				(item) => normPath(item.relative_file_path || "") === targetPath,
			)
			if (matched?.file_id) {
				if (payload.action === "download") {
					fileApi
						.getTemporaryDownloadUrl({
							file_ids: [matched.file_id],
							is_download: true,
						})
						.then((res: any) => {
							downloadFileWithAnchor(res[0]?.url)
						})
				} else {
					window.setTimeout(() => {
						detailRef.current?.openFileTab?.(matched)
					}, DETAIL_OPEN_DELAY_MS)
					scheduleFileOpenFallback()
				}
				return
			}

			if (payload.action !== "download") {
				window.setTimeout(() => {
					detailRef.current?.openFileTab?.({
						file_name: payload.fileName,
						relative_file_path: targetPath,
						file_path: targetPath,
					})
				}, DETAIL_OPEN_DELAY_MS)
				scheduleFileOpenFallback()
			}

			if (payload.action !== "download") {
				window.setTimeout(() => {
					detailRef.current?.openFileTab?.({
						file_name: payload.fileName,
						relative_file_path: targetPath,
						file_path: targetPath,
					})
				}, DETAIL_OPEN_DELAY_MS)
				scheduleFileOpenFallback()
			}
		}

		const handleOpenKnowledgeBaseTab = (data: unknown) => {
			const payload = data as {
				knowledgeBaseId: string
				documentCode?: string
				fileKey?: string
				title: string
				knowledgeBaseName?: string
				fileExtension?: string
			}
			setActiveDetailTabType("knowledge_base")
			window.setTimeout(() => {
				detailRef.current?.openKnowledgeBaseTab?.(payload)
			}, DETAIL_OPEN_DELAY_MS)
		}

		const handleOpenMicroAppTab = (data: unknown) => {
			const payload = data as { appId?: string; appName?: string }
			const appId = payload.appId?.trim()
			if (!appId) return

			setActiveDetailTabType("micro_app")
			window.setTimeout(() => {
				detailRef.current?.openMicroAppTab?.({
					appId,
					appName: payload.appName,
				})
			}, DETAIL_OPEN_DELAY_MS)
		}

		pubsub.subscribe(PubSubEvents.Open_File_Tab, handleOpenFileTab)
		pubsub.subscribe(PubSubEvents.Open_Playback_Tab, handleOpenPlaybackTab)
		pubsub.subscribe(PubSubEvents.Open_File_Tab_By_Path, handleOpenFileTabByPath)
		pubsub.subscribe(PubSubEvents.Open_Knowledge_Base_Tab, handleOpenKnowledgeBaseTab)
		if (subscribeMicroAppTab) {
			pubsub.subscribe(PubSubEvents.Open_Micro_App_Tab, handleOpenMicroAppTab)
		}

		return () => {
			pubsub.unsubscribe(PubSubEvents.Open_File_Tab, handleOpenFileTab)
			pubsub.unsubscribe(PubSubEvents.Open_Playback_Tab, handleOpenPlaybackTab)
			pubsub.unsubscribe(PubSubEvents.Open_File_Tab_By_Path, handleOpenFileTabByPath)
			pubsub.unsubscribe(PubSubEvents.Open_Knowledge_Base_Tab, handleOpenKnowledgeBaseTab)
			if (subscribeMicroAppTab) {
				pubsub.unsubscribe(PubSubEvents.Open_Micro_App_Tab, handleOpenMicroAppTab)
			}
		}
	}, [
		attachmentList,
		detailRef,
		fileApi,
		handleOpenPlaybackOverride,
		scheduleFileOpenFallback,
		setActiveFileId,
		subscribeMicroAppTab,
	])

	const handleActiveDetailTabChange = useMemoizedFn((tabType: DetailTabType) => {
		setActiveDetailTabType(tabType)
	})

	const clearActiveDetailTabType = useMemoizedFn(
		(options?: { preservePublishedMicroApp?: boolean }) => {
			// Published micro-app previews are project-scoped, so keep them visible
			// when a host topic changes while still clearing other preview types.
			if (
				options?.preservePublishedMicroApp &&
				activeDetailTabTypeRef.current === "micro_app"
			) {
				return
			}
			setActiveDetailTabType(null)
			setIsDetailPanelCollapsed(false)
		},
	)

	return {
		shouldShowDetailPanel,
		hasActiveDetailTab,
		activeDetailTabType,
		isDetailPanelCollapsed:
			!isReadOnly &&
			isDetailPanelCollapsed &&
			(Boolean(activeFileId) || Boolean(activeDetailTabType)),
		collapseDetailPanel,
		expandDetailPanel,
		handleFileClickWithPanel,
		topicFilesPropsWithPanel,
		handleActiveDetailTabChange,
		clearActiveDetailTabType,
	}
}
