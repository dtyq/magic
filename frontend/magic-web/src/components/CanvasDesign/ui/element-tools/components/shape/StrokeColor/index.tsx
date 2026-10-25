import { useCanvasUI } from "../../../../../app/providers/CanvasUIProvider"
import { useCanvas } from "../../../../../app/providers/CanvasProvider"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import styles from "./index.module.css"
import transparentIcon from "../../../../../assets/svg/transparent.svg"
import type { StrokePosition } from "../../../../../runtime/document/types"
import ColorPickerPopover from "../../../../primitives/custom/ColorPickerPopover/index"
import { cn } from "../../../../../runtime/shared/lib/utils"
import { Input } from "../../../../primitives/shadcn/input"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "../../../../primitives/shadcn/select"
import StrokeSize from "../../../../primitives/icons/StrokeSize"
import { useCanvasDesignI18n } from "../../../../../app/providers/I18nProvider"
import { getActiveContent, getContentById } from "../../../../../runtime/document/elementContent"
import { ElementToolTypeEnum } from "../../../../../public/props"
import { useElementToolResolution } from "../../../model/ElementToolResolutionContext"

export default function StrokeColor() {
	const { t } = useCanvasDesignI18n()
	const { selectedElements } = useCanvasUI()
	const { canvas } = useCanvas()
	const tool = useElementToolResolution()
	const executeUpdate = useCallback(
		(updates: Record<string, unknown>) => {
			if (tool?.id !== ElementToolTypeEnum.ShapeStrokeColor) return
			void tool.execute?.({ updates })
		},
		[tool],
	)

	// 追踪 Popover 的打开状态
	const [isPopoverOpen, setIsPopoverOpen] = useState(false)

	// 本地输入框值状态（用于处理输入过程中的临时值）
	const [inputValue, setInputValue] = useState<string>("")

	// 获取当前选中的第一个元素
	const selectedElement = useMemo(() => {
		return tool?.target.elementId
			? (canvas?.elementManager.getElementData(tool.target.elementId) ?? null)
			: (selectedElements[0] ?? null)
	}, [canvas, selectedElements, tool?.target.elementId])
	const targetContent =
		selectedElement && tool?.target.contentId
			? getContentById(selectedElement, tool.target.contentId)
			: selectedElement
				? getActiveContent(selectedElement)
				: undefined

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
		return targetContent?.stroke || undefined
	}, [targetContent, selectedElement])

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
		return targetContent?.strokeWidth || 1
	}, [targetContent, selectedElement])

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
			if (!selectedElement) return

			const [r, g, b, a] = rgba
			const color = `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}${
				a ? `, ${a}` : ""
			})`
			// 只更新颜色,如果当前是透明状态,也会自动取消透明
			executeUpdate({
				stroke: color,
				interactionConfig: {
					...selectedElement.interactionConfig,
					strokeTransparent: false,
				},
			})
		},
		[executeUpdate, selectedElement],
	)

	// 处理颜色模式变化
	const handleModeChange = useCallback(
		(mode: "hex" | "rgb" | "hsl") => {
			if (!selectedElement) return
			executeUpdate({
				interactionConfig: {
					...selectedElement.interactionConfig,
					strokeColorMode: mode,
				},
			})
		},
		[executeUpdate, selectedElement],
	)

	// 处理透明色切换
	const handleTransparentClick = useCallback(() => {
		if (!selectedElement) return
		// 切换透明状态,不修改颜色值
		executeUpdate({
			interactionConfig: {
				...selectedElement.interactionConfig,
				strokeTransparent: !selectedElement.interactionConfig?.strokeTransparent,
			},
		})
	}, [executeUpdate, selectedElement])

	// 处理边框宽度变化
	const handleStrokeWidthChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			const newValue = e.target.value
			setInputValue(newValue)

			if (!selectedElement) return

			// 允许空值（用户正在删除）
			if (newValue === "") return

			const numValue = Number.parseInt(newValue, 10)
			// 只有当值有效且非负时才更新（只接受整数）
			if (!Number.isNaN(numValue) && numValue >= 0) {
				executeUpdate({
					strokeWidth: numValue,
				})
			}
		},
		[executeUpdate, selectedElement],
	)

	// 处理输入框失焦
	const handleStrokeWidthBlur = useCallback(() => {
		if (!selectedElement) return

		// 如果输入为空或无效，恢复到当前的 strokeWidth
		if (inputValue === "" || Number.isNaN(Number.parseInt(inputValue, 10))) {
			setInputValue(Math.round(strokeWidth).toString())
		} else {
			const numValue = Number.parseInt(inputValue, 10)
			// 确保值不小于 0
			if (numValue < 0) {
				setInputValue("0")
				executeUpdate({
					strokeWidth: 0,
				})
			}
		}
	}, [executeUpdate, selectedElement, inputValue, strokeWidth])

	// 处理边框位置变化
	const handleStrokePositionChange = useCallback(
		(value: StrokePosition) => {
			if (!selectedElement) return
			executeUpdate({
				interactionConfig: {
					...selectedElement.interactionConfig,
					strokePosition: value,
				},
			})
		},
		[executeUpdate, selectedElement],
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

			if (selectedElementRef.current) {
				executeUpdate({
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
	}, [executeUpdate, isDragging])

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
								<SelectItem value="inside">
									{t("elementTools.strokeColor.inside")}
								</SelectItem>
								<SelectItem value="center">
									{t("elementTools.strokeColor.center")}
								</SelectItem>
								<SelectItem value="outside">
									{t("elementTools.strokeColor.outside")}
								</SelectItem>
							</SelectContent>
						</Select>
					</div>
				}
			>
				<div className={cn(styles.strokeColor, { [styles.active]: isPopoverOpen })}>
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
