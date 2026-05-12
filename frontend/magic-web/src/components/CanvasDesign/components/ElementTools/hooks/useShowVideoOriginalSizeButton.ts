import { useDebounceFn } from "ahooks"
import { useEffect, useRef, useState } from "react"
import { ElementTypeEnum } from "../../../canvas/types"
import type { Canvas } from "../../../canvas/Canvas"

interface UseShowVideoOriginalSizeButtonOptions {
	canvas: Canvas | null
	isSingleElement: boolean
	elementType: string | undefined
	elementId: string | undefined
	videoSrc: string | undefined
	elementWidth: number | undefined
	elementHeight: number | undefined
}

const VIDEO_RATIO_EPSILON = 0.001
const CHECK_WAIT_MS = 120

export default function useShowVideoOriginalSizeButton(
	options: UseShowVideoOriginalSizeButtonOptions,
): boolean {
	const {
		canvas,
		isSingleElement,
		elementType,
		elementId,
		videoSrc,
		elementWidth,
		elementHeight,
	} = options
	const [visible, setVisible] = useState(false)
	const requestIdRef = useRef(0)

	const { run: runCheckVisibility, cancel: cancelCheckVisibility } = useDebounceFn(
		async (payload: { requestId: number; src: string; width: number; height: number }) => {
			if (!canvas) return
			try {
				const resource = await canvas.videoResourceManager.getPreviewResource(payload.src)
				if (requestIdRef.current !== payload.requestId) return
				const videoWidth = resource?.metadata?.videoWidth ?? 0
				const videoHeight = resource?.metadata?.videoHeight ?? 0
				if (videoWidth <= 0 || videoHeight <= 0) {
					setVisible(false)
					return
				}

				const elementRatio = payload.width / payload.height
				const resourceRatio = videoWidth / videoHeight
				setVisible(Math.abs(elementRatio - resourceRatio) > VIDEO_RATIO_EPSILON)
			} catch {
				if (requestIdRef.current === payload.requestId) {
					setVisible(false)
				}
			}
		},
		{ wait: CHECK_WAIT_MS },
	)

	useEffect(() => {
		const width = elementWidth ?? 0
		const height = elementHeight ?? 0
		const isVideoElement = elementType === ElementTypeEnum.Video
		if (
			!canvas ||
			!isSingleElement ||
			!isVideoElement ||
			!videoSrc ||
			width <= 0 ||
			height <= 0
		) {
			cancelCheckVisibility()
			setVisible(false)
			return
		}

		const requestId = requestIdRef.current + 1
		requestIdRef.current = requestId
		runCheckVisibility({
			requestId,
			src: videoSrc,
			width,
			height,
		})

		return () => {
			cancelCheckVisibility()
		}
	}, [
		canvas,
		cancelCheckVisibility,
		elementType,
		elementId,
		elementHeight,
		elementWidth,
		isSingleElement,
		runCheckVisibility,
		videoSrc,
	])

	return visible
}
