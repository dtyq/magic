import { Expand } from "lucide-react"
import IconButton from "../../../../primitives/custom/IconButton/index"
import styles from "./index.module.css"
import { useCanvasDesignI18n } from "../../../../../app/providers/I18nProvider"
import { useCanvas } from "../../../../../app/providers/CanvasProvider"
import { useCanvasUI } from "../../../../../app/providers/CanvasUIProvider"
import { ElementTypeEnum } from "../../../../../runtime/document/types"
import { ElementToolTypeEnum } from "../../../../../public/props"
import { useElementToolResolution } from "../../../model/ElementToolResolutionContext"

export default function ImageExtendButton() {
	const { t } = useCanvasDesignI18n()
	const { canvas } = useCanvas()
	const { selectedElements } = useCanvasUI()
	const tool = useElementToolResolution()
	const targetElementId = tool?.target.elementId
	const targetContentId = tool?.target.contentId

	const handleImageExtend = () => {
		if (tool?.id === ElementToolTypeEnum.ContentExtend) {
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
		canvas.extendManager.enterExtendMode(imageElement.id, contentId)
	}

	return (
		<IconButton onClick={handleImageExtend} className={styles.imageExtendButton}>
			<Expand size={16} />
			<span className={styles.buttonText}>{t("elementTools.imageExtend.title", "扩展")}</span>
		</IconButton>
	)
}
