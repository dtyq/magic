import { Bold, Italic } from "lucide-react"
import { useCanvasDesignI18n } from "../../../../context/I18nContext"
import { useTextToolController } from "../text/useTextToolController"
import TextToolIconButtons from "../text/TextToolIconButtons"

function isBoldFontWeight(fontWeight: number | string | null | undefined): boolean {
	if (fontWeight === null || fontWeight === undefined) {
		return false
	}

	if (typeof fontWeight === "number") {
		return fontWeight >= 600
	}

	const parsedFontWeight = Number.parseInt(fontWeight, 10)
	if (!Number.isNaN(parsedFontWeight)) {
		return parsedFontWeight >= 600
	}

	return fontWeight === "bold"
}

export default function RichTextFontStyle() {
	const { t } = useCanvasDesignI18n()
	const { state, isEditingText, resolvedDefaultStyle, setBold, setItalic } =
		useTextToolController()
	const displayedItalic =
		isEditingText && state.italic !== null ? state.italic : resolvedDefaultStyle.italic
	const isBold =
		isEditingText && state.fontWeight !== null
			? isBoldFontWeight(state.fontWeight)
			: resolvedDefaultStyle.bold === true ||
				isBoldFontWeight(resolvedDefaultStyle.fontWeight)
	const isItalic = displayedItalic === true

	return (
		<TextToolIconButtons
			items={[
				{
					key: "bold",
					label: t("elementTools.fontStyle.bold", "粗体"),
					icon: Bold,
					selected: isBold,
					onClick: () => {
						setBold(!isBold)
					},
				},
				{
					key: "italic",
					label: t("elementTools.fontStyle.italic", "斜体"),
					icon: Italic,
					selected: isItalic,
					onClick: () => {
						setItalic(!isItalic)
					},
				},
			]}
		/>
	)
}
