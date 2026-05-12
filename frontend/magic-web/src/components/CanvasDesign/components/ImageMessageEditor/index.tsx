import { useEffect, useMemo, useState } from "react"
import { useCanvasModeUI, useCanvasSelectionUI } from "../../context/CanvasUIContext"
import { useCanvas } from "../../context/CanvasContext"
import { ElementTypeEnum, type ImageElement } from "../../canvas/types"
import { GenerationStatus } from "../../types.magic"
import { useImageOssSrc } from "../../hooks/useImageOssSrc"
import { useCanvasEvent } from "../../hooks/useCanvasEvent"
import ImageMessageEditorRender from "./ImageMessageEditorRender"
import SecondEdit from "./SecondEdit"
import { ImageElement as ImageElementClass } from "../../canvas/element/elements/ImageElement"

export default function ImageMessageEditor() {
	const { selectedElements, isSelecting, isDragging, subElementTooltip } = useCanvasSelectionUI()
	const { croppingElementId, extendingElementId, erasingElementId } = useCanvasModeUI()
	const [targetElement] = selectedElements
	const imageElement =
		selectedElements.length === 1 && targetElement?.type === ElementTypeEnum.Image
			? targetElement
			: null

	// 如果没有图片元素或正在选择元素或图片元素被锁定，则不显示图片编辑器, 或者正在裁剪、扩展、橡皮擦元素
	if (
		!imageElement ||
		isSelecting ||
		imageElement.locked ||
		!!croppingElementId ||
		!!extendingElementId ||
		!!erasingElementId ||
		!!subElementTooltip
	)
		return null

	return <ActiveImageMessageEditor imageElement={imageElement} isDragging={isDragging} />
}

interface ActiveImageMessageEditorProps {
	imageElement: ImageElement
	isDragging: boolean
}

function ActiveImageMessageEditor({ imageElement, isDragging }: ActiveImageMessageEditorProps) {
	const { canvas } = useCanvas()
	const [hiddenAfterSubmit, setHiddenAfterSubmit] = useState(false)
	const [retryEditingElementId, setRetryEditingElementId] = useState<string | null>(null)

	const hasGenerateImageRequest = !!imageElement.generateImageRequest
	const hasResultImage = !!imageElement.src
	const { hasOssSrc } = useImageOssSrc(imageElement)

	const isTemporaryElement =
		canvas != null ? canvas.elementManager.isTemporary(imageElement.id) : false

	const isUploading =
		imageElement.status === GenerationStatus.Processing && !hasGenerateImageRequest

	const isRequestPlaceholder =
		!hasResultImage &&
		(imageElement.status === GenerationStatus.Pending ||
			imageElement.status === GenerationStatus.Processing)

	const hasPendingImageTask =
		!!imageElement.imageGenerationTaskMeta &&
		!hasResultImage &&
		imageElement.status !== GenerationStatus.Failed

	const isGenerating = useMemo(() => {
		if (!canvas) return false
		const imageInstance = canvas.elementManager.getElementInstance(imageElement.id)
		if (!(imageInstance instanceof ImageElementClass)) return false
		return imageInstance.isImageGenerating()
	}, [canvas, imageElement.id])

	useEffect(() => {
		setHiddenAfterSubmit(false)
	}, [imageElement.id])

	useEffect(() => {
		if (retryEditingElementId && retryEditingElementId !== imageElement.id) {
			setRetryEditingElementId(null)
		}
	}, [imageElement.id, retryEditingElementId])

	useCanvasEvent(
		"element:image:generate-submit-started",
		({ data }) => {
			if (data.elementId === imageElement.id) {
				setHiddenAfterSubmit(true)
			}
		},
		[imageElement.id],
	)

	useCanvasEvent(
		"element:image:generate-submit-failed",
		({ data }) => {
			if (data.elementId === imageElement.id) {
				setHiddenAfterSubmit(false)
			}
		},
		[imageElement.id],
	)

	useCanvasEvent(
		"element:image:retryClick",
		({ data }) => {
			setHiddenAfterSubmit(false)
			setRetryEditingElementId(data.elementId)
		},
		[],
	)

	if (
		isTemporaryElement ||
		isUploading ||
		isRequestPlaceholder ||
		isDragging ||
		hiddenAfterSubmit ||
		isGenerating ||
		hasPendingImageTask
	)
		return null

	const isRetryEditing =
		imageElement.status === GenerationStatus.Failed && retryEditingElementId === imageElement.id

	// 如果没有生成图片请求且没有结果图片，则显示图片编辑器
	if ((!hasGenerateImageRequest && !hasResultImage) || isRetryEditing) {
		return (
			<ImageMessageEditorRender
				key={`${imageElement.id}-${isRetryEditing ? "retry" : "create"}`}
				imageElement={imageElement}
			/>
		)
	}

	// 如果有结果图片且 ossSrc 已加载，则显示二次编辑
	if (hasResultImage && hasOssSrc) {
		return <SecondEdit key={imageElement.id} imageElement={imageElement} />
	}

	return null
}
