import { Expand } from "lucide-react"
import IconButton from "../../../ui/custom/IconButton/index"
import styles from "./index.module.css"
import { useCanvasDesignI18n } from "../../../../context/I18nContext"
import { useCanvas } from "../../../../context/CanvasContext"
import { useCanvasUI } from "../../../../context/CanvasUIContext"
import { ElementTypeEnum } from "../../../../canvas/types"

export default function ImageExtendButton() {
	const { t } = useCanvasDesignI18n()
	const { canvas } = useCanvas()
	const { selectedElements } = useCanvasUI()

	const handleImageExtend = () => {
		if (!canvas) return

		const imageElement = selectedElements[0]
		if (!imageElement || imageElement.type !== ElementTypeEnum.Image) return

		canvas.extendManager.enterExtendMode(imageElement.id)
	}

	return (
		<IconButton onClick={handleImageExtend} className={styles.imageExtendButton}>
			<Expand size={16} />
			<span className={styles.buttonText}>{t("elementTools.imageExtend.title", "扩展")}</span>
		</IconButton>
	)
}
