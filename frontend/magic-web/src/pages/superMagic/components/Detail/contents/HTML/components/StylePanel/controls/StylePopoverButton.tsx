import type { ReactNode } from "react"
import { Button } from "@/components/shadcn-ui/button"
import { Popover, PopoverTrigger } from "@/components/shadcn-ui/popover"
import { TooltipContent, TooltipTrigger } from "@/components/shadcn-ui/tooltip"
import * as TooltipPrimitive from "@radix-ui/react-tooltip"
import { TAILWIND_Z_INDEX_CLASSES } from "../../../constants/z-index"
import { EditorPopoverContent } from "../../EditorFloating"
import { STYLE_PANEL_STYLES } from "../styles"

interface StylePopoverButtonProps {
	icon: ReactNode
	tooltip: string
	title: string
	disabled?: boolean
	showLabel?: boolean
	children: ReactNode
	triggerTestId?: string
	contentTestId?: string
	contentClassName?: string
}

/**
 * Generic style popover button component
 */
export function StylePopoverButton({
	icon,
	tooltip,
	title,
	disabled,
	showLabel = false,
	children,
	triggerTestId,
	contentTestId,
	contentClassName,
}: StylePopoverButtonProps) {
	return (
		<Popover>
			<TooltipPrimitive.Root>
				<PopoverTrigger asChild>
					<span>
						<TooltipTrigger asChild>
							<span>
								<Button
									variant="ghost"
									size={showLabel ? "sm" : "icon"}
									className={
										showLabel
											? `h-7 gap-1.5 px-2 ${STYLE_PANEL_STYLES.toolbarButton}`
											: `h-7 w-7 ${STYLE_PANEL_STYLES.toolbarButton}`
									}
									disabled={disabled}
									data-testid={triggerTestId}
								>
									{icon}
									{showLabel && (
										<span className="text-xs font-normal">{title}</span>
									)}
								</Button>
							</span>
						</TooltipTrigger>
					</span>
				</PopoverTrigger>
				{!showLabel && (
					<TooltipContent className={TAILWIND_Z_INDEX_CLASSES.EDITOR_FLOATING.TOOLTIP}>
						{tooltip}
					</TooltipContent>
				)}
			</TooltipPrimitive.Root>
			<EditorPopoverContent
				collisionPadding={8}
				className={`w-[min(22rem,calc(100vw-1rem))] max-w-[calc(100vw-1rem)] max-h-[min(30rem,calc(100vh-1rem))] overflow-y-auto ${contentClassName || ""}`.trim()}
				align="start"
				data-testid={contentTestId}
			>
				<div className="min-w-0 space-y-2">
					<h4 className="text-xs font-semibold leading-4">{title}</h4>
					{children}
				</div>
			</EditorPopoverContent>
		</Popover>
	)
}
