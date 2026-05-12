import { useLayoutEffect, useRef, useState } from "react"

const HTML_CODE_BLOCK_PREVIEW_WIDTH_STABLE_THRESHOLD = 2

export function useHtmlCodeBlockPreviewAvailableWidth() {
	const [previewLayoutElement, setPreviewLayoutElement] = useState<HTMLDivElement | null>(null)
	const [previewAvailableWidth, setPreviewAvailableWidth] = useState(0)
	const resizeFrameRef = useRef<number | null>(null)
	const latestMeasuredWidthRef = useRef(0)
	const committedWidthRef = useRef(0)

	useLayoutEffect(() => {
		if (!previewLayoutElement || typeof ResizeObserver === "undefined") return

		const measurementElement =
			previewLayoutElement.parentElement instanceof HTMLElement
				? previewLayoutElement.parentElement
				: previewLayoutElement

		function commitPreviewAvailableWidth(nextWidth: number) {
			if (!nextWidth) return

			const normalizedWidth = Math.round(nextWidth)
			committedWidthRef.current = normalizedWidth
			setPreviewAvailableWidth((previousWidth) =>
				Math.abs(previousWidth - normalizedWidth) <
				HTML_CODE_BLOCK_PREVIEW_WIDTH_STABLE_THRESHOLD
					? previousWidth
					: normalizedWidth,
			)
		}

		function schedulePreviewAvailableWidthUpdate(nextWidth: number) {
			latestMeasuredWidthRef.current = nextWidth

			// 首次拿到有效宽度时立即提交，避免首屏先用默认宽度再跳一下。
			if (committedWidthRef.current === 0) {
				commitPreviewAvailableWidth(nextWidth)
				return
			}

			// 宽度观测在流式预览里会非常频繁，这里合并到一帧内提交，避免手机卡片宽度来回抖动。
			if (resizeFrameRef.current !== null) return

			resizeFrameRef.current = window.requestAnimationFrame(() => {
				resizeFrameRef.current = null
				commitPreviewAvailableWidth(latestMeasuredWidthRef.current)
			})
		}

		schedulePreviewAvailableWidthUpdate(measurementElement.clientWidth)

		const resizeObserver = new ResizeObserver((entries) => {
			schedulePreviewAvailableWidthUpdate(
				entries[0]?.contentRect.width ?? measurementElement.clientWidth,
			)
		})

		resizeObserver.observe(measurementElement)

		return () => {
			if (resizeFrameRef.current !== null) {
				window.cancelAnimationFrame(resizeFrameRef.current)
				resizeFrameRef.current = null
			}
			resizeObserver.disconnect()
		}
	}, [previewLayoutElement])

	return {
		setPreviewLayoutElement,
		previewAvailableWidth,
	}
}
