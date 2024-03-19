import { useTranslation } from "react-i18next"
import { Toggle } from "@/opensource/components/shadcn-ui/toggle"
import { TooltipContent, TooltipTrigger } from "@/opensource/components/shadcn-ui/tooltip"
import * as TooltipPrimitive from "@radix-ui/react-tooltip"
import { Bold, Italic, Underline, Strikethrough } from "lucide-react"

interface TextFormatToolsProps {
	isBold: boolean
	isItalic: boolean
	hasUnderline: boolean
	hasLineThrough: boolean
	onFormat: (property: string, value: string) => void
	disabled?: boolean
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
}: TextFormatToolsProps) {
	const { t } = useTranslation("super")

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
			<TooltipPrimitive.Root>
				<TooltipTrigger asChild>
					<span>
						<Toggle
							size="sm"
							pressed={isBold}
							onPressedChange={(pressed) =>
								onFormat("fontWeight", pressed ? "700" : "400")
							}
							disabled={disabled}
							className="h-8 w-8 p-0"
						>
							<Bold className="h-4 w-4" />
						</Toggle>
					</span>
				</TooltipTrigger>
				<TooltipContent>{t("stylePanel.bold")}</TooltipContent>
			</TooltipPrimitive.Root>
			<TooltipPrimitive.Root>
				<TooltipTrigger asChild>
					<span>
						<Toggle
							size="sm"
							pressed={isItalic}
							onPressedChange={(pressed) =>
								onFormat("fontStyle", pressed ? "italic" : "normal")
							}
							disabled={disabled}
							className="h-8 w-8 p-0"
						>
							<Italic className="h-4 w-4" />
						</Toggle>
					</span>
				</TooltipTrigger>
				<TooltipContent>{t("stylePanel.italic")}</TooltipContent>
			</TooltipPrimitive.Root>
			<TooltipPrimitive.Root>
				<TooltipTrigger asChild>
					<span>
						<Toggle
							size="sm"
							pressed={hasUnderline}
							onPressedChange={(pressed) =>
								handleTextDecorationChange("underline", pressed)
							}
							disabled={disabled}
							className="h-8 w-8 p-0"
						>
							<Underline className="h-4 w-4" />
						</Toggle>
					</span>
				</TooltipTrigger>
				<TooltipContent>{t("stylePanel.underline")}</TooltipContent>
			</TooltipPrimitive.Root>
			<TooltipPrimitive.Root>
				<TooltipTrigger asChild>
					<span>
						<Toggle
							size="sm"
							pressed={hasLineThrough}
							onPressedChange={(pressed) =>
								handleTextDecorationChange("line-through", pressed)
							}
							disabled={disabled}
							className="h-8 w-8 p-0"
						>
							<Strikethrough className="h-4 w-4" />
						</Toggle>
					</span>
				</TooltipTrigger>
				<TooltipContent>{t("stylePanel.strikethrough")}</TooltipContent>
			</TooltipPrimitive.Root>
		</div>
	)
}
