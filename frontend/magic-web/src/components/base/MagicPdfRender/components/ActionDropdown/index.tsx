import { useCallback, useState } from "react"
import { Dropdown, Tooltip, InputNumber } from "antd"
import { useTranslation } from "react-i18next"
import {
	IconZoomIn,
	IconZoomOut,
	IconMaximize,
	IconDownload,
	IconRotateClockwise2,
	IconRotate2,
	IconRefresh,
	IconMenu2,
} from "@tabler/icons-react"
import type { FC } from "react"

interface ActionDropdownProps {
	// State values
	pageNumber: number
	numPages: number
	scale: number
	minScale: number
	maxScale: number
	scaleStep: number

	// Actions
	goToPage: (page: number | null) => void
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

function ActionDropdown({
	pageNumber,
	numPages,
	scale,
	minScale,
	maxScale,
	scaleStep,
	goToPage,
	zoomIn,
	zoomOut,
	setZoomScale,
	rotateLeft,
	rotateRight,
	reload,
	downloadPdf,
	toggleFullscreen,
	styles,
}: ActionDropdownProps): JSX.Element {
	const { t } = useTranslation("component")
	const [dropdownOpen, setDropdownOpen] = useState<boolean>(false)

	// Create a wrapper function for actions that need to close the dropdown
	const handleDropdownAction = useCallback((action: () => void) => {
		return (e: React.MouseEvent) => {
			e.stopPropagation()
			action()
			setDropdownOpen(false)
		}
	}, [])

	// Create a wrapper function for actions that do not need to close the dropdown (e.g., input fields)
	const handleDropdownInputAction = useCallback((action: (value: any) => void) => {
		return (value: any) => {
			action(value)
			// Do not close the dropdown
		}
	}, [])

	// Event propagation stopping handler
	const handleStopPropagation = useCallback((e: React.MouseEvent) => {
		e.stopPropagation()
	}, [])

	// Create dropdown menu items
	const dropdownItems = [
		{
			key: "page-nav",
			label: (
				<div className={styles.dropdownInputItem} onClick={handleStopPropagation}>
					<span className="label">{t("magicPdfRender.dropdown.pageNav")}</span>
					<InputNumber
						min={1}
						max={numPages}
						value={pageNumber}
						onChange={handleDropdownInputAction(goToPage)}
						size="small"
						style={{ width: "80px" }}
						onClick={handleStopPropagation}
					/>
					<span style={{ marginLeft: "4px" }}>/ {numPages}</span>
				</div>
			),
		},
		{
			key: "divider0",
			type: "divider" as const,
		},
		{
			key: "zoom-out",
			label: (
				<button
					className={styles.dropdownItem}
					disabled={scale <= minScale}
					onClick={handleDropdownInputAction(zoomOut)}
				>
					<IconZoomOut />
					<span className="label">{t("magicPdfRender.dropdown.zoomOut")}</span>
					<span className="value">-</span>
				</button>
			),
		},
		{
			key: "zoom-input",
			label: (
				<div className={styles.dropdownInputItem} onClick={handleStopPropagation}>
					<span className="label">{t("magicPdfRender.dropdown.zoom")}</span>
					<InputNumber
						min={minScale * 100}
						max={maxScale * 100}
						step={scaleStep * 100}
						value={Math.round(scale * 100)}
						formatter={(value) => `${value}%`}
						parser={(value) => Number(value?.replace("%", "") || "100")}
						onChange={handleDropdownInputAction(setZoomScale)}
						size="small"
						onClick={handleStopPropagation}
					/>
				</div>
			),
		},
		{
			key: "zoom-in",
			label: (
				<button
					className={styles.dropdownItem}
					disabled={scale >= maxScale}
					onClick={handleDropdownInputAction(zoomIn)}
				>
					<IconZoomIn />
					<span className="label">{t("magicPdfRender.dropdown.zoomIn")}</span>
					<span className="value">+</span>
				</button>
			),
		},
		{
			key: "divider1",
			type: "divider" as const,
		},
		{
			key: "rotate-left",
			label: (
				<button
					className={styles.dropdownItem}
					onClick={handleDropdownInputAction(rotateLeft)}
				>
					<IconRotate2 />
					<span className="label">{t("magicPdfRender.dropdown.rotateLeft")}</span>
				</button>
			),
		},
		{
			key: "rotate-right",
			label: (
				<button
					className={styles.dropdownItem}
					onClick={handleDropdownInputAction(rotateRight)}
				>
					<IconRotateClockwise2 />
					<span className="label">{t("magicPdfRender.dropdown.rotateRight")}</span>
				</button>
			),
		},
		{
			key: "divider2",
			type: "divider" as const,
		},
		{
			key: "reload",
			label: (
				<button className={styles.dropdownItem} onClick={handleDropdownAction(reload)}>
					<IconRefresh />
					<span className="label">{t("magicPdfRender.dropdown.reload")}</span>
				</button>
			),
		},
		{
			key: "download",
			label: (
				<button className={styles.dropdownItem} onClick={handleDropdownAction(downloadPdf)}>
					<IconDownload />
					<span className="label">{t("magicPdfRender.dropdown.download")}</span>
				</button>
			),
		},
		{
			key: "fullscreen",
			label: (
				<button
					className={styles.dropdownItem}
					onClick={handleDropdownAction(toggleFullscreen)}
				>
					<IconMaximize />
					<span className="label">{t("magicPdfRender.dropdown.fullscreen")}</span>
					<span className="value">F11</span>
				</button>
			),
		},
	]

	return (
		<Dropdown
			menu={{ items: dropdownItems }}
			trigger={["click"]}
			placement="bottomRight"
			overlayClassName={styles.dropdownMenu}
			open={dropdownOpen}
			onOpenChange={setDropdownOpen}
		>
			<Tooltip title={t("magicPdfRender.toolbar.moreActions")}>
				<button className={styles.button}>
					<IconMenu2 />
				</button>
			</Tooltip>
		</Dropdown>
	)
}

export default ActionDropdown as FC<ActionDropdownProps>
