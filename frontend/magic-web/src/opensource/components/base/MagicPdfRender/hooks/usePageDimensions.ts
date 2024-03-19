import { useState, useEffect, useCallback } from "react"

interface UsePageDimensionsProps {
	viewerRef: React.RefObject<HTMLDivElement>
	scale: number
	numPages: number
}

interface PageDimensions {
	width: number
	height: number
}

export function usePageDimensions({ viewerRef, scale, numPages }: UsePageDimensionsProps) {
	const [pageDimensions, setPageDimensions] = useState<PageDimensions>({
		width: 300, // Default fallback width
		height: 400, // Default fallback height
	})

	// Calculate page dimensions based on the first loaded page
	const calculatePageDimensions = useCallback(() => {
		const viewer = viewerRef.current
		if (!viewer || numPages === 0) return

		// Try to find any loaded page to get dimensions
		const loadedPage = viewer.querySelector(".react-pdf__Page__canvas") as HTMLCanvasElement
		if (loadedPage) {
			// Get the actual rendered dimensions
			const rect = loadedPage.getBoundingClientRect()
			const newDimensions = {
				width: Math.round(rect.width),
				height: Math.round(rect.height),
			}

			// Only update if dimensions have changed significantly
			if (
				Math.abs(newDimensions.width - pageDimensions.width) > 5 ||
				Math.abs(newDimensions.height - pageDimensions.height) > 5
			) {
				setPageDimensions(newDimensions)
			}
		} else {
			// Fallback: try to get dimensions from page container
			const pageContainer = viewer.querySelector("[data-page-number]")
			if (pageContainer) {
				const rect = pageContainer.getBoundingClientRect()
				if (rect.width > 0 && rect.height > 0) {
					const newDimensions = {
						width: Math.round(rect.width),
						height: Math.round(rect.height),
					}
					setPageDimensions(newDimensions)
				}
			}
		}
	}, [viewerRef, numPages, pageDimensions.width, pageDimensions.height])

	// Update dimensions when scale changes
	useEffect(() => {
		// Use a small delay to ensure the page has been re-rendered with new scale
		const timeoutId = setTimeout(() => {
			calculatePageDimensions()
		}, 100)

		return () => clearTimeout(timeoutId)
	}, [scale, calculatePageDimensions])

	// Update dimensions when pages are loaded
	useEffect(() => {
		if (numPages > 0) {
			// Use a longer delay for initial load to ensure pages are rendered
			const timeoutId = setTimeout(() => {
				calculatePageDimensions()
			}, 300)

			return () => clearTimeout(timeoutId)
		}
	}, [numPages, calculatePageDimensions])

	// Set up a MutationObserver to watch for page loading
	useEffect(() => {
		const viewer = viewerRef.current
		if (!viewer) return

		const observer = new MutationObserver((mutations) => {
			let shouldUpdate = false

			mutations.forEach((mutation) => {
				// Check if new canvas elements were added
				if (mutation.type === "childList") {
					mutation.addedNodes.forEach((node) => {
						if (node.nodeType === Node.ELEMENT_NODE) {
							const element = node as Element
							if (
								element.querySelector?.(".react-pdf__Page__canvas") ||
								element.classList?.contains("react-pdf__Page__canvas")
							) {
								shouldUpdate = true
							}
						}
					})
				}
			})

			if (shouldUpdate) {
				// Delay to ensure the canvas is fully rendered
				setTimeout(() => {
					calculatePageDimensions()
				}, 150)
			}
		})

		observer.observe(viewer, {
			childList: true,
			subtree: true,
		})

		return () => observer.disconnect()
	}, [viewerRef, calculatePageDimensions])

	return pageDimensions
}
