import { useCallback, useEffect, useState } from "react"
import {
	ElementTypeEnum,
	type VideoElement,
	type VideoElementContent,
} from "../../../runtime/document/types"
import { useCanvasElement } from "../../../app/hooks/canvas"
import { useCanvas } from "../../../app/providers/CanvasProvider"
import { VideoElement as VideoElementClass } from "../../../runtime/elements/video/VideoElement"
import VideoFullscreenPlayerOverlay from "./VideoFullscreenPlayerOverlay"

interface VideoFullscreenOverlayProps {
	elementId: string
	onClose: () => void
}

/** 画布视频全屏层：优先复用画布已有播放会话，避免进入全屏时重新建流 */
export default function VideoFullscreenOverlay(props: VideoFullscreenOverlayProps) {
	const { elementId, onClose } = props
	const { canvas } = useCanvas()
	const element = useCanvasElement(elementId)
	const videoElement = element?.type === ElementTypeEnum.Video ? (element as VideoElement) : null
	const playbackEnabled = canvas?.permissionManager?.can("interaction.playback") ?? true
	const videoElementId = videoElement?.id
	const videoContent = videoElement
		? typeof canvas?.getEffectiveContent === "function"
			? canvas.getEffectiveContent<VideoElementContent>(videoElement.id)
			: (videoElement.contents?.find(
					(content) => content.contentId === videoElement.activeContentId,
				) ?? videoElement.contents?.[0])
		: undefined
	const videoSrc = videoContent?.src
	const [playbackVideoElement, setPlaybackVideoElement] = useState<HTMLVideoElement | null>(null)
	const [isLoading, setIsLoading] = useState(false)
	const [hasError, setHasError] = useState(false)
	const [intrinsicSizeHint, setIntrinsicSizeHint] = useState<{
		width: number
		height: number
	} | null>(null)

	useEffect(() => {
		const src = videoSrc
		if (!canvas || !src) {
			setIntrinsicSizeHint(null)
			return
		}
		let cancelled = false
		void (async () => {
			const metadata = await canvas.videoResourceManager.getCachedMetadata(src)
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
	}, [canvas, videoSrc])

	useEffect(() => {
		if (videoElement) {
			return
		}
		onClose()
	}, [onClose, videoElement])

	useEffect(() => {
		if (!canvas || !elementId || !videoElementId || !videoSrc || !playbackEnabled) {
			setPlaybackVideoElement(null)
			setIsLoading(false)
			setHasError(false)
			return
		}

		const elementInstance = canvas.elementManager.getElementInstance(videoElementId)
		if (!(elementInstance instanceof VideoElementClass)) {
			setPlaybackVideoElement(null)
			setIsLoading(false)
			setHasError(true)
			return
		}

		let isCancelled = false
		let usedHandoff = false

		setPlaybackVideoElement(null)
		setIsLoading(true)
		setHasError(false)

		void (async () => {
			try {
				let video = elementInstance.handoffPlaybackToFullscreen()
				if (video) {
					usedHandoff = true
					await video.play().catch((error) => {
						void error
					})
				} else {
					video = await elementInstance.acquireFullscreenPlayback()
				}

				if (isCancelled) {
					// Cleanup already released this effect's session. A shared consumer ID may
					// now belong to a newer StrictMode replay acquire, so do not release again.
					return
				}

				setPlaybackVideoElement(video)
				setHasError(!video)
			} catch {
				if (isCancelled) {
					return
				}
				setPlaybackVideoElement(null)
				setHasError(true)
			} finally {
				if (!isCancelled) {
					setIsLoading(false)
				}
			}
		})()

		return () => {
			isCancelled = true
			setPlaybackVideoElement(null)
			setIsLoading(false)
			if (usedHandoff) {
				elementInstance.handoffPlaybackFromFullscreen()
			} else {
				elementInstance.releaseFullscreenPlayback()
			}
		}
	}, [canvas, elementId, playbackEnabled, videoElementId, videoSrc])

	const handlePlayRequest = useCallback(async () => {
		if (!canvas || !elementId || !videoElementId || !videoSrc || !playbackEnabled) {
			return false
		}

		const elementInstance = canvas.elementManager.getElementInstance(videoElementId)
		if (!(elementInstance instanceof VideoElementClass)) {
			return false
		}

		setIsLoading(true)
		setHasError(false)
		try {
			const video = await elementInstance.acquireFullscreenPlayback()
			setPlaybackVideoElement(video)
			setHasError(!video)
			return !!video
		} catch {
			setPlaybackVideoElement(null)
			setHasError(true)
			return false
		} finally {
			setIsLoading(false)
		}
	}, [canvas, elementId, playbackEnabled, videoElementId, videoSrc])

	return (
		<VideoFullscreenPlayerOverlay
			isOpen={Boolean(elementId && videoElement)}
			src={videoSrc}
			playbackEnabled={playbackEnabled}
			onClose={onClose}
			videoElement={playbackVideoElement}
			onPlayRequest={handlePlayRequest}
			intrinsicSizeHint={intrinsicSizeHint}
			isLoading={isLoading}
			hasError={hasError}
			resourcePath={videoSrc ?? ""}
		/>
	)
}
