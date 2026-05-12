import { useEffect, useState } from "react"
import { useCanvas } from "../../context/CanvasContext"
import { clonePosterCanvas } from "./clonePosterCanvas"

export type ReferenceVideoPosterLoadState = "loading" | "ready" | "error"

export interface UseReferenceVideoPosterResult {
	loadState: ReferenceVideoPosterLoadState
	/** 与 VideoResourceManager 缓存隔离的 poster 拷贝，供绘制到展示 canvas */
	posterClone: HTMLCanvasElement | null
	/** 就绪时可播放地址，用于 Popover 等 */
	ossSrc: string | null
}

/**
 * 按项目 path 拉取视频解码结果（与画布 VideoResourceManager 同源）
 */
export function useReferenceVideoPoster(path: string): UseReferenceVideoPosterResult {
	const { canvas } = useCanvas()
	const [posterClone, setPosterClone] = useState<HTMLCanvasElement | null>(null)
	const [ossSrc, setOssSrc] = useState<string | null>(null)
	const [loadState, setLoadState] = useState<ReferenceVideoPosterLoadState>("loading")

	useEffect(() => {
		if (!canvas) {
			setPosterClone(null)
			setOssSrc(null)
			setLoadState("error")
			return
		}
		let cancelled = false
		setLoadState("loading")
		setPosterClone(null)
		setOssSrc(null)
		void (async () => {
			try {
				const loaded = await canvas.videoResourceManager.getResource(path)
				if (cancelled) return
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
	}, [canvas, path])

	return { loadState, posterClone, ossSrc }
}
