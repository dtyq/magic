import { cn } from "../../../runtime/shared/lib/utils"
import styles from "./index.module.css"
import { useEffect, useRef, useState } from "react"
import { useLayersUI } from "../../../app/providers/LayersUIProvider"

export default function LayersResizeDragHandle() {
	const { collapsed, width, resizing, handleResizeStart, isCompactLayout } = useLayersUI()

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

	// 紧凑布局隐藏拖拽手柄
	if (isCompactLayout) {
		return null
	}

	return (
		<div
			className={cn(
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
