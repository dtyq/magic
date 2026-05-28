import { Inbox } from "lucide-react"
import { cn } from "@/lib/utils"

interface MobileListEmptyIconProps {
	className?: string
}

/**
 * Generic muted icon for mobile list empty states (no data, not search).
 * Centralizes the illustration so list pages do not pick resource-specific lucide icons by mistake.
 */
export function MobileListEmptyIcon({ className }: MobileListEmptyIconProps) {
	return (
		<Inbox
			className={cn("size-10 text-muted-foreground/50", className)}
			aria-hidden
			data-testid="mobile-list-empty-icon"
		/>
	)
}
