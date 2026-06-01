import { useMemoizedFn } from "ahooks"
import { useEffect, useMemo, useRef, useState, type RefObject } from "react"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import type { DetailRef } from "../../../components/Detail"
import type { AttachmentItem } from "../../../components/TopicFilesButton/hooks/types"
import { getTemporaryDownloadUrl } from "../../../utils/api"
import { downloadFileWithAnchor } from "../../../utils/handleFIle"

type DetailTabType = "playback" | "file" | null

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
}

interface UseTopicDetailPanelControllerReturn {
	shouldShowDetailPanel: boolean
	handleFileClickWithPanel: (fileItem?: unknown) => void
	topicFilesPropsWithPanel: {
		onFileClick?: (fileItem?: unknown) => void
		[key: string]: unknown
	}
	handleActiveDetailTabChange: (tabType: DetailTabType) => void
	clearActiveDetailTabType: () => void
}

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
}: UseTopicDetailPanelControllerOptions): UseTopicDetailPanelControllerReturn {
	const [activeDetailTabType, setActiveDetailTabType] = useState<DetailTabType>(null)
	const fileOpenFallbackTimerRef = useRef<number | null>(null)
	const activeFileIdRef = useRef<string | null>(activeFileId)

	const shouldShowDetailPanel = useMemo(() => {
		if (isReadOnly) {
			return true
		}
		return (
			Boolean(activeFileId) ||
			activeDetailTabType === "playback" ||
			activeDetailTabType === "file"
		)
	}, [activeDetailTabType, activeFileId, isReadOnly])

	useEffect(() => {
		activeFileIdRef.current = activeFileId
	}, [activeFileId])

	const scheduleFileOpenFallback = useMemoizedFn(() => {
		if (fileOpenFallbackTimerRef.current) {
			window.clearTimeout(fileOpenFallbackTimerRef.current)
		}

		fileOpenFallbackTimerRef.current = window.setTimeout(() => {
			if (!activeFileIdRef.current) {
				setActiveDetailTabType((prev) => (prev === "file" ? null : prev))
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
		// setActiveFileId(null)
		// setActiveDetailTabType("file")
		handleFileClick(fileItem)
		scheduleFileOpenFallback()
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
			window.setTimeout(() => {
				// 允许消息区直接传入临时 fileData，复用右侧详情区打开逻辑。
				detailRef.current?.openFileTab?.({ file_id: payload.fileId })
			}, DETAIL_OPEN_DELAY_MS)
			scheduleFileOpenFallback()
		}

		const handleOpenPlaybackTab = (toolData: unknown) => {
			setActiveFileId(null)
			setActiveDetailTabType("playback")
			window.setTimeout(() => {
				detailRef.current?.openPlaybackTab?.({ toolData, forceActivate: true })
			}, DETAIL_OPEN_DELAY_MS)
		}

		const handleOpenFileTabByPath = (data: unknown) => {
			// 在 attachmentList 中按 relative_file_path 查找对应文件
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
					getTemporaryDownloadUrl({
						file_ids: [matched.file_id],
						is_download: true,
					}).then((res: any) => {
						downloadFileWithAnchor(res[0]?.url)
					})
				} else {
					window.setTimeout(() => {
						detailRef.current?.openFileTab?.({ file_id: matched.file_id })
					}, DETAIL_OPEN_DELAY_MS)
					scheduleFileOpenFallback()
				}
			}
		}

		const handleOpenKnowledgeBaseTab = (data: unknown) => {
			const payload = data as {
				knowledgeBaseId: string
				fileKey: string
				title: string
				knowledgeBaseName?: string
				fileExtension?: string
			}
			setActiveDetailTabType("file")
			window.setTimeout(() => {
				detailRef.current?.openKnowledgeBaseTab?.(payload)
			}, DETAIL_OPEN_DELAY_MS)
		}

		pubsub.subscribe(PubSubEvents.Open_File_Tab, handleOpenFileTab)
		pubsub.subscribe(PubSubEvents.Open_Playback_Tab, handleOpenPlaybackTab)
		pubsub.subscribe(PubSubEvents.Open_File_Tab_By_Path, handleOpenFileTabByPath)
		pubsub.subscribe(PubSubEvents.Open_Knowledge_Base_Tab, handleOpenKnowledgeBaseTab)

		return () => {
			pubsub.unsubscribe(PubSubEvents.Open_File_Tab, handleOpenFileTab)
			pubsub.unsubscribe(PubSubEvents.Open_Playback_Tab, handleOpenPlaybackTab)
			pubsub.unsubscribe(PubSubEvents.Open_File_Tab_By_Path, handleOpenFileTabByPath)
			pubsub.unsubscribe(PubSubEvents.Open_Knowledge_Base_Tab, handleOpenKnowledgeBaseTab)
		}
	}, [detailRef, scheduleFileOpenFallback, setActiveFileId, attachmentList])

	const handleActiveDetailTabChange = useMemoizedFn((tabType: DetailTabType) => {
		setActiveDetailTabType(tabType)
	})

	const clearActiveDetailTabType = useMemoizedFn(() => {
		setActiveDetailTabType(null)
	})

	return {
		shouldShowDetailPanel,
		handleFileClickWithPanel,
		topicFilesPropsWithPanel,
		handleActiveDetailTabChange,
		clearActiveDetailTabType,
	}
}
