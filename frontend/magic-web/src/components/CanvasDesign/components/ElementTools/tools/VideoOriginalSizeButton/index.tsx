import { RotateCcw } from "lucide-react"
import { useCallback, useState } from "react"
import { ElementTypeEnum } from "../../../../canvas/types"
import { useCanvas } from "../../../../context/CanvasContext"
import { useCanvasDesignI18n } from "../../../../context/I18nContext"
import { useCanvasUI } from "../../../../context/CanvasUIContext"
import IconButton from "../../../ui/custom/IconButton/index"
import styles from "./index.module.css"

export default function VideoOriginalSizeButton() {
	const { t } = useCanvasDesignI18n()
	const { canvas } = useCanvas()
	const { selectedElements } = useCanvasUI()
	const [isApplying, setIsApplying] = useState(false)

	const handleRestoreOriginalSize = useCallback(async () => {
		if (!canvas || isApplying) return

		const videoElement = selectedElements[0]
		if (!videoElement || videoElement.type !== ElementTypeEnum.Video || !videoElement.src)
			return

		const elementWidth = videoElement.width ?? 0
		const elementHeight = videoElement.height ?? 0
		const longestEdge = Math.max(elementWidth, elementHeight)
		if (longestEdge <= 0) return

		setIsApplying(true)
		try {
			const resource = await canvas.videoResourceManager.getPreviewResource(videoElement.src)
			const videoWidth = resource?.metadata?.videoWidth ?? 0
			const videoHeight = resource?.metadata?.videoHeight ?? 0
			if (videoWidth <= 0 || videoHeight <= 0) return

			let nextWidth = longestEdge
			let nextHeight = longestEdge
			if (videoWidth >= videoHeight) {
				nextHeight = Math.max(1, Math.round((longestEdge * videoHeight) / videoWidth))
			} else {
				nextWidth = Math.max(1, Math.round((longestEdge * videoWidth) / videoHeight))
			}

			if (nextWidth === elementWidth && nextHeight === elementHeight) return

			canvas.elementManager.update(videoElement.id, {
				width: nextWidth,
				height: nextHeight,
			})
		} finally {
			setIsApplying(false)
		}
	}, [canvas, isApplying, selectedElements])

	return (
		<IconButton
			onClick={() => {
				void handleRestoreOriginalSize()
			}}
			className={styles.videoOriginalSizeButton}
			disabled={isApplying}
		>
			<RotateCcw size={16} />
			<span className={styles.buttonText}>
				{t("elementTools.videoOriginalSize.title", "恢复原比例")}
			</span>
		</IconButton>
	)
}
