import { cn } from "@/lib/utils"
import { ChevronUp, Loader2 } from "lucide-react"
import type { ReactNode } from "react"
import { ToolIconBadge } from "../../../shared/ToolIconConfig"

interface ReasoningPanelProps {
	open: boolean
	title: string
	onToggle: () => void
	loading?: boolean
	children: ReactNode
	classNames?: string
	contentClassName?: string
}

export function ReasoningPanel(props: ReasoningPanelProps) {
	const { open, title, onToggle, children, contentClassName, classNames, loading } = props

	return (
		<div className={cn("flex h-fit w-full flex-none overflow-hidden py-[5px]", classNames)}>
			<div
				className={cn(
					"inline-flex flex-col overflow-hidden rounded-md border border-border shadow-sm",
					open ? "w-full" : "w-fit",
				)}
			>
				<div className="flex w-full items-center gap-1.5 bg-white pl-1.5 dark:bg-card">
					<div className="inline-flex h-7 w-fit items-center gap-1.5 overflow-hidden py-1.5">
						<ToolIconBadge toolName="agent_think" />
						<span className="w-fit flex-none text-xs font-normal leading-4 text-foreground">
							{title}
						</span>
					</div>
					<div
						className="ml-auto mr-[6px] inline-flex size-5 flex-none cursor-pointer items-center justify-center rounded-[4px] hover:bg-fill active:bg-fill-secondary"
						onClick={onToggle}
					>
						{loading ? (
							<Loader2 className="size-4 animate-spin" />
						) : (
							<ChevronUp
								size={16}
								className={cn(
									"text-muted-foreground transition-transform duration-200 ease-in-out",
									open ? "rotate-180" : "rotate-90",
								)}
							/>
						)}
					</div>
				</div>
				{open && (
					<div
						className={cn(
							"w-full duration-200 animate-in fade-in slide-in-from-top-1",
							contentClassName,
						)}
					>
						{children}
					</div>
				)}
			</div>
		</div>
	)
}
