import { Document, Page } from "react-pdf"
import { useTranslation } from "react-i18next"
import type { FC } from "react"

interface PdfViewerProps {
	file?: string | File | null
	reloadKey: number
	numPages: number
	pageNumber: number
	scale: number
	rotation: number
	onDocumentLoadSuccess: (pdf: any) => void
	onDocumentLoadError: (err: Error) => void
	onPageLoadSuccess: () => void
	onPageLoadError: (err: Error) => void
	styles: any
}

function PdfViewer({
	file,
	reloadKey,
	numPages,
	pageNumber,
	scale,
	rotation,
	onDocumentLoadSuccess,
	onDocumentLoadError,
	onPageLoadSuccess,
	onPageLoadError,
	styles,
}: PdfViewerProps): JSX.Element {
	const { t } = useTranslation("component")

	if (!file) {
		return (
			<div className={styles.error}>
				<div>{t("magicPdfRender.status.noFile")}</div>
			</div>
		)
	}

	return (
		<Document
			key={`pdf-${reloadKey}`}
			file={file}
			onLoadSuccess={onDocumentLoadSuccess}
			onLoadError={onDocumentLoadError}
			loading={<div className={styles.loading}>{t("magicPdfRender.status.loading")}</div>}
			error={<div className={styles.error}>{t("magicPdfRender.status.loadFailed")}</div>}
		>
			{numPages > 0 && (
				<div className={styles.pagesContainer}>
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
										onLoadSuccess={onPageLoadSuccess}
										onLoadError={onPageLoadError}
										error={
											<div className={styles.error}>
												{t("magicPdfRender.status.pageLoadFailed")}
											</div>
										}
									/>
								) : (
									<div className={styles.pagePlaceholder}>
										<div>
											{t("magicPdfRender.placeholders.pageNumber", {
												number: currentPageNum,
											})}
										</div>
										<div>{t("magicPdfRender.placeholders.scrollToLoad")}</div>
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
