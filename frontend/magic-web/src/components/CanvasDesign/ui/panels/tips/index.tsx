import styles from "./index.module.css"
import { useCanvasModeUI, useCanvasSelectionUI } from "../../../app/providers/CanvasUIProvider"
import { ElementToolTypeEnum } from "../../../public/props"
import ImageConvertHight from "./tips/ImageConvertHight/index"
import ImageCrop from "./tips/ImageCrop/index"
import ImageExtend from "./tips/ImageExtend/index"
import ImageEraser from "./tips/ImageEraser/index"

export default function CanvasTips() {
	const { activeToolSession } = useCanvasSelectionUI()
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

	if (!activeToolSession) return null

	// 根据当前工具会话渲染对应提示
	if (activeToolSession.toolId === ElementToolTypeEnum.ContentEnhance) {
		return (
			<div className={styles.canvasTips}>
				<ImageConvertHight />
			</div>
		)
	}

	return null
}
