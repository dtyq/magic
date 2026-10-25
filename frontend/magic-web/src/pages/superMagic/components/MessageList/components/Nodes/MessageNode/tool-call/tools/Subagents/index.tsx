import { memo, useCallback, useId } from "react"
import type { MouseEvent } from "react"
import { useTranslation } from "react-i18next"
import { ChevronRight, CircleAlert, CircleCheck, CircleX, Loader2 } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { Button } from "@/components/shadcn-ui/button"
import { ScrollArea } from "@/components/shadcn-ui/scroll-area"
import type { DetailSubagentItem } from "@/pages/superMagic/components/Detail/types"
import { cn } from "@/utils/cn"
import { ToolIconBadge } from "../../../../../shared/ToolIconConfig"
import { useToggleWithScrollPreserve } from "../../../../shared/hooks/useToggleWithScrollPreserve"
import DefaultTool from "../Default"
import type { ToolCallViewModel } from "../../types"
import { getSubagentsDetailData } from "./subagentsDetail"

interface SubagentsToolProps {
	toolData: ToolCallViewModel
	loading?: boolean
	classNames?: string
	onClick?: () => void
	onMouseEnter?: (evt: MouseEvent) => void
	onMouseLeave?: (evt: MouseEvent) => void
}

interface StatusVisual {
	icon: LucideIcon
	className: string
	spin?: boolean
}

const IN_FLIGHT_STATUSES = new Set(["pending", "running"])

/**
 * | 状态 | 图标 |
 * | pending / running | 转圈 |
 * | done | 绿色对勾 |
 * | error | 红色叉 |
 * | interrupted / not_found / ambiguous | 黄色感叹号（没正常完成，但不是子智能体自己出错） |
 */
function getAgentStatusVisual(status: string): StatusVisual {
	if (IN_FLIGHT_STATUSES.has(status))
		return { icon: Loader2, className: "text-muted-foreground", spin: true }
	if (status === "done") return { icon: CircleCheck, className: "text-success" }
	if (status === "error") return { icon: CircleX, className: "text-destructive" }
	return { icon: CircleAlert, className: "text-warning" }
}

/** 结果态头部：全部完成为对勾，全部失败为叉，其余（部分失败、被停止、没找到）为感叹号 */
function getSettledVisual(agents: DetailSubagentItem[]): StatusVisual {
	if (agents.length > 0 && agents.every((agent) => agent.status === "done"))
		return getAgentStatusVisual("done")
	if (agents.length > 0 && agents.every((agent) => agent.status === "error"))
		return getAgentStatusVisual("error")
	return getAgentStatusVisual("interrupted")
}

function useFormatDuration() {
	const { t } = useTranslation("super")
	return useCallback(
		(totalSeconds: number) => {
			const seconds = Math.max(0, Math.floor(totalSeconds))
			if (seconds < 60) return t("subagents.durationSeconds", { seconds })
			const minutes = Math.floor(seconds / 60)
			if (minutes < 60)
				return t("subagents.durationMinutes", { minutes, seconds: seconds % 60 })
			return t("subagents.durationHours", {
				hours: Math.floor(minutes / 60),
				minutes: minutes % 60,
			})
		},
		[t],
	)
}

function useAgentStatusLabel() {
	const { t } = useTranslation("super")
	return useCallback(
		(status: string) => {
			switch (status) {
				case "pending":
				case "running":
					return t("subagents.status.running")
				case "done":
					return t("subagents.status.done")
				case "error":
					return t("subagents.status.error")
				case "interrupted":
					return t("subagents.status.interrupted")
				default:
					return t("subagents.status.notFound")
			}
		},
		[t],
	)
}

function SubagentRow({
	agent,
	settled,
	formatDuration,
	statusLabel,
}: {
	agent: DetailSubagentItem
	settled: boolean
	formatDuration: (seconds: number) => string
	statusLabel: string
}) {
	const visual = getAgentStatusVisual(agent.status)
	const StatusIcon = visual.icon
	return (
		<li className="flex items-start gap-2 py-2 text-xs">
			<StatusIcon
				size={16}
				className={cn("shrink-0", visual.className, visual.spin && "animate-spin")}
				aria-label={statusLabel}
			/>
			<div className="min-w-0 flex-1">
				<div className="flex items-start justify-between gap-3">
					<span className="min-w-0 break-all text-foreground">{agent.label}</span>
					{agent.elapsed_seconds !== undefined && (
						<span className="shrink-0 tabular-nums text-muted-foreground">
							{formatDuration(agent.elapsed_seconds)}
						</span>
					)}
				</div>
				{agent.last_activity && (
					<p className="mb-0 mt-1 line-clamp-2 break-words text-muted-foreground">
						{agent.last_activity}
					</p>
				)}
				{settled && agent.result && (
					<p className="mb-0 mt-1 line-clamp-2 break-words text-muted-foreground">
						{agent.result}
					</p>
				)}
				{agent.error && (
					<p className="mb-0 mt-1 line-clamp-2 break-words text-destructive">
						{agent.error}
					</p>
				)}
			</div>
		</li>
	)
}

/**
 * 等待子智能体的卡片：头部一句汇总，展开后一行一个子智能体。
 * 等待期间后端每 3 秒用同一个 correlation_id 推送新 detail，卡片就地刷新；等待结束后变成结果态。
 * 完整结果已进入主智能体上下文并由它回复用户，所以卡片只摘要显示，不打开回放面板。
 */
function SubagentsTool({
	toolData,
	loading = false,
	classNames,
	onClick,
	onMouseEnter,
	onMouseLeave,
}: SubagentsToolProps) {
	const { t } = useTranslation("super")
	const contentId = useId()
	// 默认展开：等待期间用户的注意力就在这份名单上；结果态保留用户当前的展开选择
	const [open, toggle] = useToggleWithScrollPreserve(true, "subagents-expanded")
	const formatDuration = useFormatDuration()
	const getStatusLabel = useAgentStatusLabel()
	const data = getSubagentsDetailData(toolData.detail)

	// 老消息里是终端文本形状的 detail，没有可展开的名单，沿用默认卡片
	if (!data || data.agents.length === 0) {
		return (
			<DefaultTool
				toolData={toolData}
				loading={loading}
				classNames={classNames}
				onClick={onClick}
				onMouseEnter={onMouseEnter}
				onMouseLeave={onMouseLeave}
			/>
		)
	}

	const settled = !loading || data.phase === "settled"
	const settledVisual = getSettledVisual(data.agents)
	const SettledIcon = settledVisual.icon
	const summary = data.message || toolData.remark

	return (
		<div
			className={cn("h-fit w-full flex-none", classNames)}
			data-tool={toolData.id}
			onMouseEnter={onMouseEnter}
			onMouseLeave={onMouseLeave}
		>
			<div
				className={cn(
					"inline-flex max-w-full flex-col rounded-md border border-border bg-card shadow-sm",
					open ? "w-full" : "w-fit",
				)}
			>
				<Button
					type="button"
					variant="ghost"
					onClick={toggle}
					aria-expanded={open}
					aria-controls={contentId}
					className="h-auto min-h-7 w-full justify-start gap-1.5 whitespace-normal p-1.5 text-left text-xs font-normal focus-visible:ring-inset"
				>
					<ToolIconBadge toolName={toolData.name} />
					{toolData.action && <span className="shrink-0">{toolData.action}</span>}
					{summary && (
						<span
							className="min-w-0 break-words text-muted-foreground"
							aria-live="polite"
						>
							{summary}
						</span>
					)}
					<span className="ml-auto inline-flex shrink-0 items-center gap-1 tabular-nums text-muted-foreground">
						{settled ? (
							<SettledIcon
								size={16}
								className={settledVisual.className}
								aria-label={t("subagents.settled")}
							/>
						) : (
							<>
								<Loader2 size={16} className="animate-spin" aria-hidden />
								{!data.indeterminate && <span>{data.progress}%</span>}
							</>
						)}
					</span>
					<ChevronRight
						size={16}
						aria-hidden
						className={cn(
							"shrink-0 transition-transform motion-reduce:transition-none",
							open && "rotate-90",
						)}
					/>
				</Button>
				{open && (
					<div id={contentId} className="border-t border-border">
						{/* 几十个子智能体时限制高度，避免把消息流撑得很长 */}
						<ScrollArea viewportClassName="max-h-80">
							<ul className="m-0 list-none divide-y divide-border px-3 py-0">
								{data.agents.map((agent) => (
									<SubagentRow
										key={agent.agent_id}
										agent={agent}
										settled={settled}
										formatDuration={formatDuration}
										statusLabel={getStatusLabel(agent.status)}
									/>
								))}
							</ul>
						</ScrollArea>
					</div>
				)}
			</div>
		</div>
	)
}

export default memo(SubagentsTool)
