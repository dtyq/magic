import { useCanvasUI } from "../../context/CanvasUIContext"
import { useCanvas } from "../../context/CanvasContext"
import { ElementTypeEnum } from "../../canvas/types"
import { useImageOssSrc } from "../../hooks/useImageOssSrc"
import ImageMessageEditorRender from "./ImageMessageEditorRender"
import SecondEdit from "./SecondEdit"

export default function ImageMessageEditor() {
	const { selectedElements, isSelecting, isDragging } = useCanvasUI()
	const { canvas } = useCanvas()

	const isSingleElement = selectedElements.length === 1

	const [targetElement] = selectedElements

	// 获取单选图片元素
	const imageElement =
		isSingleElement && targetElement?.type === ElementTypeEnum.Image ? targetElement : null

	// 是否有生成图片请求
	const hasGenerateImageRequest = !!imageElement?.generateImageRequest

	// 是否有结果图片
	const hasResultImage = !!imageElement?.src

	// 检查 ossSrc 是否已加载
	const { hasOssSrc } = useImageOssSrc(imageElement)

	// 检查是否为临时元素（本地上传中）
	const isTemporaryElement =
		imageElement && canvas ? canvas.elementManager.isTemporary(imageElement.id) : false

	// 检查是否处于上传中状态（status 为 processing 且没有 generateImageRequest）
	const isUploading = imageElement?.status === "processing" && !hasGenerateImageRequest

	// 如果没有图片元素或正在选择元素或图片元素被锁定，则不显示图片编辑器
	if (!imageElement || isSelecting || imageElement.locked) return null

	// 如果是本地上传中的临时元素，则不显示图片编辑器
	if (isTemporaryElement || isUploading || isDragging) return null

	// 如果没有生成图片请求且没有结果图片，则显示图片编辑器
	if (!hasGenerateImageRequest && !hasResultImage) {
		return <ImageMessageEditorRender key={imageElement.id} imageElement={imageElement} />
	}

	// 如果有结果图片且 ossSrc 已加载，则显示二次编辑
	if (hasResultImage && hasOssSrc) {
		return <SecondEdit key={imageElement.id} imageElement={imageElement} />
	}

	return null
}
