import { useCallback, useEffect, useRef, useState } from "react"
import { useCanvasDesignI18n } from "../../../app/providers/I18nProvider"
import { useCanvas } from "../../../app/providers/CanvasProvider"
import VideoFullscreenPlayerOverlay from "../video/VideoFullscreenPlayerOverlay"
import type { MediaResourceFullscreenPreviewItem } from "./types"

interface VideoPreviewContentProps {
	resource: MediaResourceFullscreenPreviewItem
	/** 是否允许当前 Canvas 会话执行播放控制；无权限时仍加载静态视频预览。 */
	playbackEnabled?: boolean
	onClose: () => void
}

export default function VideoPreviewContent(props: VideoPreviewContentProps) {
	const { resource, playbackEnabled = true, onClose } = props
	const { t } = useCanvasDesignI18n()
	const { canvas } = useCanvas()
	const [videoElement, setVideoElement] = useState<HTMLVideoElement | null>(null)
	const [isLoading, setIsLoading] = useState(false)
	const [hasError, setHasError] = useState(false)
	const [isRefreshing, setIsRefreshing] = useState(false)
	const [intrinsicSizeHint, setIntrinsicSizeHint] = useState<{
		width: number
		height: number
	} | null>(null)
	const consumerIdRef = useRef(
		`video:resource-preview:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`,
	)

	useEffect(() => {
		if (!canvas || !resource.path) {
			setIntrinsicSizeHint(null)
			return
		}
		let cancelled = false
		void (async () => {
			const metadata = await canvas.videoResourceManager.getCachedMetadata(resource.path)
			if (cancelled) return
			if (!metadata) {
				setIntrinsicSizeHint(null)
				return
			}
			setIntrinsicSizeHint({
				width: metadata.videoWidth,
				height: metadata.videoHeight,
			})
		})()
		return () => {
			cancelled = true
		}
	}, [canvas, resource.path])

	const acquirePlayback = useCallback(
		async (options?: { autoPlay?: boolean }) => {
			if (!canvas || !resource.path) {
				return null
			}

			return canvas.videoPlaybackManager.acquire(resource.path, consumerIdRef.current, {
				autoPlay: options?.autoPlay,
			})
		},
		[canvas, resource.path],
	)

	const releasePlayback = useCallback(() => {
		if (!canvas) return

		const consumerId = consumerIdRef.current
		const video = canvas.videoPlaybackManager.getVideoElement(consumerId)
		video?.pause()
		canvas.videoPlaybackManager.release(consumerId)
	}, [canvas])

	const handleClose = useCallback(() => {
		releasePlayback()
		onClose()
	}, [onClose, releasePlayback])

	useEffect(() => {
		if (!canvas || !resource.path) {
			setVideoElement(null)
			setIsLoading(false)
			setHasError(false)
			return
		}

		const consumerId = consumerIdRef.current
		let cancelled = false
		setVideoElement(null)
		setIsLoading(true)
		setHasError(false)

		void acquirePlayback({ autoPlay: playbackEnabled })
			.then((session) => {
				if (cancelled) {
					session?.video.pause()
					canvas.videoPlaybackManager.release(consumerId)
					return
				}
				setVideoElement(session?.video ?? null)
				setHasError(!session?.video)
			})
			.catch(() => {
				if (cancelled) {
					return
				}
				setVideoElement(null)
				setHasError(true)
			})
			.finally(() => {
				if (!cancelled) {
					setIsLoading(false)
				}
			})

		return () => {
			cancelled = true
			const video = canvas.videoPlaybackManager.getVideoElement(consumerId)
			video?.pause()
			canvas.videoPlaybackManager.release(consumerId)
			setIsRefreshing(false)
		}
	}, [acquirePlayback, canvas, playbackEnabled, resource.path])

	useEffect(() => {
		if (!canvas) {
			setIsRefreshing(false)
			return
		}

		const consumerId = consumerIdRef.current
		return canvas.videoPlaybackManager.subscribeConsumerState(consumerId, (state) => {
			setIsRefreshing(state.isRefreshing)
		})
	}, [canvas])

	const handlePlayRequest = useCallback(async () => {
		if (!playbackEnabled) return false
		setHasError(false)
		const session = await acquirePlayback({ autoPlay: true }).catch(() => null)
		setVideoElement(session?.video ?? null)
		setHasError(!session?.video)
		return !!session?.video
	}, [acquirePlayback, playbackEnabled])

	return (
		<VideoFullscreenPlayerOverlay
			videoElement={videoElement}
			onPlayRequest={handlePlayRequest}
			isOpen
			playbackEnabled={playbackEnabled}
			onClose={handleClose}
			intrinsicSizeHint={intrinsicSizeHint}
			isLoading={isLoading || isRefreshing}
			hasError={hasError}
			fileName={resource.fileName}
			resourcePath={resource.path}
			loadFailedMessage={t(
				"mediaResourceFullscreenPreview.videoLoadFailed",
				"视频加载失败，请稍后重试",
			)}
		/>
	)
}
