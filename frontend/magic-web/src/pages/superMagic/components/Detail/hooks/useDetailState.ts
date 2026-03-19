import { useMemo } from "react"
import { isEmpty } from "lodash-es"
import { TaskStatus, Topic } from "../../../pages/Workspace/types"
import { DetailType } from "../types"

interface UseDetailStateProps {
	currentTopicStatus?: TaskStatus
	userSelectDetail?: any
	autoDetail?: any
	selectedTopic?: Topic | null
	messages?: any[]
	toolSteps?: any[]
	currentStepIndex?: number
	isFromNode?: boolean
	isShareRoute?: boolean
	isFileShare?: boolean
	disPlayDetail?: any
	isPlaybackMode?: boolean // 是否在演示模式（playback tab）中
}

interface UseDetailStateReturn {
	showAnimation: boolean
	isEmptyDetail: boolean
	isPPT: boolean
	isViewingPreviousTopic: boolean
	shouldShowBackToLatestButton: boolean
}

function useDetailState({
	currentTopicStatus,
	userSelectDetail,
	autoDetail,
	selectedTopic,
	messages = [],
	toolSteps = [],
	currentStepIndex = 0,
	isFromNode = false,
	isShareRoute = false,
	isFileShare = false,
	disPlayDetail,
	isPlaybackMode = false,
}: UseDetailStateProps): UseDetailStateReturn {
	const showAnimation = useMemo(() => {
		// 在演示模式（playback tab）中，如果话题正在运行，则显示动画
		if (isPlaybackMode && currentTopicStatus === "running") return true
		return false
	}, [isPlaybackMode, currentTopicStatus])

	const isEmptyDetail = useMemo(() => {
		return isEmpty(disPlayDetail) || disPlayDetail?.type === DetailType.Empty
	}, [disPlayDetail])

	const isPPT = useMemo(() => {
		// 暂时先这么认为他是一个PPT文件，后续需要优化
		return disPlayDetail?.data?.file_name === "index.html"
	}, [disPlayDetail])

	// 检查是否正在查看上一个话题的详情
	const isViewingPreviousTopic = useMemo(() => {
		// 如果当前有用户选择的详情，但是 toolSteps 为空
		if ((userSelectDetail || autoDetail) && messages.length > 0) {
			// 如果 toolSteps 为空，但是有详情在显示，说明可能是在查看其他话题的内容
			return toolSteps.length === 0
		}
		return false
	}, [userSelectDetail, autoDetail, messages.length, toolSteps.length])

	// 判断是否应该显示回到最新按钮
	const shouldShowBackToLatestButton = useMemo(() => {
		return (
			(isFromNode || !isShareRoute) && !isFileShare && !isPPT && !isViewingPreviousTopic // 新增：不在查看上一个话题的详情时才显示
		)
	}, [isFromNode, isShareRoute, isFileShare, isPPT, isViewingPreviousTopic])

	return {
		showAnimation,
		isEmptyDetail,
		isPPT,
		isViewingPreviousTopic,
		shouldShowBackToLatestButton,
	}
}

export default useDetailState
export type { UseDetailStateProps, UseDetailStateReturn }
