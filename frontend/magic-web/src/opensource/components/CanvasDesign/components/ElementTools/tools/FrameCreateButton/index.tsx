import IconButton from "../../../ui/custom/IconButton/index"
import styles from "./index.module.css"
import { Frame } from "../../../ui/icons/index"
import { useCanvas } from "../../../../context/CanvasContext"

export default function FrameCreateButton() {
	const { canvas } = useCanvas()

	const handleCreateFrame = () => {
		if (!canvas) {
			return
		}

		// 使用 UserActionRegistry 执行画框创建
		canvas.userActionRegistry.execute("frame.create")
	}

	return (
		<IconButton onClick={handleCreateFrame} className={styles.frameCreateButton}>
			<Frame size={16} />
			<span className={styles.buttonText}>创建画框</span>
		</IconButton>
	)
}
