import { observer } from "mobx-react-lite"
import { useCallback } from "react"
import { useTranslation } from "react-i18next"
import { ImageUp } from "lucide-react"
import { Button } from "@/components/shadcn-ui/button"
import { Label } from "@/components/shadcn-ui/label"
import { Select, SelectItem, SelectTrigger, SelectValue } from "@/components/shadcn-ui/select"
import type { StyleSectionProps } from "../types"
import { EditorSelectContent } from "../../EditorFloating"
import { STYLE_PANEL_STYLES } from "../styles"

const OBJECT_FIT_VALUES = ["fill", "contain", "cover", "none", "scale-down"] as const
const OBJECT_POSITION_VALUES = ["center", "top", "right", "bottom", "left"] as const
type ObjectPositionValue = (typeof OBJECT_POSITION_VALUES)[number]

const OBJECT_POSITION_ALIASES: Record<string, ObjectPositionValue> = {
	"50% 50%": "center",
	"center center": "center",
	"50% 0%": "top",
	"center top": "top",
	"top center": "top",
	"100% 50%": "right",
	"right center": "right",
	"center right": "right",
	"50% 100%": "bottom",
	"center bottom": "bottom",
	"bottom center": "bottom",
	"0% 50%": "left",
	"left center": "left",
	"center left": "left",
}

function normalizeObjectPosition(value?: string): ObjectPositionValue | undefined {
	const normalized = value?.trim().toLowerCase().replace(/\s+/g, " ")
	if (!normalized) return undefined
	if (OBJECT_POSITION_VALUES.includes(normalized as ObjectPositionValue)) {
		return normalized as ObjectPositionValue
	}
	return OBJECT_POSITION_ALIASES[normalized]
}

/** Controls that only make sense for an actual image element. */
const ImageSection = observer(function ImageSection({
	selectedElement,
	editorRef,
	onStyleChange,
}: StyleSectionProps) {
	const { t } = useTranslation("super")
	const computedStyles = selectedElement?.computedStyles
	const objectFit = computedStyles?.objectFit || "fill"
	const objectPosition = normalizeObjectPosition(computedStyles?.objectPosition) || "center"

	const replaceImage = useCallback(async () => {
		if (!editorRef.current || !selectedElement) return
		if (!selectedElement.isImageElement && selectedElement.tagName.toLowerCase() !== "img")
			return
		await editorRef.current.runImageAction({ action: "replace-element-image" })
	}, [editorRef, selectedElement])

	return (
		<div
			className={STYLE_PANEL_STYLES.sectionContent}
			data-testid="html-style-panel-image-section"
		>
			<div className="flex items-center justify-between gap-2">
				<Label className="text-[11px] font-medium leading-4 text-muted-foreground">
					{t("stylePanel.imageSettings")}
				</Label>
				<Button
					type="button"
					variant="outline"
					size="sm"
					className="h-7 gap-1.5 rounded-md px-2 text-xs"
					onClick={() => void replaceImage()}
					data-testid="html-style-panel-image-replace"
				>
					<ImageUp className="h-3.5 w-3.5" />
					{t("stylePanel.replaceImage")}
				</Button>
			</div>

			<div className="grid min-w-0 grid-cols-2 gap-2">
				<div className="min-w-0 space-y-1">
					<Label className="text-[11px] font-medium leading-4 text-muted-foreground">
						{t("stylePanel.objectFit")}
					</Label>
					<Select
						value={objectFit}
						onValueChange={(value) => onStyleChange?.("objectFit", value)}
					>
						<SelectTrigger className="h-7 w-full rounded-md border-border/70 bg-background/70 px-2 text-xs">
							<SelectValue />
						</SelectTrigger>
						<EditorSelectContent>
							{OBJECT_FIT_VALUES.map((value) => (
								<SelectItem key={value} value={value}>
									{t(`stylePanel.objectFitValues.${value}`)}
								</SelectItem>
							))}
						</EditorSelectContent>
					</Select>
				</div>

				<div className="min-w-0 space-y-1">
					<Label className="text-[11px] font-medium leading-4 text-muted-foreground">
						{t("stylePanel.objectPosition")}
					</Label>
					<Select
						value={objectPosition}
						onValueChange={(value) => onStyleChange?.("objectPosition", value)}
					>
						<SelectTrigger className="h-7 w-full rounded-md border-border/70 bg-background/70 px-2 text-xs">
							<SelectValue />
						</SelectTrigger>
						<EditorSelectContent>
							{OBJECT_POSITION_VALUES.map((value) => (
								<SelectItem key={value} value={value}>
									{t(`stylePanel.objectPositionValues.${value}`)}
								</SelectItem>
							))}
						</EditorSelectContent>
					</Select>
				</div>
			</div>
		</div>
	)
})

export default ImageSection
