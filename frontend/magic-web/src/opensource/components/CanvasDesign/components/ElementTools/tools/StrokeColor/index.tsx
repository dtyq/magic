import { useCanvasUI } from "../../../../context/CanvasUIContext"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import styles from "./index.module.css"
import transparentIcon from "../../../../assets/svg/transparent.svg"
import type { RectangleElement, EllipseElement, StrokePosition } from "../../../../canvas/types"
import ColorPickerPopover from "../../../ui/custom/ColorPickerPopover/index"
import classNames from "classnames"
import { Input } from "../../../ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../ui/select"
import StrokeSize from "../../../ui/icons/StrokeSize"
import { useCanvas } from "../../../../context/CanvasContext"
import { useCanvasDesignI18n } from "../../../../context/I18nContext"

export default function StrokeColor() {
	const { t } = useCanvasDesignI18n()
	const { selectedElements } = useCanvasUI()
	const { canvas } = useCanvas()

	// 追踪 Popover 的打开状态
	const [isPopoverOpen, setIsPopoverOpen] = useState(false)

	// 本地输入框值状态（用于处理输入过程中的临时值）
	const [inputValue, setInputValue] = useState<string>("")

	// 获取当前选中的第一个元素
	const selectedElement = useMemo(() => {
		if (selectedElements.length === 0) return null
		return selectedElements[0]
	}, [selectedElements])

	// 拖动状态
	const [isDragging, setIsDragging] = useState(false)
	const dragStartXRef = useRef(0)
	const dragStartValueRef = useRef(0)
	const selectedElementRef = useRef(selectedElement)

	// 同步 selectedElement 到 ref
	useEffect(() => {
		selectedElementRef.current = selectedElement
	}, [selectedElement])

	// 获取当前描边颜色
	const strokeColor = useMemo(() => {
		if (!selectedElement) return undefined
		const element = selectedElement as RectangleElement | EllipseElement
		return element.stroke || undefined
	}, [selectedElement])

	// 获取透明状态
	const isTransparent = useMemo(() => {
		return selectedElement?.interactionConfig?.strokeTransparent || false
	}, [selectedElement])

	// 获取颜色模式
	const colorMode = useMemo(() => {
		return selectedElement?.interactionConfig?.strokeColorMode || "rgb"
	}, [selectedElement])

	// 获取边框宽度
	const strokeWidth = useMemo(() => {
		if (!selectedElement) return 1
		const element = selectedElement as RectangleElement | EllipseElement
		return element.strokeWidth || 1
	}, [selectedElement])

	// 同步 strokeWidth 到 inputValue（取整）
	useEffect(() => {
		setInputValue(Math.round(strokeWidth).toString())
	}, [strokeWidth])

	// 获取边框位置
	const strokePosition = useMemo(() => {
		return selectedElement?.interactionConfig?.strokePosition || "center"
	}, [selectedElement])

	// 处理颜色变化
	const handleColorChange = useCallback(
		(rgba: [number, number, number, number]) => {
			if (!selectedElement || !canvas) return

			const [r, g, b, a] = rgba
			const color = `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}${
				a ? `, ${a}` : ""
			})`
			// 只更新颜色,如果当前是透明状态,也会自动取消透明
			canvas.elementManager.update(selectedElement.id, {
				stroke: color,
				interactionConfig: {
					...selectedElement.interactionConfig,
					strokeTransparent: false,
				},
			})
		},
		[selectedElement, canvas],
	)

	// 处理颜色模式变化
	const handleModeChange = useCallback(
		(mode: "hex" | "rgb" | "hsl") => {
			if (!selectedElement || !canvas) return
			canvas.elementManager.update(selectedElement.id, {
				interactionConfig: {
					...selectedElement.interactionConfig,
					strokeColorMode: mode,
				},
			})
		},
		[selectedElement, canvas],
	)

	// 处理透明色切换
	const handleTransparentClick = useCallback(() => {
		if (!selectedElement || !canvas) return
		// 切换透明状态,不修改颜色值
		canvas.elementManager.update(selectedElement.id, {
			interactionConfig: {
				...selectedElement.interactionConfig,
				strokeTransparent: !selectedElement.interactionConfig?.strokeTransparent,
			},
		})
	}, [selectedElement, canvas])

	// 处理边框宽度变化
	const handleStrokeWidthChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			const newValue = e.target.value
			setInputValue(newValue)

			if (!selectedElement || !canvas) return

			// 允许空值（用户正在删除）
			if (newValue === "") return

			const numValue = Number.parseInt(newValue, 10)
			// 只有当值有效且非负时才更新（只接受整数）
			if (!Number.isNaN(numValue) && numValue >= 0) {
				canvas.elementManager.update(selectedElement.id, {
					strokeWidth: numValue,
				})
			}
		},
		[selectedElement, canvas],
	)

	// 处理输入框失焦
	const handleStrokeWidthBlur = useCallback(() => {
		if (!selectedElement || !canvas) return

		// 如果输入为空或无效，恢复到当前的 strokeWidth
		if (inputValue === "" || Number.isNaN(Number.parseInt(inputValue, 10))) {
			setInputValue(Math.round(strokeWidth).toString())
		} else {
			const numValue = Number.parseInt(inputValue, 10)
			// 确保值不小于 0
			if (numValue < 0) {
				setInputValue("0")
				canvas.elementManager.update(selectedElement.id, {
					strokeWidth: 0,
				})
			}
		}
	}, [selectedElement, inputValue, strokeWidth, canvas])

	// 处理边框位置变化
	const handleStrokePositionChange = useCallback(
		(value: StrokePosition) => {
			if (!selectedElement || !canvas) return
			canvas.elementManager.update(selectedElement.id, {
				interactionConfig: {
					...selectedElement.interactionConfig,
					strokePosition: value,
				},
			})
		},
		[selectedElement, canvas],
	)

	// 处理图标鼠标按下
	const handleIconMouseDown = useCallback(
		(e: React.MouseEvent) => {
			e.preventDefault()
			dragStartXRef.current = e.clientX
			dragStartValueRef.current = strokeWidth
			setIsDragging(true)
		},
		[strokeWidth],
	)

	// 处理鼠标移动和释放
	useEffect(() => {
		if (!isDragging) return

		const handleMouseMove = (e: MouseEvent) => {
			e.preventDefault()
			const deltaX = e.clientX - dragStartXRef.current
			// 每移动 5px 改变 1（整数）
			const delta = Math.round(deltaX / 5)
			const newValue = Math.max(0, Math.round(dragStartValueRef.current + delta))

			if (selectedElementRef.current && canvas) {
				canvas.elementManager.update(selectedElementRef.current.id, {
					strokeWidth: newValue,
				})
			}
		}

		const handleMouseUp = (e: MouseEvent) => {
			e.preventDefault()
			setIsDragging(false)
		}

		document.addEventListener("mousemove", handleMouseMove, true)
		document.addEventListener("mouseup", handleMouseUp, true)

		return () => {
			document.removeEventListener("mousemove", handleMouseMove, true)
			document.removeEventListener("mouseup", handleMouseUp, true)
		}
	}, [isDragging, canvas])

	return (
		<>
			<ColorPickerPopover
				value={strokeColor}
				onChange={handleColorChange}
				mode={colorMode}
				onModeChange={handleModeChange}
				isTransparent={isTransparent}
				onTransparentClick={handleTransparentClick}
				title={t("elementTools.strokeColor.title", "描边")}
				onOpenChange={setIsPopoverOpen}
				extraContent={
					<div className={styles.strokeControls}>
						<div className={styles.strokeWidthInput}>
							<StrokeSize
								size={16}
								className={styles.prefixIcon}
								onMouseDown={handleIconMouseDown}
							/>
							<Input
								type="number"
								min="0"
								step="1"
								value={inputValue}
								onChange={handleStrokeWidthChange}
								onBlur={handleStrokeWidthBlur}
								className={styles.input}
							/>
							<span className={styles.unit}>px</span>
						</div>
						<Select value={strokePosition} onValueChange={handleStrokePositionChange}>
							<SelectTrigger className={styles.select}>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="inside">内部</SelectItem>
								<SelectItem value="center">居中</SelectItem>
								<SelectItem value="outside">外部</SelectItem>
							</SelectContent>
						</Select>
					</div>
				}
			>
				<div className={classNames(styles.strokeColor, { [styles.active]: isPopoverOpen })}>
					<div className={styles.strokeColorContent}>
						<div className={styles.colorBackground}>
							<img src={transparentIcon} alt="transparent" />
							{!isTransparent && (
								<div
									className={styles.strokeBorder}
									style={{ backgroundColor: strokeColor }}
								></div>
							)}
						</div>
					</div>
				</div>
			</ColorPickerPopover>
			{isDragging && createPortal(<div className={styles.dragOverlay} />, document.body)}
		</>
	)
}
