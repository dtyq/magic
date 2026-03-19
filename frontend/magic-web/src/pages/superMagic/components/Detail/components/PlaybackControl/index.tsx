import { useCallback, useState, useRef, useEffect, useMemo } from "react"
import { useTranslation } from "react-i18next"
import type { ToolStep } from "../../hooks/useToolSteps"
import StatusIcon from "../../../MessageHeader/components/StatusIcon"
import { cn } from "@/lib/utils"
import { Button } from "@/components/shadcn-ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/shadcn-ui/tooltip"
import { TaskStatus } from "@/pages/superMagic/pages/Workspace/types"
import StepBack from "@/pages/superMagic/assets/svg/step-back.svg"
import StepForward from "@/pages/superMagic/assets/svg/step-forward.svg"

interface PlaybackControlProps {
	toolSteps: ToolStep[]
	currentProgress: number
	currentStepIndex: number
	onProgressChange: (progress: number, stepIndex: number) => void
	showPlaybackControl: boolean
	userSelectDetail: unknown
	status?: TaskStatus
	progressOnly?: boolean
	onPrevStep?: () => void
	onNextStep?: () => void
	onBackToLatest?: () => void
	className?: string
}

function PlaybackControl({
	toolSteps,
	currentProgress,
	currentStepIndex,
	onProgressChange,
	showPlaybackControl,
	userSelectDetail,
	status,
	progressOnly = false,
	onPrevStep,
	onNextStep,
	onBackToLatest,
	className,
}: PlaybackControlProps) {
	const { t } = useTranslation("super")

	const [localProgress, setLocalProgress] = useState(currentProgress)
	const [localStepIndex, setLocalStepIndex] = useState(currentStepIndex)
	const [isDragging, setIsDragging] = useState(false)

	const progressTrackRef = useRef<HTMLDivElement>(null)
	const finalProgressRef = useRef<{ progress: number; stepIndex: number } | null>(null)
	const animationFrameRef = useRef<number | null>(null)

	useEffect(() => {
		if (!isDragging) {
			setLocalProgress(currentProgress)
			setLocalStepIndex(currentStepIndex)
		}
	}, [currentProgress, currentStepIndex, isDragging])

	const updateProgressSmooth = useCallback((progress: number, stepIndex: number) => {
		if (animationFrameRef.current) {
			cancelAnimationFrame(animationFrameRef.current)
		}

		animationFrameRef.current = requestAnimationFrame(() => {
			setLocalProgress(progress)
			setLocalStepIndex(stepIndex)
		})
	}, [])

	const calculateProgressFromEvent = useCallback(
		(clientX: number) => {
			if (!progressTrackRef.current) return { progress: 0, stepIndex: 0 }

			const rect = progressTrackRef.current.getBoundingClientRect()
			const progress = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
			const stepIndex = Math.max(
				0,
				Math.min(toolSteps.length - 1, Math.floor(progress * toolSteps.length)),
			)

			return { progress, stepIndex }
		},
		[toolSteps.length],
	)

	const handleMouseDown = useCallback(
		(e: React.MouseEvent) => {
			e.preventDefault()
			setIsDragging(true)

			const { progress, stepIndex } = calculateProgressFromEvent(e.clientX)
			updateProgressSmooth(progress, stepIndex)
			finalProgressRef.current = { progress, stepIndex }
		},
		[calculateProgressFromEvent, updateProgressSmooth],
	)

	const handleMouseMove = useCallback(
		(e: MouseEvent) => {
			if (!isDragging) return

			const { progress, stepIndex } = calculateProgressFromEvent(e.clientX)
			updateProgressSmooth(progress, stepIndex)
			finalProgressRef.current = { progress, stepIndex }
		},
		[isDragging, calculateProgressFromEvent, updateProgressSmooth],
	)

	const handleMouseUp = useCallback(() => {
		setIsDragging(false)
		if (animationFrameRef.current) {
			cancelAnimationFrame(animationFrameRef.current)
			animationFrameRef.current = null
		}
		if (finalProgressRef.current) {
			onProgressChange(finalProgressRef.current.progress, finalProgressRef.current.stepIndex)
			finalProgressRef.current = null
		}
	}, [onProgressChange])

	useEffect(() => {
		if (isDragging) {
			document.addEventListener("mousemove", handleMouseMove)
			document.addEventListener("mouseup", handleMouseUp)
			document.body.style.userSelect = "none"

			return () => {
				document.removeEventListener("mousemove", handleMouseMove)
				document.removeEventListener("mouseup", handleMouseUp)
				document.body.style.userSelect = ""
			}
		}
	}, [isDragging, handleMouseMove, handleMouseUp])

	useEffect(() => {
		return () => {
			if (animationFrameRef.current) {
				cancelAnimationFrame(animationFrameRef.current)
			}
		}
	}, [])

	const handlePrevStep = useCallback(() => {
		const prevIndex = Math.max(0, localStepIndex - 1)
		const progress = prevIndex / Math.max(1, toolSteps.length - 1)
		setLocalProgress(progress)
		setLocalStepIndex(prevIndex)
		onProgressChange(progress, prevIndex)
		onPrevStep?.()
	}, [localStepIndex, toolSteps.length, onProgressChange, onPrevStep])

	const handleNextStep = useCallback(() => {
		if (localStepIndex >= toolSteps.length - 1) return
		const nextIndex = Math.min(toolSteps.length - 1, localStepIndex + 1)
		const progress = nextIndex / Math.max(1, toolSteps.length - 1)
		setLocalProgress(progress)
		setLocalStepIndex(nextIndex)
		onProgressChange(progress, nextIndex)
		onNextStep?.()
	}, [localStepIndex, toolSteps.length, onProgressChange, onNextStep])

	const handleProgressClick = useCallback(
		(e: React.MouseEvent) => {
			if (isDragging) return

			const { progress, stepIndex } = calculateProgressFromEvent(e.clientX)
			setLocalProgress(progress)
			setLocalStepIndex(stepIndex)
			onProgressChange(progress, stepIndex)
		},
		[isDragging, calculateProgressFromEvent, onProgressChange],
	)

	const currentStatus = useMemo(() => {
		if (status === "running") return "running"
		return "finished"
	}, [status])

	const drivingTitle = useMemo(() => {
		if (!userSelectDetail) {
			if (status === "running") return t("playbackControl.autoPlayback")
			return t("playbackControl.finished")
		}
		return toolSteps[localStepIndex]?.action || t("playbackControl.autoPlayback")
	}, [userSelectDetail, toolSteps, localStepIndex, t, status])

	const isAtLatest = useMemo(() => {
		return localStepIndex >= toolSteps.length - 1
	}, [localStepIndex, toolSteps.length])

	if (toolSteps.length === 0 || !showPlaybackControl) return null

	const progressTrackJSX = (
		<div
			ref={progressTrackRef}
			className="relative flex flex-1 cursor-pointer items-center"
			onClick={handleProgressClick}
			onMouseDown={handleMouseDown}
		>
			<div className="h-2 w-full overflow-hidden rounded-full bg-[#d1d1d1]">
				<div
					className="h-full bg-foreground"
					style={{
						width: `${localProgress * 100}%`,
						transition: isDragging ? "none" : "width 0.1s ease-out",
					}}
				/>
			</div>
		</div>
	)

	if (progressOnly) {
		return (
			<div
				className={cn(
					"flex w-full items-center gap-[10px] rounded-lg border border-border bg-background p-[10px]",
					className,
				)}
			>
				<Button
					variant="outline"
					className="shadow-xs size-6 rounded-lg p-0"
					disabled={localStepIndex <= 0}
					onClick={handlePrevStep}
				>
					<img src={StepBack} alt="" width={16} height={16} />
				</Button>

				{progressTrackJSX}

				<Button
					variant="outline"
					className="shadow-xs size-6 rounded-lg p-0"
					disabled={isAtLatest}
					onClick={handleNextStep}
				>
					<img src={StepForward} alt="" width={16} height={16} />
				</Button>

				{onBackToLatest && (
					<Button
						variant="outline"
						className={cn(
							"shadow-xs h-6 rounded-lg px-3 text-xs font-normal",
							isAtLatest && "opacity-50",
						)}
						disabled={isAtLatest}
						onClick={onBackToLatest}
					>
						{isAtLatest
							? t("playbackControl.alreadyAtLatest")
							: t("playbackControl.backToLatest")}
					</Button>
				)}
			</div>
		)
	}

	return (
		<div
			className={cn(
				"absolute bottom-0 left-0 right-0 z-[2] flex h-12 w-full items-center gap-[10px] border-t border-border bg-background p-[10px]",
				className,
			)}
		>
			{/* Left: Current tool status */}
			<div className="flex shrink-0 basis-28 items-center gap-2 rounded-lg px-2 py-1">
				<StatusIcon status={currentStatus as TaskStatus} />
				<Tooltip>
					<TooltipTrigger asChild>
						<span
							className="w-[60px] shrink overflow-hidden text-ellipsis whitespace-nowrap text-xs font-normal leading-[18px] text-foreground"
							style={
								currentStatus === "running"
									? {
										background:
											"linear-gradient(90deg, #EEF3FD 0%, #315CEC 17.79%, #D3DFFB 50%, #315CEC 82.21%, #EEF3FD 100%)",
										backgroundSize: "200% 100%",
										backgroundClip: "text",
										WebkitBackgroundClip: "text",
										WebkitTextFillColor: "transparent",
										animation: "shimmer 4s ease-in-out infinite",
										color: "transparent",
									}
									: undefined
							}
						>
							{drivingTitle}
						</span>
					</TooltipTrigger>
					<TooltipContent>{drivingTitle}</TooltipContent>
				</Tooltip>
			</div>

			{/* Middle: Progress bar */}
			<div className="flex h-6 flex-1 shrink-0 items-center gap-2 rounded-lg bg-muted/50 px-1">
				<Button
					variant="ghost"
					className="size-6 rounded p-0 text-primary hover:bg-muted"
					disabled={localStepIndex <= 0}
					onClick={handlePrevStep}
				>
					<img src={StepBack} alt="" width={16} height={16} />
				</Button>

				{progressTrackJSX}

				<Button
					variant="ghost"
					className="size-6 rounded p-0 text-primary hover:bg-muted"
					disabled={isAtLatest}
					onClick={handleNextStep}
				>
					<img src={StepForward} alt="" width={16} height={16} />
				</Button>

				{onBackToLatest && (
					<Button
						variant="outline"
						className={cn(
							"shadow-xs h-6 rounded-lg px-3 text-xs font-normal",
							isAtLatest && "opacity-50",
						)}
						disabled={isAtLatest}
						onClick={onBackToLatest}
					>
						{isAtLatest
							? t("playbackControl.alreadyAtLatest")
							: t("playbackControl.backToLatest")}
					</Button>
				)}
			</div>
		</div>
	)
}

export default PlaybackControl
