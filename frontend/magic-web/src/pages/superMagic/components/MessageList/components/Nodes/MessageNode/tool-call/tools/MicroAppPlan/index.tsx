import magicToast from "@/components/base/MagicToaster/utils"
import { Badge } from "@/components/shadcn-ui/badge"
import { Button } from "@/components/shadcn-ui/button"
import { Textarea } from "@/components/shadcn-ui/textarea"
import { cn } from "@/utils/cn"
import DefaultTool from "@/pages/superMagic/components/MessageList/components/Nodes/ToolCall/tools/DefaultTool"
import type {
	DefaultToolProps,
	ToolDataLike,
} from "@/pages/superMagic/components/MessageList/components/Nodes/ToolCall/tools/DefaultTool"
import useShareRoute from "@/pages/superMagic/hooks/useShareRoute"
import { sendUserToolCallReply } from "@/pages/superMagic/services/askUserToolReplyService"
import { superMagicStore } from "@/pages/superMagic/stores"
import { logger as Logger } from "@/infrastructure/logger"
import { IconLoader2 } from "@tabler/icons-react"
import { CheckCircle2, ChevronDown, ClipboardList, PencilLine, XCircle } from "lucide-react"
import { observer } from "mobx-react-lite"
import type { ReactNode } from "react"
import { useCallback, useDeferredValue, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import PlanDataModelFields from "./PlanDataModelFields"
import { MICRO_APP_PLAN_TOOL_NAME, PLAN_STATUS, resolvePlan, resolveTaskId } from "./model"
import type { PlanActionDetail, PlanResponseStatus } from "./model"

const logger = Logger.createLogger("MicroAppPlanToolCall")

function PlanList({ items }: { items: string[] }) {
	if (items.length === 0) return null
	return (
		<ul className="space-y-1.5">
			{items.map((item, index) => (
				<li key={`item-${index}`} className="flex gap-2 text-xs leading-5 text-foreground">
					<span className="mt-2 size-1 shrink-0 rounded-full bg-muted-foreground/60" />
					<span>{item}</span>
				</li>
			))}
		</ul>
	)
}

function PlanSection({
	title,
	children,
	hidden,
}: {
	title: string
	children: ReactNode
	hidden?: boolean
}) {
	if (hidden) return null
	return (
		<section className="space-y-2">
			<h4 className="text-xs font-medium leading-4 text-muted-foreground">{title}</h4>
			{children}
		</section>
	)
}

function MicroAppPlanToolCall(props: DefaultToolProps) {
	const { onMouseEnter, onMouseLeave, loading, classNames, selectedTopic } = props
	const { t } = useTranslation("super")
	const { isShareRoute } = useShareRoute()
	const [open, setOpen] = useState(true)
	const [revisionMode, setRevisionMode] = useState(false)
	const [revisionFeedback, setRevisionFeedback] = useState("")
	const [pendingAction, setPendingAction] = useState<PlanResponseStatus | null>(null)

	const node = superMagicStore.getMessageNode(props?.node?.app_message_id) as
		{ tool?: ToolDataLike } | undefined
	const tool = props.toolData || node?.tool
	const deferredRawArguments = useDeferredValue(tool?.rawArguments)
	const plan = resolvePlan(
		tool
			? {
					...tool,
					rawArguments: deferredRawArguments,
				}
			: tool,
	)
	const shouldRenderDefaultTool = tool?.status === "error"

	const isPending = plan.status === PLAN_STATUS.pending
	const isStreaming = !!loading && !plan.isComplete
	const isOpen = isStreaming || open
	const toolId = tool?.id
	const conversationId = selectedTopic?.chat_conversation_id || ""
	const topicId = selectedTopic?.chat_topic_id || ""
	const taskId = resolveTaskId(topicId, toolId)
	const hasSubmitContext = !!conversationId && !!topicId && !!toolId && !!taskId
	// loading 只表示工具消息的传输状态；历史恢复后，完整且待确认的计划仍应允许操作。
	const isFrozen =
		pendingAction !== null ||
		isStreaming ||
		props.isShare ||
		isShareRoute ||
		!isPending ||
		!hasSubmitContext

	const statusConfig = useMemo(() => {
		if (isStreaming && plan.status === PLAN_STATUS.pending) {
			return {
				label: t("plan.status.generating"),
				className: "border-primary/20 bg-primary/10 text-primary",
			}
		}
		if (plan.status === PLAN_STATUS.approved) {
			return {
				label: t("plan.status.approved"),
				className: "border-emerald-200 bg-emerald-50 text-emerald-700",
			}
		}
		if (plan.status === PLAN_STATUS.revisionRequested) {
			return {
				label: t("plan.status.revisionRequested"),
				className: "border-amber-200 bg-amber-50 text-amber-700",
			}
		}
		if (plan.status === PLAN_STATUS.cancelled) {
			return {
				label: t("plan.status.cancelled"),
				className: "border-muted bg-muted text-muted-foreground",
			}
		}
		if (plan.status === PLAN_STATUS.timeout) {
			return {
				label: t("plan.status.timeout"),
				className: "border-muted bg-muted text-muted-foreground",
			}
		}
		return {
			label: t("plan.status.pending"),
			className: "border-primary/20 bg-primary/10 text-primary",
		}
	}, [isStreaming, plan.status, t])

	const submitReply = useCallback(
		async (responseStatus: PlanResponseStatus, comment = "") => {
			if (!conversationId || !topicId) throw new Error("missing_topic_context")
			if (!toolId) throw new Error("missing_plan_tool_call_id")
			if (!taskId) throw new Error("missing_plan_task_id")

			const detail: PlanActionDetail = {
				task_id: taskId,
				plan_id: plan.planId || toolId,
				question_id: plan.planId || toolId,
				response_status: responseStatus,
				answer: comment ? JSON.stringify({ comment }) : "",
			}

			await sendUserToolCallReply({
				conversationId,
				topicId,
				toolName: MICRO_APP_PLAN_TOOL_NAME,
				toolCallId: toolId,
				detail,
				isAnswered: responseStatus === PLAN_STATUS.approved,
			})
		},
		[conversationId, plan.planId, taskId, toolId, topicId],
	)

	const handleApprove = useCallback(async () => {
		if (pendingAction || isFrozen) return
		try {
			setPendingAction(PLAN_STATUS.approved)
			await submitReply(PLAN_STATUS.approved)
		} catch (error) {
			logger.error({
				eventKey: "approve_micro_app_plan_failed",
				errorKind: "unknown",
				error,
				message: "Failed to approve micro app plan",
			})
			setPendingAction(null)
			magicToast.error(t("plan.status.submitFailed"))
		}
	}, [isFrozen, pendingAction, submitReply, t])

	const handleCancel = useCallback(async () => {
		if (pendingAction || isFrozen) return
		try {
			setPendingAction(PLAN_STATUS.cancelled)
			await submitReply(PLAN_STATUS.cancelled)
		} catch (error) {
			logger.error({
				eventKey: "cancel_micro_app_plan_failed",
				errorKind: "unknown",
				error,
				message: "Failed to cancel micro app plan",
			})
			setPendingAction(null)
			magicToast.error(t("plan.status.submitFailed"))
		}
	}, [isFrozen, pendingAction, submitReply, t])

	const handleRevisionSubmit = useCallback(async () => {
		if (pendingAction || isFrozen) return
		const comment = revisionFeedback.trim()
		if (!comment) {
			magicToast.error(t("plan.validation.revisionRequired"))
			return
		}
		try {
			setPendingAction(PLAN_STATUS.revisionRequested)
			await submitReply(PLAN_STATUS.revisionRequested, comment)
		} catch (error) {
			logger.error({
				eventKey: "request_micro_app_plan_revision_failed",
				errorKind: "unknown",
				error,
				message: "Failed to request micro app plan revision",
			})
			setPendingAction(null)
			magicToast.error(t("plan.status.submitFailed"))
		}
	}, [isFrozen, pendingAction, revisionFeedback, submitReply, t])

	if (shouldRenderDefaultTool) {
		return <DefaultTool {...props} toolData={tool} loading={false} />
	}

	return (
		<div
			className={cn(
				"h-fit w-full max-w-[720px] flex-none self-start overflow-hidden rounded-lg border border-border bg-card text-card-foreground shadow-sm",
				classNames,
			)}
			data-tool={tool?.id}
			data-testid="plan-tool-card"
			onMouseEnter={onMouseEnter}
			onMouseLeave={onMouseLeave}
		>
			<div className="flex items-start gap-3 border-b border-border px-4 py-3">
				<div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
					<ClipboardList size={18} aria-hidden />
				</div>
				<div className="min-w-0 flex-1">
					<div className="flex flex-wrap items-center gap-2">
						<h3 className="min-w-0 truncate text-sm font-semibold leading-5">
							{plan.title || tool?.action || t("plan.title")}
						</h3>
						{plan.appType && (
							<Badge variant="outline" className="rounded-md font-normal">
								{plan.appType}
							</Badge>
						)}
						<Badge
							variant="outline"
							className={cn("rounded-md font-normal", statusConfig.className)}
						>
							{statusConfig.label}
						</Badge>
					</div>
					{plan.summary && (
						<p className="mt-1 text-xs leading-5 text-muted-foreground">
							{plan.summary}
						</p>
					)}
				</div>
				<Button
					type="button"
					variant="ghost"
					size="icon-sm"
					onClick={() => setOpen((value) => !value)}
					disabled={isStreaming}
					aria-label={isOpen ? t("plan.actions.collapse") : t("plan.actions.expand")}
					aria-expanded={isOpen}
					className="size-7 shrink-0 text-muted-foreground hover:bg-transparent hover:text-foreground"
				>
					{isStreaming ? (
						<IconLoader2 size={14} className="animate-spin" aria-hidden />
					) : (
						<ChevronDown
							className={cn(
								"size-4 transition-transform duration-200",
								!isOpen && "rotate-180",
							)}
							aria-hidden
						/>
					)}
				</Button>
			</div>

			{isOpen && (
				<div className="space-y-4 px-4 py-4">
					<PlanSection
						title={t("plan.sections.requirements")}
						hidden={plan.requirements.length === 0}
					>
						<PlanList items={plan.requirements} />
					</PlanSection>

					<PlanSection
						title={t("plan.sections.implementationSteps")}
						hidden={plan.implementationSteps.length === 0}
					>
						<ol className="space-y-1.5">
							{plan.implementationSteps.map((item, index) => (
								<li
									key={`step-${index}`}
									className="flex gap-2 text-xs leading-5 text-foreground"
								>
									<span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] text-muted-foreground">
										{index + 1}
									</span>
									<span>{item}</span>
								</li>
							))}
						</ol>
					</PlanSection>

					<PlanSection title={t("plan.sections.files")} hidden={plan.files.length === 0}>
						<div className="grid gap-2">
							{plan.files.map((file, index) => (
								<div
									key={`file-${index}`}
									className="rounded-md border border-border bg-muted/30 px-3 py-2"
								>
									<div className="text-xs font-medium leading-5 text-foreground">
										{file.path}
									</div>
									{file.purpose && (
										<div className="text-xs leading-5 text-muted-foreground">
											{file.purpose}
										</div>
									)}
								</div>
							))}
						</div>
					</PlanSection>

					<PlanSection
						title={t("plan.sections.dataModel")}
						hidden={plan.dataModel.length === 0}
					>
						<div className="grid gap-2">
							{plan.dataModel.map((table, index) => (
								<div
									key={`table-${index}`}
									className="min-w-0 rounded-md border border-border bg-muted/30 px-3 py-2"
								>
									<div className="text-xs font-medium leading-5 text-foreground">
										{table.tableName || t("plan.fields.unnamedTable")}
									</div>
									{table.purpose && (
										<div className="text-xs leading-5 text-muted-foreground">
											{table.purpose}
										</div>
									)}
									<PlanDataModelFields fields={table.fields} />
								</div>
							))}
						</div>
					</PlanSection>

					<PlanSection
						title={t("plan.sections.acceptanceCriteria")}
						hidden={plan.acceptanceCriteria.length === 0}
					>
						<PlanList items={plan.acceptanceCriteria} />
					</PlanSection>

					<PlanSection
						title={t("plan.sections.assumptions")}
						hidden={plan.assumptions.length === 0}
					>
						<PlanList items={plan.assumptions} />
					</PlanSection>

					{plan.response && !isPending && (
						<div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs leading-5 text-muted-foreground">
							<span className="font-medium text-foreground">
								{t("plan.sections.userFeedback")}
							</span>
							<div className="mt-1">{plan.response}</div>
						</div>
					)}

					{isPending && !revisionMode && (
						<div className="flex flex-wrap gap-2 border-t border-border pt-3">
							<Button
								type="button"
								size="sm"
								onClick={handleApprove}
								disabled={isFrozen}
								data-testid="plan-approve-button"
							>
								<CheckCircle2 size={15} aria-hidden />
								{t("plan.actions.approve")}
							</Button>
							<Button
								type="button"
								variant="outline"
								size="sm"
								onClick={() => setRevisionMode(true)}
								disabled={isFrozen}
							>
								<PencilLine size={15} aria-hidden />
								{t("plan.actions.requestRevision")}
							</Button>
							<Button
								type="button"
								variant="ghost"
								size="sm"
								onClick={handleCancel}
								disabled={isFrozen}
								className="text-muted-foreground"
							>
								<XCircle size={15} aria-hidden />
								{t("plan.actions.cancel")}
							</Button>
						</div>
					)}

					{isPending && revisionMode && (
						<div className="space-y-2 border-t border-border pt-3">
							<Textarea
								value={revisionFeedback}
								onChange={(event) => setRevisionFeedback(event.target.value)}
								placeholder={t("plan.revisionPlaceholder")}
								disabled={isFrozen}
								className="min-h-20 resize-none text-sm"
								data-testid="plan-revision-textarea"
							/>
							<div className="flex flex-wrap gap-2">
								<Button
									type="button"
									size="sm"
									variant="outline"
									onClick={handleRevisionSubmit}
									disabled={isFrozen}
									data-testid="plan-revision-submit-button"
								>
									<PencilLine size={15} aria-hidden />
									{t("plan.actions.submitRevision")}
								</Button>
								<Button
									type="button"
									size="sm"
									variant="ghost"
									onClick={() => setRevisionMode(false)}
									disabled={isFrozen}
								>
									{t("plan.actions.back")}
								</Button>
							</div>
						</div>
					)}
				</div>
			)}
		</div>
	)
}

export default observer(MicroAppPlanToolCall)
