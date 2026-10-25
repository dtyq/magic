import { useMemo } from "react"
import {
	AlignCenter,
	// AlignJustify,
	AlignLeft,
	AlignRight,
} from "lucide-react"
import { useCanvasDesignI18n } from "../../../../../app/providers/I18nProvider"
import type { RichTextParagraph, TextElementContent } from "../../../../../runtime/document/types"
import { getActiveContent } from "../../../../../runtime/document/elementContent"
import { useTextToolController } from "../useTextToolController"
import TextToolIconButtons from "../TextToolIconButtons"

export default function RichTextTextAlign() {
	const { t } = useCanvasDesignI18n()
	const { state, selectedTextElement, isEditingText, setTextAlign } = useTextToolController()
	const selectedTextContent = selectedTextElement
		? getActiveContent<TextElementContent>(selectedTextElement)
		: undefined

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
			return state.textAlign ?? getRichTextElementTextAlign(selectedTextContent?.content)
		}
		return getRichTextElementTextAlign(selectedTextContent?.content)
	}, [isEditingText, selectedTextContent?.content, state.textAlign])

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
