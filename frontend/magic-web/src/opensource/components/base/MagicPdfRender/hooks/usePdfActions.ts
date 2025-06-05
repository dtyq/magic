import { useCallback, useRef } from "react"
import { message } from "antd"
import { useTranslation } from "react-i18next"

interface UsePdfActionsProps {
	// State values
	numPages: number
	pageNumber: number
	scale: number
	minScale: number
	maxScale: number
	scaleStep: number
	initialScale: number
	file?: string | File | null

	// State setters
	setPageNumber: (page: number) => void
	setScale: (scale: number | ((prev: number) => number)) => void
	setRotation: (rotation: number | ((prev: number) => number)) => void
	setLoading: (loading: boolean) => void
	setError: (error: string) => void
	setNumPages: (numPages: number) => void
	setReloadKey: (key: number | ((prev: number) => number)) => void

	// Refs
	viewerRef: React.RefObject<HTMLDivElement>
	containerRef: React.RefObject<HTMLDivElement>
}

export function usePdfActions({
	numPages,
	pageNumber,
	scale,
	minScale,
	maxScale,
	scaleStep,
	initialScale,
	file,
	setPageNumber,
	setScale,
	setRotation,
	setLoading,
	setError,
	setNumPages,
	setReloadKey,
	viewerRef,
	containerRef,
}: UsePdfActionsProps) {
	const { t } = useTranslation("component")

	// Navigate to specific page
	const goToPage = useCallback(
		(page: number | null) => {
			if (page && page >= 1 && page <= numPages) {
				setPageNumber(page)
				// Scroll to specific page
				const pageElement = viewerRef.current?.querySelector(`[data-page-number="${page}"]`)
				if (pageElement) {
					pageElement.scrollIntoView({ behavior: "smooth", block: "center" })
				}
			}
		},
		[numPages, setPageNumber, viewerRef],
	)

	// Go to previous page
	const goToPrevPage = useCallback(() => {
		const newPage = Math.max(1, pageNumber - 1)
		goToPage(newPage)
	}, [pageNumber, goToPage])

	// Go to next page
	const goToNextPage = useCallback(() => {
		const newPage = Math.min(numPages, pageNumber + 1)
		goToPage(newPage)
	}, [numPages, pageNumber, goToPage])

	// Zoom in
	const zoomIn = useCallback(() => {
		setScale((prev) => Math.min(maxScale, prev + scaleStep))
	}, [maxScale, scaleStep, setScale])

	// Zoom out
	const zoomOut = useCallback(() => {
		setScale((prev) => Math.max(minScale, prev - scaleStep))
	}, [minScale, scaleStep, setScale])

	// Reset zoom to initial scale
	const resetZoom = useCallback(() => {
		setScale(initialScale)
	}, [initialScale, setScale])

	// Set zoom scale
	const setZoomScale = useCallback(
		(newScale: number | null) => {
			if (newScale && newScale >= minScale * 100 && newScale <= maxScale * 100) {
				setScale(newScale / 100)
			}
		},
		[minScale, maxScale, setScale],
	)

	// Rotate 90 degrees clockwise
	const rotateRight = useCallback(() => {
		setRotation((prev) => (prev + 90) % 360)
	}, [setRotation])

	// Rotate 90 degrees counterclockwise
	const rotateLeft = useCallback(() => {
		setRotation((prev) => (prev - 90 + 360) % 360)
	}, [setRotation])

	// Reload PDF document
	const reload = useCallback(() => {
		setLoading(true)
		setError("")
		setPageNumber(1)
		setScale(initialScale)
		setRotation(0)
		setNumPages(0)
		setReloadKey((prev) => prev + 1) // Force re-render Document component
	}, [
		initialScale,
		setLoading,
		setError,
		setPageNumber,
		setScale,
		setRotation,
		setNumPages,
		setReloadKey,
	])

	// Download PDF
	const downloadPdf = useCallback(() => {
		if (typeof file === "string") {
			const link = document.createElement("a")
			link.href = file
			link.download = "document.pdf"
			link.click()
		} else if (file instanceof File) {
			const url = URL.createObjectURL(file)
			const link = document.createElement("a")
			link.href = url
			link.download = file.name
			link.click()
			URL.revokeObjectURL(url)
		} else {
			message.warning(t("magicPdfRender.status.downloadUnavailable"))
		}
	}, [file, t])

	// Toggle fullscreen
	const toggleFullscreen = useCallback(() => {
		if (containerRef.current) {
			if (document.fullscreenElement) {
				document.exitFullscreen()
			} else {
				containerRef.current.requestFullscreen()
			}
		}
	}, [containerRef])

	// Handle document load success
	const onDocumentLoadSuccess = useCallback(
		(pdf: any) => {
			console.log("PDF document loaded successfully:", pdf)
			setNumPages(pdf.numPages)
			setPageNumber(1)
			setLoading(false)
			setError("")
		},
		[setNumPages, setPageNumber, setLoading, setError],
	)

	// Handle document load error
	const onDocumentLoadError = useCallback(
		(err: Error) => {
			console.error("PDF document load failed:", err)
			setLoading(false)
			setError(err.message || t("magicPdfRender.status.loadFailed"))
		},
		[setLoading, setError, t],
	)

	// Handle page load success
	const onPageLoadSuccess = useCallback(() => {
		setLoading(false)
	}, [setLoading])

	// Handle page load error
	const onPageLoadError = useCallback(
		(err: Error) => {
			setLoading(false)
			console.error("Page load failed:", err)
		},
		[setLoading],
	)

	return {
		// Navigation actions
		goToPage,
		goToPrevPage,
		goToNextPage,

		// Zoom actions
		zoomIn,
		zoomOut,
		resetZoom,
		setZoomScale,

		// Rotation actions
		rotateRight,
		rotateLeft,

		// Document actions
		reload,
		downloadPdf,
		toggleFullscreen,

		// Event handlers
		onDocumentLoadSuccess,
		onDocumentLoadError,
		onPageLoadSuccess,
		onPageLoadError,
	}
}
