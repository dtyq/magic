import * as React from "react"

// --- Tiptap UI Primitive ---
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/tiptap-ui-primitive/tooltip"

// --- Lib ---
import { cn, parseShortcutKeys } from "@/lib/tiptap-utils"

import "@/components/tiptap-ui-primitive/button/button-colors.scss"
import "@/components/tiptap-ui-primitive/button/button-group.scss"
import "@/components/tiptap-ui-primitive/button/button.scss"

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
	className?: string
	showTooltip?: boolean
	tooltip?: React.ReactNode
	shortcutKeys?: string
}

export const ShortcutDisplay: React.FC<{ shortcuts: string[] }> = ({ shortcuts }) => {
	if (shortcuts.length === 0) return null

	return (
		<div>
			{shortcuts.map((key, index) => (
				<React.Fragment key={index}>
					{index > 0 && <kbd>+</kbd>}
					<kbd>{key}</kbd>
				</React.Fragment>
			))}
		</div>
	)
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
	(
		{
			className,
			children,
			tooltip,
			showTooltip = true,
			shortcutKeys,
			"aria-label": ariaLabel,
			...props
		},
		ref,
	) => {
		const shortcuts = React.useMemo(() => parseShortcutKeys({ shortcutKeys }), [shortcutKeys])

		if (!tooltip || !showTooltip) {
			return (
				<button
					className={cn("tiptap-button", className)}
					ref={ref}
					aria-label={ariaLabel}
					{...props}
				>
					{children}
				</button>
			)
		}

		return (
			<Tooltip delay={200}>
				<TooltipTrigger
					className={cn("tiptap-button", className)}
					ref={ref}
					aria-label={ariaLabel}
					{...props}
				>
					{children}
				</TooltipTrigger>
				<TooltipContent>
					{tooltip}
					<ShortcutDisplay shortcuts={shortcuts} />
				</TooltipContent>
			</Tooltip>
		)
	},
)

Button.displayName = "Button"

export const ButtonGroup = React.forwardRef<
	HTMLDivElement,
	React.ComponentProps<"div"> & {
		orientation?: "horizontal" | "vertical"
	}
>(({ className, children, orientation = "vertical", ...props }, ref) => {
	return (
		<div
			ref={ref}
			className={cn("tiptap-button-group", className)}
			data-orientation={orientation}
			role="group"
			{...props}
		>
			{children}
		</div>
	)
})
ButtonGroup.displayName = "ButtonGroup"

export default Button
