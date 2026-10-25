import { useCallback, useEffect, useState, type MouseEvent } from "react"
import { RefreshCw } from "lucide-react"
import { useCanvasEvent } from "../../../../../app/hooks/canvas"
import { useCanvas } from "../../../../../app/providers/CanvasProvider"
import { useCanvasDesignI18n } from "../../../../../app/providers/I18nProvider"
import { useCanvasUI } from "../../../../../app/providers/CanvasUIProvider"
import {
	getActiveImageContent,
	isImageElementContent,
} from "../../../../../runtime/document/elementContent"
import { ElementTypeEnum } from "../../../../../runtime/document/types"
import { GenerationStatus } from "../../../../../public/magic-types"
import IconButton from "../../../../primitives/custom/IconButton/index"
import styles from "../ImageCropButton/index.module.css"

export default function ImageReplaceButton() {
	const { canvas } = useCanvas()
	const { selectedElements } = useCanvasUI()
	const { t } = useCanvasDesignI18n()
	const [replacingElementId, setReplacingElementId] = useState<string | null>(
		() => canvas?.mediaReplaceController?.getReplacingElementId?.() ?? null,
	)
	const selected = selectedElements[0]
	const selectedImage = selected?.type === ElementTypeEnum.Image ? selected : undefined
	const activeContent = selectedImage ? getActiveImageContent(selectedImage) : undefined
	const activeIsProcessing =
		activeContent?.status === GenerationStatus.Pending ||
		activeContent?.status === GenerationStatus.Processing
	const isReplacing = replacingElementId === selectedImage?.id
	const isReplacementBusy = replacingElementId !== null

	useEffect(() => {
		setReplacingElementId(canvas?.mediaReplaceController?.getReplacingElementId?.() ?? null)
	}, [canvas])

	useCanvasEvent(
		"element:image:replaceStateChanged",
		useCallback(({ data }) => {
			setReplacingElementId((current) => {
				if (data.status === "uploading" || data.status === "applying") {
					return data.elementId
				}
				return current === data.elementId ? null : current
			})
		}, []),
		[],
	)

	const handleReplace = (event: MouseEvent<HTMLDivElement>) => {
		if (
			!canvas ||
			!canvas.permissionManager.can("document.write") ||
			!selectedImage ||
			activeIsProcessing ||
			isReplacementBusy
		)
			return
		canvas.eventEmitter.emit({
			type: "element:image:replaceClick",
			data: {
				elementId: selectedImage.id,
				contentId: isImageElementContent(selectedImage)
					? selectedImage.activeContentId
					: null,
				clientX: event.clientX,
				clientY: event.clientY,
			},
		})
	}

	return (
		<IconButton
			onClick={handleReplace}
			disabled={
				!canvas ||
				!canvas.permissionManager.can("document.write") ||
				!selectedImage ||
				activeIsProcessing ||
				isReplacementBusy
			}
			className={styles.imageCropButton}
		>
			<RefreshCw size={16} />
			<span className={styles.buttonText}>
				{isReplacing
					? t("image.replacing", "替换中")
					: t("elementTools.imageReplace.title", "替换图片")}
			</span>
		</IconButton>
	)
}
