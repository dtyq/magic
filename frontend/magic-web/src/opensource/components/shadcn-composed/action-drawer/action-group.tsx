import { memo } from "react"
import { cn } from "@/opensource/lib/utils"
import type { ActionGroupProps } from "./types"

/**
 * ActionGroup - Container for grouped action items
 */
function ActionGroupComponent(props: ActionGroupProps) {
	const { children, className } = props

	return (
		<div className={cn("flex-shrink-0 overflow-hidden rounded-md bg-popover", className)}>
			{children}
		</div>
	)
}

ActionGroupComponent.displayName = "ActionGroup"

export const ActionGroup = memo(ActionGroupComponent)
