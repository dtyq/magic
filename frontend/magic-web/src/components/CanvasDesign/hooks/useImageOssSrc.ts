import { useState, useEffect, useCallback } from "react"
import { useCanvas } from "../context/CanvasContext"
import type { ImageElement } from "../canvas/types"
import { useCanvasEvent } from "./useCanvasEvent"
import { normalizePath } from "../canvas/utils/utils"

/**
 * 检查图片元素的 ossSrc 是否已加载
 * @param imageElement - 图片元素数据
 * @returns ossSrc 是否已加载，以及 ossSrc 的值
 */
export function useImageOssSrc(imageElement: ImageElement | null) {
	const { canvas } = useCanvas()
	const [ossSrc, setOssSrc] = useState<string | undefined>(undefined)

	const path = imageElement?.src
	const pathNormalized = path ? normalizePath(path) : ""

	// 初始同步及 path 变化时通过 getResource 获取
	const syncOssSrc = useCallback(async () => {
		if (!canvas || !path) return
		const resource = await canvas.imageResourceManager.getResource(path)
		if (resource && normalizePath(path) === pathNormalized) {
			setOssSrc(resource.ossSrc)
		}
	}, [canvas, path, pathNormalized])

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
			if (path && normalizePath(data.path) === pathNormalized) {
				setOssSrc(data.resource.ossSrc)
			}
		},
		[path, pathNormalized],
	)

	return {
		hasOssSrc: !!ossSrc,
		ossSrc,
	}
}
