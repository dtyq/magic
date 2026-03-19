import { Space, Tooltip } from "antd"
import { useTranslation } from "react-i18next"
import { IconMaximize, IconDownload, IconRefresh } from "@tabler/icons-react"
import type { FC } from "react"

// Types
import type { ToolbarProps } from "../../types"

// Components
import NavigationControls from "../NavigationControls"
import ZoomControls from "../ZoomControls"
import ActionDropdown from "../ActionDropdown"

function Toolbar({
	scale,
	minScale,
	maxScale,
	scaleStep,
	currentSection,
	totalSections,
	isCompactMode,
	zoomIn,
	zoomOut,
	setZoomScale,
	reload,
	downloadFile,
	toggleFullscreen,
	goToSection,
	goToPrevSection,
	goToNextSection,
	styles,
	showDownload = true,
	showFullscreen = true,
	showReload = true,
}: ToolbarProps): JSX.Element {
	const { t } = useTranslation("component")

	return (
		<div className={styles.toolbar}>
			<div className={styles.toolbarLeft}>
				<NavigationControls
					currentSection={currentSection}
					totalSections={totalSections}
					goToPrevSection={goToPrevSection}
					goToNextSection={goToNextSection}
					goToSection={goToSection}
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
						{showReload && (
							<Tooltip title={t("magicDocxRender.toolbar.reload")}>
								<button className={styles.button} onClick={reload}>
									<IconRefresh />
								</button>
							</Tooltip>
						)}
						{showDownload && (
							<Tooltip title={t("magicDocxRender.toolbar.download")}>
								<button className={styles.button} onClick={downloadFile}>
									<IconDownload />
								</button>
							</Tooltip>
						)}
						{showFullscreen && (
							<Tooltip title={t("magicDocxRender.toolbar.fullscreen")}>
								<button className={styles.button} onClick={toggleFullscreen}>
									<IconMaximize />
								</button>
							</Tooltip>
						)}
					</Space>
				) : (
					/* Compact mode: display section info + dropdown */
					<Space className={styles.buttonGroup}>
						<div className={styles.pageInfo}>
							<span>
								{currentSection} / {totalSections}
							</span>
						</div>
						<ActionDropdown
							scale={scale}
							minScale={minScale}
							maxScale={maxScale}
							scaleStep={scaleStep}
							currentSection={currentSection}
							totalSections={totalSections}
							goToSection={goToSection}
							zoomIn={zoomIn}
							zoomOut={zoomOut}
							setZoomScale={setZoomScale}
							reload={reload}
							downloadFile={downloadFile}
							toggleFullscreen={toggleFullscreen}
							styles={styles}
							showDownload={showDownload}
							showFullscreen={showFullscreen}
							showReload={showReload}
						/>
					</Space>
				)}
			</div>
		</div>
	)
}

export default Toolbar as FC<ToolbarProps>
