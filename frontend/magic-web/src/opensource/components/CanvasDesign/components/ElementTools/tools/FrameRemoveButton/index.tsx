import IconButton from "../../../ui/custom/IconButton/index"
import styles from "./index.module.css"
import { FrameDotted } from "../../../ui/icons/index"
import { useCanvas } from "../../../../context/CanvasContext"

export default function FrameRemoveButton() {
	const { canvas } = useCanvas()

	const handleRemoveFrame = () => {
		if (!canvas) {
			return
		}

		// 使用 UserActionRegistry 执行画框移除
		canvas.userActionRegistry.execute("frame.remove")
	}

	return (
		<IconButton onClick={handleRemoveFrame} className={styles.frameRemoveButton}>
			<FrameDotted size={16} />
			<span className={styles.buttonText}>解除画框</span>
		</IconButton>
	)
}
