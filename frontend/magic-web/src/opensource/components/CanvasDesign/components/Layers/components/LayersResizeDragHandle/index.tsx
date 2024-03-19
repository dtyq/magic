import classNames from "classnames"
import styles from "./index.module.css"
import { useEffect, useRef, useState } from "react"
import { useLayersUI } from "../../../../context/LayersUIContext"

export default function LayersResizeDragHandle() {
	const { collapsed, width, resizing, handleResizeStart, isMobile } = useLayersUI()

	const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
	const [visible, setVisible] = useState(false)

	useEffect(() => {
		if (collapsed) {
			setVisible(false)
			if (timer.current) clearTimeout(timer.current)
		} else {
			timer.current = setTimeout(() => {
				setVisible(true)
			}, 300)
		}
	}, [collapsed])

	// 移动端隐藏拖拽手柄
	if (isMobile) {
		return null
	}

	return (
		<div
			className={classNames(
				styles.layersResizeDragHandleContainer,
				resizing && styles.resizing,
				visible && styles.visible,
			)}
			style={{ left: width + 8 }}
			onMouseDown={handleResizeStart}
			data-canvas-ui-component
		>
			<div className={styles.layersResizeDragHandle}>
				<div className={styles.layersResizeDragHandleLine} />
				<div className={styles.layersResizeDragHandleLine} />
			</div>
		</div>
	)
}
