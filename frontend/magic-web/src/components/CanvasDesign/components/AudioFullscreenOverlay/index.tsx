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
import chromeStyles from "../FullscreenMediaShell/chrome.module.css"
import { getFullscreenMediaFileLabel } from "../FullscreenMediaShell/getFullscreenMediaFileLabel"
import styles from "../FullscreenMediaShell/shell.module.css"
import MediaControls from "../MediaControls"
import { ReferenceSlotAudioIcon } from "../ui/icons"
import { useResolvedFilePreviewSrc } from "../MediaResourceFullscreenPreview/useResolvedMediaPreviewSrc"

const AUDIO_FULLSCREEN_LAYOUT = {
	insetPx: 80,
} as const satisfies { insetPx: number }

const CHROME_IDLE_HIDE_MS = 3000

const overlayInsetStyle: CSSProperties = {
	padding: AUDIO_FULLSCREEN_LAYOUT.insetPx,
}

const panelStyle: CSSProperties = {
	width: "min(720px, calc(100vw - 160px))",
	height: "min(380px, calc(100vh - 160px))",
}

function formatTime(seconds: number): string {
	const totalSeconds = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0
	const minutes = Math.floor(totalSeconds / 60)
	const remainingSeconds = totalSeconds % 60
	return `${minutes.toString().padStart(2, "0")}:${remainingSeconds.toString().padStart(2, "0")}`
}

interface AudioFullscreenOverlayProps {
	path: string
	title: string
	isOpen: boolean
	onClose: () => void
	closeAriaLabel?: string
}

export default function AudioFullscreenOverlay(props: AudioFullscreenOverlayProps) {
	const { path, title, isOpen, onClose, closeAriaLabel } = props
	const { t } = useCanvasDesignI18n()

	const audioRef = useRef<HTMLAudioElement | null>(null)
	const progressRangeRef = useRef<HTMLInputElement>(null)
	const currentTimeLabelRef = useRef<HTMLSpanElement>(null)
	const isScrubbingRef = useRef(false)
	const progressRafRef = useRef(0)
	const hideChromeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

	const [isClient, setIsClient] = useState(false)
	const [isAudioLoading, setIsAudioLoading] = useState(true)
	const [hasAudioError, setHasAudioError] = useState(false)
	const [duration, setDuration] = useState(0)
	const [isPlaying, setIsPlaying] = useState(false)
	const [volume, setVolume] = useState(1)
	const [isMuted, setIsMuted] = useState(false)
	const [chromeVisible, setChromeVisible] = useState(false)

	const { src, isLoading, hasError } = useResolvedFilePreviewSrc(path)

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

	const syncProgressDOM = useCallback(() => {
		const audio = audioRef.current
		const input = progressRangeRef.current
		const label = currentTimeLabelRef.current
		if (!audio) return
		const d = Number.isFinite(audio.duration) ? audio.duration : 0
		if (input && d > 0) {
			const pct = (audio.currentTime / d) * 100
			input.style.setProperty("--progress", `${pct}%`)
			if (!isScrubbingRef.current) {
				input.value = String(pct)
			}
		}
		if (label) {
			label.textContent = formatTime(audio.currentTime)
		}
	}, [])

	const syncAudioStateFromDom = useCallback(() => {
		const audio = audioRef.current
		if (!audio) return

		setDuration(Number.isFinite(audio.duration) ? audio.duration : 0)
		setIsPlaying(!audio.paused && !audio.ended)
		setIsMuted(audio.muted)
		setVolume(audio.volume)
		setHasAudioError(!!audio.error)
		setIsAudioLoading(audio.readyState < HTMLMediaElement.HAVE_CURRENT_DATA)

		queueMicrotask(() => syncProgressDOM())
	}, [syncProgressDOM])

	const togglePlay = useCallback(() => {
		const audio = audioRef.current
		if (!audio) return
		if (audio.paused) {
			void audio.play()
		} else {
			audio.pause()
		}
	}, [])

	const handleProgressInput = useCallback((value: number) => {
		const audio = audioRef.current
		const input = progressRangeRef.current
		if (!audio) return
		const d = Number.isFinite(audio.duration) ? audio.duration : 0
		if (d <= 0) return
		audio.currentTime = (value / 100) * d
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
		const audio = audioRef.current
		const normalized = Math.max(0, Math.min(1, value))
		setVolume(normalized)
		setIsMuted(normalized === 0)
		if (audio) {
			audio.volume = normalized
			audio.muted = normalized === 0
		}
	}, [])

	const toggleMute = useCallback(() => {
		const audio = audioRef.current
		if (!audio) return

		const nextMuted = !audio.muted
		audio.muted = nextMuted
		setIsMuted(nextMuted)
		if (!nextMuted && audio.volume === 0) {
			audio.volume = 1
			setVolume(1)
		}
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
		setIsAudioLoading(Boolean(src))
		setHasAudioError(false)
		setDuration(0)
		setIsPlaying(false)
	}, [isOpen, src])

	useLayoutEffect(() => {
		const input = progressRangeRef.current
		const label = currentTimeLabelRef.current
		if (input) {
			input.value = "0"
			input.style.setProperty("--progress", "0%")
		}
		if (label) label.textContent = formatTime(0)
	}, [isOpen, src])

	useEffect(() => {
		if (!isOpen) return

		if (!isPlaying) {
			cancelAnimationFrame(progressRafRef.current)
			progressRafRef.current = 0
			syncProgressDOM()
			return
		}

		const step = () => {
			const audio = audioRef.current
			if (!audio) {
				progressRafRef.current = 0
				return
			}
			syncProgressDOM()
			if (!audio.paused && !audio.ended) {
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

	const showLoading = (!src && isLoading) || (Boolean(src) && isAudioLoading && !hasAudioError)
	const showError =
		hasError || (!src && !isLoading) || (Boolean(src) && hasAudioError && !isAudioLoading)

	const topChromeClassName = [
		chromeStyles.layer,
		chromeStyles.topBar,
		chromeVisible ? chromeStyles.layerVisible : chromeStyles.layerHidden,
	].join(" ")

	const fileLabel = getFullscreenMediaFileLabel(path, title)

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
					style={panelStyle}
					onClick={(event) => event.stopPropagation()}
				>
					<div
						className={styles.player}
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
									closeAriaLabel ??
									t("mediaResourceFullscreenPreview.close", "关闭全屏预览")
								}
							>
								<X size={20} />
							</button>
						</div>

						<div
							style={{
								position: "absolute",
								inset: 0,
								display: "flex",
								flexDirection: "column",
								alignItems: "center",
								justifyContent: "center",
								padding: "16px",
							}}
						>
							<div
								style={{
									display: "inline-flex",
									alignItems: "center",
									justifyContent: "center",
									width: "72px",
									height: "72px",
									color: "#fff",
									background: "rgb(255 255 255 / 10%)",
									borderRadius: "9999px",
								}}
							>
								<ReferenceSlotAudioIcon size={40} />
							</div>

							{src ? (
								<audio
									ref={audioRef}
									style={{ width: "min(420px, 100%)" }}
									src={src}
									autoPlay
									preload="metadata"
									onLoadedMetadata={syncAudioStateFromDom}
									onCanPlay={syncAudioStateFromDom}
									onPlaying={syncAudioStateFromDom}
									onPause={syncAudioStateFromDom}
									onEnded={syncAudioStateFromDom}
									onWaiting={() => setIsAudioLoading(true)}
									onError={() => {
										setIsAudioLoading(false)
										setHasAudioError(true)
										setIsPlaying(false)
									}}
								/>
							) : null}
						</div>

						{src ? (
							<MediaControls
								progressAlwaysVisible
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
						) : null}

						{(showLoading || showError) && (
							<div className={styles.centerOverlay}>
								{showError ? (
									<div className={styles.errorState}>
										{t(
											"mediaResourceFullscreenPreview.audioLoadFailed",
											"音频加载失败",
										)}
									</div>
								) : (
									<div className={styles.spinner} />
								)}
							</div>
						)}
					</div>
				</div>
			</div>
		</div>,
		document.body,
	)
}
