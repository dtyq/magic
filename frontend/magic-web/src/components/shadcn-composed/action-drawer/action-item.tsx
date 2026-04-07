import { memo, useCallback } from "react"
import { cn } from "@/lib/utils"
import type { ActionItemProps } from "./types"

/**
 * ActionItem - Individual action button within a group
 */
function ActionItemComponent(props: ActionItemProps) {
	const {
		label,
		icon,
		onClick,
		disabled = false,
		variant = "default",
		className,
		"data-testid": dataTestId,
	} = props

	const isDestructive = variant === "destructive"

	const handleClick = useCallback(() => {
		if (!disabled) {
			onClick?.()
		}
	}, [onClick, disabled])

	return (
		<button
			type="button"
			onClick={handleClick}
			disabled={disabled}
			data-testid={dataTestId}
			className={cn(
				"flex h-10 w-full items-center gap-2 bg-transparent px-2 transition-colors",
				"text-sm text-foreground",
				"cursor-not-allowed disabled:opacity-50",
				"border-b border-border last:border-b-0",
				!disabled && "hover:bg-accent",
				isDestructive && "text-destructive",
				className,
			)}
		>
			{icon && <span className="shrink-0 [&_svg]:size-4">{icon}</span>}
			<span className="flex-1 text-left">{label}</span>
		</button>
	)
}

ActionItemComponent.displayName = "ActionItem"

export const ActionItem = memo(ActionItemComponent)
