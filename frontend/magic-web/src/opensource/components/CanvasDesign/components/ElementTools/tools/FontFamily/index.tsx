import { useCanvasUI } from "../../../../context/CanvasUIContext"
import { useCallback, useMemo } from "react"
import type { TextElement } from "../../../../canvas/types"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../ui/select"
import styles from "./index.module.css"
import { useCanvas } from "../../../../context/CanvasContext"
import { useCanvasDesignI18n } from "../../../../context/I18nContext"

const FONT_FAMILIES = [
	{ value: "Arial", label: "Arial" },
	{ value: "Helvetica", label: "Helvetica" },
	{ value: "Times New Roman", label: "Times New Roman" },
	{ value: "Georgia", label: "Georgia" },
	{ value: "Courier New", label: "Courier New" },
	{ value: "Verdana", label: "Verdana" },
	{ value: "Trebuchet MS", label: "Trebuchet MS" },
	{ value: "Comic Sans MS", label: "Comic Sans MS" },
	{ value: "Impact", label: "Impact" },
	{ value: "Palatino", label: "Palatino" },
]

export default function FontFamily() {
	const { t } = useCanvasDesignI18n()
	const { selectedElements } = useCanvasUI()
	const { canvas } = useCanvas()

	// 获取当前选中的第一个文本元素
	const selectedElement = useMemo(() => {
		if (selectedElements.length === 0) return null
		const element = selectedElements[0]
		return element?.type === "text" ? (element as TextElement) : null
	}, [selectedElements])

	// 获取当前字体家族
	const fontFamily = useMemo(() => {
		if (!selectedElement) return ""
		return selectedElement.defaultStyle?.fontFamily || "Arial"
	}, [selectedElement])

	// 处理字体家族变化
	const handleFontFamilyChange = useCallback(
		(value: string) => {
			if (!selectedElement || !canvas) return
			canvas.elementManager.update(selectedElement.id, {
				defaultStyle: {
					...selectedElement.defaultStyle,
					fontFamily: value,
				},
			} as Partial<TextElement>)
		},
		[selectedElement, canvas],
	)

	return (
		<Select value={fontFamily} onValueChange={handleFontFamilyChange}>
			<SelectTrigger className={styles.selectTrigger}>
				<SelectValue placeholder={t("elementTools.fontFamily.placeholder", "字体")} />
			</SelectTrigger>
			<SelectContent>
				{FONT_FAMILIES.map((font) => (
					<SelectItem
						key={font.value}
						value={font.value}
						className={styles.selectOptionItem}
					>
						<div className={styles.selectOptionItemContent}>
							<span className={styles.label}>{font.label}</span>
						</div>
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	)
}
