import IconButton from "../../../../primitives/custom/IconButton/index"
import styles from "./index.module.css"
import { Frame } from "lucide-react"
import { useElementToolResolution } from "../../../model/ElementToolResolutionContext"

export default function FrameCreateButton() {
	const tool = useElementToolResolution()

	const handleCreateFrame = () => {
		if (tool?.visibility !== "visible") return
		void tool.execute?.()
	}

	return (
		<IconButton
			onClick={handleCreateFrame}
			className={styles.frameCreateButton}
			disabled={tool?.visibility !== "visible"}
		>
			<Frame size={16} />
			<span className={styles.buttonText}>创建画框</span>
		</IconButton>
	)
}
