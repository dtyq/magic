import styles from "./index.module.css"
import { useCanvasUI } from "../../../../context/CanvasUIContext"
import { useCallback, useMemo } from "react"
import type { TextElement } from "../../../../canvas/types"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../ui/select"
import { useCanvas } from "../../../../context/CanvasContext"

const FONT_SIZES = [8, 10, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 64, 72, 96]

export default function FontSize() {
	const { selectedElements } = useCanvasUI()
	const { canvas } = useCanvas()

	// 获取当前选中的第一个文本元素
	const selectedElement = useMemo(() => {
		if (selectedElements.length === 0) return null
		const element = selectedElements[0]
		return element?.type === "text" ? (element as TextElement) : null
	}, [selectedElements])

	// 获取当前字体大小
	const fontSize = useMemo(() => {
		if (!selectedElement) return ""
		return String(selectedElement.defaultStyle?.fontSize || 16)
	}, [selectedElement])

	// 处理字体大小变化
	const handleFontSizeChange = useCallback(
		(value: string) => {
			if (!selectedElement || !canvas) return
			canvas.elementManager.update(selectedElement.id, {
				defaultStyle: {
					...selectedElement.defaultStyle,
					fontSize: Number(value),
				},
			} as Partial<TextElement>)
		},
		[selectedElement, canvas],
	)

	return (
		<Select value={fontSize} onValueChange={handleFontSizeChange}>
			<SelectTrigger className={styles.selectTrigger}>
				<SelectValue placeholder="字号" />
			</SelectTrigger>
			<SelectContent>
				{FONT_SIZES.map((size) => (
					<SelectItem key={size} value={String(size)} className={styles.selectOptionItem}>
						<div className={styles.selectOptionItemContent}>
							<span className={styles.label}>{size}</span>
						</div>
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	)
}
