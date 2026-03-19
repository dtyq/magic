import { useMemoizedFn } from "ahooks"
import { useEffect, useMemo, useRef, useState, type RefObject } from "react"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import type { DetailRef } from "../../../components/Detail"

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
		setActiveDetailTabType("file")
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
		const handleOpenFileTab = (data: { fileId: string }) => {
			// setActiveFileId(null)
			setActiveDetailTabType("file")
			window.setTimeout(() => {
				detailRef.current?.openFileTab?.({ file_id: data.fileId })
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

		pubsub.subscribe(PubSubEvents.Open_File_Tab, handleOpenFileTab)
		pubsub.subscribe(PubSubEvents.Open_Playback_Tab, handleOpenPlaybackTab)

		return () => {
			pubsub.unsubscribe(PubSubEvents.Open_File_Tab, handleOpenFileTab)
			pubsub.unsubscribe(PubSubEvents.Open_Playback_Tab, handleOpenPlaybackTab)
		}
	}, [detailRef, scheduleFileOpenFallback, setActiveFileId])

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
