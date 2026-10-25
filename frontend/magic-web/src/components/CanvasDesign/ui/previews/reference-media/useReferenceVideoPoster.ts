import { useCallback, useEffect, useState } from "react"
import { useOptionalCanvas } from "../../../app/providers/CanvasProvider"
import { useCanvasEventWithInstance } from "../../../app/hooks/canvas"
import { clonePosterCanvas } from "./clonePosterCanvas"
export type ReferenceVideoPosterLoadState = "loading" | "ready" | "error"

export interface UseReferenceVideoPosterResult {
	loadState: ReferenceVideoPosterLoadState
	/** 与 VideoResourceManager 缓存隔离的 poster 拷贝，供绘制到展示 canvas */
	posterClone: HTMLCanvasElement | null
	/** 就绪时可播放地址，用于 Popover 等 */
	ossSrc: string | null
}

interface UseReferenceVideoPosterOptions {
	enabled?: boolean
}

/**
 * 按项目 path 拉取视频解码结果（与画布 VideoResourceManager 同源）
 */
export function useReferenceVideoPoster(
	path: string,
	options?: UseReferenceVideoPosterOptions,
): UseReferenceVideoPosterResult {
	const enabled = options?.enabled ?? true
	const canvas = useOptionalCanvas()
	const [posterClone, setPosterClone] = useState<HTMLCanvasElement | null>(null)
	const [ossSrc, setOssSrc] = useState<string | null>(null)
	const [loadState, setLoadState] = useState<ReferenceVideoPosterLoadState>("loading")
	const [retryToken, setRetryToken] = useState(0)

	useCanvasEventWithInstance(
		canvas,
		"resource:remote-load-deferral-released",
		useCallback(
			({ data }) => {
				if (!canvas || !enabled) return
				const pathKey =
					canvas.canvasFileUploadManager.getRemoteResourceLoadDeferralKey(path)
				if (!pathKey || pathKey !== data.key) {
					return
				}
				setRetryToken((value) => value + 1)
			},
			[canvas, enabled, path],
		),
		[canvas, enabled, path],
	)

	useEffect(() => {
		if (!canvas || !enabled || !path) {
			setPosterClone(null)
			setOssSrc(null)
			setLoadState("error")
			return
		}
		let cancelled = false
		setLoadState("loading")
		setPosterClone(null)
		setOssSrc(null)
		if (canvas.canvasFileUploadManager.shouldDeferRemoteResourceLoad(path)) {
			return () => {
				cancelled = true
			}
		}
		void (async () => {
			try {
				const loaded = await canvas.videoResourceManager.getResource(path)
				if (cancelled) return
				if (!loaded && canvas.canvasFileUploadManager.shouldDeferRemoteResourceLoad(path)) {
					setLoadState("loading")
					return
				}
				if (!loaded?.poster || loaded.poster.width < 1 || loaded.poster.height < 1) {
					setPosterClone(null)
					setOssSrc(null)
					setLoadState("error")
					return
				}
				setPosterClone(clonePosterCanvas(loaded.poster))
				setOssSrc(loaded.ossSrc || null)
				setLoadState("ready")
			} catch {
				if (cancelled) return
				setPosterClone(null)
				setOssSrc(null)
				setLoadState("error")
			}
		})()
		return () => {
			cancelled = true
		}
	}, [canvas, enabled, path, retryToken])

	return { loadState, posterClone, ossSrc }
}
