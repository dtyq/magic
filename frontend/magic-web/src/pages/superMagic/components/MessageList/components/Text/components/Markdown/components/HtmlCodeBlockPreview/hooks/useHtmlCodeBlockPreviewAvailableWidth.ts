import { useLayoutEffect, useState } from "react"

export function useHtmlCodeBlockPreviewAvailableWidth() {
	const [previewLayoutElement, setPreviewLayoutElement] = useState<HTMLDivElement | null>(null)
	const [previewAvailableWidth, setPreviewAvailableWidth] = useState(0)

	useLayoutEffect(() => {
		if (!previewLayoutElement || typeof ResizeObserver === "undefined") return

		const measurementElement =
			previewLayoutElement.parentElement instanceof HTMLDivElement
				? previewLayoutElement.parentElement
				: previewLayoutElement

		function updatePreviewAvailableWidth(nextWidth: number) {
			if (!nextWidth) return

			setPreviewAvailableWidth((previousWidth) =>
				Math.abs(previousWidth - nextWidth) < 1 ? previousWidth : nextWidth,
			)
		}

		updatePreviewAvailableWidth(measurementElement.clientWidth)

		const resizeObserver = new ResizeObserver((entries) => {
			updatePreviewAvailableWidth(
				entries[0]?.contentRect.width ?? measurementElement.clientWidth,
			)
		})

		resizeObserver.observe(measurementElement)

		return () => {
			resizeObserver.disconnect()
		}
	}, [previewLayoutElement])

	return {
		setPreviewLayoutElement,
		previewAvailableWidth,
	}
}
