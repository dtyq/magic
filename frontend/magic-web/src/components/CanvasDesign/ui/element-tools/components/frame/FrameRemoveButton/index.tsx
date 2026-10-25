import IconButton from "../../../../primitives/custom/IconButton/index"
import styles from "./index.module.css"
import { FrameDotted } from "../../../../primitives/icons/index"
import { useElementToolResolution } from "../../../model/ElementToolResolutionContext"

export default function FrameRemoveButton() {
	const tool = useElementToolResolution()

	const handleRemoveFrame = () => {
		if (tool?.visibility !== "visible") return
		void tool.execute?.()
	}

	return (
		<IconButton
			onClick={handleRemoveFrame}
			className={styles.frameRemoveButton}
			disabled={tool?.visibility !== "visible"}
		>
			<FrameDotted size={16} />
			<span className={styles.buttonText}>解除画框</span>
		</IconButton>
	)
}
