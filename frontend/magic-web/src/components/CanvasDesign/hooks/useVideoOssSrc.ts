import { useCallback, useEffect, useState } from "react"
import type { VideoElement } from "../canvas/types"
import { useCanvas } from "../context/CanvasContext"

/**
 * 解析视频元素的可播放地址，避免 React 层直接消费临时 path。
 * 这里只做换链，不等待海报提取，适合全屏等需要尽快起播的场景。
 */
export function useVideoOssSrc(videoElement: VideoElement | null) {
	const { canvas } = useCanvas()
	const [ossSrc, setOssSrc] = useState<string | undefined>(undefined)
	const [isLoading, setIsLoading] = useState(false)
	const [hasError, setHasError] = useState(false)

	const path = videoElement?.src

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
			const loaded = await canvas.videoResourceManager.ensureFreshOssInfo(path)
			if (videoElement?.src === path) {
				if (loaded) {
					setOssSrc(loaded.ossSrc)
					setHasError(false)
				} else {
					setOssSrc(undefined)
					setHasError(true)
				}
			}
		} catch (error) {
			if (videoElement?.src === path) {
				setOssSrc(undefined)
				setHasError(true)
			}
		} finally {
			if (videoElement?.src === path) {
				setIsLoading(false)
			}
		}
	}, [canvas, path, videoElement?.src])

	useEffect(() => {
		void syncOssSrc()
	}, [syncOssSrc])

	return {
		ossSrc,
		isLoading,
		hasError,
	}
}
