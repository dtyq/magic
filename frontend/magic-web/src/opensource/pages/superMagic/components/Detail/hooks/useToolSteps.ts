import { useState, useCallback, useEffect, useRef } from "react"
import { isEmpty } from "lodash-es"
import { useTranslation } from "react-i18next"
import pubsub from "@/opensource/utils/pubsub"
import { filterClickableMessage } from "../../../utils/handleMessage"
import { reaction } from "mobx"
import { superMagicStore } from "@/opensource/pages/superMagic/stores"
import { Topic } from "@/opensource/pages/superMagic/pages/Workspace/types"

interface ToolStep {
	id: string
	name: string
	action: string
	remark: string
	status: string
	event: string
	detail?: any
}

interface UseToolStepsProps {
	selectedTopic?: Topic | null
	setUserSelectDetail?: (detail: any) => void
	displayDetail?: any
	userSelectDetail?: any
	autoDetail?: any
	isFullscreen?: boolean
	setIsFullscreen?: (isFullscreen: boolean) => void
}

interface UseToolStepsReturn {
	toolSteps: ToolStep[]
	currentProgress: number
	currentStepIndex: number
	handleProgressChange: (progress: number, stepIndex: number) => void
	handlePrevStep: () => void
	handleNextStep: () => void
}

function useToolSteps({
	setUserSelectDetail,
	displayDetail,
	userSelectDetail,
	autoDetail,
	isFullscreen,
	setIsFullscreen,
	selectedTopic,
}: UseToolStepsProps): UseToolStepsReturn {
	const { t } = useTranslation("super")
	const [currentProgress, setCurrentProgress] = useState(0)
	const [currentStepIndex, setCurrentStepIndex] = useState(0)

	const [toolSteps, setToolSteps] = useState<Array<ToolStep>>([])

	// 缓存上一次的 toolSteps，用于在特定条件下保留内容
	const cachedToolStepsRef = useRef<ToolStep[]>([])
	const prevUserSelectDetailRef = useRef(userSelectDetail)
	const prevAutoDetailRef = useRef(autoDetail)

	// 提取计算 toolSteps 的逻辑为独立函数
	const calculateToolSteps = useCallback(
		(messages: any[]) => {
			const steps: ToolStep[] = []

			// Extract tool steps from messages
			messages.forEach((message) => {
				const node = superMagicStore.getMessageNode(message?.app_message_id)
				if (!filterClickableMessage(node)) {
					return
				}
				if (isEmpty(node?.tool?.detail)) {
					return
				}
				// Check if message has tool information
				if (node?.tool && !isEmpty(node.tool)) {
					const tool = node.tool
					steps.push({
						id: tool.id || message.id || `tool-${steps.length}`,
						name: tool.name || t("playbackControl.unknownTool"),
						action: tool.action || "",
						remark: tool.remark || "",
						status: tool.status || message.status || "unknown",
						event: message.event,
						detail: tool.detail,
					})
				}

				// Check if message has steps information
				if (node?.steps && Array.isArray(node.steps)) {
					node.steps.forEach((step: any, index: number) => {
						if (step?.tool || step?.action || step?.name) {
							steps.push({
								id: step.id || `step-${node.id}-${index}`,
								name:
									step.name ||
									step.tool?.name ||
									t("playbackControl.unknownTool"),
								action: step.action || step.tool?.action || "",
								remark: step.remark || step.tool?.remark || "",
								status: step.status || step.tool?.status || "unknown",
								event: step.event || "after_tool_call",
								detail: step.detail || step.tool?.detail,
							})
						}
					})
				}
			})

			// Filter invalid steps and sort by time
			return steps.filter((step) => step.name)
		},
		[t],
	)

	// 初始化时计算一次 toolSteps
	useEffect(() => {
		const messages = superMagicStore.messages?.get(selectedTopic?.chat_topic_id || "") || []
		if (messages.length > 0) {
			const filteredSteps = calculateToolSteps(messages)
			cachedToolStepsRef.current = filteredSteps
			setToolSteps(filteredSteps)
		}
	}, [selectedTopic?.chat_topic_id, calculateToolSteps])

	// 监听 messages 变化
	useEffect(() => {
		return reaction(
			() => superMagicStore.messages?.get(selectedTopic?.chat_topic_id || "") || [],
			(messages) => {
				// 检查是否应该重新计算 toolSteps
				const shouldRecalculate =
					prevUserSelectDetailRef.current !== userSelectDetail ||
					prevAutoDetailRef.current !== autoDetail

				// 如果不需要重新计算且有缓存，则返回缓存的结果
				if (!shouldRecalculate && cachedToolStepsRef.current.length > 0) {
					// 避免因 selectedTopic 变更导致 messages 重新拉取时 toolSteps 被清空
					return cachedToolStepsRef.current
				}

				// 更新引用
				prevUserSelectDetailRef.current = userSelectDetail
				prevAutoDetailRef.current = autoDetail

				const filteredSteps = calculateToolSteps(messages)

				// 缓存计算结果
				cachedToolStepsRef.current = filteredSteps

				setToolSteps(filteredSteps)
			},
		)
	}, [calculateToolSteps, userSelectDetail, autoDetail, selectedTopic?.chat_topic_id])

	// Sync progress when displayDetail changes (Problem 1: 进度条同步)
	useEffect(() => {
		if (displayDetail?.id && toolSteps.length > 0) {
			// Find the step index that matches current displayDetail
			const currentStepIndex = toolSteps.findIndex((step) => step?.id === displayDetail?.id)

			if (currentStepIndex >= 0) {
				const progress = currentStepIndex / Math.max(1, toolSteps.length - 1)
				setCurrentProgress(progress)
				setCurrentStepIndex(currentStepIndex)
			}
		}
	}, [displayDetail, toolSteps])

	// Playback control callbacks
	const handleProgressChange = useCallback(
		(progress: number, stepIndex: number) => {
			setCurrentProgress(progress)
			setCurrentStepIndex(stepIndex)

			// Problem 2: 当滚动到最后时，如果有autoDetail，则需要将userDetail置空
			const isLastStep = stepIndex >= toolSteps.length - 1
			if (isLastStep && autoDetail && userSelectDetail) {
				setUserSelectDetail?.(null)
				return
			}

			// Update current displayed detail
			if (toolSteps[stepIndex]?.detail) {
				setUserSelectDetail?.(toolSteps[stepIndex].detail)
			}
		},
		[toolSteps, setUserSelectDetail, autoDetail, userSelectDetail],
	)

	const handlePrevStep = useCallback(() => {
		if (currentStepIndex > 0) {
			const prevIndex = currentStepIndex - 1
			const progress = prevIndex / Math.max(1, toolSteps.length - 1)
			handleProgressChange(progress, prevIndex)
		}
	}, [currentStepIndex, toolSteps.length, handleProgressChange])

	const handleNextStep = useCallback(() => {
		if (currentStepIndex < toolSteps.length - 1) {
			const nextIndex = currentStepIndex + 1
			const progress = nextIndex / Math.max(1, toolSteps.length - 1)
			handleProgressChange(progress, nextIndex)
		}
	}, [currentStepIndex, toolSteps.length, handleProgressChange])

	return {
		toolSteps,
		currentProgress,
		currentStepIndex,
		handleProgressChange,
		handlePrevStep,
		handleNextStep,
	}
}

export default useToolSteps
export type { ToolStep, UseToolStepsProps, UseToolStepsReturn }
