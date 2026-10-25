import { useState, useCallback, useEffect, useRef } from "react"
import { useCanvas } from "../../providers/CanvasProvider"
import { useCanvasEvent } from "../canvas"
import { ElementTypeEnum } from "../../../runtime/document/types"
import { areCanvasHostResourceReferencesSame } from "../../../runtime/shared/path/canvasResourcePath"
import { getActiveImageContent } from "../../../runtime/document/elementContent"
import type { ImageInfo } from "../../../runtime/resources/image/ImageResourceManager"

export interface UseImageLowUrlOptions {
	elementId: string
	src?: string
	enabled?: boolean
}

export interface UseImageLowUrlResult {
	lowUrl: string | null
	imageInfo: ImageInfo | null
	isLoading: boolean
	hasError: boolean
}

export function useImageLowUrl(options: UseImageLowUrlOptions): UseImageLowUrlResult {
	const { elementId, src, enabled = true } = options
	const { canvas } = useCanvas()
	const requestIdRef = useRef(0)
	const lowImageReleaseRef = useRef<(() => void) | null>(null)
	const [lowUrl, setLowUrl] = useState<string | null>(null)
	const [imageInfo, setImageInfo] = useState<ImageInfo | null>(null)
	const [isLoading, setIsLoading] = useState(false)
	const [hasError, setHasError] = useState(false)

	const releaseLowImageUrl = useCallback(() => {
		lowImageReleaseRef.current?.()
		lowImageReleaseRef.current = null
	}, [])

	const resetLowUrl = useCallback(() => {
		requestIdRef.current += 1
		releaseLowImageUrl()
		setLowUrl(null)
		setImageInfo(null)
		setIsLoading(false)
		setHasError(false)
	}, [releaseLowImageUrl])

	const syncLoadedLowUrl = useCallback(async () => {
		if (!canvas || !src || !enabled) return
		const currentRequestId = requestIdRef.current + 1
		requestIdRef.current = currentRequestId
		releaseLowImageUrl()
		setLowUrl(null)
		setImageInfo(null)
		setIsLoading(true)
		setHasError(false)

		const loaded = await canvas.imageResourceManager.getLowImageUrl(src)
		if (requestIdRef.current !== currentRequestId) {
			loaded?.release()
			return
		}

		lowImageReleaseRef.current = loaded?.release ?? null
		setLowUrl(loaded?.url ?? null)
		setImageInfo(loaded?.imageInfo ?? null)
		setHasError(false)
		setIsLoading(false)
	}, [canvas, enabled, releaseLowImageUrl, src])

	useEffect(() => releaseLowImageUrl, [releaseLowImageUrl])

	useEffect(() => {
		if (!enabled || !src) {
			resetLowUrl()
			return
		}
		void syncLoadedLowUrl()
	}, [enabled, resetLowUrl, src, syncLoadedLowUrl])

	// 监听元素更新事件，当图片元素的 src 更新时更新 URL
	useCanvasEvent(
		"element:updated",
		useCallback(
			({ data }) => {
				if (!canvas || !enabled || data.elementId !== elementId) return
				if (data.data?.type !== ElementTypeEnum.Image) return
				const effectiveSrc =
					(canvas.getEffectiveContent(data.elementId) as { src?: string } | undefined)
						?.src ?? getActiveImageContent(data.data).src
				if (effectiveSrc !== src) return
				void syncLoadedLowUrl()
			},
			[elementId, enabled, src, syncLoadedLowUrl, canvas],
		),
	)

	useCanvasEvent(
		"content:previewChanged",
		useCallback(
			({ data }) => {
				if (!enabled || (data.elementId && data.elementId !== elementId)) return
				void syncLoadedLowUrl()
			},
			[elementId, enabled, syncLoadedLowUrl],
		),
	)

	// 监听临时元素转正事件，当图片上传完成转为正式元素时更新 URL
	useCanvasEvent(
		"element:temporary:converted",
		useCallback(
			({ data }) => {
				if (!enabled || data.elementId !== elementId) return
				void syncLoadedLowUrl()
			},
			[elementId, enabled, syncLoadedLowUrl],
		),
	)

	// 监听元素删除事件，移除已删除的图片元素的 URL
	useCanvasEvent(
		"element:deleted",
		useCallback(
			({ data }) => {
				if (data.elementId === elementId) resetLowUrl()
			},
			[elementId, resetLowUrl],
		),
	)

	// 监听图片资源加载完成事件，当图片加载完成时更新 URL
	useCanvasEvent(
		"resource:image:loaded",
		useCallback(
			({ data }) => {
				if (!canvas || !enabled || !src) return
				if (!areCanvasHostResourceReferencesSame(canvas, src, data.path)) return

				const currentRequestId = requestIdRef.current + 1
				requestIdRef.current = currentRequestId
				void (async () => {
					const loaded = await canvas.imageResourceManager.getLowImageUrl(src)
					if (requestIdRef.current !== currentRequestId) {
						loaded?.release()
						return
					}
					releaseLowImageUrl()
					lowImageReleaseRef.current = loaded?.release ?? null
					setLowUrl(loaded?.url ?? null)
					setImageInfo(loaded?.imageInfo ?? null)
					setIsLoading(false)
					setHasError(false)
				})()
			},
			[canvas, enabled, releaseLowImageUrl, src],
		),
	)

	return {
		lowUrl,
		imageInfo,
		isLoading,
		hasError,
	}
}
