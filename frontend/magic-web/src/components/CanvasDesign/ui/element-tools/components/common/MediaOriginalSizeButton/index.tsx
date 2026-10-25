import { RotateCcw } from "lucide-react"
import { useCallback, useState } from "react"
import { ElementTypeEnum } from "../../../../../runtime/document/types"
import { useCanvas } from "../../../../../app/providers/CanvasProvider"
import { useCanvasDesignI18n } from "../../../../../app/providers/I18nProvider"
import type { LayerElement } from "../../../../../runtime/document/types"
import IconButton from "../../../../primitives/custom/IconButton/index"
import styles from "./index.module.css"
import { getContentById } from "../../../../../runtime/document/elementContent"
import { useElementToolResolution } from "../../../model/ElementToolResolutionContext"
import {
	calculateMediaOriginalSize,
	getMediaDimensions,
	type MediaElementType,
} from "../../../shared/mediaOriginalSize"

export default function MediaOriginalSizeButton() {
	const { t } = useCanvasDesignI18n()
	const { canvas } = useCanvas()
	const tool = useElementToolResolution()
	const targetElementId = tool?.target.elementId
	const targetContentId = tool?.target.contentId
	const [isApplying, setIsApplying] = useState(false)

	const handleRestoreOriginalSize = useCallback(async () => {
		if (!canvas || isApplying || !targetElementId || !targetContentId) return

		const element = canvas.elementManager.getElementData(targetElementId) as
			| LayerElement
			| undefined
		if (
			!element ||
			(element.type !== ElementTypeEnum.Image && element.type !== ElementTypeEnum.Video)
		)
			return

		const content = getContentById(element, targetContentId)
		if (!content?.src) return

		const elementWidth = element.width ?? 0
		const elementHeight = element.height ?? 0
		if (elementWidth <= 0 || elementHeight <= 0) return

		setIsApplying(true)
		try {
			const dimensions = await getMediaDimensions(
				canvas,
				element.type as MediaElementType,
				content.src,
			)
			if (!dimensions) return
			const nextSize = calculateMediaOriginalSize(
				elementWidth,
				elementHeight,
				dimensions.width,
				dimensions.height,
			)
			if (!nextSize) return

			if (nextSize.width === elementWidth && nextSize.height === elementHeight) return
			if (tool?.visibility !== "visible") return
			await tool.execute?.({ width: nextSize.width, height: nextSize.height })
		} finally {
			setIsApplying(false)
		}
	}, [canvas, isApplying, targetContentId, targetElementId, tool])

	return (
		<IconButton
			onClick={() => {
				void handleRestoreOriginalSize()
			}}
			className={styles.mediaOriginalSizeButton}
			disabled={isApplying}
		>
			<RotateCcw size={16} />
			<span className={styles.buttonText}>
				{t("elementTools.mediaOriginalSize.title", "恢复原比例")}
			</span>
		</IconButton>
	)
}
