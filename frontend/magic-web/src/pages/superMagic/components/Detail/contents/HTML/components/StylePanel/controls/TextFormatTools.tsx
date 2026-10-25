import { useTranslation } from "react-i18next"
import type { ReactNode } from "react"
import { Toggle } from "@/components/shadcn-ui/toggle"
import { TooltipContent, TooltipTrigger } from "@/components/shadcn-ui/tooltip"
import * as TooltipPrimitive from "@radix-ui/react-tooltip"
import { Bold, Italic, Underline, Strikethrough } from "lucide-react"
import { TAILWIND_Z_INDEX_CLASSES } from "../../../constants/z-index"
import { STYLE_PANEL_STYLES } from "../styles"
import type { ContextToolbarItemMotion } from "../types"

interface TextFormatToolsProps {
	isBold: boolean
	isItalic: boolean
	hasUnderline: boolean
	hasLineThrough: boolean
	onFormat: (property: string, value: string) => void
	disabled?: boolean
	itemMotion?: ContextToolbarItemMotion
}

/**
 * Text formatting tools component (bold, italic, underline, strikethrough)
 */
export function TextFormatTools({
	isBold,
	isItalic,
	hasUnderline,
	hasLineThrough,
	onFormat,
	disabled,
	itemMotion,
}: TextFormatToolsProps) {
	const { t } = useTranslation("super")
	const renderItem = (children: ReactNode) => itemMotion?.(children) ?? children

	/**
	 * Handle text decoration changes (underline and line-through can coexist)
	 */
	function handleTextDecorationChange(type: "underline" | "line-through", pressed: boolean) {
		const decorations: string[] = []

		if (type === "underline") {
			if (pressed) decorations.push("underline")
			if (hasLineThrough) decorations.push("line-through")
		} else {
			if (hasUnderline) decorations.push("underline")
			if (pressed) decorations.push("line-through")
		}

		const value = decorations.length > 0 ? decorations.join(" ") : "none"
		onFormat("textDecoration", value)
	}

	return (
		<div className="flex items-center gap-0.5">
			{renderItem(
				<TooltipPrimitive.Root>
					<TooltipTrigger asChild>
						<span>
							<Toggle
								data-testid="html-editor-text-format-bold-button"
								size="sm"
								pressed={isBold}
								onPressedChange={(pressed) =>
									onFormat("fontWeight", pressed ? "700" : "400")
								}
								disabled={disabled}
								className={STYLE_PANEL_STYLES.iconButton}
							>
								<Bold className="h-4 w-4" />
							</Toggle>
						</span>
					</TooltipTrigger>
					<TooltipContent className={TAILWIND_Z_INDEX_CLASSES.EDITOR_FLOATING.TOOLTIP}>
						{t("stylePanel.bold")}
					</TooltipContent>
				</TooltipPrimitive.Root>,
			)}
			{renderItem(
				<TooltipPrimitive.Root>
					<TooltipTrigger asChild>
						<span>
							<Toggle
								data-testid="html-editor-text-format-italic-button"
								size="sm"
								pressed={isItalic}
								onPressedChange={(pressed) =>
									onFormat("fontStyle", pressed ? "italic" : "normal")
								}
								disabled={disabled}
								className={STYLE_PANEL_STYLES.iconButton}
							>
								<Italic className="h-4 w-4" />
							</Toggle>
						</span>
					</TooltipTrigger>
					<TooltipContent className={TAILWIND_Z_INDEX_CLASSES.EDITOR_FLOATING.TOOLTIP}>
						{t("stylePanel.italic")}
					</TooltipContent>
				</TooltipPrimitive.Root>,
			)}
			{renderItem(
				<TooltipPrimitive.Root>
					<TooltipTrigger asChild>
						<span>
							<Toggle
								data-testid="html-editor-text-format-underline-button"
								size="sm"
								pressed={hasUnderline}
								onPressedChange={(pressed) =>
									handleTextDecorationChange("underline", pressed)
								}
								disabled={disabled}
								className={STYLE_PANEL_STYLES.iconButton}
							>
								<Underline className="h-4 w-4" />
							</Toggle>
						</span>
					</TooltipTrigger>
					<TooltipContent className={TAILWIND_Z_INDEX_CLASSES.EDITOR_FLOATING.TOOLTIP}>
						{t("stylePanel.underline")}
					</TooltipContent>
				</TooltipPrimitive.Root>,
			)}
			{renderItem(
				<TooltipPrimitive.Root>
					<TooltipTrigger asChild>
						<span>
							<Toggle
								data-testid="html-editor-text-format-strikethrough-button"
								size="sm"
								pressed={hasLineThrough}
								onPressedChange={(pressed) =>
									handleTextDecorationChange("line-through", pressed)
								}
								disabled={disabled}
								className={STYLE_PANEL_STYLES.iconButton}
							>
								<Strikethrough className="h-4 w-4" />
							</Toggle>
						</span>
					</TooltipTrigger>
					<TooltipContent className={TAILWIND_Z_INDEX_CLASSES.EDITOR_FLOATING.TOOLTIP}>
						{t("stylePanel.strikethrough")}
					</TooltipContent>
				</TooltipPrimitive.Root>,
			)}
		</div>
	)
}
