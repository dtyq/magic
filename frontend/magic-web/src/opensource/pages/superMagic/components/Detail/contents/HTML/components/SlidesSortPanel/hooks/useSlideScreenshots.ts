import { useState, useEffect } from "react"
import { snapdom } from "@zumer/snapdom"
import type { SortableSlide } from "../types"

interface UseSlideScreenshotsOptions {
	slides: SortableSlide[]
	enabled?: boolean
}

interface SlideScreenshot {
	index: number
	thumbnailUrl: string
	isLoading: boolean
	error?: Error
}

/**
 * Hook to generate screenshots for slides using snapDOM
 * Converts HTML content to images for lightweight thumbnail rendering
 */
export function useSlideScreenshots({ slides, enabled = true }: UseSlideScreenshotsOptions) {
	const [screenshots, setScreenshots] = useState<Map<number, SlideScreenshot>>(new Map())
	const [isGenerating, setIsGenerating] = useState(false)

	useEffect(() => {
		if (!enabled || slides.length === 0) return

		const generateScreenshots = async () => {
			setIsGenerating(true)

			// Initialize loading state for all slides
			const initialScreenshots = new Map<number, SlideScreenshot>()
			slides.forEach((slide) => {
				initialScreenshots.set(slide.index, {
					index: slide.index,
					thumbnailUrl: "",
					isLoading: true,
				})
			})
			setScreenshots(initialScreenshots)

			// Generate screenshots for each slide sequentially to avoid performance issues
			for (const slide of slides) {
				if (!slide.content) continue

				try {
					// Create temporary container for rendering
					const container = document.createElement("div")
					container.style.cssText = `
						position: fixed;
						top: -9999px;
						left: -9999px;
						width: 1920px;
						height: 1080px;
						visibility: hidden;
						pointer-events: none;
					`
					document.body.appendChild(container)

					// Create iframe for isolated rendering
					const iframe = document.createElement("iframe")
					iframe.style.cssText = "width: 100%; height: 100%; border: none;"
					container.appendChild(iframe)

					// Wait for iframe to load
					await new Promise((resolve) => {
						iframe.onload = resolve
						// Set content after attaching onload
						if (iframe.contentDocument) {
							iframe.contentDocument.open()
							iframe.contentDocument.write(slide.content || "")
							iframe.contentDocument.close()
						}
					})

					// Wait a bit for content to render
					await new Promise((resolve) => setTimeout(resolve, 300))

					// Capture screenshot using snapDOM
					const iframeBody = iframe.contentDocument?.body
					if (iframeBody) {
						const result = await snapdom(iframeBody, {
							width: 1920,
							height: 1080,
							backgroundColor: "#ffffff",
						})

						const blob = await result.toBlob()
						const thumbnailUrl = URL.createObjectURL(blob)

						// Update screenshot state
						setScreenshots((prev) => {
							const next = new Map(prev)
							next.set(slide.index, {
								index: slide.index,
								thumbnailUrl,
								isLoading: false,
							})
							return next
						})
					}

					// Cleanup temporary container
					document.body.removeChild(container)
				} catch (error) {
					console.error(`Failed to generate screenshot for slide ${slide.index}:`, error)

					// Update error state
					setScreenshots((prev) => {
						const next = new Map(prev)
						next.set(slide.index, {
							index: slide.index,
							thumbnailUrl: "",
							isLoading: false,
							error: error instanceof Error ? error : new Error("Unknown error"),
						})
						return next
					})
				}
			}

			setIsGenerating(false)
		}

		generateScreenshots()

		// Cleanup: revoke all object URLs when component unmounts or when slides change
		return () => {
			// Create a snapshot of current screenshots for cleanup
			const currentScreenshots = new Map(screenshots)
			currentScreenshots.forEach((screenshot) => {
				if (screenshot.thumbnailUrl) {
					URL.revokeObjectURL(screenshot.thumbnailUrl)
				}
			})
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [slides, enabled])

	return {
		screenshots,
		isGenerating,
		getScreenshot: (index: number) => screenshots.get(index),
	}
}
