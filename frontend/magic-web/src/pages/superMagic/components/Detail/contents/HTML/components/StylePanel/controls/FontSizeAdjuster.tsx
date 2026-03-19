import { useTranslation } from "react-i18next"
import { Button } from "@/components/shadcn-ui/button"
import { TooltipContent, TooltipTrigger } from "@/components/shadcn-ui/tooltip"
import * as TooltipPrimitive from "@radix-ui/react-tooltip"
import { AArrowUp, AArrowDown } from "lucide-react"

interface FontSizeAdjusterProps {
	onAdjust: (direction: "increase" | "decrease") => void
	disabled?: boolean
}

/**
 * Font size adjuster component
 * Provides buttons to increase/decrease font size for selected element and its children
 */
export function FontSizeAdjuster({ onAdjust, disabled }: FontSizeAdjusterProps) {
	const { t } = useTranslation("super")

	return (
		<div className="flex items-center gap-0.5">
			<TooltipPrimitive.Root>
				<TooltipTrigger asChild>
					<span>
						<Button
							variant="ghost"
							size="sm"
							onClick={() => onAdjust("increase")}
							disabled={disabled}
							className="h-8 w-8 p-0"
						>
							<AArrowUp className="h-4 w-4" />
						</Button>
					</span>
				</TooltipTrigger>
				<TooltipContent>{t("stylePanel.increaseFontSize")}</TooltipContent>
			</TooltipPrimitive.Root>

			<TooltipPrimitive.Root>
				<TooltipTrigger asChild>
					<span>
						<Button
							variant="ghost"
							size="sm"
							onClick={() => onAdjust("decrease")}
							disabled={disabled}
							className="h-8 w-8 p-0"
						>
							<AArrowDown className="h-4 w-4" />
						</Button>
					</span>
				</TooltipTrigger>
				<TooltipContent>{t("stylePanel.decreaseFontSize")}</TooltipContent>
			</TooltipPrimitive.Root>
		</div>
	)
}
