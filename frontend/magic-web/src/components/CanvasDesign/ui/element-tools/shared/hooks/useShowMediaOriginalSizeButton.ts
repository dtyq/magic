import { useDebounceFn } from "ahooks"
import { useEffect, useRef, useState } from "react"
import { ElementTypeEnum } from "../../../../runtime/document/types"
import type { Canvas } from "../../../../runtime/core/Canvas"
import { getMediaDimensions } from "../mediaOriginalSize"

interface UseShowMediaOriginalSizeButtonOptions {
	canvas: Canvas | null
	isSingleElement: boolean
	elementType: string | undefined
	elementId: string | undefined
	mediaSrc: string | undefined
	elementWidth: number | undefined
	elementHeight: number | undefined
}

const MEDIA_RATIO_EPSILON = 0.001
const CHECK_WAIT_MS = 120

export default function useShowMediaOriginalSizeButton(
	options: UseShowMediaOriginalSizeButtonOptions,
): boolean {
	const {
		canvas,
		isSingleElement,
		elementType,
		elementId,
		mediaSrc,
		elementWidth,
		elementHeight,
	} = options
	const [visible, setVisible] = useState(false)
	const requestIdRef = useRef(0)

	const { run: runCheckVisibility, cancel: cancelCheckVisibility } = useDebounceFn(
		async (payload: {
			requestId: number
			src: string
			width: number
			height: number
			mediaType: "image" | "video"
		}) => {
			if (!canvas) return
			try {
				const dimensions = await getMediaDimensions(canvas, payload.mediaType, payload.src)
				if (requestIdRef.current !== payload.requestId) return
				if (!dimensions) {
					setVisible(false)
					return
				}

				const elementRatio = payload.width / payload.height
				const resourceRatio = dimensions.width / dimensions.height
				setVisible(Math.abs(elementRatio - resourceRatio) > MEDIA_RATIO_EPSILON)
			} catch {
				if (requestIdRef.current === payload.requestId) setVisible(false)
			}
		},
		{ wait: CHECK_WAIT_MS },
	)

	useEffect(() => {
		const width = elementWidth ?? 0
		const height = elementHeight ?? 0
		const mediaType =
			elementType === ElementTypeEnum.Image
				? ElementTypeEnum.Image
				: elementType === ElementTypeEnum.Video
					? ElementTypeEnum.Video
					: undefined
		if (!canvas || !isSingleElement || !mediaType || !mediaSrc || width <= 0 || height <= 0) {
			cancelCheckVisibility()
			setVisible(false)
			return
		}

		const requestId = requestIdRef.current + 1
		requestIdRef.current = requestId
		runCheckVisibility({
			requestId,
			src: mediaSrc,
			width,
			height,
			mediaType,
		})

		return () => cancelCheckVisibility()
	}, [
		canvas,
		cancelCheckVisibility,
		elementType,
		elementId,
		elementHeight,
		elementWidth,
		isSingleElement,
		mediaSrc,
		runCheckVisibility,
	])

	return visible
}
