import { useCallback, useState, useEffect } from "react"
import { InputNumber, Space, Tooltip } from "antd"
import { useTranslation } from "react-i18next"
import { IconZoomIn, IconZoomOut } from "@tabler/icons-react"
import type { FC } from "react"
import { createStyles } from "antd-style"

// Types
import type { ZoomControlsProps } from "../../types"

const useStyles = createStyles(({ css, prefixCls }) => ({
	zoomInputNumber: css`
		width: 70px;
		height: 32px;
		line-height: 32px;
		text-align: center;

		& .${prefixCls}-input-number-input {
			text-align: center;
		}
	`,
}))

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
	const { styles: zoomInputNumberStyle } = useStyles()
	const { t } = useTranslation("component")
	const [inputValue, setInputValue] = useState<number>(Math.round(scale * 100))

	// Handle input change
	const handleInputChange = useCallback((value: number | null) => {
		if (value !== null) {
			setInputValue(value)
		}
	}, [])

	// Handle input enter or blur
	const handleInputSubmit = useCallback(() => {
		const targetScale = Math.round(scale * 100)
		if (inputValue !== targetScale) {
			setZoomScale(inputValue)
		}
	}, [inputValue, scale, setZoomScale])

	// Update input value when scale changes
	useEffect(() => {
		setInputValue(Math.round(scale * 100))
	}, [scale])

	const canZoomIn = scale < maxScale
	const canZoomOut = scale > minScale

	return (
		<Space className={styles.zoomControls}>
			<Tooltip title={t("magicDocxRender.zoom.zoomOut")}>
				<button className={styles.button} onClick={zoomOut} disabled={!canZoomOut}>
					<IconZoomOut />
				</button>
			</Tooltip>

			<div className={styles.zoomInput}>
				<InputNumber
					size="small"
					min={minScale * 100}
					max={maxScale * 100}
					value={inputValue}
					onChange={handleInputChange}
					onPressEnter={handleInputSubmit}
					onBlur={handleInputSubmit}
					controls={false}
					className={zoomInputNumberStyle.zoomInputNumber}
					formatter={(value) => `${value}%`}
					parser={(value) => Number(value?.replace("%", "") || "0")}
				/>
			</div>

			<Tooltip title={t("magicDocxRender.zoom.zoomIn")}>
				<button className={styles.button} onClick={zoomIn} disabled={!canZoomIn}>
					<IconZoomIn />
				</button>
			</Tooltip>
		</Space>
	)
}

export default ZoomControls as FC<ZoomControlsProps>
