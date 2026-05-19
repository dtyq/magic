import type { ReactNode } from "react"
import { History } from "lucide-react"
import { Button } from "@/components/shadcn-ui/button"
import { MagicTooltip } from "@/components/base"
import { cn } from "@/lib/utils"

export interface TopicHistoryTriggerProps {
	mode: "dropdown" | "layout"
	isActive: boolean
	tooltipTitle: string
	onToggle?: () => void
	renderDropdown?: (trigger: ReactNode) => ReactNode
}

const headerIconButtonClassName = "!size-6 !min-h-6 !min-w-6 !rounded-md !p-0"

export function TopicHistoryTrigger({
	mode,
	isActive,
	tooltipTitle,
	onToggle,
	renderDropdown,
}: TopicHistoryTriggerProps) {
	const trigger = (
		<MagicTooltip title={tooltipTitle}>
			<span>
				<Button
					variant="ghost"
					size="icon-sm"
					className={cn(headerIconButtonClassName, isActive && "bg-accent")}
					data-testid="message-header-history-button"
					onClick={mode === "layout" ? onToggle : undefined}
				>
					<History size={16} className="shrink-0 text-foreground" />
				</Button>
			</span>
		</MagicTooltip>
	)

	// `layout` 是当前主路径；`dropdown` 仅保留给遗留兼容场景。
	if (mode === "layout") return trigger
	return renderDropdown?.(trigger) ?? trigger
}
