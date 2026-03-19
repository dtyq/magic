import styles from "./index.module.css"
import { Hd, ArrowUp } from "../../../ui/icons/index"
import { useMagic } from "../../../../context/MagicContext"
import { useCanvasUI } from "../../../../context/CanvasUIContext"
import { useCanvas } from "../../../../context/CanvasContext"
import { useMemo, useState, useCallback } from "react"
import { ElementTypeEnum, type ImageElement } from "../../../../canvas/types"
import { ImageElement as ImageElementClass } from "../../../../canvas/element/elements/ImageElement"
import type { GenerateHightImageRequest } from "../../../../types.magic"
import { generateElementId, calculateNewElementPosition } from "../../../../canvas/utils/utils"
import SizeSelect from "../../../ui/custom/SizeSelect"
import SizeInput from "../Size/SizeInput"
import { Button } from "../../../ui/button"
import { useCanvasDesignI18n } from "../../../../context/I18nContext"
import { useImageConvertHightOptions } from "./useImageConvertHightOptions"

export default function ImageConvertHight() {
	const { t } = useCanvasDesignI18n()
	const { convertHightConfig } = useMagic()
	const { selectedElements } = useCanvasUI()
	const { canvas } = useCanvas()

	// 本地状态：选中的分辨率
	const [selectedResolution, setSelectedResolution] = useState<string | undefined>(undefined)

	// 获取当前选中的第一个图片元素
	const selectedImageElement = useMemo(() => {
		if (selectedElements.length === 0) return null
		const element = selectedElements[0]
		return element?.type === "image" ? (element as ImageElement) : null
	}, [selectedElements])

	// 获取 ImageElement 实例
	const imageElementInstance = useMemo(() => {
		if (!selectedImageElement || !canvas) return null
		return canvas.elementManager.getElementInstance(selectedImageElement.id)
	}, [selectedImageElement, canvas])

	// const request = selectedImageElement?.generateImageRequest
	const requestSize =
		selectedImageElement?.generateImageRequest?.size ||
		selectedImageElement?.generateHightImageRequest?.size ||
		`${selectedImageElement?.width}x${selectedImageElement?.height}`

	// 使用 hook 获取分辨率选项
	const resolutionOptions = useImageConvertHightOptions(convertHightConfig)

	// 处理分辨率变化
	const handleResolutionChange = useCallback((value: string) => {
		setSelectedResolution(value)
	}, [])

	// 计算 select 的显示值：如果没有选中分辨率，检查 requestSize 是否在 options 中
	const displayValue = useMemo(() => {
		if (selectedResolution) {
			return selectedResolution
		}
		// 如果没有选中分辨率，检查 requestSize 是否在 options 中存在
		if (requestSize) {
			const existsInOptions = resolutionOptions.some((opt) => opt.value === requestSize)
			if (existsInOptions) {
				return requestSize
			}
		}
		// 如果 requestSize 不在 options 中，返回 undefined，让 SizeSelect 显示 "分辨率"
		return undefined
	}, [selectedResolution, requestSize, resolutionOptions])

	// 获取当前选中分辨率对应的尺寸
	const currentSize = useMemo(() => {
		// 使用选中的分辨率或当前请求尺寸（都是宽x高格式）
		const sizeToUse = selectedResolution || requestSize
		if (sizeToUse) {
			const [width, height] = sizeToUse.split("x").map(Number)
			return { width, height }
		}
		return { width: 0, height: 0 }
	}, [selectedResolution, requestSize])

	// 处理发送按钮点击
	const handleSend = useCallback(async () => {
		if (!selectedResolution || !selectedImageElement || !imageElementInstance || !canvas) {
			return
		}

		// 获取当前图片的 src（文件路径）
		const filePath = selectedImageElement.src
		if (!filePath) {
			return
		}

		// 从选项中找到选中的分辨率对应的数据（用于获取 scale）
		const selectedOption = resolutionOptions.find((opt) => opt.value === selectedResolution)
		if (!selectedOption?.data) {
			return
		}

		// 新元素位置间距常量（像素）
		const NEW_ELEMENT_SPACING = 0

		// 计算新元素的位置（放在原元素右边，顶部对齐）
		const newPosition = calculateNewElementPosition(
			selectedImageElement,
			imageElementInstance,
			canvas.elementManager,
			NEW_ELEMENT_SPACING,
		)
		if (!newPosition) {
			return
		}
		const { x: newX, y: newY } = newPosition

		// 解析新元素的尺寸（selectedResolution 已经是宽x高格式）
		const [newWidth, newHeight] = selectedResolution.split("x").map(Number)

		// 生成新元素 ID
		const newElementId = generateElementId()

		// 获取下一个 zIndex
		const newZIndex = canvas.elementManager.getNextZIndexInLevel()

		// 获取原图片的基础名称
		const originalBaseName = selectedImageElement.name || imageElementInstance.getRenderName()

		// 获取选中分辨率对应的 scale（如 "1K", "2K", "4K"）
		const resolutionScale = selectedOption.data.scale || ""

		// 创建新的图片元素数据，设置名称为 "原图片名称_分辨率scale"
		const newImageElement: ImageElement = {
			id: newElementId,
			type: ElementTypeEnum.Image,
			x: newX,
			y: newY,
			width: newWidth,
			height: newHeight,
			zIndex: newZIndex,
			name: resolutionScale ? `${originalBaseName} ${resolutionScale}` : originalBaseName,
		}

		// 创建元素
		canvas.elementManager.create(newImageElement)

		// 获取新创建的元素实例
		const newElementInstance = canvas.elementManager.getElementInstance(newElementId)
		if (!newElementInstance || !(newElementInstance instanceof ImageElementClass)) {
			return
		}

		// 构建高清图生成请求参数（selectedResolution 已经是宽x高格式）
		const hightImageRequest: GenerateHightImageRequest = {
			file_path: filePath,
			size: selectedResolution,
		}

		// 调用新元素的 generateHightImage 方法
		try {
			await newElementInstance.generateHightImage(hightImageRequest)
			// 清空画布选中状态
			canvas.selectionManager.deselectAll()
		} catch (error) {
			//
		}
	}, [selectedResolution, selectedImageElement, imageElementInstance, resolutionOptions, canvas])

	return (
		<div className={styles.imageConvertHight}>
			<div className={styles.name}>
				<Hd size={16} />
				<span>{t("elementTools.imageConvertHight.title", "高清放大")}</span>
			</div>
			<SizeSelect
				options={resolutionOptions}
				value={displayValue}
				onValueChange={handleResolutionChange}
			/>
			<SizeInput width={currentSize.width} height={currentSize.height} readonly />
			<Button
				className={styles.sendButton}
				onClick={handleSend}
				disabled={!selectedResolution}
			>
				<ArrowUp size={16} />
			</Button>
		</div>
	)
}
