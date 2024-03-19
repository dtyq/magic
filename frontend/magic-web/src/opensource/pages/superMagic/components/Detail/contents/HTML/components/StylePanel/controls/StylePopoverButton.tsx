import type { ReactNode } from "react"
import { Button } from "@/opensource/components/shadcn-ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/opensource/components/shadcn-ui/popover"
import { TooltipContent, TooltipTrigger } from "@/opensource/components/shadcn-ui/tooltip"
import * as TooltipPrimitive from "@radix-ui/react-tooltip"

interface StylePopoverButtonProps {
	icon: ReactNode
	tooltip: string
	title: string
	disabled?: boolean
	showLabel?: boolean
	children: ReactNode
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
									className={showLabel ? "h-8 gap-1.5 px-2" : "h-8 w-8"}
									disabled={disabled}
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
				{!showLabel && <TooltipContent>{tooltip}</TooltipContent>}
			</TooltipPrimitive.Root>
			<PopoverContent className="z-popup w-80" align="start">
				<div className="space-y-3">
					<h4 className="text-sm font-medium">{title}</h4>
					{children}
				</div>
			</PopoverContent>
		</Popover>
	)
}
