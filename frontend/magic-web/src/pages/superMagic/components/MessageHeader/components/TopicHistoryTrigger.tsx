import type { ReactNode, RefObject } from "react"
import { History } from "lucide-react"
import { Button } from "@/components/shadcn-ui/button"
import { MagicTooltip } from "@/components/base"
import { cn } from "@/utils/cn"

export interface TopicHistoryTriggerProps {
	mode: "dropdown" | "layout"
	isActive: boolean
	tooltipTitle: string
	onToggle?: () => void
	/** Notified after the history control has already toggled. */
	onTriggerAction?: () => Promise<void> | void
	renderDropdown?: (trigger: ReactNode) => ReactNode
	triggerRef?: RefObject<HTMLButtonElement>
}

const headerIconButtonClassName =
	"!size-[var(--conversation-header-button-size,24px)] !min-h-6 !min-w-6 !rounded-md !p-0"

export function TopicHistoryTrigger({
	mode,
	isActive,
	tooltipTitle,
	onToggle,
	onTriggerAction,
	renderDropdown,
	triggerRef,
}: TopicHistoryTriggerProps) {
	const button = (
		<Button
			ref={triggerRef}
			aria-label={tooltipTitle}
			variant="ghost"
			size="icon-sm"
			className={cn(headerIconButtonClassName, isActive && "bg-accent")}
			data-testid="message-header-history-button"
			onClick={
				mode === "layout"
					? () => {
							onToggle?.()
							if (!onTriggerAction) return
							void Promise.resolve(onTriggerAction()).catch(() => {
								// A host callback failure must not undo the history toggle.
							})
						}
					: undefined
			}
		>
			<History size={16} className="shrink-0 text-foreground" />
		</Button>
	)
	// Radix DropdownMenuTrigger must receive the ref-forwarding Button directly;
	// placing MagicTooltip between them drops the injected pointer and keyboard handlers.
	const trigger = mode === "dropdown" ? (renderDropdown?.(button) ?? button) : button

	return (
		<MagicTooltip title={tooltipTitle}>
			<span>{trigger}</span>
		</MagicTooltip>
	)
}
