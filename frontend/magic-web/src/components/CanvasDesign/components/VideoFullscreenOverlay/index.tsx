import { useCallback, useEffect, useState } from "react"
import { ElementTypeEnum, type VideoElement } from "../../canvas/types"
import { useCanvasElement } from "../../hooks/useCanvasElement"
import { useCanvasPanelUI } from "../../context/CanvasUIContext"
import { useCanvas } from "../../context/CanvasContext"
import { VideoElement as VideoElementClass } from "../../canvas/element/elements/VideoElement"
import VideoFullscreenPlayerOverlay from "./VideoFullscreenPlayerOverlay"

/** 画布视频全屏层：优先复用画布已有播放会话，避免进入全屏时重新建流 */
export default function VideoFullscreenOverlay() {
	const { canvas } = useCanvas()
	const { fullscreenVideoElementId, setFullscreenVideoElementId } = useCanvasPanelUI()
	const element = useCanvasElement(fullscreenVideoElementId)
	const videoElement = element?.type === ElementTypeEnum.Video ? (element as VideoElement) : null
	const [playbackVideoElement, setPlaybackVideoElement] = useState<HTMLVideoElement | null>(null)
	const [isLoading, setIsLoading] = useState(false)
	const [hasError, setHasError] = useState(false)
	const [intrinsicSizeHint, setIntrinsicSizeHint] = useState<{
		width: number
		height: number
	} | null>(null)

	useEffect(() => {
		const src = videoElement?.src
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
	}, [canvas, videoElement?.src])

	useEffect(() => {
		if (!fullscreenVideoElementId || videoElement) {
			return
		}
		setFullscreenVideoElementId(null)
	}, [fullscreenVideoElementId, setFullscreenVideoElementId, videoElement])

	useEffect(() => {
		if (!canvas || !fullscreenVideoElementId || !videoElement?.src) {
			setPlaybackVideoElement(null)
			setIsLoading(false)
			setHasError(false)
			return
		}

		const elementInstance = canvas.elementManager.getElementInstance(videoElement.id)
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
					if (usedHandoff) {
						elementInstance.handoffPlaybackFromFullscreen()
					} else {
						elementInstance.releaseFullscreenPlayback()
					}
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
	}, [canvas, fullscreenVideoElementId, videoElement?.id, videoElement?.src])

	const handlePlayRequest = useCallback(async () => {
		if (!canvas || !fullscreenVideoElementId || !videoElement?.src) {
			return false
		}

		const elementInstance = canvas.elementManager.getElementInstance(videoElement.id)
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
	}, [canvas, fullscreenVideoElementId, videoElement?.id, videoElement?.src])

	return (
		<VideoFullscreenPlayerOverlay
			isOpen={Boolean(fullscreenVideoElementId && videoElement)}
			onClose={() => setFullscreenVideoElementId(null)}
			videoElement={playbackVideoElement}
			onPlayRequest={handlePlayRequest}
			intrinsicSizeHint={intrinsicSizeHint}
			isLoading={isLoading}
			hasError={hasError}
			fileName={videoElement?.name}
			resourcePath={videoElement?.src ?? ""}
		/>
	)
}
