import { useState, useEffect, useCallback } from "react"
import { useCanvas } from "../context/CanvasContext"
import type { ImageElement } from "../canvas/types"
import { useCanvasEvent } from "./useCanvasEvent"
import { resolveCanonicalResourcePath } from "../canvas/utils/pathUtils"

/**
 * 检查图片元素的 ossSrc 是否已加载
 * @param imageElement - 图片元素数据
 * @returns ossSrc 是否已加载，以及 ossSrc 的值
 */
export function useImageOssSrc(imageElement: ImageElement | null) {
	const { canvas } = useCanvas()
	const [ossSrc, setOssSrc] = useState<string | undefined>(undefined)

	const path = imageElement?.src

	// 初始同步及 path 变化时通过 getResource 获取
	const syncOssSrc = useCallback(async () => {
		if (!canvas || !path) return
		const resource = await canvas.imageResourceManager.getResource(path)
		if (resource) {
			setOssSrc(resource.ossSrc)
		}
	}, [canvas, path])

	useEffect(() => {
		if (!path || !canvas) {
			setOssSrc(undefined)
			return
		}
		syncOssSrc()
	}, [path, canvas, syncOssSrc])

	useCanvasEvent(
		"element:image:ossSrcReady",
		({ data }) => {
			if (data.elementId === imageElement?.id) {
				syncOssSrc()
			}
		},
		[imageElement?.id, syncOssSrc],
	)

	useCanvasEvent(
		"resource:image:loaded",
		({ data }) => {
			if (!canvas || !path) return
			const resolveAbs = canvas.magicConfigManager.config?.methods?.resolveAbsolutePath
			if (
				resolveCanonicalResourcePath(data.path, resolveAbs) ===
				resolveCanonicalResourcePath(path, resolveAbs)
			) {
				setOssSrc(data.resource.ossSrc)
			}
		},
		[canvas, path],
	)

	return {
		hasOssSrc: !!ossSrc,
		ossSrc,
	}
}
