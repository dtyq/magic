import { useRef, useEffect } from "react"
import { useTranslation } from "react-i18next"
import type { FC } from "react"
import type { MagicPdfRenderProps } from "./types"
import { useStyles } from "./styles"
import { loadReactPdf } from "@/opensource/lib/react-pdf"

// Import react-pdf styles
import "react-pdf/dist/esm/Page/AnnotationLayer.css"
import "react-pdf/dist/esm/Page/TextLayer.css"

// Import custom hooks
import { usePdfState } from "./hooks/usePdfState"
import { usePdfActions } from "./hooks/usePdfActions"
import { useKeyboardControls } from "./hooks/useKeyboardControls"
import { useContainerSize } from "./hooks/useContainerSize"
import { useScrollListener } from "./hooks/useScrollListener"
import { useAutoScale } from "./hooks/useAutoScale"
import { useTouchGestures } from "./hooks/useTouchGestures"
import { usePageDimensions } from "./hooks/usePageDimensions"

// Import components
import Toolbar from "./components/Toolbar"
import PdfViewer from "./components/PdfViewer"

function MagicPdfRender({
	file,
	showToolbar = true,
	initialScale = 1.0,
	minScale = 0.5,
	maxScale = 3.0,
	scaleStep = 0.1,
	height = "600px",
	width = "100%",
	enableKeyboard = true,
	autoScale = true,
	enableTouchGestures = true,
	onLoadError,
	onLoadSuccess,
}: MagicPdfRenderProps): JSX.Element {
	const { styles } = useStyles()
	const { t } = useTranslation("component")
	const containerRef = useRef<HTMLDivElement>(null)
	const viewerRef = useRef<HTMLDivElement>(null)

	// 按需加载 react-pdf 并初始化 worker
	useEffect(() => {
		loadReactPdf().catch((error) => {
			console.error("Failed to load react-pdf:", error)
		})
	}, [])

	// Custom hooks for state management
	const pdfState = usePdfState({ initialScale, file })
	const { isCompactMode } = useContainerSize({ containerRef })
	const pageDimensions = usePageDimensions({
		viewerRef,
		scale: pdfState.scale,
		numPages: pdfState.numPages,
	})

	// Custom hook for auto scaling
	const { applyAutoScale, resetAutoScale } = useAutoScale({
		containerRef,
		viewerRef,
		minScale,
		maxScale,
		setScale: pdfState.setScale,
		setIsAutoScaling: pdfState.setIsAutoScaling,
		setIsStabilizing: pdfState.setIsStabilizing,
		showToolbar,
	})

	// Custom hook for PDF actions
	const pdfActions = usePdfActions({
		numPages: pdfState.numPages,
		pageNumber: pdfState.pageNumber,
		scale: pdfState.scale,
		minScale,
		maxScale,
		scaleStep,
		initialScale,
		file,
		setPageNumber: pdfState.setPageNumber,
		setScale: pdfState.setScale,
		setRotation: pdfState.setRotation,
		setLoading: pdfState.setLoading,
		setError: pdfState.setError,
		setNumPages: pdfState.setNumPages,
		setReloadKey: pdfState.setReloadKey,
		setIsStabilizing: pdfState.setIsStabilizing,
		viewerRef,
		containerRef,
	})

	// Enhanced event handlers with external callback support
	const handleDocumentLoadSuccess = (pdf: any) => {
		pdfActions.onDocumentLoadSuccess(pdf)
		resetAutoScale() // Reset auto scale flag for new document
		onLoadSuccess?.(pdf)
	}

	const handleDocumentLoadError = (err: Error) => {
		pdfActions.onDocumentLoadError(err)
		onLoadError?.(err)
	}

	// Handle first page load success for auto scaling
	const handleFirstPageLoadSuccess = () => {
		if (autoScale) {
			applyAutoScale()
		}
	}

	// Custom hook for touch gestures (mobile pinch-to-zoom)
	const { isGesturing, isScaling } = useTouchGestures({
		scale: pdfState.scale,
		setScale: pdfState.setScale,
		minScale,
		maxScale,
		enabled: enableTouchGestures,
		viewerRef,
		setIsStabilizing: pdfState.setIsStabilizing,
	})

	// Custom hooks for side effects
	useScrollListener({
		viewerRef,
		numPages: pdfState.numPages,
		pageNumber: pdfState.pageNumber,
		setPageNumber: pdfState.setPageNumber,
		disabled: isGesturing, // Disable scroll listener during touch gestures
		isScaling: pdfState.isAutoScaling || isScaling, // Also disable during scaling operations
		isStabilizing: pdfState.isStabilizing, // Disable during stabilizing period
	})

	useKeyboardControls({
		enableKeyboard,
		goToPrevPage: pdfActions.goToPrevPage,
		goToNextPage: pdfActions.goToNextPage,
		zoomIn: pdfActions.zoomIn,
		zoomOut: pdfActions.zoomOut,
		resetZoom: pdfActions.resetZoom,
		toggleFullscreen: pdfActions.toggleFullscreen,
	})

	// If no file is selected, display a message
	if (!file) {
		return (
			<div className={styles.container} style={{ height, width }}>
				<div className={styles.error}>
					<div>{t("magicPdfRender.status.noFile")}</div>
				</div>
			</div>
		)
	}

	return (
		<div ref={containerRef} className={styles.container} style={{ height, width }}>
			{showToolbar && (
				<Toolbar
					pageNumber={pdfState.pageNumber}
					numPages={pdfState.numPages}
					scale={pdfState.scale}
					minScale={minScale}
					maxScale={maxScale}
					scaleStep={scaleStep}
					isCompactMode={isCompactMode}
					goToPage={pdfActions.goToPage}
					goToPrevPage={pdfActions.goToPrevPage}
					goToNextPage={pdfActions.goToNextPage}
					zoomIn={pdfActions.zoomIn}
					zoomOut={pdfActions.zoomOut}
					setZoomScale={pdfActions.setZoomScale}
					rotateLeft={pdfActions.rotateLeft}
					rotateRight={pdfActions.rotateRight}
					reload={pdfActions.reload}
					downloadPdf={pdfActions.downloadPdf}
					toggleFullscreen={pdfActions.toggleFullscreen}
					styles={styles}
				/>
			)}

			<div ref={viewerRef} className={styles.viewer}>
				{pdfState.error && (
					<div className={styles.error}>
						<h3 className="error-title">{t("magicPdfRender.status.loadFailed")}</h3>
						<div className="error-message">{pdfState.error}</div>
						<button className={styles.retryButton} onClick={pdfActions.reload}>
							{t("magicPdfRender.status.retry")}
						</button>
					</div>
				)}

				<PdfViewer
					file={file}
					reloadKey={pdfState.reloadKey}
					numPages={pdfState.numPages}
					pageNumber={pdfState.pageNumber}
					scale={pdfState.scale}
					rotation={pdfState.rotation}
					isAutoScaling={pdfState.isAutoScaling}
					pageDimensions={pageDimensions}
					onDocumentLoadSuccess={handleDocumentLoadSuccess}
					onDocumentLoadError={handleDocumentLoadError}
					onPageLoadSuccess={pdfActions.onPageLoadSuccess}
					onPageLoadError={pdfActions.onPageLoadError}
					onFirstPageLoadSuccess={handleFirstPageLoadSuccess}
					styles={styles}
				/>
			</div>
		</div>
	)
}

export default MagicPdfRender as FC<MagicPdfRenderProps>
export type { MagicPdfRenderProps } from "./types"
