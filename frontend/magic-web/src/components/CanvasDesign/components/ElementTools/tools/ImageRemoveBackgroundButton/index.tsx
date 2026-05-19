import { useCallback, useMemo } from "react"
import IconButton from "../../../ui/custom/IconButton/index"
import styles from "./index.module.css"
import { Wand2 } from "lucide-react"
import { useCanvasDesignI18n } from "../../../../context/I18nContext"
import { useCanvasUI } from "../../../../context/CanvasUIContext"
import { useCanvas } from "../../../../context/CanvasContext"
import { useMagic } from "../../../../context/MagicContext"
import { ElementTypeEnum, type ImageElement } from "../../../../canvas/types"
import { ImageElement as ImageElementClass } from "../../../../canvas/element/elements/ImageElement"
import { createRemoveBackgroundTaskMeta } from "../../../../canvas/utils/imageGenerationTaskMeta"
import {
	generateElementId,
	calculateNewElementPosition,
	generateUUID,
} from "../../../../canvas/utils/utils"
import {
	buildReferenceImageOptions,
	getImageProcessRequestPayload,
} from "../../../../canvas/utils/imageCropUtils"
import { GenerationStatus } from "../../../../types.magic"

export default function ImageRemoveBackgroundButton() {
	const { t } = useCanvasDesignI18n()
	const { selectedElements } = useCanvasUI()
	const { canvas } = useCanvas()
	const { methods } = useMagic()

	const selectedImageElement = useMemo(() => {
		if (selectedElements.length === 0) return null
		const element = selectedElements[0]
		return element?.type === ElementTypeEnum.Image ? (element as ImageElement) : null
	}, [selectedElements])

	const imageElementInstance = useMemo(() => {
		if (!selectedImageElement || !canvas) return null
		const elementInstance = canvas.elementManager.getElementInstance(selectedImageElement.id)
		return elementInstance instanceof ImageElementClass ? elementInstance : null
	}, [selectedImageElement, canvas])

	const handleRemoveBackground = useCallback(async () => {
		if (
			!selectedImageElement ||
			!imageElementInstance ||
			!canvas ||
			!methods?.removeBackground
		) {
			return
		}

		const filePath = selectedImageElement.src
		if (!filePath) return

		canvas.eventEmitter.emit({
			type: "element:image:generate-submit-started",
			data: { elementId: selectedImageElement.id },
		})

		let imageInfo = imageElementInstance.getImageInfo()
		if (!imageInfo?.naturalWidth || !imageInfo?.naturalHeight) {
			await imageElementInstance.getHTMLImageElement()
			imageInfo = imageElementInstance.getImageInfo()
		}

		const imageProcessRequestPayload = getImageProcessRequestPayload({
			crop: selectedImageElement.crop,
			sourceDimensions: {
				width: imageInfo?.naturalWidth ?? selectedImageElement.width ?? 0,
				height: imageInfo?.naturalHeight ?? selectedImageElement.height ?? 0,
			},
		})

		const newPosition = calculateNewElementPosition(
			selectedImageElement,
			imageElementInstance,
			canvas.elementManager,
			0,
		)
		if (!newPosition) return

		const newElementId = generateElementId()
		const newZIndex = canvas.elementManager.getNextZIndexInLevel()
		const originalBaseName = selectedImageElement.name || imageElementInstance.getRenderName()
		const removeBackgroundSuffix = t("elementTools.imageRemoveBackground.title", "去背景")
		const requestImageId = generateUUID()
		const placeholderTaskMeta = createRemoveBackgroundTaskMeta({
			file_path: filePath,
			reference_image_options: buildReferenceImageOptions({
				filePath,
				crop: imageProcessRequestPayload.crop,
			}),
		})

		const newImageElement: ImageElement = {
			id: newElementId,
			type: ElementTypeEnum.Image,
			x: newPosition.x,
			y: newPosition.y,
			width: selectedImageElement.width ?? 1024,
			height: selectedImageElement.height ?? 1024,
			zIndex: newZIndex,
			name: `${originalBaseName} ${removeBackgroundSuffix}`,
			status: GenerationStatus.Pending,
			imageGenerationTaskMeta: placeholderTaskMeta,
		}

		canvas.elementManager.create(newImageElement)

		const newElementInstance = canvas.elementManager.getElementInstance(newElementId)
		if (!newElementInstance || !(newElementInstance instanceof ImageElementClass)) {
			canvas.eventEmitter.emit({
				type: "element:image:generate-submit-failed",
				data: { elementId: selectedImageElement.id },
			})
			canvas.elementManager.delete(newElementId)
			return
		}

		try {
			const success = await newElementInstance.removeBackground({
				image_id: requestImageId,
				file_path: filePath,
				size: imageProcessRequestPayload.size,
				reference_image_options: buildReferenceImageOptions({
					filePath,
					crop: imageProcessRequestPayload.crop,
				}),
			})
			if (!success) {
				canvas.eventEmitter.emit({
					type: "element:image:generate-submit-failed",
					data: { elementId: selectedImageElement.id },
				})
				canvas.elementManager.delete(newElementId)
				return
			}
			canvas.selectionManager.select(newElementId, false)
		} catch {
			canvas.eventEmitter.emit({
				type: "element:image:generate-submit-failed",
				data: { elementId: selectedImageElement.id },
			})
			canvas.elementManager.delete(newElementId)
		}
	}, [selectedImageElement, imageElementInstance, canvas, methods, t])

	return (
		<IconButton onClick={handleRemoveBackground} className={styles.imageRemoveBackgroundButton}>
			<Wand2 size={16} />
			<span className={styles.buttonText}>
				{t("elementTools.imageRemoveBackground.title", "去背景")}
			</span>
		</IconButton>
	)
}
