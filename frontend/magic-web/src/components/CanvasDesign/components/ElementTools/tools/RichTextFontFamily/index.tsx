import { useCallback } from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../ui/select"
import styles from "./index.module.css"
import { useCanvasDesignI18n } from "../../../../context/I18nContext"
import { DEFAULT_TEXT_FONT_FAMILY } from "../../../../canvas/text/richText"
import { useTextToolController } from "../text/useTextToolController"

const FONT_FAMILIES = [
	{ value: DEFAULT_TEXT_FONT_FAMILY, label: "Sans Serif" },
	{ value: "serif", label: "Serif" },
	{ value: "monospace", label: "Monospace" },
	{ value: "Georgia", label: "Georgia" },
	{ value: "Verdana", label: "Verdana" },
	{ value: "Trebuchet MS", label: "Trebuchet MS" },
	{ value: "Comic Sans MS", label: "Comic Sans MS" },
	{ value: "Impact", label: "Impact" },
	{ value: "Palatino", label: "Palatino" },
]
const SUPPORTED_FONT_FAMILY_VALUES = new Set(FONT_FAMILIES.map((font) => font.value))

export default function RichTextFontFamily() {
	const { t } = useCanvasDesignI18n()
	const { state, isEditingText, resolvedDefaultStyle, restoreSelection, setFontFamily } =
		useTextToolController()
	const richTextFontFamily = resolveRichTextFontFamilyValue(
		isEditingText && state.fontFamily !== null
			? state.fontFamily
			: resolvedDefaultStyle.fontFamily,
	)

	const handleRichTextFontFamilyChange = useCallback(
		(value: string) => {
			setFontFamily(value)
		},
		[setFontFamily],
	)

	return (
		<Select value={richTextFontFamily} onValueChange={handleRichTextFontFamilyChange}>
			<SelectTrigger className={`${styles.selectTrigger} text-sm`}>
				<SelectValue
					className="text-sm"
					placeholder={t("elementTools.fontFamily.placeholder", "字体")}
				/>
			</SelectTrigger>
			<SelectContent onContentPreserveSelection={restoreSelection}>
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

function resolveRichTextFontFamilyValue(value: string | null | undefined): string {
	if (!value) {
		return DEFAULT_TEXT_FONT_FAMILY
	}
	return SUPPORTED_FONT_FAMILY_VALUES.has(value) ? value : DEFAULT_TEXT_FONT_FAMILY
}
