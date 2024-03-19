import { Document, Page } from "react-pdf"
import { useTranslation } from "react-i18next"
import { useEffect, useMemo, useState } from "react"
import type { FC } from "react"
import MagicSpin from "@/opensource/components/base/MagicSpin"

interface PageDimensions {
	width: number
	height: number
}

interface PdfViewerProps {
	file?: string | File | null
	reloadKey: number
	numPages: number
	pageNumber: number
	scale: number
	rotation: number
	isAutoScaling: boolean
	pageDimensions: PageDimensions
	onDocumentLoadSuccess: (pdf: unknown) => void
	onDocumentLoadError: (err: Error) => void
	onPageLoadSuccess: () => void
	onPageLoadError: (err: Error) => void
	onFirstPageLoadSuccess?: () => void
	styles: Record<string, string>
}

function PdfViewer({
	file,
	reloadKey,
	numPages,
	pageNumber,
	scale,
	rotation,
	isAutoScaling,
	pageDimensions,
	onDocumentLoadSuccess,
	onDocumentLoadError,
	onPageLoadSuccess,
	onPageLoadError,
	onFirstPageLoadSuccess,
	styles,
}: PdfViewerProps): JSX.Element {
	const { t } = useTranslation("component")
	const [loadProgress, setLoadProgress] = useState(0)

	useEffect(() => {
		setLoadProgress(0)
	}, [reloadKey])

	// Memoize PDF.js options to prevent unnecessary reloads
	const pdfOptions = useMemo(
		() => ({
			cMapUrl: "/packages/pdfjs/cmaps/",
			cMapPacked: true,
			standardFontDataUrl: "/packages/pdfjs/",
		}),
		[],
	)

	// Handle loading progress
	const handleLoadProgress = ({ loaded, total }: { loaded: number; total: number }) => {
		if (total > 0) {
			const progress = Math.round((loaded / total) * 100)
			setLoadProgress(progress)
		}
	}

	// Handle page load success with first page detection
	const handlePageLoadSuccess = (pageNum: number) => {
		onPageLoadSuccess()
		// Trigger auto scale when first page loads
		if (pageNum === 1 && onFirstPageLoadSuccess) {
			onFirstPageLoadSuccess()
		}
	}

	// Safe error handler that catches null reference errors
	const handlePageLoadError = (err: Error) => {
		// Ignore errors related to destroyed PDF worker (component unmounted)
		if (err.message?.includes("sendWithPromise") || err.message?.includes("Destroyed")) {
			return
		}
		onPageLoadError(err)
	}

	if (!file) {
		return (
			<div className={styles.error}>
				<h3 className="error-title">{t("magicPdfRender.status.noFile")}</h3>
				<div className="error-message">{t("magicPdfRender.placeholders.scrollToLoad")}</div>
			</div>
		)
	}

	return (
		<Document
			file={file}
			// 每次 reloadKey 变化时，重新渲染 Document 组件
			key={`pdf-${reloadKey}`}
			onLoadSuccess={onDocumentLoadSuccess}
			onLoadError={onDocumentLoadError}
			onLoadProgress={handleLoadProgress}
			options={pdfOptions}
			loading={
				<div className={styles.loading}>
					<div className="loading-content">
						<MagicSpin spinning size="large" />
						<div className="loading-text">{t("magicPdfRender.status.loading")}</div>
						<div className="loading-description">
							{`${t("magicPdfRender.status.loadingProgress")} ${loadProgress}%`}
						</div>
					</div>
				</div>
			}
		>
			{numPages > 0 && (
				<div
					className={styles.pagesContainer}
					style={{
						opacity: isAutoScaling ? 0.7 : 1,
						transition: "opacity 0.2s ease-in-out",
					}}
				>
					{Array.from(new Array(numPages), (_, index) => {
						const currentPageNum = index + 1
						const shouldLoad = Math.abs(currentPageNum - pageNumber) <= 2

						return (
							<div
								key={currentPageNum}
								className={`${styles.pageContainer} ${
									pageNumber === currentPageNum ? styles.currentPage : ""
								}`}
								data-page-number={currentPageNum}
							>
								{shouldLoad ? (
									<Page
										key={`${currentPageNum}-${scale}-${rotation}`}
										pageNumber={currentPageNum}
										scale={scale}
										rotate={rotation}
										onLoadSuccess={() => handlePageLoadSuccess(currentPageNum)}
										onLoadError={handlePageLoadError}
										error={
											<div className={styles.error}>
												<h3 className="error-title">
													{t("magicPdfRender.status.pageLoadFailed")}
												</h3>
												<div className="error-message">
													{t("magicPdfRender.placeholders.pageNumber", {
														number: currentPageNum,
													})}
												</div>
											</div>
										}
									/>
								) : (
									<div
										className={styles.pagePlaceholder}
										style={{
											width: pageDimensions.width,
											height: pageDimensions.height,
										}}
									>
										<div className="page-number">
											{t("magicPdfRender.placeholders.pageNumber", {
												number: currentPageNum,
											})}
										</div>
										<div className="page-hint">
											{t("magicPdfRender.placeholders.scrollToLoad")}
										</div>
									</div>
								)}
							</div>
						)
					})}
				</div>
			)}
		</Document>
	)
}

export default PdfViewer as FC<PdfViewerProps>
