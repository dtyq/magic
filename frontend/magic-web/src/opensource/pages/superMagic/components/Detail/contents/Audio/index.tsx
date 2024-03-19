import CommonHeaderV2 from "@/opensource/pages/superMagic/components/Detail/components/CommonHeaderV2"
import React, { memo, useMemo, useState, useCallback } from "react"
import { useStyles } from "./style"
import { useFileUrl } from "@/opensource/pages/superMagic/hooks/useFileUrl"
import { useXgAudioPlayer } from "./hooks/useXgAudioPlayer"
import { Flex } from "antd"
import {
	IconDownload,
	IconPlayerPlay,
	IconPlayerPause,
	IconVolume,
	IconVolumeOff,
} from "@tabler/icons-react"

function formatTime(sec: number) {
	if (!isFinite(sec) || sec < 0) return "00:00:00"
	const hours = Math.floor(sec / 3600)
	const minutes = Math.floor((sec % 3600) / 60)
	const seconds = Math.floor(sec % 60)
	return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(
		seconds,
	).padStart(2, "0")}`
}

interface AudioPreviewProps {
	type: string
	currentIndex: number
	onPrevious?: () => void
	onNext?: () => void
	onFullscreen?: () => void
	onDownload?: () => void
	totalFiles: number
	hasUserSelectDetail: boolean
	setUserSelectDetail: (value: boolean) => void
	isFromNode: boolean
	onClose?: () => void
	isFullscreen: boolean
	data: {
		file_name?: string
		file_id?: string
		file_extension?: string
	}
	viewMode?: "code" | "desktop" | "phone"
	onViewModeChange?: (mode: "code" | "desktop" | "phone") => void
	onCopy?: () => void
	onShare?: () => void
	onFavorite?: () => void
	fileContent?: string
	isFavorited?: boolean
	topicId?: string
	baseShareUrl?: string
	currentFile?: { id: string; name: string; type: string; url?: string }
	detailMode?: "single" | "files"
	allowEdit?: boolean
	showFileHeader?: boolean
	attachments?: any[]
	allowDownload?: boolean
}

export function AudioPreview(props: AudioPreviewProps) {
	const { styles } = useStyles()
	const {
		type,
		onFullscreen,
		onDownload,
		isFromNode,
		isFullscreen,
		data,
		viewMode,
		onViewModeChange,
		onCopy,
		fileContent,
		// File sharing props
		currentFile,
		detailMode,
		allowEdit = true,
		showFileHeader = true,
		attachments,
		allowDownload,
	} = props

	const { file_name, file_id } = data || {}
	const { fileUrl } = useFileUrl({ file_id: file_id || "" })

	// Use xgplayer audio player
	const {
		containerRef,
		isPlaying,
		duration,
		current,
		volume,
		isMuted,
		isLoading,
		error,
		togglePlay,
		seek,
		setVolume: setPlayerVolume,
		toggleMute,
	} = useXgAudioPlayer({
		fileUrl,
		fileName: file_name || "Unknown Audio",
	})

	// Local UI state - syncs with player when not dragging
	const [localProgress, setLocalProgress] = useState(current)
	const [localVolume, setLocalVolume] = useState(volume)
	const [isDraggingProgress, setIsDraggingProgress] = useState(false)
	const [isDraggingVolume, setIsDraggingVolume] = useState(false)

	// Auto-sync local state with player state when not dragging
	React.useEffect(() => {
		if (!isDraggingProgress) setLocalProgress(current)
	}, [current, isDraggingProgress])

	React.useEffect(() => {
		if (!isDraggingVolume) setLocalVolume(volume)
	}, [volume, isDraggingVolume])

	const currentTimeText = useMemo(() => formatTime(localProgress), [localProgress])
	const durationTimeText = useMemo(() => formatTime(duration), [duration])
	const progressPercent = duration > 0 ? (localProgress / duration) * 100 : 0
	const volumePercent = localVolume * 100

	// Calculate progress from mouse position
	const calcProgressFromClientX = useCallback(
		(clientX: number, trackEl: HTMLDivElement): number => {
			if (duration <= 0) return 0
			const rect = trackEl.getBoundingClientRect()
			const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
			return ratio * duration
		},
		[duration],
	)

	// Calculate volume from mouse position
	const calcVolumeFromClientX = useCallback(
		(clientX: number, trackEl: HTMLDivElement): number => {
			const rect = trackEl.getBoundingClientRect()
			return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
		},
		[],
	)

	// Progress bar events
	const onProgressMouseDown = useCallback(
		(e: React.MouseEvent<HTMLDivElement>) => {
			e.preventDefault()
			setIsDraggingProgress(true)
			setLocalProgress(calcProgressFromClientX(e.clientX, e.currentTarget))
		},
		[calcProgressFromClientX],
	)

	const onProgressClick = useCallback(
		(e: React.MouseEvent<HTMLDivElement>) => {
			const newTime = calcProgressFromClientX(e.clientX, e.currentTarget)
			setLocalProgress(newTime)
			seek(newTime)
		},
		[calcProgressFromClientX, seek],
	)

	// Volume bar events
	const onVolumeMouseDown = useCallback(
		(e: React.MouseEvent<HTMLDivElement>) => {
			e.preventDefault()
			setIsDraggingVolume(true)
			setLocalVolume(calcVolumeFromClientX(e.clientX, e.currentTarget))
		},
		[calcVolumeFromClientX],
	)

	const onVolumeClick = useCallback(
		(e: React.MouseEvent<HTMLDivElement>) => {
			const newVolume = calcVolumeFromClientX(e.clientX, e.currentTarget)
			setLocalVolume(newVolume)
			setPlayerVolume(newVolume)
		},
		[calcVolumeFromClientX, setPlayerVolume],
	)

	// Global mouse event handling
	React.useEffect(() => {
		if (!isDraggingProgress && !isDraggingVolume) return

		let rafId: number | null = null
		const progressTrack = isDraggingProgress
			? (document.querySelector(`.${styles.progressTrack}`) as HTMLDivElement | null)
			: null
		const volumeBar = isDraggingVolume
			? (document.querySelector(`.${styles.volumeBar}`) as HTMLDivElement | null)
			: null

		function handleMouseMove(e: MouseEvent) {
			if (rafId) return // Throttle with RAF

			rafId = requestAnimationFrame(() => {
				if (isDraggingProgress && progressTrack) {
					setLocalProgress(calcProgressFromClientX(e.clientX, progressTrack))
				}
				if (isDraggingVolume && volumeBar) {
					setLocalVolume(calcVolumeFromClientX(e.clientX, volumeBar))
				}
				rafId = null
			})
		}

		function handleMouseUp() {
			if (rafId) cancelAnimationFrame(rafId)

			// Commit changes to player
			if (isDraggingProgress) {
				seek(localProgress)
				setIsDraggingProgress(false)
			}
			if (isDraggingVolume) {
				setPlayerVolume(localVolume)
				setIsDraggingVolume(false)
			}
		}

		document.addEventListener("mousemove", handleMouseMove, { passive: true })
		document.addEventListener("mouseup", handleMouseUp)

		return () => {
			if (rafId) cancelAnimationFrame(rafId)
			document.removeEventListener("mousemove", handleMouseMove)
			document.removeEventListener("mouseup", handleMouseUp)
		}
	}, [
		isDraggingProgress,
		isDraggingVolume,
		localProgress,
		localVolume,
		styles.progressTrack,
		styles.volumeBar,
		calcProgressFromClientX,
		calcVolumeFromClientX,
		seek,
		setPlayerVolume,
	])

	const handleDownload = useCallback(() => {
		if (onDownload) onDownload()
	}, [onDownload])

	return (
		<div className={styles.mediaViewer}>
			{showFileHeader && (
				<CommonHeaderV2
					type={type}
					onFullscreen={onFullscreen}
					onDownload={onDownload}
					isFromNode={isFromNode}
					isFullscreen={isFullscreen}
					viewMode={viewMode}
					onViewModeChange={
						onViewModeChange as
							| ((mode: "code" | "desktop" | "phone") => void)
							| undefined
					}
					onCopy={onCopy}
					fileContent={fileContent}
					// File sharing props
					currentFile={currentFile}
					detailMode={detailMode as "single" | "files" | undefined}
					showDownload={allowDownload !== false}
					allowEdit={allowEdit}
					attachments={attachments}
				/>
			)}
			<div className={styles.mediaContainer}>
				{/* XgPlayer 容器 */}
				<div
					ref={containerRef}
					style={{
						position: "absolute",
						top: "-9999px",
						left: "-9999px",
						width: "1px",
						height: "1px",
						opacity: 0,
						pointerEvents: "none",
					}}
				/>

				{/* Loading state */}
				{isLoading && <div className={styles.loadingState}>Loading...</div>}

				{/* Error state */}
				{error && <div className={styles.errorState}>{error}</div>}

				{/* 自定义音频控制器 */}
				<div
					className={styles.audioWrapper}
					style={error || isLoading ? { display: "none" } : undefined}
				>
					<Flex className={styles.controlsLeft} align="center">
						<div className={styles.iconButton} onClick={togglePlay}>
							{isPlaying ? (
								<IconPlayerPause size={20} color="#fff" />
							) : (
								<IconPlayerPlay size={20} color="#fff" />
							)}
						</div>
						<div className={styles.progressWrap}>
							<div className={styles.currentTime}>{currentTimeText}</div>
							<div className={styles.progress}>
								<div
									className={styles.progressTrack}
									onClick={onProgressClick}
									onMouseDown={onProgressMouseDown}
								>
									<div
										className={styles.progressFill}
										style={{ width: `${progressPercent}%` }}
									/>
									<div
										className={styles.progressThumb}
										style={{ left: `${progressPercent}%` }}
										onMouseDown={onProgressMouseDown}
									/>
								</div>
							</div>
							<div className={styles.durationTime}>{durationTimeText}</div>
						</div>
					</Flex>

					<Flex className={styles.controlsRight} align="center">
						<div className={styles.iconButton} onClick={toggleMute}>
							{isMuted || volume === 0 ? (
								<IconVolumeOff size={20} color="#fff" />
							) : (
								<IconVolume size={20} color="#fff" />
							)}
						</div>
						<div className={styles.volumeWrap}>
							<div
								className={styles.volumeBar}
								onClick={onVolumeClick}
								onMouseDown={onVolumeMouseDown}
							>
								<div
									className={styles.progressFill}
									style={{ width: `${volumePercent}%` }}
								/>
								<div
									className={styles.volumeThumb}
									style={{ left: `${volumePercent}%` }}
									onMouseDown={onVolumeMouseDown}
								/>
							</div>
						</div>
						<div className={styles.iconButton} onClick={handleDownload}>
							<IconDownload size={20} color="#fff" />
						</div>
					</Flex>
				</div>
			</div>
		</div>
	)
}

export default memo(AudioPreview)
