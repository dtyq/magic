import IconButton from "../../../ui/custom/IconButton/index"
import styles from "./index.module.css"
import { Eraser } from "lucide-react"
import { useCanvasDesignI18n } from "../../../../context/I18nContext"
import { useCanvasUI } from "../../../../context/CanvasUIContext"
import { useCanvas } from "../../../../context/CanvasContext"
import { ElementTypeEnum } from "../../../../canvas/types"

export default function ImageEraserButton() {
	const { t } = useCanvasDesignI18n()
	const { selectedElements } = useCanvasUI()
	const { canvas } = useCanvas()

	const handleEraser = () => {
		if (!canvas) return

		const imageElement = selectedElements[0]
		if (!imageElement || imageElement.type !== ElementTypeEnum.Image) return

		canvas.eraserManager.enterEraserMode(imageElement.id)
	}

	return (
		<IconButton onClick={handleEraser} className={styles.imageEraserButton}>
			<Eraser size={16} />
			<span className={styles.buttonText}>
				{t("elementTools.imageEraser.title", "橡皮工具")}
			</span>
		</IconButton>
	)
}
