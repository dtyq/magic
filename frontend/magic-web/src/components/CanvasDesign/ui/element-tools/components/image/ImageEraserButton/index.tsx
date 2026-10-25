import IconButton from "../../../../primitives/custom/IconButton/index"
import styles from "./index.module.css"
import { Eraser } from "lucide-react"
import { useCanvasDesignI18n } from "../../../../../app/providers/I18nProvider"
import { useCanvasUI } from "../../../../../app/providers/CanvasUIProvider"
import { useCanvas } from "../../../../../app/providers/CanvasProvider"
import { ElementTypeEnum } from "../../../../../runtime/document/types"
import { ElementToolTypeEnum } from "../../../../../public/props"
import { useElementToolResolution } from "../../../model/ElementToolResolutionContext"

export default function ImageEraserButton() {
	const { t } = useCanvasDesignI18n()
	const { selectedElements } = useCanvasUI()
	const { canvas } = useCanvas()
	const tool = useElementToolResolution()
	const targetElementId = tool?.target.elementId
	const targetContentId = tool?.target.contentId

	const handleEraser = () => {
		if (tool?.id === ElementToolTypeEnum.ContentEraser) {
			void tool.execute()
			return
		}
		if (!canvas) return

		const imageElement = targetElementId
			? canvas.elementManager.getElementData(targetElementId)
			: selectedElements[0]
		if (!imageElement || imageElement.type !== ElementTypeEnum.Image) return

		const contentId = tool ? targetContentId : imageElement.activeContentId
		if (!contentId) return
		canvas.eraserManager.enterEraserMode(imageElement.id, contentId)
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
