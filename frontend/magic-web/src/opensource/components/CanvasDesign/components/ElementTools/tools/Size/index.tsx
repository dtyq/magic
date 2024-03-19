import { useMemo, useCallback } from "react"
import { useCanvasUI } from "../../../../context/CanvasUIContext"
import { useCanvas } from "../../../../context/CanvasContext"
import SizeInput from "./SizeInput"

export default function Size() {
	const { selectedElements } = useCanvasUI()
	const { canvas } = useCanvas()

	// 获取当前选中的第一个元素
	const selectedElement = useMemo(() => {
		if (selectedElements.length === 0) return null
		return selectedElements[0]
	}, [selectedElements])

	// 从交互配置中获取锁定状态，默认为 false
	const isLocked = useMemo(() => {
		return selectedElement?.interactionConfig?.aspectRatioLocked ?? false
	}, [selectedElement])

	// 获取当前宽高
	const width = useMemo(() => {
		return selectedElement?.width || 0
	}, [selectedElement])

	const height = useMemo(() => {
		return selectedElement?.height || 0
	}, [selectedElement])

	// 处理宽度变化
	const handleWidthChange = useCallback(
		(value: number) => {
			if (!selectedElement || !canvas) return
			canvas.elementManager.update(selectedElement.id, { width: value })
		},
		[selectedElement, canvas],
	)

	// 处理高度变化
	const handleHeightChange = useCallback(
		(value: number) => {
			if (!selectedElement || !canvas) return
			canvas.elementManager.update(selectedElement.id, { height: value })
		},
		[selectedElement, canvas],
	)

	// 处理宽度输入框失焦
	const handleWidthBlur = useCallback(() => {
		if (!selectedElement || !canvas) return
		// 失焦时的验证逻辑已在 SizeInput 组件中处理
	}, [selectedElement, canvas])

	// 处理高度输入框失焦
	const handleHeightBlur = useCallback(() => {
		if (!selectedElement || !canvas) return
		// 失焦时的验证逻辑已在 SizeInput 组件中处理
	}, [selectedElement, canvas])

	// 切换锁定状态
	const handleToggleLock = useCallback(() => {
		if (!selectedElement || !canvas) return

		// 保存锁定状态到交互配置
		// SizeInput 组件会在切换时更新宽高比
		canvas.elementManager.update(selectedElement.id, {
			interactionConfig: {
				...selectedElement.interactionConfig,
				aspectRatioLocked: !isLocked,
			},
		})
	}, [selectedElement, isLocked, canvas])

	return (
		<SizeInput
			width={width}
			height={height}
			isLocked={isLocked}
			onWidthChange={handleWidthChange}
			onHeightChange={handleHeightChange}
			onToggleLock={handleToggleLock}
			onWidthBlur={handleWidthBlur}
			onHeightBlur={handleHeightBlur}
		/>
	)
}
