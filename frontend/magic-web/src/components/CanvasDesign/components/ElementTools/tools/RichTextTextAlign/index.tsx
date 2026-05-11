import { useMemo } from "react"
import {
	AlignCenter,
	// AlignJustify,
	AlignLeft,
	AlignRight,
} from "lucide-react"
import { useCanvasDesignI18n } from "../../../../context/I18nContext"
import type { RichTextParagraph } from "../../../../canvas/types"
import { useTextToolController } from "../text/useTextToolController"
import TextToolIconButtons from "../text/TextToolIconButtons"

export default function RichTextTextAlign() {
	const { t } = useCanvasDesignI18n()
	const { state, selectedTextElement, isEditingText, setTextAlign } = useTextToolController()

	const RICH_TEXT_ALIGNS = useMemo(
		() => [
			{
				value: "left",
				label: t("elementTools.textAlign.left", "左对齐"),
				icon: AlignLeft,
			},
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
			// {
			// 	value: "justify",
			// 	label: t("elementTools.textAlign.justify", "两端对齐"),
			// 	icon: AlignJustify,
			// },
		],
		[t],
	)

	const richTextTextAlign = useMemo(() => {
		if (isEditingText) {
			return state.textAlign ?? getRichTextElementTextAlign(selectedTextElement?.content)
		}
		return getRichTextElementTextAlign(selectedTextElement?.content)
	}, [isEditingText, selectedTextElement?.content, state.textAlign])

	return (
		<TextToolIconButtons
			items={RICH_TEXT_ALIGNS.map((align) => ({
				key: align.value,
				label: align.label,
				icon: align.icon,
				selected: richTextTextAlign === align.value,
				onClick: () => {
					setTextAlign(align.value as "left" | "center" | "right")
				},
			}))}
		/>
	)
}

function getRichTextElementTextAlign(
	content: RichTextParagraph[] | undefined,
): "left" | "center" | "right" | "justify" {
	if (!content?.length) {
		return "left"
	}

	return (
		content.find((paragraph) => paragraph.style?.textAlign)?.style?.textAlign ??
		content[0]?.style?.textAlign ??
		"left"
	)
}
