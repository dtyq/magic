import { useRef } from "react"
import { pdfjs } from "react-pdf"
import { useTranslation } from "react-i18next"
import type { FC } from "react"
import type { MagicPdfRenderProps } from "./types"
import { useStyles } from "./styles"

// Import react-pdf styles
import "react-pdf/dist/esm/Page/AnnotationLayer.css"
import "react-pdf/dist/esm/Page/TextLayer.css"

// Import custom hooks
import { usePdfState } from "./hooks/usePdfState"
import { usePdfActions } from "./hooks/usePdfActions"
import { useKeyboardControls } from "./hooks/useKeyboardControls"
import { useContainerSize } from "./hooks/useContainerSize"
import { useScrollListener } from "./hooks/useScrollListener"

// Import components
import Toolbar from "./components/Toolbar"
import PdfViewer from "./components/PdfViewer"

pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`

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
	onLoadError,
	onLoadSuccess,
}: MagicPdfRenderProps): JSX.Element {
	const { styles } = useStyles()
	const { t } = useTranslation("component")
	const containerRef = useRef<HTMLDivElement>(null)
	const viewerRef = useRef<HTMLDivElement>(null)

	// Custom hooks for state management
	const pdfState = usePdfState({ initialScale, file })
	const { isCompactMode } = useContainerSize({ containerRef })

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
		viewerRef,
		containerRef,
	})

	// Enhanced event handlers with external callback support
	const handleDocumentLoadSuccess = (pdf: any) => {
		pdfActions.onDocumentLoadSuccess(pdf)
		onLoadSuccess?.(pdf)
	}

	const handleDocumentLoadError = (err: Error) => {
		pdfActions.onDocumentLoadError(err)
		onLoadError?.(err)
	}

	// Custom hooks for side effects
	useScrollListener({
		viewerRef,
		numPages: pdfState.numPages,
		pageNumber: pdfState.pageNumber,
		setPageNumber: pdfState.setPageNumber,
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
						<div>{pdfState.error}</div>
						<button className={styles.textButton} onClick={pdfActions.reload}>
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
					onDocumentLoadSuccess={handleDocumentLoadSuccess}
					onDocumentLoadError={handleDocumentLoadError}
					onPageLoadSuccess={pdfActions.onPageLoadSuccess}
					onPageLoadError={pdfActions.onPageLoadError}
					styles={styles}
				/>
			</div>
		</div>
	)
}

export default MagicPdfRender as FC<MagicPdfRenderProps>
export type { MagicPdfRenderProps } from "./types"
