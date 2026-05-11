import type { ReactNode } from "react"
import { ChevronRight } from "lucide-react"
import { cn } from "@/lib/tiptap-utils"

export interface SidebarRowProps {
	label: string
	onClick: () => void
	isActive?: boolean
	isExpanded?: boolean
	disabled?: boolean
	hideChevron?: boolean
	leading?: ReactNode
	trailing?: ReactNode
	testId: string
}

export function SidebarRow({
	label,
	onClick,
	isActive = false,
	isExpanded = false,
	disabled = false,
	hideChevron = false,
	leading,
	trailing,
	testId,
}: SidebarRowProps) {
	return (
		<button
			type="button"
			className={cn(
				"flex h-10 w-full items-center gap-2 overflow-hidden px-2.5 text-left transition-[background-color,box-shadow] duration-200 ease-out hover:bg-accent/40",
				isActive && "bg-accent/50",
				disabled && "cursor-not-allowed opacity-60 hover:bg-transparent",
			)}
			disabled={disabled}
			onClick={onClick}
			data-testid={testId}
		>
			{leading && (
				<div className="flex h-4 w-4 shrink-0 items-center justify-center text-muted-foreground">
					{leading}
				</div>
			)}
			<p className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{label}</p>
			{trailing && (
				<div
					className="flex shrink-0 items-center gap-1"
					onClick={(event) => event.stopPropagation()}
				>
					{trailing}
				</div>
			)}
			{hideChevron ? null : (
				<div className="flex h-4 w-4 shrink-0 items-center justify-center text-muted-foreground">
					<ChevronRight
						className={cn(
							"h-4 w-4 transition-transform duration-200 ease-out",
							isExpanded && "rotate-90",
						)}
					/>
				</div>
			)}
		</button>
	)
}
