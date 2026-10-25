import { LoaderCircle, Pause, Play } from "lucide-react"
import {
	cloneElement,
	useCallback,
	useEffect,
	useRef,
	useState,
	type MutableRefObject,
	type PointerEvent as ReactPointerEvent,
	type SyntheticEvent,
	type ReactNode,
} from "react"
import { MediaPreviewImageActions } from "./MediaPreviewImageActions"
import { MediaPreviewImageHover } from "./MediaPreviewImageHover"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/shadcn-ui/tooltip"
import { useIsMobile } from "@/hooks/useIsMobile"
import { useFileAccess } from "@/pages/superMagic/providers/FileAccessProvider"
import { useMediaPreviewPlayback } from "./useMediaPreviewPlayback"
import { MEDIA_PREVIEW_POLICY, type MediaPreviewCrop, type MediaPreviewTooltipProps } from "./types"

function isInteractiveTriggerTarget(target: EventTarget | null): boolean {
	return (
		target instanceof Element && Boolean(target.closest("button, a, input, textarea, select"))
	)
}

function isHoverExcludedTriggerTarget(target: EventTarget | null): boolean {
	return target instanceof Element && Boolean(target.closest("[data-media-preview-ignore-hover]"))
}

function formatTime(value: number) {
	if (!Number.isFinite(value) || value < 0) value = 0
	const totalSeconds = Math.floor(value)
	const hours = Math.floor(totalSeconds / 3600)
	const minutes = Math.floor((totalSeconds % 3600) / 60)
	const seconds = totalSeconds % 60
	return hours > 0
		? `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
		: `${minutes}:${String(seconds).padStart(2, "0")}`
}

function clampCrop(crop: MediaPreviewCrop, sourceSize: { width: number; height: number }) {
	const left = Math.max(0, Math.min(sourceSize.width, crop.x))
	const top = Math.max(0, Math.min(sourceSize.height, crop.y))
	const right = Math.max(left, Math.min(sourceSize.width, crop.x + crop.width))
	const bottom = Math.max(top, Math.min(sourceSize.height, crop.y + crop.height))
	if (right <= left || bottom <= top) return undefined
	return { x: left, y: top, width: right - left, height: bottom - top }
}

function getBoundedPreviewSize(width: number, height: number, maxWidth: number, maxHeight: number) {
	if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
		return undefined
	}
	const scale = Math.min(1, maxWidth / width, maxHeight / height)
	return {
		width: Math.max(1, Math.round(width * scale)),
		height: Math.max(1, Math.round(height * scale)),
	}
}

function isValidPreviewSize(
	size: { width: number; height: number } | undefined,
): size is { width: number; height: number } {
	return Boolean(
		size &&
		Number.isFinite(size.width) &&
		Number.isFinite(size.height) &&
		size.width > 0 &&
		size.height > 0,
	)
}

function AudioPlayer({
	src,
	fileName,
	audioRef,
	onError,
	labels,
	playback,
}: {
	src: string
	fileName: string
	audioRef: MutableRefObject<HTMLAudioElement | null>
	onError?: () => void
	labels: MediaPreviewTooltipProps["audioLabels"]
	playback: ReturnType<typeof useMediaPreviewPlayback>
}) {
	const [playing, setPlaying] = useState(false)
	const [currentTime, setCurrentTime] = useState(0)
	const [duration, setDuration] = useState(0)
	const isSeekingRef = useRef(false)
	const playRequestRef = useRef(0)
	const playbackIntentRef = useRef(false)
	const [isLoading, setIsLoading] = useState(false)
	const { remember: rememberPlayback, restore: restorePlayback } = playback
	const progressPercent = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0

	const playAudio = useCallback((audio: HTMLAudioElement) => {
		const requestId = ++playRequestRef.current
		playbackIntentRef.current = true
		setIsLoading(true)
		setPlaying(false)
		void audio
			.play()
			.then(() => {
				if (requestId !== playRequestRef.current || !playbackIntentRef.current) return
				setIsLoading(false)
				setPlaying(true)
			})
			.catch(() => {
				if (requestId !== playRequestRef.current || !playbackIntentRef.current) return
				playbackIntentRef.current = false
				setIsLoading(false)
				setPlaying(false)
			})
	}, [])

	const pauseAudio = useCallback((audio: HTMLAudioElement) => {
		++playRequestRef.current
		playbackIntentRef.current = false
		audio.pause()
		setIsLoading(false)
		setPlaying(false)
	}, [])

	const invalidatePlayback = useCallback(() => {
		++playRequestRef.current
		playbackIntentRef.current = false
		audioRef.current?.pause()
	}, [audioRef])

	const syncCurrentTimeFromAudio = useCallback(() => {
		const audio = audioRef.current
		if (!audio || isSeekingRef.current) return
		setCurrentTime(audio.currentTime)
		rememberPlayback(audio)
	}, [audioRef, rememberPlayback])

	useEffect(() => {
		invalidatePlayback()
		setIsLoading(false)
		setPlaying(false)
		setCurrentTime(0)
		setDuration(0)

		return invalidatePlayback
	}, [invalidatePlayback, src])

	// Portal + display:none 的 <audio> 上，React 的 onTimeUpdate 可能不推进 UI；
	// 与全屏音频一致，播放中用 RAF 读 audio.currentTime 作为进度权威来源。
	useEffect(() => {
		if (!playing) {
			syncCurrentTimeFromAudio()
			return
		}

		let rafId = 0
		const step = () => {
			const audio = audioRef.current
			if (!audio || audio.paused || audio.ended) {
				rafId = 0
				return
			}
			syncCurrentTimeFromAudio()
			rafId = requestAnimationFrame(step)
		}
		rafId = requestAnimationFrame(step)
		return () => {
			cancelAnimationFrame(rafId)
		}
	}, [audioRef, playing, syncCurrentTimeFromAudio])

	const handleSeek = useCallback(
		(value: number) => {
			if (!Number.isFinite(value)) return
			const nextTime = Math.max(0, Math.min(value, duration || value))
			setCurrentTime(nextTime)
			const audio = audioRef.current
			if (audio) {
				audio.currentTime = nextTime
			}
		},
		[audioRef, duration],
	)

	const seekFromPointer = useCallback(
		(event: ReactPointerEvent<HTMLInputElement>) => {
			const rect = event.currentTarget.getBoundingClientRect()
			if (rect.width <= 0 || duration <= 0) return
			const ratio = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width))
			handleSeek(ratio * duration)
		},
		[duration, handleSeek],
	)

	return (
		<div className="relative box-border flex min-w-0 max-w-full items-center gap-3 px-2.5 pb-3 pt-2 text-white">
			<audio
				ref={audioRef}
				src={src}
				preload="metadata"
				aria-label={fileName}
				// 避免 display:none：部分环境下会让 timeupdate 不可靠；用 sr-only 隐藏即可。
				className="sr-only"
				onLoadedMetadata={(event) => {
					const audio = event.currentTarget
					setDuration(audio.duration || 0)
					const saved = restorePlayback(audio)
					setCurrentTime(audio.currentTime)
					if (saved?.shouldResume) playAudio(audio)
				}}
				onVolumeChange={(event) => rememberPlayback(event.currentTarget)}
				onRateChange={(event) => rememberPlayback(event.currentTarget)}
				onDurationChange={(event) => setDuration(event.currentTarget.duration || 0)}
				onTimeUpdate={syncCurrentTimeFromAudio}
				onLoadStart={() => {
					if (playbackIntentRef.current) setIsLoading(true)
				}}
				onWaiting={() => {
					if (playbackIntentRef.current) setIsLoading(true)
				}}
				onCanPlay={() => {
					// 播放请求仍在 pending 时，保持 loading，直到 play() 或 playing 事件确认启动。
					if (!playbackIntentRef.current || playing) setIsLoading(false)
				}}
				onPlaying={() => {
					setIsLoading(false)
					setPlaying(playbackIntentRef.current)
				}}
				onPlay={() => {
					setIsLoading(false)
					setPlaying(playbackIntentRef.current)
				}}
				onPause={() => {
					playbackIntentRef.current = false
					setIsLoading(false)
					setPlaying(false)
					syncCurrentTimeFromAudio()
				}}
				onEnded={() => {
					playbackIntentRef.current = false
					setIsLoading(false)
					setPlaying(false)
					setCurrentTime(duration)
				}}
				onError={() => {
					playbackIntentRef.current = false
					setIsLoading(false)
					setPlaying(false)
					onError?.()
				}}
			/>
			<button
				type="button"
				className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-white/15 hover:bg-white/25"
				aria-label={
					isLoading
						? (labels.loading ?? labels.play)
						: playing
							? labels.pause
							: labels.play
				}
				onClick={() => {
					const audio = audioRef.current
					if (!audio) return
					if (playing || isLoading) pauseAudio(audio)
					else playAudio(audio)
				}}
			>
				{isLoading ? (
					<LoaderCircle size={15} className="animate-spin" aria-hidden />
				) : playing ? (
					<Pause size={15} fill="currentColor" strokeWidth={1.5} aria-hidden />
				) : (
					<Play
						size={15}
						fill="currentColor"
						strokeWidth={1.5}
						className="translate-x-px"
						aria-hidden
					/>
				)}
			</button>
			<div className="flex min-w-0 flex-1 flex-col items-start gap-0.5">
				<div className="relative h-3 w-full min-w-0">
					<div
						className="pointer-events-none absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full"
						style={{
							background: `linear-gradient(to right, #fff 0%, #fff ${progressPercent}%, rgb(255 255 255 / 30%) ${progressPercent}%, rgb(255 255 255 / 30%) 100%)`,
						}}
					/>
					<input
						type="range"
						className="relative z-10 m-0 h-3 w-full min-w-0 max-w-full cursor-pointer touch-none appearance-none rounded-full bg-transparent accent-white [&::-moz-range-progress]:bg-transparent [&::-moz-range-thumb]:size-3 [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-white [&::-moz-range-track]:h-0.5 [&::-moz-range-track]:rounded-full [&::-moz-range-track]:bg-transparent [&::-webkit-slider-runnable-track]:h-0.5 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-transparent [&::-webkit-slider-thumb]:mt-[-5px] [&::-webkit-slider-thumb]:size-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-0 [&::-webkit-slider-thumb]:bg-white"
						min={0}
						max={duration || 0}
						step={0.1}
						value={Math.min(currentTime, duration || currentTime)}
						aria-label={labels.progress}
						onPointerDown={(event) => {
							isSeekingRef.current = true
							event.currentTarget.setPointerCapture?.(event.pointerId)
							seekFromPointer(event)
						}}
						onPointerMove={(event) => {
							if (isSeekingRef.current) seekFromPointer(event)
						}}
						onPointerUp={(event) => {
							seekFromPointer(event)
							isSeekingRef.current = false
							event.currentTarget.releasePointerCapture?.(event.pointerId)
						}}
						onPointerCancel={() => {
							isSeekingRef.current = false
						}}
						onBlur={() => {
							isSeekingRef.current = false
						}}
						onChange={(event) => handleSeek(Number(event.currentTarget.value))}
					/>
				</div>
				<span className="w-full text-left text-xs tabular-nums">
					{formatTime(currentTime)} / {formatTime(duration)}
				</span>
			</div>
		</div>
	)
}

/**
 * Keeps the original AudioPlayer layout while the audio source is loading.
 * The invisible controls preserve the player's natural height; the spinner is
 * centered in that space instead of introducing the generic media viewport height.
 */
function AudioLoadingPlayer({ label }: { label: string }) {
	return (
		<div className="relative box-border flex min-w-0 max-w-full items-center gap-3 px-2.5 pb-3 pt-2 text-white">
			<div className="size-7 shrink-0" aria-hidden="true" />
			<div className="flex min-w-0 flex-1 flex-col items-start gap-0.5" aria-hidden="true">
				<div className="relative h-3 w-full min-w-0" />
				<span className="invisible w-full text-left text-xs tabular-nums">0:00 / 0:00</span>
			</div>
			<LoaderCircle
				size={15}
				className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 animate-spin"
				aria-label={label}
			/>
		</div>
	)
}

export function MediaPreviewTooltip(props: MediaPreviewTooltipProps) {
	const {
		children,
		mediaType,
		fileName,
		resourceKey,
		imageActions,
		previewUrl,
		posterUrl,
		audioUrl,
		audioLabels,
		poster,
		crop,
		isLoading = false,
		hasError = false,
		errorMessage,
		enableTouchTrigger = false,
		disabled = false,
		side = "top",
		sideOffset = 8,
		previewSize,
		sourceSize,
		container,
		open: controlledOpen,
		onOpenChange,
		onMediaError,
	} = props
	const isMobile = useIsMobile()
	const { permissions } = useFileAccess()
	const [uncontrolledOpen, setUncontrolledOpen] = useState(false)
	const videoRef = useRef<HTMLVideoElement>(null)
	const audioRef = useRef<HTMLAudioElement>(null)
	const videoPlayback = useMediaPreviewPlayback()
	const audioPlayback = useMediaPreviewPlayback()
	const { reset: resetVideoPlayback } = videoPlayback
	const { reset: resetAudioPlayback } = audioPlayback
	const [videoReady, setVideoReady] = useState(false)
	const [mediaError, setMediaError] = useState(false)
	const [intrinsicPreviewSize, setIntrinsicPreviewSize] = useState<
		{ width: number; height: number } | undefined
	>()
	const open = controlledOpen ?? uncontrolledOpen
	const policy = MEDIA_PREVIEW_POLICY[mediaType]
	const resolvedPreviewSize = isValidPreviewSize(previewSize)
		? previewSize
		: isValidPreviewSize(sourceSize)
			? sourceSize
			: isValidPreviewSize(intrinsicPreviewSize)
				? intrinsicPreviewSize
				: undefined
	const layoutSize = resolvedPreviewSize ?? {
		width: policy.maxWidth,
		height: policy.defaultHeight,
	}
	const previewScale = Math.min(
		1,
		policy.maxWidth / layoutSize.width,
		policy.maxHeight / layoutSize.height,
	)
	const contentWidth = Math.max(1, Math.round(layoutSize.width * previewScale))
	const contentHeight = Math.max(1, Math.round(layoutSize.height * previewScale))
	const cropSourceSize = isValidPreviewSize(sourceSize)
		? sourceSize
		: isValidPreviewSize(intrinsicPreviewSize)
			? intrinsicPreviewSize
			: undefined
	const cropRect = cropSourceSize && crop ? clampCrop(crop, cropSourceSize) : undefined
	const cropDisplaySize = cropRect
		? getBoundedPreviewSize(cropRect.width, cropRect.height, policy.maxWidth, policy.maxHeight)
		: undefined
	const cropDisplayScale =
		cropRect && cropDisplaySize ? cropDisplaySize.width / cropRect.width : 1
	const touchInteractionRef = useRef(false)
	const triggerElementRef = useRef<HTMLElement | null>(null)
	const suppressFocusPreviewRef = useRef(false)
	const lastContentInteractionAtRef = useRef(0)
	const handleContentInteraction = useCallback((event: SyntheticEvent) => {
		lastContentInteractionAtRef.current = Date.now()
		event.stopPropagation()
	}, [])
	const handleMediaError = useCallback(() => {
		setMediaError(true)
		const recovery = onMediaError?.()
		if (recovery) void recovery.then(() => setMediaError(false))
	}, [onMediaError])

	useEffect(() => {
		setMediaError(false)
		setIntrinsicPreviewSize(undefined)
	}, [mediaType, previewUrl, posterUrl, audioUrl])

	useEffect(() => {
		const video = videoRef.current
		if (!video || mediaType !== "video" || !open || !previewUrl) return
		void video.play().catch(() => undefined)
	}, [mediaType, open, previewUrl])

	const handleOpenChange = useCallback(
		(nextOpen: boolean) => {
			if (controlledOpen === undefined) setUncontrolledOpen(nextOpen)
			if (!nextOpen) {
				resetVideoPlayback()
				resetAudioPlayback()
				videoRef.current?.pause()
				if (videoRef.current) videoRef.current.currentTime = 0
				audioRef.current?.pause()
				if (audioRef.current) audioRef.current.currentTime = 0
				setVideoReady(false)
				setMediaError(false)
			}
			onOpenChange?.(nextOpen)
		},
		[controlledOpen, onOpenChange, resetVideoPlayback, resetAudioPlayback],
	)

	useEffect(() => {
		if (!open || !enableTouchTrigger) return
		const handlePointerDown = (event: globalThis.PointerEvent) => {
			const target = event.target
			if (!(target instanceof Element)) return
			if (target.closest("[data-media-preview-trigger], [data-media-preview-content]")) return
			handleOpenChange(false)
		}
		document.addEventListener("pointerdown", handlePointerDown, true)
		return () => document.removeEventListener("pointerdown", handlePointerDown, true)
	}, [enableTouchTrigger, handleOpenChange, open])

	if (disabled || !permissions.preview || (isMobile && !enableTouchTrigger))
		return <>{children}</>

	const trigger = cloneElement(children, {
		"data-media-preview-trigger": "",
		onFocus: (event: React.FocusEvent<HTMLElement>) => {
			triggerElementRef.current = event.currentTarget
			children.props.onFocus?.(event)
			if (suppressFocusPreviewRef.current) event.preventDefault()
		},
		onBlur: (event: React.FocusEvent<HTMLElement>) => {
			children.props.onBlur?.(event)
			suppressFocusPreviewRef.current = false
		},
		onPointerMove: (event: ReactPointerEvent<HTMLElement>) => {
			triggerElementRef.current = event.currentTarget
			suppressFocusPreviewRef.current = false
			children.props.onPointerMove?.(event)
			if (isHoverExcludedTriggerTarget(event.target)) event.preventDefault()
		},
		onPointerDown: (event: ReactPointerEvent<HTMLElement>) => {
			children.props.onPointerDown?.(event)
			if (isInteractiveTriggerTarget(event.target)) return
			if (!enableTouchTrigger || event.pointerType !== "touch") return
			touchInteractionRef.current = true
			event.preventDefault()
			event.stopPropagation()
			handleOpenChange(true)
		},
		onClick: (event: React.MouseEvent<HTMLElement>) => {
			children.props.onClick?.(event)
			if (isInteractiveTriggerTarget(event.target)) return
			if (!touchInteractionRef.current) return
			touchInteractionRef.current = false
			event.preventDefault()
			event.stopPropagation()
		},
		onDoubleClick: (event: React.MouseEvent<HTMLElement>) => {
			// Portal content 若在双击期间关闭，第二次事件可能落回 trigger。
			if (Date.now() - lastContentInteractionAtRef.current < 500) {
				event.preventDefault()
				event.stopPropagation()
				return
			}
			children.props.onDoubleClick?.(event)
		},
		onPointerCancel: (event: ReactPointerEvent<HTMLElement>) => {
			children.props.onPointerCancel?.(event)
			touchInteractionRef.current = false
		},
	})
	const renderContent = (controls?: ReactNode) => (
		<div
			className="relative overflow-hidden rounded-md border border-white/15 bg-black/90 text-white shadow-lg"
			data-media-preview-content=""
			onPointerDown={imageActions ? handleContentInteraction : undefined}
			onDoubleClickCapture={imageActions ? handleContentInteraction : undefined}
		>
			<div
				className="absolute inset-x-0 top-0 z-10 flex items-center gap-2 bg-gradient-to-b from-black/80 to-transparent px-2.5 py-1.5"
				data-reference-media-tooltip-header=""
			>
				<span className="min-w-0 flex-1 truncate text-xs font-medium" title={fileName}>
					{fileName}
				</span>
				{controls}
			</div>
			{isLoading ? (
				mediaType === "audio" ? (
					<div className="box-border w-full min-w-0 max-w-full pt-9">
						<AudioLoadingPlayer label={audioLabels.loading ?? audioLabels.play} />
					</div>
				) : (
					<div
						className="flex min-h-[72px] max-w-full items-center justify-center"
						style={{ width: contentWidth, height: contentHeight }}
					>
						<LoaderCircle size={15} className="animate-spin" aria-hidden="true" />
					</div>
				)
			) : hasError || (mediaError && !poster && !posterUrl) ? (
				<div className="flex min-h-[72px] items-center justify-center px-4 py-8 text-xs text-white/70">
					{errorMessage}
				</div>
			) : mediaType === "image" ? (
				cropRect && cropSourceSize && cropDisplaySize ? (
					<div
						className="relative overflow-hidden bg-black"
						style={{ width: cropDisplaySize.width, height: cropDisplaySize.height }}
					>
						<img
							src={previewUrl ?? undefined}
							alt={fileName}
							className="absolute left-0 top-0 block max-w-none"
							style={{
								width: cropSourceSize.width * cropDisplayScale,
								height: cropSourceSize.height * cropDisplayScale,
								transform: `translate(${-cropRect.x * cropDisplayScale}px, ${-cropRect.y * cropDisplayScale}px)`,
							}}
							onLoad={(event) => {
								const { naturalWidth, naturalHeight } = event.currentTarget
								if (naturalWidth > 0 && naturalHeight > 0) {
									setIntrinsicPreviewSize({
										width: naturalWidth,
										height: naturalHeight,
									})
								}
							}}
							onError={handleMediaError}
						/>
					</div>
				) : (
					<img
						src={previewUrl ?? undefined}
						alt={fileName}
						className="block max-w-full object-contain"
						style={{
							width: contentWidth,
							maxWidth: policy.maxWidth,
							...(previewSize || sourceSize
								? { height: contentHeight, maxHeight: contentHeight }
								: { maxHeight: contentHeight }),
						}}
						onLoad={(event) => {
							const { naturalWidth, naturalHeight } = event.currentTarget
							if (naturalWidth > 0 && naturalHeight > 0) {
								setIntrinsicPreviewSize({
									width: naturalWidth,
									height: naturalHeight,
								})
							}
						}}
						onError={handleMediaError}
					/>
				)
			) : mediaType === "video" ? (
				<div
					className="relative flex items-center justify-center bg-black"
					style={{
						width: contentWidth ?? policy.maxWidth,
						height: contentHeight ?? policy.defaultHeight,
					}}
				>
					{previewUrl ? (
						<video
							ref={videoRef}
							src={previewUrl}
							poster={posterUrl ?? undefined}
							muted
							loop
							autoPlay
							playsInline
							preload="auto"
							aria-label={fileName}
							className="block h-full w-full object-contain"
							onLoadedMetadata={(event) => {
								videoPlayback.restore(event.currentTarget)
								const { videoWidth, videoHeight } = event.currentTarget
								if (videoWidth > 0 && videoHeight > 0) {
									setIntrinsicPreviewSize({
										width: videoWidth,
										height: videoHeight,
									})
								}
							}}
							onCanPlay={() => setVideoReady(true)}
							onTimeUpdate={(event) => videoPlayback.remember(event.currentTarget)}
							onVolumeChange={(event) => videoPlayback.remember(event.currentTarget)}
							onRateChange={(event) => videoPlayback.remember(event.currentTarget)}
							onError={() => {
								setVideoReady(false)
								handleMediaError()
							}}
						/>
					) : null}
					{!videoReady && poster ? (
						<div className="absolute inset-0">{poster}</div>
					) : null}
				</div>
			) : audioUrl || previewUrl ? (
				<div className="box-border w-full min-w-0 max-w-full pt-9">
					<AudioPlayer
						src={audioUrl ?? previewUrl ?? ""}
						fileName={fileName}
						audioRef={audioRef}
						playback={audioPlayback}
						onError={handleMediaError}
						labels={audioLabels}
					/>
				</div>
			) : null}
		</div>
	)

	const renderTooltip = () => (
		<Tooltip open={open} onOpenChange={handleOpenChange} delayDuration={250}>
			<TooltipTrigger asChild>{trigger}</TooltipTrigger>
			<TooltipContent
				side={side}
				sideOffset={sideOffset}
				className="!p-0"
				container={container}
				onClick={handleContentInteraction}
				onDoubleClick={handleContentInteraction}
				onDoubleClickCapture={handleContentInteraction}
				onMouseDown={handleContentInteraction}
				onPointerDown={handleContentInteraction}
				onTouchStart={handleContentInteraction}
				style={{
					width: mediaType === "audio" ? policy.maxWidth : (contentWidth ?? "auto"),
					maxWidth: policy.maxWidth,
					maxHeight: policy.maxHeight,
				}}
			>
				{renderContent()}
			</TooltipContent>
		</Tooltip>
	)
	if (mediaType !== "image" || !imageActions) return renderTooltip()
	return (
		<MediaPreviewImageActions
			key={resourceKey ?? imageActions.resourceKey ?? previewUrl ?? fileName}
			fileName={fileName}
			resourceKey={resourceKey ?? imageActions.resourceKey}
			imageActions={imageActions}
			container={container}
			crop={crop}
			sourceSize={sourceSize}
			getTrigger={() => triggerElementRef.current}
			onExpand={() => {
				suppressFocusPreviewRef.current = true
				handleOpenChange(false)
			}}
		>
			{(controls, modalOpen, menuOpen) => (
				<MediaPreviewImageHover
					open={open && !modalOpen}
					onOpenChange={(nextOpen) => {
						if (nextOpen && (modalOpen || suppressFocusPreviewRef.current)) return
						if (!nextOpen && menuOpen && !modalOpen) return
						handleOpenChange(nextOpen)
					}}
					trigger={trigger}
					getTrigger={(element) => {
						triggerElementRef.current = element
					}}
					side={side}
					sideOffset={sideOffset}
					container={container}
					width={contentWidth}
					maxHeight={policy.maxHeight}
				>
					{renderContent(controls)}
				</MediaPreviewImageHover>
			)}
		</MediaPreviewImageActions>
	)
}
