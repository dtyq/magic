import { Space, Tooltip, InputNumber } from "antd"
import { useTranslation } from "react-i18next"
import { IconZoomIn, IconZoomOut } from "@tabler/icons-react"
import type { FC } from "react"

interface ZoomControlsProps {
	scale: number
	minScale: number
	maxScale: number
	scaleStep: number
	zoomIn: () => void
	zoomOut: () => void
	setZoomScale: (scale: number | null) => void
	styles: any
}

function ZoomControls({
	scale,
	minScale,
	maxScale,
	scaleStep,
	zoomIn,
	zoomOut,
	setZoomScale,
	styles,
}: ZoomControlsProps): JSX.Element {
	const { t } = useTranslation("component")

	return (
		<Space className={styles.buttonGroup}>
			<Tooltip title={t("magicPdfRender.toolbar.zoomOut")}>
				<button className={styles.button} disabled={scale <= minScale} onClick={zoomOut}>
					<IconZoomOut />
				</button>
			</Tooltip>
			<InputNumber
				className={styles.scaleInput}
				min={minScale * 100}
				max={maxScale * 100}
				step={scaleStep * 100}
				value={Math.round(scale * 100)}
				formatter={(value) => `${value}%`}
				parser={(value) => Number(value?.replace("%", "") || "100")}
				onChange={setZoomScale}
				size="small"
				status=""
			/>
			<Tooltip title={t("magicPdfRender.toolbar.zoomIn")}>
				<button className={styles.button} disabled={scale >= maxScale} onClick={zoomIn}>
					<IconZoomIn />
				</button>
			</Tooltip>
		</Space>
	)
}

export default ZoomControls as FC<ZoomControlsProps>
