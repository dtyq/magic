import { type RefObject } from "react"
import { useDeepCompareEffect, useMemoizedFn } from "ahooks"
import type { DetailRef } from "@/pages/superMagic/components/Detail"
import { useTopicDetailPanelController } from "@/pages/superMagic/pages/TopicPage/hooks/useTopicDetailPanelController"
import type { AttachmentItem } from "@/pages/superMagic/components/TopicFilesButton/hooks/types"

interface TopicFilesProps {
	onFileClick?: (fileItem?: unknown) => void
	[key: string]: unknown
}

interface UseCompositeDetailPanelControllerOptions {
	detailRef: RefObject<DetailRef>
	isReadOnly: boolean
	activeFileId: string | null
	setActiveFileId: (fileId: string | null) => void
	handleFileClick: (fileItem?: unknown) => void
	topicFilesProps: TopicFilesProps
	extraPanelVisible?: boolean
	resetDeps?: Array<unknown>
	onReset?: () => void
	/** 附件列表，用于 Open_File_Tab_By_Path 事件按路径查找文件 */
	attachmentList?: AttachmentItem[]
}

interface UseCompositeDetailPanelControllerResult {
	shouldShowDetailPanel: boolean
	topicFilesPropsWithPanel: TopicFilesProps
	handleFileClickWithPanel: (fileItem?: unknown) => void
	handleActiveDetailTabChange: (tabType: "playback" | "file" | null) => void
	clearActiveDetailTabType: () => void
}

export function useCompositeDetailPanelController({
	detailRef,
	isReadOnly,
	activeFileId,
	setActiveFileId,
	handleFileClick,
	topicFilesProps,
	extraPanelVisible = false,
	resetDeps = [],
	onReset,
	attachmentList,
}: UseCompositeDetailPanelControllerOptions): UseCompositeDetailPanelControllerResult {
	const {
		shouldShowDetailPanel: shouldShowFileDetailPanel,
		topicFilesPropsWithPanel,
		handleFileClickWithPanel,
		handleActiveDetailTabChange,
		clearActiveDetailTabType,
	} = useTopicDetailPanelController({
		detailRef,
		isReadOnly,
		activeFileId,
		setActiveFileId,
		handleFileClick,
		topicFilesProps,
		attachmentList,
	})

	const resetDetailPanelState = useMemoizedFn(() => {
		clearActiveDetailTabType()
		setActiveFileId(null)
		onReset?.()
	})

	useDeepCompareEffect(() => {
		if (!resetDeps.length) return
		resetDetailPanelState()
	}, resetDeps)

	return {
		shouldShowDetailPanel: extraPanelVisible || shouldShowFileDetailPanel,
		topicFilesPropsWithPanel,
		handleFileClickWithPanel,
		handleActiveDetailTabChange,
		clearActiveDetailTabType,
	}
}
