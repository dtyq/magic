import { useCanvasUI } from "../../../../context/CanvasUIContext"
import { useCallback, useMemo } from "react"
import type { TextElement } from "../../../../canvas/types"
import { AlignLeft, AlignCenter, AlignRight } from "../../../ui/icons/index"
import { Select, SelectContent, SelectItem, SelectTrigger } from "../../../ui/select"
import styles from "./index.module.css"
import { useCanvas } from "../../../../context/CanvasContext"
import { useCanvasDesignI18n } from "../../../../context/I18nContext"

export default function TextAlign() {
	const { t } = useCanvasDesignI18n()
	const { selectedElements } = useCanvasUI()
	const { canvas } = useCanvas()

	const TEXT_ALIGNS = useMemo(
		() => [
			{ value: "left", label: t("elementTools.textAlign.left", "左对齐"), icon: AlignLeft },
			{
				value: "center",
				label: t("elementTools.textAlign.center", "居中对齐"),
				icon: AlignCenter,
			},
			{
				value: "right",
				label: t("elementTools.textAlign.right", "右对齐"),
				icon: AlignRight,
			},
		],
		[t],
	)

	// 获取当前选中的第一个文本元素
	const selectedElement = useMemo(() => {
		if (selectedElements.length === 0) return null
		const element = selectedElements[0]
		return element?.type === "text" ? (element as TextElement) : null
	}, [selectedElements])

	// 获取当前对齐方式
	const textAlign = useMemo(() => {
		if (!selectedElement) return ""
		return selectedElement.content?.[0]?.style?.textAlign || "left"
	}, [selectedElement])

	// 获取当前对齐方式的图标
	const currentIcon = useMemo(() => {
		const align = TEXT_ALIGNS.find((a) => a.value === textAlign)
		return align?.icon
	}, [textAlign])

	// 处理对齐方式变化
	const handleAlignChange = useCallback(
		(value: string) => {
			if (!selectedElement || !canvas) return

			// 更新第一个段落的 textAlign
			const updatedContent = [...(selectedElement.content || [])]
			if (updatedContent[0]) {
				updatedContent[0] = {
					...updatedContent[0],
					style: {
						...updatedContent[0].style,
						textAlign: value as "left" | "center" | "right" | "justify",
					},
				}
			}

			canvas.elementManager.update(selectedElement.id, {
				content: updatedContent,
			} as Partial<TextElement>)
		},
		[selectedElement, canvas],
	)

	const CurrentIcon = currentIcon

	return (
		<Select value={textAlign} onValueChange={handleAlignChange}>
			<SelectTrigger className={styles.selectTrigger}>
				{CurrentIcon && <CurrentIcon size={16} />}
			</SelectTrigger>
			<SelectContent>
				{TEXT_ALIGNS.map((align) => {
					const Icon = align.icon
					return (
						<SelectItem
							key={align.value}
							value={align.value}
							className={styles.selectOptionItem}
						>
							<div className={styles.selectOptionItemContent}>
								<Icon size={16} className={styles.icon} />
								<span className={styles.label}>{align.label}</span>
							</div>
						</SelectItem>
					)
				})}
			</SelectContent>
		</Select>
	)
}
