import {
	useCallback,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
	type CSSProperties,
} from "react"
import { createPortal } from "react-dom"
import { X } from "lucide-react"
import { useCanvasDesignI18n } from "../../context/I18nContext"
import VideoFullscreenCenterPlayButton from "./VideoFullscreenCenterPlayButton"
import MediaControls from "../MediaControls"
import chromeStyles from "../FullscreenMediaShell/chrome.module.css"
import { getFullscreenMediaFileLabel } from "../FullscreenMediaShell/getFullscreenMediaFileLabel"
import styles from "../FullscreenMediaShell/shell.module.css"

const VIDEO_FULLSCREEN_LAYOUT = {
	insetPx: 80,
	panelMaxWidthPx: 1200,
} as const satisfies { insetPx: number; panelMaxWidthPx: number }

const CHROME_IDLE_HIDE_MS = 3000

const overlayInsetStyle: CSSProperties = {
	padding: VIDEO_FULLSCREEN_LAYOUT.insetPx,
}

function formatTime(seconds: number): string {
	const totalSeconds = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0
	const minutes = Math.floor(totalSeconds / 60)
	const remainingSeconds = totalSeconds % 60
	return `${minutes.toString().padStart(2, "0")}:${remainingSeconds.toString().padStart(2, "0")}`
}

function computeVideoPanelPixelSize(
	aspectWidth: number,
	aspectHeight: number,
): {
	width: number
	height: number
} {
	const aw = Math.max(1, aspectWidth)
	const ah = Math.max(1, aspectHeight)
	const viewportGutter = VIDEO_FULLSCREEN_LAYOUT.insetPx * 2
	const maxW = Math.min(
		VIDEO_FULLSCREEN_LAYOUT.panelMaxWidthPx,
		Math.max(200, window.innerWidth - viewportGutter),
	)
	const maxH = Math.max(200, window.innerHeight - viewportGutter)
	const scale = Math.min(maxW / aw, maxH / ah)
	return { width: aw * scale, height: ah * scale }
}

interface VideoFullscreenPlayerOverlayProps {
	src?: string
	isOpen: boolean
	onClose: () => void
	videoElement?: HTMLVideoElement | null
	onPlayRequest?: () => Promise<boolean> | boolean
	intrinsicSizeHint?: { width: number; height: number } | null
	isLoading?: boolean
	hasError?: boolean
	loadFailedMessage?: string
	closeAriaLabel?: string
	/** 显式文件名（如资源 fileName / 元素 name），优先于 resourcePath 末段展示 */
	fileName?: string
	/** 资源 path，用于在无 fileName 时推导展示名 */
	resourcePath?: string
}

export default function VideoFullscreenPlayerOverlay(props: VideoFullscreenPlayerOverlayProps) {
	const {
		src,
		isOpen,
		onClose,
		videoElement: managedVideoElement = null,
		onPlayRequest,
		intrinsicSizeHint = null,
		isLoading: externalIsLoading = false,
		hasError: externalHasError = false,
		loadFailedMessage,
		closeAriaLabel,
		fileName,
		resourcePath = "",
	} = props
	const { t } = useCanvasDesignI18n()

	const videoRef = useRef<HTMLVideoElement | null>(null)
	const internalVideoRef = useRef<HTMLVideoElement | null>(null)
	const managedVideoHostRef = useRef<HTMLDivElement | null>(null)
	const progressRangeRef = useRef<HTMLInputElement>(null)
	const currentTimeLabelRef = useRef<HTMLSpanElement>(null)
	const isScrubbingRef = useRef(false)
	const progressRafRef = useRef(0)
	const hideChromeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

	const [isClient, setIsClient] = useState(false)
	const [isVideoLoading, setIsVideoLoading] = useState(true)
	const [hasVideoError, setHasVideoError] = useState(false)
	const [duration, setDuration] = useState(0)
	const [isPlaying, setIsPlaying] = useState(false)
	const [volume, setVolume] = useState(1)
	const [isMuted, setIsMuted] = useState(false)
	const [chromeVisible, setChromeVisible] = useState(false)
	const [videoIntrinsicSize, setVideoIntrinsicSize] = useState<{
		width: number
		height: number
	} | null>(null)

	const [panelSize, setPanelSize] = useState<{
		width: number
		height: number
	} | null>(null)

	const syncProgressDOM = useCallback(() => {
		const video = videoRef.current
		const input = progressRangeRef.current
		const label = currentTimeLabelRef.current
		if (!video) return
		const d = Number.isFinite(video.duration) ? video.duration : 0
		if (input && d > 0) {
			const pct = (video.currentTime / d) * 100
			input.style.setProperty("--progress", `${pct}%`)
			if (!isScrubbingRef.current) {
				input.value = String(pct)
			}
		}
		if (label) {
			label.textContent = formatTime(video.currentTime)
		}
	}, [])

	const syncVideoStateFromDom = useCallback(() => {
		const video = videoRef.current
		if (!video) return

		setDuration(Number.isFinite(video.duration) ? video.duration : 0)
		setIsPlaying(!video.paused && !video.ended)
		setIsMuted(video.muted)
		setVolume(video.volume)
		setHasVideoError(!!video.error)
		setIsVideoLoading(video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA)

		const vw = video.videoWidth
		const vh = video.videoHeight
		if (vw > 0 && vh > 0) {
			setVideoIntrinsicSize({ width: vw, height: vh })
		}

		queueMicrotask(() => syncProgressDOM())
	}, [syncProgressDOM])

	const clearHideChromeTimer = useCallback(() => {
		if (hideChromeTimerRef.current !== null) {
			clearTimeout(hideChromeTimerRef.current)
			hideChromeTimerRef.current = null
		}
	}, [])

	const scheduleHideChrome = useCallback(() => {
		clearHideChromeTimer()
		hideChromeTimerRef.current = setTimeout(() => {
			setChromeVisible(false)
		}, CHROME_IDLE_HIDE_MS)
	}, [clearHideChromeTimer])

	const handlePlayerMouseEnter = useCallback(() => {
		setChromeVisible(true)
		scheduleHideChrome()
	}, [scheduleHideChrome])

	const handlePlayerMouseMove = useCallback(() => {
		setChromeVisible(true)
		scheduleHideChrome()
	}, [scheduleHideChrome])

	const handlePlayerMouseLeave = useCallback(() => {
		clearHideChromeTimer()
		setChromeVisible(false)
	}, [clearHideChromeTimer])

	const togglePlay = useCallback(() => {
		const video = videoRef.current
		if (!video) return
		if (video.paused) {
			if (onPlayRequest) {
				setIsVideoLoading(true)
				setHasVideoError(false)
				void Promise.resolve(onPlayRequest()).then((started) => {
					if (started === false) {
						setHasVideoError(true)
						setIsVideoLoading(false)
					}
				})
				return
			}
			void video.play()
		} else {
			video.pause()
		}
	}, [onPlayRequest])

	const handleManagedVideoError = useCallback(() => {
		setIsVideoLoading(false)
		setHasVideoError(true)
		setIsPlaying(false)
	}, [])

	const handleManagedVideoWaiting = useCallback(() => {
		setIsVideoLoading(true)
	}, [])

	useEffect(() => {
		setIsClient(true)
	}, [])

	useEffect(() => {
		return () => clearHideChromeTimer()
	}, [clearHideChromeTimer])

	useEffect(() => {
		if (!isOpen) {
			clearHideChromeTimer()
			setChromeVisible(false)
			return
		}

		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") {
				onClose()
			}
		}

		const originalOverflow = document.body.style.overflow
		document.body.style.overflow = "hidden"
		window.addEventListener("keydown", handleKeyDown)

		return () => {
			document.body.style.overflow = originalOverflow
			window.removeEventListener("keydown", handleKeyDown)
		}
	}, [clearHideChromeTimer, isOpen, onClose])

	useEffect(() => {
		setIsVideoLoading(Boolean(src))
		setHasVideoError(false)
		setDuration(0)
		setIsPlaying(false)
	}, [isOpen, managedVideoElement, src])

	useEffect(() => {
		if (!isOpen) {
			setVideoIntrinsicSize(null)
			return
		}

		if (intrinsicSizeHint?.width && intrinsicSizeHint.height) {
			setVideoIntrinsicSize({
				width: intrinsicSizeHint.width,
				height: intrinsicSizeHint.height,
			})
			return
		}

		setVideoIntrinsicSize(null)
	}, [intrinsicSizeHint, isOpen, managedVideoElement, src])

	useLayoutEffect(() => {
		const input = progressRangeRef.current
		const label = currentTimeLabelRef.current
		if (input) {
			input.value = "0"
			input.style.setProperty("--progress", "0%")
		}
		if (label) label.textContent = formatTime(0)
	}, [isOpen, managedVideoElement, src])

	useEffect(() => {
		if (!managedVideoElement) {
			if (videoRef.current && videoRef.current === internalVideoRef.current) {
				videoRef.current = internalVideoRef.current
			}
			return
		}

		const host = managedVideoHostRef.current
		if (!host) {
			return
		}

		videoRef.current = managedVideoElement
		managedVideoElement.className = styles.video
		managedVideoElement.playsInline = true

		if (managedVideoElement.parentElement !== host) {
			host.replaceChildren(managedVideoElement)
		}

		syncVideoStateFromDom()

		return () => {
			if (managedVideoElement.parentElement === host) {
				host.removeChild(managedVideoElement)
			}
			if (videoRef.current === managedVideoElement) {
				videoRef.current = null
			}
		}
	}, [managedVideoElement, syncVideoStateFromDom])

	useEffect(() => {
		if (!managedVideoElement) {
			return
		}

		const handleClick = (event: Event) => {
			event.stopPropagation()
			togglePlay()
		}

		managedVideoElement.addEventListener("loadedmetadata", syncVideoStateFromDom)
		managedVideoElement.addEventListener("canplay", syncVideoStateFromDom)
		managedVideoElement.addEventListener("playing", syncVideoStateFromDom)
		managedVideoElement.addEventListener("pause", syncVideoStateFromDom)
		managedVideoElement.addEventListener("ended", syncVideoStateFromDom)
		managedVideoElement.addEventListener("waiting", handleManagedVideoWaiting)
		managedVideoElement.addEventListener("error", handleManagedVideoError)
		managedVideoElement.addEventListener("click", handleClick)

		return () => {
			managedVideoElement.removeEventListener("loadedmetadata", syncVideoStateFromDom)
			managedVideoElement.removeEventListener("canplay", syncVideoStateFromDom)
			managedVideoElement.removeEventListener("playing", syncVideoStateFromDom)
			managedVideoElement.removeEventListener("pause", syncVideoStateFromDom)
			managedVideoElement.removeEventListener("ended", syncVideoStateFromDom)
			managedVideoElement.removeEventListener("waiting", handleManagedVideoWaiting)
			managedVideoElement.removeEventListener("error", handleManagedVideoError)
			managedVideoElement.removeEventListener("click", handleClick)
		}
	}, [
		handleManagedVideoError,
		handleManagedVideoWaiting,
		managedVideoElement,
		syncVideoStateFromDom,
		togglePlay,
	])

	useEffect(() => {
		if (!isOpen) return

		if (!isPlaying) {
			cancelAnimationFrame(progressRafRef.current)
			progressRafRef.current = 0
			syncProgressDOM()
			return
		}

		const step = () => {
			const video = videoRef.current
			if (!video) {
				progressRafRef.current = 0
				return
			}
			syncProgressDOM()
			if (!video.paused && !video.ended) {
				progressRafRef.current = requestAnimationFrame(step)
			} else {
				progressRafRef.current = 0
			}
		}

		progressRafRef.current = requestAnimationFrame(step)

		return () => {
			cancelAnimationFrame(progressRafRef.current)
			progressRafRef.current = 0
		}
	}, [isOpen, isPlaying, syncProgressDOM])

	useLayoutEffect(() => {
		if (!isOpen || (!src && !managedVideoElement)) {
			setVideoIntrinsicSize(null)
			return
		}
		if (externalHasError || hasVideoError) {
			setVideoIntrinsicSize(null)
			return
		}
		const video = videoRef.current
		const vw = video?.videoWidth ?? 0
		const vh = video?.videoHeight ?? 0
		if (vw <= 0 || vh <= 0) {
			setVideoIntrinsicSize(null)
			return
		}
		setVideoIntrinsicSize((prev) =>
			prev?.width === vw && prev?.height === vh ? prev : { width: vw, height: vh },
		)
	}, [externalHasError, hasVideoError, isOpen, managedVideoElement, src])

	useLayoutEffect(() => {
		if (!isOpen || !videoIntrinsicSize) {
			setPanelSize(null)
			return
		}

		const aw = videoIntrinsicSize.width
		const ah = videoIntrinsicSize.height
		const updatePanelSize = () => {
			setPanelSize(computeVideoPanelPixelSize(aw, ah))
		}

		updatePanelSize()
		window.addEventListener("resize", updatePanelSize)
		return () => window.removeEventListener("resize", updatePanelSize)
	}, [isOpen, videoIntrinsicSize])

	const handleProgressInput = useCallback((value: number) => {
		const video = videoRef.current
		const input = progressRangeRef.current
		if (!video) return
		const d = Number.isFinite(video.duration) ? video.duration : 0
		if (d <= 0) return
		video.currentTime = (value / 100) * d
		if (input) {
			input.style.setProperty("--progress", `${value}%`)
		}
	}, [])

	const handleScrubStart = useCallback(() => {
		isScrubbingRef.current = true
	}, [])

	const handleScrubEnd = useCallback(() => {
		isScrubbingRef.current = false
		syncProgressDOM()
	}, [syncProgressDOM])

	const handleVolumeChange = useCallback((value: number) => {
		const video = videoRef.current
		const normalized = Math.max(0, Math.min(1, value))
		setVolume(normalized)
		setIsMuted(normalized === 0)
		if (video) {
			video.volume = normalized
			video.muted = normalized === 0
		}
	}, [])

	const toggleMute = useCallback(() => {
		const video = videoRef.current
		if (!video) return

		const nextMuted = !video.muted
		video.muted = nextMuted
		setIsMuted(nextMuted)
		if (!nextMuted && video.volume === 0) {
			video.volume = 1
			setVolume(1)
		}
	}, [])

	const hasPlayableSource = Boolean(src || managedVideoElement)
	const isVideoLayoutPending = Boolean(
		hasPlayableSource && !externalHasError && !hasVideoError && !videoIntrinsicSize,
	)
	const showLoading =
		externalIsLoading ||
		(hasPlayableSource &&
			!externalHasError &&
			!hasVideoError &&
			(isVideoLoading || !videoIntrinsicSize))
	const showError = (externalHasError || hasVideoError || !hasPlayableSource) && !showLoading

	const topChromeClassName = [
		chromeStyles.layer,
		chromeStyles.topBar,
		chromeVisible ? chromeStyles.layerVisible : chromeStyles.layerHidden,
	].join(" ")

	const fileLabel = getFullscreenMediaFileLabel(resourcePath, fileName)

	if (!isClient || !isOpen) {
		return null
	}

	return createPortal(
		<div className={styles.overlayRoot} style={overlayInsetStyle} data-canvas-ui-component>
			<div
				className={styles.overlayBackdrop}
				role="presentation"
				onClick={onClose}
				aria-hidden
			/>
			<div className={styles.overlayContent}>
				<div
					className={styles.panel}
					style={
						panelSize
							? { width: panelSize.width, height: panelSize.height }
							: {
									width: "auto",
									height: "auto",
									minWidth: 280,
									minHeight: 160,
									background: "transparent",
									boxShadow: "none",
								}
					}
					onClick={(event) => event.stopPropagation()}
				>
					<div
						className={styles.player}
						style={isVideoLayoutPending ? { minWidth: 280, minHeight: 160 } : undefined}
						onMouseEnter={handlePlayerMouseEnter}
						onMouseMove={handlePlayerMouseMove}
						onMouseLeave={handlePlayerMouseLeave}
					>
						<div
							className={topChromeClassName}
							onClick={(event) => event.stopPropagation()}
							onPointerDown={(event) => event.stopPropagation()}
						>
							<div className={chromeStyles.topBarLeft}>
								{fileLabel ? (
									<span className={chromeStyles.fileName} title={fileLabel}>
										{fileLabel}
									</span>
								) : null}
							</div>
							<button
								type="button"
								className={styles.closeButton}
								onClick={(event) => {
									event.stopPropagation()
									onClose()
								}}
								aria-label={
									closeAriaLabel ?? t("video.fullscreen.close", "关闭全屏")
								}
							>
								<X size={20} />
							</button>
						</div>

						{managedVideoElement ? (
							<div
								ref={managedVideoHostRef}
								className={styles.video}
								style={
									isVideoLayoutPending
										? {
												position: "absolute",
												width: 1,
												height: 1,
												opacity: 0,
												pointerEvents: "none",
											}
										: undefined
								}
							/>
						) : null}

						{src && !managedVideoElement ? (
							<video
								ref={(node) => {
									internalVideoRef.current = node
									videoRef.current = node
								}}
								className={styles.video}
								src={src}
								autoPlay
								playsInline
								preload="metadata"
								style={
									isVideoLayoutPending
										? {
												position: "absolute",
												width: 1,
												height: 1,
												opacity: 0,
												pointerEvents: "none",
											}
										: undefined
								}
								onLoadedMetadata={syncVideoStateFromDom}
								onCanPlay={syncVideoStateFromDom}
								onPlaying={syncVideoStateFromDom}
								onPause={syncVideoStateFromDom}
								onEnded={syncVideoStateFromDom}
								onWaiting={() => setIsVideoLoading(true)}
								onError={() => {
									setIsVideoLoading(false)
									setHasVideoError(true)
									setIsPlaying(false)
								}}
								onClick={(event) => {
									event.stopPropagation()
									togglePlay()
								}}
							/>
						) : null}

						{(showLoading || showError) && (
							<div className={styles.centerOverlay}>
								{showError ? (
									<div className={styles.errorState}>
										{loadFailedMessage ??
											t(
												"video.fullscreen.loadFailed",
												"视频加载失败，请稍后重试",
											)}
									</div>
								) : (
									<div className={styles.spinner} />
								)}
							</div>
						)}

						<VideoFullscreenCenterPlayButton
							visible={chromeVisible && !showLoading && !showError}
							isPlaying={isPlaying}
							onToggle={togglePlay}
							playAriaLabel={t("video.fullscreen.play", "播放")}
							pauseAriaLabel={t("video.fullscreen.pause", "暂停")}
						/>

						<MediaControls
							visible={chromeVisible}
							duration={duration}
							progressRangeRef={progressRangeRef}
							currentTimeLabelRef={currentTimeLabelRef}
							onProgressInput={handleProgressInput}
							onScrubStart={handleScrubStart}
							onScrubEnd={handleScrubEnd}
							isPlaying={isPlaying}
							isMuted={isMuted}
							volume={volume}
							onTogglePlay={togglePlay}
							onToggleMute={toggleMute}
							onVolumeChange={handleVolumeChange}
							onExitClick={onClose}
						/>
					</div>
				</div>
			</div>
		</div>,
		document.body,
	)
}
