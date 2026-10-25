import { cn } from "@/utils/cn"
import { Button } from "@/components/shadcn-ui/button"
import { ChevronUp, Loader2 } from "lucide-react"
import { useId, type ReactNode } from "react"
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
	const contentId = useId()

	return (
		<div className={cn("flex h-fit w-full flex-none overflow-hidden py-[5px]", classNames)}>
			<div
				className={cn(
					"inline-flex flex-col overflow-hidden rounded-md border border-border shadow-sm",
					open ? "w-full" : "w-fit",
				)}
			>
				{/* 头部共用一个按钮，图标、标题和空白均可切换；正文独立，选字与滚动不触发收起。 */}
				<Button
					type="button"
					variant="ghost"
					onClick={onToggle}
					aria-expanded={open}
					aria-controls={contentId}
					data-testid="on-toggle"
					className="h-7 w-full cursor-pointer justify-start gap-1.5 rounded-none bg-white p-0 pl-1.5 text-left font-normal transition-colors hover:bg-fill focus-visible:ring-inset active:bg-fill-secondary motion-reduce:transition-none dark:bg-card dark:hover:bg-fill dark:active:bg-fill-secondary"
				>
					<span className="inline-flex h-7 w-fit items-center gap-1.5 overflow-hidden py-1.5">
						{/* 保留色块内部的图标尺寸，避免 Button 的默认 SVG 样式将其放大。 */}
						<ToolIconBadge toolName="agent_think" className="[&_svg]:!size-auto" />
						<span className="w-fit flex-none text-xs font-normal leading-4 text-foreground">
							{title}
						</span>
					</span>
					<span
						className="ml-auto mr-[6px] inline-flex size-5 flex-none items-center justify-center"
						aria-hidden
					>
						{loading ? (
							<Loader2 className="size-4 animate-spin" />
						) : (
							<ChevronUp
								size={16}
								className={cn(
									"text-muted-foreground transition-transform duration-200 ease-in-out motion-reduce:transition-none",
									open ? "rotate-180" : "rotate-90",
								)}
							/>
						)}
					</span>
				</Button>
				{open && (
					<div
						id={contentId}
						className={cn(
							"w-full duration-200 animate-in fade-in slide-in-from-top-1 motion-reduce:animate-none",
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
