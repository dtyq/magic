import { useTranslation } from "react-i18next"
import { Toggle } from "@/opensource/components/shadcn-ui/toggle"
import { TooltipContent, TooltipTrigger } from "@/opensource/components/shadcn-ui/tooltip"
import * as TooltipPrimitive from "@radix-ui/react-tooltip"
import { AlignLeft, AlignCenter, AlignRight } from "lucide-react"

interface TextAlignToolsProps {
	textAlign: string
	onAlign: (value: string) => void
	disabled?: boolean
}

/**
 * Text alignment tools component
 */
export function TextAlignTools({ textAlign, onAlign, disabled }: TextAlignToolsProps) {
	const { t } = useTranslation("super")

	return (
		<div className="flex items-center gap-0.5">
			<TooltipPrimitive.Root>
				<TooltipTrigger asChild>
					<span>
						<Toggle
							size="sm"
							pressed={textAlign === "left"}
							onPressedChange={() => onAlign("left")}
							disabled={disabled}
							className="h-8 w-8 p-0"
						>
							<AlignLeft className="h-4 w-4" />
						</Toggle>
					</span>
				</TooltipTrigger>
				<TooltipContent>{t("stylePanel.alignLeft")}</TooltipContent>
			</TooltipPrimitive.Root>
			<TooltipPrimitive.Root>
				<TooltipTrigger asChild>
					<span>
						<Toggle
							size="sm"
							pressed={textAlign === "center"}
							onPressedChange={() => onAlign("center")}
							disabled={disabled}
							className="h-8 w-8 p-0"
						>
							<AlignCenter className="h-4 w-4" />
						</Toggle>
					</span>
				</TooltipTrigger>
				<TooltipContent>{t("stylePanel.alignCenter")}</TooltipContent>
			</TooltipPrimitive.Root>
			<TooltipPrimitive.Root>
				<TooltipTrigger asChild>
					<span>
						<Toggle
							size="sm"
							pressed={textAlign === "right"}
							onPressedChange={() => onAlign("right")}
							disabled={disabled}
							className="h-8 w-8 p-0"
						>
							<AlignRight className="h-4 w-4" />
						</Toggle>
					</span>
				</TooltipTrigger>
				<TooltipContent>{t("stylePanel.alignRight")}</TooltipContent>
			</TooltipPrimitive.Root>
		</div>
	)
}
