import IconButton from "../../../../primitives/custom/IconButton/index"
import styles from "./index.module.css"
import { Crop } from "lucide-react"
import { useCanvasDesignI18n } from "../../../../../app/providers/I18nProvider"
import { useCanvas } from "../../../../../app/providers/CanvasProvider"
import { useCanvasUI } from "../../../../../app/providers/CanvasUIProvider"
import { ElementTypeEnum } from "../../../../../runtime/document/types"
import { ElementToolTypeEnum } from "../../../../../public/props"
import { useElementToolResolution } from "../../../model/ElementToolResolutionContext"

export default function ImageCropButton() {
	const { t } = useCanvasDesignI18n()
	const { canvas } = useCanvas()
	const { selectedElements } = useCanvasUI()
	const tool = useElementToolResolution()
	const targetElementId = tool?.target.elementId
	const targetContentId = tool?.target.contentId

	const handleImageCrop = () => {
		if (tool?.id === ElementToolTypeEnum.ContentCrop) {
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
		canvas.cropManager.enterCropMode(imageElement.id, contentId)
	}

	return (
		<IconButton onClick={handleImageCrop} className={styles.imageCropButton}>
			<Crop size={16} />
			<span className={styles.buttonText}>{t("elementTools.imageCrop.title", "裁剪")}</span>
		</IconButton>
	)
}
