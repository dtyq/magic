import styles from "./index.module.css"
import { useCanvasModeUI, useCanvasSelectionUI } from "../../context/CanvasUIContext"
import { ElementToolTypeEnum } from "../../types"
import ImageConvertHight from "./tips/ImageConvertHight"
import ImageCrop from "./tips/ImageCrop"
import ImageExtend from "./tips/ImageExtend/index"
import ImageEraser from "./tips/ImageEraser"

export default function CanvasTips() {
	const { subElementTooltip } = useCanvasSelectionUI()
	const { croppingElementId, extendingElementId, erasingElementId } = useCanvasModeUI()

	// 裁剪模式下显示裁剪提示
	if (croppingElementId) {
		return (
			<div className={styles.canvasTips}>
				<ImageCrop />
			</div>
		)
	}

	if (extendingElementId) {
		return (
			<div className={styles.canvasTips}>
				<ImageExtend />
			</div>
		)
	}

	// 橡皮擦模式下显示橡皮擦提示
	if (erasingElementId) {
		return (
			<div className={styles.canvasTips}>
				<ImageEraser />
			</div>
		)
	}

	if (!subElementTooltip) return null

	// 根据 subElementTooltip 类型渲染对应提示
	if (subElementTooltip === ElementToolTypeEnum.ImageConvertHight) {
		return (
			<div className={styles.canvasTips}>
				<ImageConvertHight />
			</div>
		)
	}

	return null
}
