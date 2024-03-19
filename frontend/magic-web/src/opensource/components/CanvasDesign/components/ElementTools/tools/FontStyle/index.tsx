import { useCanvasUI } from "../../../../context/CanvasUIContext"
import { useCallback, useMemo } from "react"
import type { TextElement } from "../../../../canvas/types"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../ui/select"
import styles from "./index.module.css"
import { useCanvas } from "../../../../context/CanvasContext"
import { useCanvasDesignI18n } from "../../../../context/I18nContext"

const FONT_WEIGHTS = [
	{ value: "300", label: "Light" },
	{ value: "400", label: "Regular" },
	{ value: "500", label: "Medium" },
	{ value: "600", label: "Semibold" },
	{ value: "700", label: "Bold" },
	{ value: "800", label: "Extrabold" },
	{ value: "900", label: "Black" },
]

export default function FontStyle() {
	const { t } = useCanvasDesignI18n()
	const { selectedElements } = useCanvasUI()
	const { canvas } = useCanvas()

	// 获取当前选中的第一个文本元素
	const selectedElement = useMemo(() => {
		if (selectedElements.length === 0) return null
		const element = selectedElements[0]
		return element?.type === "text" ? (element as TextElement) : null
	}, [selectedElements])

	// 获取当前字体粗细
	const fontWeight = useMemo(() => {
		if (!selectedElement) return ""
		const weight = selectedElement.defaultStyle?.fontWeight || 400
		return typeof weight === "number" ? weight.toString() : weight
	}, [selectedElement])

	// 处理字体粗细变化
	const handleFontWeightChange = useCallback(
		(value: string) => {
			if (!selectedElement || !canvas) return
			canvas.elementManager.update(selectedElement.id, {
				defaultStyle: {
					...selectedElement.defaultStyle,
					fontWeight: Number.parseInt(value, 10),
				},
			} as Partial<TextElement>)
		},
		[selectedElement, canvas],
	)

	return (
		<Select value={fontWeight} onValueChange={handleFontWeightChange}>
			<SelectTrigger className={styles.selectTrigger}>
				<SelectValue placeholder={t("elementTools.fontStyle.placeholder", "字重")} />
			</SelectTrigger>
			<SelectContent>
				{FONT_WEIGHTS.map((weight) => (
					<SelectItem
						key={weight.value}
						value={weight.value}
						className={styles.selectOptionItem}
					>
						<div className={styles.selectOptionItemContent}>
							<span className={styles.label}>{weight.label}</span>
						</div>
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	)
}
