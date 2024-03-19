import { useCallback, useMemo } from "react"
import { useCanvasUI } from "../../../../context/CanvasUIContext"
import { Select, SelectContent, SelectItem, SelectTrigger } from "../../../ui/select"
import styles from "./index.module.css"
import { useCanvas } from "../../../../context/CanvasContext"
import { useCanvasDesignI18n } from "../../../../context/I18nContext"

interface SizeOption {
	label: string
	ratio: string
	width: number
	height: number
	iconWidth: number
	iconHeight: number
}

const SIZE_OPTIONS: SizeOption[] = [
	{
		label: "1:1",
		ratio: "1:1",
		width: 1024,
		height: 1024,
		iconWidth: 12,
		iconHeight: 12,
	},
	{
		label: "2:3",
		ratio: "2:3",
		width: 1024,
		height: 1536,
		iconWidth: 10,
		iconHeight: 15,
	},
	{
		label: "9:16",
		ratio: "9:16",
		width: 1080,
		height: 1920,
		iconWidth: 9,
		iconHeight: 16,
	},
	{
		label: "3:2",
		ratio: "3:2",
		width: 1536,
		height: 1024,
		iconWidth: 15,
		iconHeight: 10,
	},
	{
		label: "16:9",
		ratio: "16:9",
		width: 1920,
		height: 1080,
		iconWidth: 16,
		iconHeight: 9,
	},
	{
		label: "A4",
		ratio: "A4",
		width: 1024,
		height: 1754,
		iconWidth: 10,
		iconHeight: 15,
	},
	{
		label: "Website",
		ratio: "Website",
		width: 1366,
		height: 768,
		iconWidth: 13,
		iconHeight: 7,
	},
]

export default function SizeSelect() {
	const { selectedElements } = useCanvasUI()
	const { canvas } = useCanvas()
	const { t } = useCanvasDesignI18n()

	// 获取当前选中的第一个元素
	const selectedElement = useMemo(() => {
		if (selectedElements.length === 0) return null
		return selectedElements[0]
	}, [selectedElements])

	// 根据当前元素的宽高，找到最匹配的尺寸选项
	const currentOption = useMemo(() => {
		if (!selectedElement?.width || !selectedElement?.height) return null

		const currentWidth = selectedElement.width
		const currentHeight = selectedElement.height

		// 查找完全匹配的选项
		return SIZE_OPTIONS.find(
			(option) => option.width === currentWidth && option.height === currentHeight,
		)
	}, [selectedElement])

	// 获取当前值
	const currentValue = useMemo(() => {
		return currentOption?.ratio || ""
	}, [currentOption])

	// 获取显示文本
	const displayText = useMemo(() => {
		if (currentOption) {
			return currentOption.label
		}
		if (selectedElement) {
			return t("sizeSelect.custom", "自定义")
		}
		return t("sizeSelect.selectSize", "选择尺寸")
	}, [currentOption, selectedElement, t])

	// 处理选择变化
	const handleSelectChange = useCallback(
		(selectedRatio: string) => {
			const option = SIZE_OPTIONS.find((opt) => opt.ratio === selectedRatio)
			if (option && selectedElement && canvas) {
				// 更新元素的宽高
				canvas.elementManager.update(selectedElement.id, {
					width: option.width,
					height: option.height,
				})
			}
		},
		[selectedElement, canvas],
	)

	return (
		<Select value={currentValue} onValueChange={handleSelectChange}>
			<SelectTrigger className={styles.selectTrigger}>
				<span className={styles.triggerText}>{displayText}</span>
			</SelectTrigger>
			<SelectContent>
				{SIZE_OPTIONS.map((option) => (
					<SelectItem
						key={option.ratio}
						value={option.ratio}
						className={styles.selectOptionItem}
					>
						<div className={styles.selectOptionItemContent}>
							<div className={styles.iconWrapper}>
								<div
									className={styles.icon}
									style={{
										width: `${option.iconWidth}px`,
										height: `${option.iconHeight}px`,
									}}
								/>
							</div>
							<span className={styles.label}>{option.label}</span>
							<span className={styles.size}>
								{option.width}*{option.height}
							</span>
						</div>
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	)
}
