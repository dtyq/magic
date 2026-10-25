import { useTranslation } from "react-i18next"
import type { ReactNode } from "react"
import { Button } from "@/components/shadcn-ui/button"
import { TooltipContent, TooltipTrigger } from "@/components/shadcn-ui/tooltip"
import * as TooltipPrimitive from "@radix-ui/react-tooltip"
import { AArrowUp, AArrowDown } from "lucide-react"
import { TAILWIND_Z_INDEX_CLASSES } from "../../../constants/z-index"
import { STYLE_PANEL_STYLES } from "../styles"
import type { ContextToolbarItemMotion } from "../types"

interface FontSizeAdjusterProps {
	onAdjust: (direction: "increase" | "decrease") => void
	disabled?: boolean
	itemMotion?: ContextToolbarItemMotion
}

/**
 * Font size adjuster component
 * Provides buttons to increase/decrease font size for selected element and its children
 */
export function FontSizeAdjuster({ onAdjust, disabled, itemMotion }: FontSizeAdjusterProps) {
	const { t } = useTranslation("super")
	const renderItem = (children: ReactNode) => itemMotion?.(children) ?? children

	return (
		<div className="flex items-center gap-0.5">
			{renderItem(
				<TooltipPrimitive.Root>
					<TooltipTrigger asChild>
						<span>
							<Button
								data-testid="html-editor-font-size-increase-button"
								variant="ghost"
								size="sm"
								onClick={() => onAdjust("increase")}
								disabled={disabled}
								className={STYLE_PANEL_STYLES.iconButton}
							>
								<AArrowUp className="h-4 w-4" />
							</Button>
						</span>
					</TooltipTrigger>
					<TooltipContent className={TAILWIND_Z_INDEX_CLASSES.EDITOR_FLOATING.TOOLTIP}>
						{t("stylePanel.increaseFontSize")}
					</TooltipContent>
				</TooltipPrimitive.Root>,
			)}

			{renderItem(
				<TooltipPrimitive.Root>
					<TooltipTrigger asChild>
						<span>
							<Button
								data-testid="html-editor-font-size-decrease-button"
								variant="ghost"
								size="sm"
								onClick={() => onAdjust("decrease")}
								disabled={disabled}
								className={STYLE_PANEL_STYLES.iconButton}
							>
								<AArrowDown className="h-4 w-4" />
							</Button>
						</span>
					</TooltipTrigger>
					<TooltipContent className={TAILWIND_Z_INDEX_CLASSES.EDITOR_FLOATING.TOOLTIP}>
						{t("stylePanel.decreaseFontSize")}
					</TooltipContent>
				</TooltipPrimitive.Root>,
			)}
		</div>
	)
}
