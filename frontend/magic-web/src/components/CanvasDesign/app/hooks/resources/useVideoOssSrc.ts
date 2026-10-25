import { useCallback, useEffect, useReducer, useState } from "react"
import type { VideoElement } from "../../../runtime/document/types"
import { useCanvas } from "../../providers/CanvasProvider"
import { useCanvasEvent } from "../canvas/useCanvasEvent"

/**
 * 解析视频元素的可播放地址，避免 React 层直接消费临时 path。
 * 这里只做换链，不等待海报提取，适合全屏等需要尽快起播的场景。
 */
export function useVideoOssSrc(videoElement: VideoElement | null) {
	const { canvas } = useCanvas()
	const [, forceUpdate] = useReducer((value: number) => value + 1, 0)
	useCanvasEvent(
		"content:previewChanged",
		({ data }) => {
			if (videoElement && (!data.elementId || data.elementId === videoElement.id)) {
				forceUpdate()
			}
		},
		[videoElement?.id],
	)
	const [ossSrc, setOssSrc] = useState<string | undefined>(undefined)
	const [isLoading, setIsLoading] = useState(false)
	const [hasError, setHasError] = useState(false)

	const getCurrentPath = useCallback(() => {
		if (!videoElement) return undefined
		const content =
			typeof canvas?.getEffectiveContent === "function"
				? (canvas.getEffectiveContent(videoElement.id) as { src?: string } | undefined)
				: (videoElement.contents?.find(
						(item) => item.contentId === videoElement.activeContentId,
					) ?? videoElement.contents?.[0])
		return content?.src
	}, [canvas, videoElement])
	const path = getCurrentPath()

	const syncOssSrc = useCallback(async () => {
		if (!canvas || !path) {
			setOssSrc(undefined)
			setIsLoading(false)
			setHasError(false)
			return
		}

		setIsLoading(true)
		setHasError(false)
		try {
			const loaded = await canvas.videoResourceManager.ensureFreshOssInfo(path, {
				allowCachedFallback: true,
			})
			if (videoElement && getCurrentPath() === path) {
				if (loaded) {
					setOssSrc(loaded.ossSrc)
					setHasError(false)
				} else {
					setOssSrc(undefined)
					setHasError(true)
				}
			}
		} catch (error) {
			if (videoElement && getCurrentPath() === path) {
				setOssSrc(undefined)
				setHasError(true)
			}
		} finally {
			if (videoElement && getCurrentPath() === path) {
				setIsLoading(false)
			}
		}
	}, [canvas, getCurrentPath, path, videoElement])

	useEffect(() => {
		void syncOssSrc()
	}, [syncOssSrc])

	return {
		ossSrc,
		isLoading,
		hasError,
	}
}
