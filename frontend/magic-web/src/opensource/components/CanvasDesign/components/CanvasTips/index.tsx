import styles from "./index.module.css"
import { useCanvasUI } from "../../context/CanvasUIContext"
import ImageConvertHight from "./tips/ImageConvertHight"

export default function CanvasTips() {
	const { subElementTooltip } = useCanvasUI()

	if (!subElementTooltip) return null

	return (
		<div className={styles.canvasTips}>
			<ImageConvertHight />
		</div>
	)
}
