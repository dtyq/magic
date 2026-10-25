import { useId } from "react"
import type { MouseEvent, ReactNode } from "react"
import { ChevronRight, CircleAlert, CircleCheck, CircleX, Loader2 } from "lucide-react"
import { cn } from "@/utils/cn"
import { ToolIconBadge } from "../../../../../shared/ToolIconConfig"
import type { ToolCallViewModel } from "../../types"

/**
 * | tone | 含义 | 图标 |
 * | running | 工具还在执行 | 转圈 |
 * | success | 全部完成 | 绿色对勾 |
 * | partial | 部分完成（如小组讨论有人没回答） | 黄色感叹号 |
 * | error | 没有完成 | 红色叉 |
 */
export type ResearchToolTone = "running" | "success" | "partial" | "error"

export function resolveTone(loading: boolean, status: string | undefined): ResearchToolTone {
	if (loading) return "running"
	return status === "error" ? "error" : "success"
}

function ToneIcon({ tone }: { tone: ResearchToolTone }) {
	if (tone === "running")
		return (
			<Loader2
				size={16}
				className="shrink-0 animate-spin text-muted-foreground"
				aria-hidden
			/>
		)
	if (tone === "success")
		return <CircleCheck size={16} className="shrink-0 text-success" aria-hidden />
	if (tone === "partial")
		return <CircleAlert size={16} className="shrink-0 text-warning" aria-hidden />
	return <CircleX size={16} className="shrink-0 text-destructive" aria-hidden />
}

interface ResearchToolCardProps {
	toolData: ToolCallViewModel
	tone: ResearchToolTone
	classNames?: string
	/** 紧跟在动作名后面的业务摘要：迷你进度条、头像组、轮次 */
	summary?: ReactNode
	/** 不传时显示后端 remark；摘要已经说清楚时传 null 隐藏 */
	remark?: string | null
	/** 传入 children 时头部可点击展开 */
	open?: boolean
	onToggle?: () => void
	children?: ReactNode
	onMouseEnter?: (evt: MouseEvent) => void
	onMouseLeave?: (evt: MouseEvent) => void
}

/**
 * AI 研究工具卡片的外壳：和子智能体卡片同一套头部（图标、动作、摘要、状态、展开箭头），
 * 让研究流程里的卡片和其他工具卡片在消息流中对齐。
 */
export default function ResearchToolCard({
	toolData,
	tone,
	classNames,
	summary,
	remark = toolData.remark,
	open = false,
	onToggle,
	children,
	onMouseEnter,
	onMouseLeave,
}: ResearchToolCardProps) {
	const contentId = useId()
	const expandable = Boolean(children && onToggle)
	const header = (
		<>
			<ToolIconBadge toolName={toolData.name} />
			{toolData.action && <span className="shrink-0 text-foreground">{toolData.action}</span>}
			{summary}
			{remark && (
				<span className="min-w-0 truncate text-muted-foreground" aria-live="polite">
					{remark}
				</span>
			)}
			<span className="ml-auto inline-flex shrink-0 items-center pl-1">
				<ToneIcon tone={tone} />
			</span>
			{expandable && (
				<ChevronRight
					size={16}
					aria-hidden
					className={cn(
						"shrink-0 text-muted-foreground transition-transform motion-reduce:transition-none",
						open && "rotate-90",
					)}
				/>
			)}
		</>
	)
	const headerClassName =
		"flex min-h-7 w-full min-w-0 items-center gap-1.5 p-1.5 text-left text-xs font-normal"

	return (
		<div
			className={cn("h-fit w-full flex-none", classNames)}
			data-tool={toolData.id}
			onMouseEnter={onMouseEnter}
			onMouseLeave={onMouseLeave}
		>
			<div
				className={cn(
					"inline-flex max-w-full flex-col overflow-hidden rounded-md border border-border bg-card shadow-sm",
					expandable && open ? "w-full" : "w-fit",
				)}
			>
				{expandable ? (
					<button
						type="button"
						onClick={onToggle}
						aria-expanded={open}
						aria-controls={contentId}
						className={cn(
							headerClassName,
							"outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
						)}
					>
						{header}
					</button>
				) : (
					<div className={headerClassName}>{header}</div>
				)}
				{expandable && open && (
					<div id={contentId} className="border-t border-border">
						{children}
					</div>
				)}
			</div>
		</div>
	)
}
