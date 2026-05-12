import IconButton from "../../../ui/custom/IconButton/index"
import styles from "./index.module.css"
import { Crop } from "lucide-react"
import { useCanvasDesignI18n } from "../../../../context/I18nContext"
import { useCanvas } from "../../../../context/CanvasContext"
import { useCanvasUI } from "../../../../context/CanvasUIContext"
import { ElementTypeEnum } from "../../../../canvas/types"

export default function ImageCropButton() {
	const { t } = useCanvasDesignI18n()
	const { canvas } = useCanvas()
	const { selectedElements } = useCanvasUI()

	const handleImageCrop = () => {
		if (!canvas) return

		const imageElement = selectedElements[0]
		if (!imageElement || imageElement.type !== ElementTypeEnum.Image) return

		// 调用 CropManager 进入裁剪模式
		canvas.cropManager.enterCropMode(imageElement.id)
	}

	return (
		<IconButton onClick={handleImageCrop} className={styles.imageCropButton}>
			<Crop size={16} />
			<span className={styles.buttonText}>{t("elementTools.imageCrop.title", "裁剪")}</span>
		</IconButton>
	)
}
