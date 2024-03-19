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
	IconChevronLeft,
	IconChevronRight,
} from "@tabler/icons-react"
import type { FC } from "react"

interface ActionDropdownProps {
	// State values
	scale: number
	minScale: number
	maxScale: number
	scaleStep: number
	currentSection: number
	totalSections: number

	// Actions
	goToSection: (section: number | null) => void
	zoomIn: () => void
	zoomOut: () => void
	setZoomScale: (scale: number | null) => void
	reload: () => void
	downloadFile: () => void
	toggleFullscreen: () => void

	styles: any
	showDownload?: boolean
	showFullscreen?: boolean
	showReload?: boolean
}

function ActionDropdown({
	scale,
	minScale,
	maxScale,
	scaleStep,
	currentSection,
	totalSections,
	goToSection,
	zoomIn,
	zoomOut,
	setZoomScale,
	reload,
	downloadFile,
	toggleFullscreen,
	styles,
	showDownload = true,
	showFullscreen = true,
	showReload = true,
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

	// Create a wrapper function for actions that do not need to close the dropdown
	const handleDropdownInputAction = useCallback((action: (value: any) => void) => {
		return (value: any) => {
			action(value)
			// Do not close the dropdown for input actions
		}
	}, [])

	// Event propagation stopping handler
	const handleStopPropagation = useCallback((e: React.MouseEvent) => {
		e.stopPropagation()
	}, [])

	const dropdownItems = [
		{
			key: "prev-section",
			label: (
				<button
					className={styles.dropdownItem}
					onClick={handleDropdownAction(() =>
						goToSection(Math.max(1, currentSection - 1)),
					)}
				>
					<IconChevronLeft />
					<span className="label">{t("magicDocxRender.dropdown.prevSection")}</span>
				</button>
			),
		},
		{
			key: "next-section",
			label: (
				<button
					className={styles.dropdownItem}
					onClick={handleDropdownAction(() =>
						goToSection(Math.min(totalSections, currentSection + 1)),
					)}
				>
					<IconChevronRight />
					<span className="label">{t("magicDocxRender.dropdown.nextSection")}</span>
				</button>
			),
		},
		{
			key: "divider1",
			type: "divider" as const,
		},
		{
			key: "zoom-in",
			label: (
				<button className={styles.dropdownItem} onClick={handleDropdownAction(zoomIn)}>
					<IconZoomIn />
					<span className="label">{t("magicDocxRender.dropdown.zoomIn")}</span>
					<span className="value">+</span>
				</button>
			),
		},
		{
			key: "zoom-out",
			label: (
				<button className={styles.dropdownItem} onClick={handleDropdownAction(zoomOut)}>
					<IconZoomOut />
					<span className="label">{t("magicDocxRender.dropdown.zoomOut")}</span>
					<span className="value">-</span>
				</button>
			),
		},
		{
			key: "zoom-scale",
			label: (
				<div className={styles.dropdownInputItem} onClick={handleStopPropagation}>
					<span className="label">{t("magicDocxRender.dropdown.zoomScale")}</span>
					<InputNumber
						size="small"
						min={minScale * 100}
						max={maxScale * 100}
						value={Math.round(scale * 100)}
						onChange={handleDropdownInputAction(setZoomScale)}
						controls={false}
						style={{ width: 70 }}
						formatter={(value) => `${value}%`}
						parser={(value) => Number(value?.replace("%", "") || "0")}
					/>
				</div>
			),
		},
		...(showReload || showDownload || showFullscreen
			? [
					{
						key: "divider2",
						type: "divider" as const,
					},
				]
			: []),
		...(showReload
			? [
					{
						key: "reload",
						label: (
							<button
								className={styles.dropdownItem}
								onClick={handleDropdownAction(reload)}
							>
								<IconRefresh />
								<span className="label">
									{t("magicDocxRender.dropdown.reload")}
								</span>
							</button>
						),
					},
				]
			: []),
		...(showDownload
			? [
					{
						key: "download",
						label: (
							<button
								className={styles.dropdownItem}
								onClick={handleDropdownAction(downloadFile)}
							>
								<IconDownload />
								<span className="label">
									{t("magicDocxRender.dropdown.download")}
								</span>
							</button>
						),
					},
				]
			: []),
		...(showFullscreen
			? [
					{
						key: "fullscreen",
						label: (
							<button
								className={styles.dropdownItem}
								onClick={handleDropdownAction(toggleFullscreen)}
							>
								<IconMaximize />
								<span className="label">
									{t("magicDocxRender.dropdown.fullscreen")}
								</span>
								<span className="value">F11</span>
							</button>
						),
					},
				]
			: []),
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
			<Tooltip title={t("magicDocxRender.toolbar.moreActions")}>
				<button className={styles.button}>
					<IconMenu2 />
				</button>
			</Tooltip>
		</Dropdown>
	)
}

export default ActionDropdown as FC<ActionDropdownProps>
