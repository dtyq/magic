import React, { useEffect, useRef, useState, useCallback } from "react"
import { useTranslation } from "react-i18next"
import MagicProgressToast from "../MagicProgressToast"
import { SuperMagicApi } from "@/opensource/apis"
import type { CopyProjectProgressToastProps } from "./types"
import { useMemoizedFn } from "ahooks"
import useNavigate from "@/opensource/routes/hooks/useNavigate"
import { RouteName } from "@/opensource/routes/constants"

function CopyProjectProgressToast({
	projectId,
	visible,
	projectInfo,
	onComplete,
	onError,
	onProgress,
	setCopyProjectIsRunning,
	pollInterval = 2000,
	maxRetries = 60,
	position = "top",
	...progressProps
}: CopyProjectProgressToastProps) {
	const { t } = useTranslation("super")
	const navigate = useNavigate()
	const [progress, setProgress] = useState(0)
	const [progressText, setProgressText] = useState("")
	const [isCompleted, setIsCompleted] = useState(false)
	const [showCompleted, setShowCompleted] = useState(false)
	const pollTimerRef = useRef<NodeJS.Timeout | null>(null)
	const retryCountRef = useRef(0)

	// 清理定时器
	const clearPollTimer = () => {
		if (pollTimerRef.current) {
			clearTimeout(pollTimerRef.current)
			pollTimerRef.current = null
		}
	}

	// 处理进入项目
	const handleEnterProject = useCallback(() => {
		if (projectInfo?.project_id) {
			navigate({
				name: RouteName.SuperWorkspaceProjectState,
				params: {
					projectId: projectInfo.project_id,
				},
			})
		}
	}, [navigate, projectInfo])

	// 处理关闭
	const handleClose = useMemoizedFn(() => {
		onComplete?.()
	})

	// 轮询复制状态
	const pollCopyStatus = useMemoizedFn(async () => {
		if (!projectId || isCompleted) return

		try {
			const response = await SuperMagicApi.getProjectCopyStatus({ projectId })
			setCopyProjectIsRunning(response?.status === "running")
			if (response?.status === "finished") {
				setCopyProjectIsRunning(false)
				// 复制完成
				setProgress(100)
				setProgressText(t("share.copyProjectCompleted"))
				setIsCompleted(true)
				clearPollTimer()
				// 延迟显示完成状态，让用户看到100%的进度
				setTimeout(() => {
					setShowCompleted(true)
					onProgress(100)
				}, 1000)
				return
			}

			if (response?.status === "failed") {
				// 复制失败
				setIsCompleted(true)
				setCopyProjectIsRunning(false)
				clearPollTimer()
				const errorMsg = response.err_msg || t("share.copyProjectFailed")
				onProgress(100)
				onError?.(new Error(errorMsg))
				return
			}

			if (response?.status === "running") {
				// 正在运行，更新进度
				const progressStr = response.progress || "0%"
				const progressNum = parseInt(progressStr.replace("%", "")) || 0
				setProgress(progressNum)
				setProgressText(t("share.copyProjectProcess"))
				onProgress(progressNum)
				setCopyProjectIsRunning(true)
				// 继续轮询
				pollTimerRef.current = setTimeout(pollCopyStatus, pollInterval)
				return
			}

			retryCountRef.current += 1

			// 检查是否超过最大重试次数
			if (retryCountRef.current >= maxRetries) {
				setCopyProjectIsRunning(false)
				setIsCompleted(true)
				clearPollTimer()
				onError?.(new Error(t("share.copyProjectTimeout")))
				return
			}

			// 继续轮询
			pollTimerRef.current = setTimeout(pollCopyStatus, pollInterval)
		} catch (error) {
			console.error("Failed to get copy status:", error)
			retryCountRef.current += 1
			setCopyProjectIsRunning(false)
			if (retryCountRef.current >= maxRetries) {
				setIsCompleted(true)
				clearPollTimer()
				onProgress(100)
				onError?.(error as Error)
				return
			}

			// 出错后继续重试
			// pollTimerRef.current = setTimeout(pollCopyStatus, pollInterval)
		}
	})

	// 开始轮询
	useEffect(() => {
		if (visible && projectId && !isCompleted) {
			setProgress(0) // 初始进度
			setProgressText(t("share.copyProjectProcess"))
			retryCountRef.current = 0

			// 延迟开始轮询，给用户一些视觉反馈
			pollTimerRef.current = setTimeout(pollCopyStatus, 1000)
		}

		return () => {
			clearPollTimer()
		}
	}, [visible, projectId, isCompleted, pollCopyStatus, t])

	// 组件卸载时清理
	useEffect(() => {
		return () => {
			clearPollTimer()
		}
	}, [])

	// 当visible变为false时重置状态
	useEffect(() => {
		if (!visible) {
			setProgress(0)
			setProgressText("")
			setIsCompleted(false)
			setShowCompleted(false)
			retryCountRef.current = 0
			clearPollTimer()
		}
	}, [visible])

	// 准备操作按钮
	const actions = showCompleted
		? [
				{
					text: t("share.enterProject"),
					type: "link" as const,
					onClick: handleEnterProject,
				},
				{
					text: t("share.close"),
					type: "text" as const,
					style: { color: "red" },
					onClick: handleClose,
				},
			]
		: []

	return (
		<MagicProgressToast
			visible={visible}
			progress={progress}
			text={progressText}
			position={position}
			isCompleted={showCompleted}
			actions={actions}
			{...progressProps}
		/>
	)
}

export default React.memo(CopyProjectProgressToast)
