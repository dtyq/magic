import { Space, Tooltip } from "antd"
import { useTranslation } from "react-i18next"
import {
	IconMaximize,
	IconDownload,
	IconRotateClockwise2,
	IconRotate2,
	IconRefresh,
} from "@tabler/icons-react"
import type { FC } from "react"
import PageNavigation from "../PageNavigation"
import ZoomControls from "../ZoomControls"
import ActionDropdown from "../ActionDropdown"

interface ToolbarProps {
	// State values
	pageNumber: number
	numPages: number
	scale: number
	minScale: number
	maxScale: number
	scaleStep: number
	isCompactMode: boolean

	// Actions
	goToPage: (page: number | null) => void
	goToPrevPage: () => void
	goToNextPage: () => void
	zoomIn: () => void
	zoomOut: () => void
	setZoomScale: (scale: number | null) => void
	rotateLeft: () => void
	rotateRight: () => void
	reload: () => void
	downloadPdf: () => void
	toggleFullscreen: () => void

	styles: any
}

function Toolbar({
	pageNumber,
	numPages,
	scale,
	minScale,
	maxScale,
	scaleStep,
	isCompactMode,
	goToPage,
	goToPrevPage,
	goToNextPage,
	zoomIn,
	zoomOut,
	setZoomScale,
	rotateLeft,
	rotateRight,
	reload,
	downloadPdf,
	toggleFullscreen,
	styles,
}: ToolbarProps): JSX.Element {
	const { t } = useTranslation("component")

	return (
		<div className={styles.toolbar}>
			<div className={styles.toolbarLeft}>
				<PageNavigation
					pageNumber={pageNumber}
					numPages={numPages}
					goToPrevPage={goToPrevPage}
					goToNextPage={goToNextPage}
					goToPage={goToPage}
					isCompactMode={isCompactMode}
					styles={styles}
				/>
			</div>

			<div className={styles.toolbarRight}>
				{!isCompactMode ? (
					/* Wide screen mode: display detailed controls */
					<Space className={styles.buttonGroup}>
						<ZoomControls
							scale={scale}
							minScale={minScale}
							maxScale={maxScale}
							scaleStep={scaleStep}
							zoomIn={zoomIn}
							zoomOut={zoomOut}
							setZoomScale={setZoomScale}
							styles={styles}
						/>
						<span className="rotation-buttons">
							<Tooltip title={t("magicPdfRender.toolbar.rotateLeft")}>
								<button className={styles.button} onClick={rotateLeft}>
									<IconRotate2 />
								</button>
							</Tooltip>
							<Tooltip title={t("magicPdfRender.toolbar.rotateRight")}>
								<button className={styles.button} onClick={rotateRight}>
									<IconRotateClockwise2 />
								</button>
							</Tooltip>
						</span>
						<Tooltip title={t("magicPdfRender.toolbar.reload")}>
							<button className={styles.button} onClick={reload}>
								<IconRefresh />
							</button>
						</Tooltip>
						<Tooltip title={t("magicPdfRender.toolbar.download")}>
							<button className={styles.button} onClick={downloadPdf}>
								<IconDownload />
							</button>
						</Tooltip>
						<Tooltip title={t("magicPdfRender.toolbar.fullscreen")}>
							<button className={styles.button} onClick={toggleFullscreen}>
								<IconMaximize />
							</button>
						</Tooltip>
					</Space>
				) : (
					/* Compact mode: display page information + dropdown */
					<Space className={styles.buttonGroup}>
						<div className={styles.pageInfo}>
							<span>
								{pageNumber} / {numPages}
							</span>
						</div>
						<ActionDropdown
							pageNumber={pageNumber}
							numPages={numPages}
							scale={scale}
							minScale={minScale}
							maxScale={maxScale}
							scaleStep={scaleStep}
							goToPage={goToPage}
							zoomIn={zoomIn}
							zoomOut={zoomOut}
							setZoomScale={setZoomScale}
							rotateLeft={rotateLeft}
							rotateRight={rotateRight}
							reload={reload}
							downloadPdf={downloadPdf}
							toggleFullscreen={toggleFullscreen}
							styles={styles}
						/>
					</Space>
				)}
			</div>
		</div>
	)
}

export default Toolbar as FC<ToolbarProps>
