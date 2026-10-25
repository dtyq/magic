import { useCanvasUI } from "../../../../../app/providers/CanvasUIProvider"
import { useCanvas } from "../../../../../app/providers/CanvasProvider"
import { useCallback, useMemo, useState, useEffect } from "react"
import styles from "./index.module.css"
import type { RectangleElement, StarElement } from "../../../../../runtime/document/types"
import { ElementTypeEnum } from "../../../../../runtime/document/types"
import { Slider } from "../../../../primitives/shadcn/slider"
import { Input } from "../../../../primitives/shadcn/input"
import { Popover, PopoverContent, PopoverTrigger } from "../../../../primitives/shadcn/popover"
import IconButton from "../../../../primitives/custom/IconButton/index"
import { SplinePointer } from "lucide-react"
import { useCanvasDesignI18n } from "../../../../../app/providers/I18nProvider"
import { getActiveContent, getContentById } from "../../../../../runtime/document/elementContent"
import { ElementToolTypeEnum } from "../../../../../public/props"
import { useElementToolResolution } from "../../../model/ElementToolResolutionContext"

export default function ShapeStyle() {
	const { t } = useCanvasDesignI18n()
	const { selectedElements } = useCanvasUI()
	const { canvas } = useCanvas()
	const tool = useElementToolResolution()
	const executeUpdate = useCallback(
		(updates: Record<string, unknown>) => {
			if (tool?.id !== ElementToolTypeEnum.ShapeStyle) return
			void tool.execute?.({ updates })
		},
		[tool],
	)

	// 本地输入框值状态
	const [cornerRadiusInput, setCornerRadiusInput] = useState<string>("")
	const [sidesInput, setSidesInput] = useState<string>("")
	const [opacityInput, setOpacityInput] = useState<string>("")
	const [innerRadiusRatioInput, setInnerRadiusRatioInput] = useState<string>("")

	// 获取当前选中的第一个元素
	const selectedElement = useMemo(() => {
		const element = tool?.target.elementId
			? canvas?.elementManager.getElementData(tool.target.elementId)
			: selectedElements[0]
		if (!element) return null
		// 只处理矩形、多边形、星形类型
		if (element?.type === ElementTypeEnum.Rectangle || element?.type === ElementTypeEnum.Star) {
			return element as RectangleElement | StarElement
		}
		return null
	}, [canvas, selectedElements, tool?.target.elementId])

	// 判断图形类型（基于元素类型枚举）
	const shapeType = useMemo(() => {
		if (!selectedElement) return null
		return selectedElement.type
	}, [selectedElement])
	const activeContent =
		selectedElement && tool?.target.contentId
			? getContentById(selectedElement, tool.target.contentId)
			: selectedElement
				? getActiveContent(selectedElement)
				: undefined

	// 获取当前值
	const cornerRadius = useMemo(() => activeContent?.cornerRadius || 0, [activeContent])

	const sides = useMemo(() => {
		if (selectedElement?.type === ElementTypeEnum.Star) {
			return activeContent?.sides || 3
		}
		return 3
	}, [activeContent, selectedElement])

	const opacity = useMemo(
		() => (selectedElement?.opacity !== undefined ? selectedElement.opacity : 1),
		[selectedElement],
	)

	const innerRadiusRatio = useMemo(() => {
		if (selectedElement?.type === ElementTypeEnum.Star) {
			return activeContent?.innerRadiusRatio || 0.5
		}
		return 0.5
	}, [activeContent, selectedElement])

	// 同步值到输入框
	useEffect(() => {
		setCornerRadiusInput(Math.round(cornerRadius).toString())
		setSidesInput(Math.round(sides).toString())
		setOpacityInput(Math.round(opacity * 100).toString())
		setInnerRadiusRatioInput(Math.round(innerRadiusRatio * 100).toString())
	}, [cornerRadius, sides, opacity, innerRadiusRatio])

	// 处理圆角变化
	const handleCornerRadiusChange = useCallback(
		(value: number[]) => {
			if (!selectedElement) return
			const newValue = value[0]
			setCornerRadiusInput(Math.round(newValue).toString())
			executeUpdate({ cornerRadius: newValue })
		},
		[executeUpdate, selectedElement],
	)

	const handleCornerRadiusInputChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			const newValue = e.target.value
			setCornerRadiusInput(newValue)
			if (!selectedElement || newValue === "") return

			const numValue = Number.parseInt(newValue, 10)
			if (!Number.isNaN(numValue) && numValue >= 0) {
				executeUpdate({ cornerRadius: numValue })
			}
		},
		[executeUpdate, selectedElement],
	)

	const handleCornerRadiusInputBlur = useCallback(() => {
		if (!selectedElement) return
		if (cornerRadiusInput === "" || Number.isNaN(Number.parseInt(cornerRadiusInput, 10))) {
			setCornerRadiusInput(Math.round(cornerRadius).toString())
		}
	}, [selectedElement, cornerRadiusInput, cornerRadius])

	// 处理边数变化
	const handleSidesChange = useCallback(
		(value: number[]) => {
			if (!selectedElement) return
			const newValue = Math.round(value[0])
			setSidesInput(newValue.toString())
			executeUpdate({ sides: newValue })
		},
		[executeUpdate, selectedElement],
	)

	const handleSidesInputChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			const newValue = e.target.value
			setSidesInput(newValue)
			if (!selectedElement || newValue === "") return

			const numValue = Number.parseInt(newValue, 10)
			if (!Number.isNaN(numValue) && numValue >= 3) {
				executeUpdate({ sides: numValue })
			}
		},
		[executeUpdate, selectedElement],
	)

	const handleSidesInputBlur = useCallback(() => {
		if (!selectedElement) return
		const numValue = Number.parseInt(sidesInput, 10)
		if (sidesInput === "" || Number.isNaN(numValue) || numValue < 3) {
			setSidesInput(Math.round(sides).toString())
		}
	}, [selectedElement, sidesInput, sides])

	// 处理透明度变化
	const handleOpacityChange = useCallback(
		(value: number[]) => {
			if (!selectedElement) return
			const newValue = value[0] / 100
			setOpacityInput(Math.round(value[0]).toString())
			executeUpdate({ opacity: newValue })
		},
		[executeUpdate, selectedElement],
	)

	const handleOpacityInputChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			const newValue = e.target.value
			setOpacityInput(newValue)
			if (!selectedElement || newValue === "") return

			const numValue = Number.parseInt(newValue, 10)
			if (!Number.isNaN(numValue) && numValue >= 0 && numValue <= 100) {
				executeUpdate({ opacity: numValue / 100 })
			}
		},
		[executeUpdate, selectedElement],
	)

	const handleOpacityInputBlur = useCallback(() => {
		if (!selectedElement) return
		const numValue = Number.parseInt(opacityInput, 10)
		if (opacityInput === "" || Number.isNaN(numValue) || numValue < 0 || numValue > 100) {
			setOpacityInput(Math.round(opacity * 100).toString())
		}
	}, [selectedElement, opacityInput, opacity])

	// 处理内凹比例变化
	const handleInnerRadiusRatioChange = useCallback(
		(value: number[]) => {
			if (!selectedElement) return
			const newValue = value[0] / 100
			setInnerRadiusRatioInput(Math.round(value[0]).toString())
			executeUpdate({ innerRadiusRatio: newValue })
		},
		[executeUpdate, selectedElement],
	)

	const handleInnerRadiusRatioInputChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			const newValue = e.target.value
			setInnerRadiusRatioInput(newValue)
			if (!selectedElement || newValue === "") return

			const numValue = Number.parseInt(newValue, 10)
			if (!Number.isNaN(numValue) && numValue >= 0 && numValue <= 100) {
				executeUpdate({
					innerRadiusRatio: numValue / 100,
				})
			}
		},
		[executeUpdate, selectedElement],
	)

	const handleInnerRadiusRatioInputBlur = useCallback(() => {
		if (!selectedElement) return
		const numValue = Number.parseInt(innerRadiusRatioInput, 10)
		if (
			innerRadiusRatioInput === "" ||
			Number.isNaN(numValue) ||
			numValue < 0 ||
			numValue > 100
		) {
			setInnerRadiusRatioInput(Math.round(innerRadiusRatio * 100).toString())
		}
	}, [selectedElement, innerRadiusRatioInput, innerRadiusRatio])

	// 如果没有选中元素或不是矩形类型，不显示
	if (!selectedElement || !shapeType) return null

	return (
		<Popover>
			<PopoverTrigger className={styles.trigger}>
				<div>
					<IconButton className={styles.triggerButton}>
						<SplinePointer size={16} />
						<span className={styles.buttonText}>
							{t("elementTools.shapeStyle.advanced", "高级")}
						</span>
					</IconButton>
				</div>
			</PopoverTrigger>
			<PopoverContent className={styles.popoverContent} align="start">
				<div className={styles.shapeStyle}>
					{/* 圆角 - 所有图形都显示 */}
					<div className={styles.configItem}>
						<label className={styles.label}>
							{t("elementTools.shapeStyle.cornerRadius", "圆角")}
						</label>
						<div className={styles.sliderWrapper}>
							<Slider
								value={[cornerRadius]}
								onValueChange={handleCornerRadiusChange}
								min={0}
								max={100}
								step={1}
								className={styles.slider}
							/>
						</div>
						<div className={styles.inputGroup}>
							<Input
								type="number"
								min={0}
								max={100}
								value={cornerRadiusInput}
								onChange={handleCornerRadiusInputChange}
								onBlur={handleCornerRadiusInputBlur}
								className={styles.input}
							/>
							<span className={styles.suffix}>px</span>
						</div>
					</div>

					{/* 边数 - 多边形和星形显示 */}
					{shapeType === ElementTypeEnum.Star && (
						<div className={styles.configItem}>
							<label className={styles.label}>
								{t("elementTools.shapeStyle.sides", "边数")}
							</label>
							<div className={styles.sliderWrapper}>
								<Slider
									value={[sides]}
									onValueChange={handleSidesChange}
									min={3}
									max={20}
									step={1}
									className={styles.slider}
								/>
							</div>
							<div className={styles.inputGroup}>
								<Input
									type="number"
									min={3}
									max={20}
									value={sidesInput}
									onChange={handleSidesInputChange}
									onBlur={handleSidesInputBlur}
									className={styles.input}
								/>
								<span className={styles.suffix}></span>
							</div>
						</div>
					)}

					{/* 透明度 - 所有图形都显示 */}
					<div className={styles.configItem}>
						<label className={styles.label}>
							{t("elementTools.shapeStyle.opacity", "透明度")}
						</label>
						<div className={styles.sliderWrapper}>
							<Slider
								value={[opacity * 100]}
								onValueChange={handleOpacityChange}
								min={0}
								max={100}
								step={1}
								className={styles.slider}
							/>
						</div>
						<div className={styles.inputGroup}>
							<Input
								type="number"
								min={0}
								max={100}
								value={opacityInput}
								onChange={handleOpacityInputChange}
								onBlur={handleOpacityInputBlur}
								className={styles.input}
							/>
							<span className={styles.suffix}>%</span>
						</div>
					</div>

					{/* 内凹比例 - 只有星形显示 */}
					{shapeType === ElementTypeEnum.Star && (
						<div className={styles.configItem}>
							<label className={styles.label}>
								{t("elementTools.shapeStyle.innerRadiusRatio", "内凹比例")}
							</label>
							<div className={styles.sliderWrapper}>
								<Slider
									value={[innerRadiusRatio * 100]}
									onValueChange={handleInnerRadiusRatioChange}
									min={0}
									max={100}
									step={1}
									className={styles.slider}
								/>
							</div>
							<div className={styles.inputGroup}>
								<Input
									type="number"
									min={0}
									max={100}
									value={innerRadiusRatioInput}
									onChange={handleInnerRadiusRatioInputChange}
									onBlur={handleInnerRadiusRatioInputBlur}
									className={styles.input}
								/>
								<span className={styles.suffix}>%</span>
							</div>
						</div>
					)}
				</div>
			</PopoverContent>
		</Popover>
	)
}
