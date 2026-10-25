import { useId, type MouseEventHandler, type ReactNode } from "react"
import { observer } from "mobx-react-lite"
import { ChevronRight, CircleAlert, CircleCheck, CircleX, Loader2, MonitorPlay } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/shadcn-ui/button"
import { ScrollArea } from "@/components/shadcn-ui/scroll-area"
import SmartTooltip from "@/components/other/SmartTooltip"
import MagicTooltip from "@/components/base/MagicTooltip"
import { cn } from "@/utils/cn"
import {
	getOperationResultListData,
	getOperationResultListReportDetail,
} from "@/pages/superMagic/utils/toolDetailDisplay"
import { focusCanvasElementByProjectPath } from "@/pages/superMagic/components/Detail/contents/Design/utils/toolDesignProjectInfo"
import { useMessageListProjectFilesStore } from "@/pages/superMagic/components/MessageList/context"
import { ToolIconBadge } from "../../../shared/ToolIconConfig"
import { useToggleWithScrollPreserve } from "../hooks/useToggleWithScrollPreserve"
import {
	getToolCardInteractionTarget,
	selectToolDetail,
	selectToolFile,
} from "../../toolDetailSelection"
import OperationResultRow from "./OperationResultRow"

interface OperationResultListProps {
	toolData: {
		id?: string
		name?: string
		action?: ReactNode
		remark?: string
		status?: string
		detail?: unknown
	}
	loading?: boolean
	className?: string
	onSelectDetail?: (detail: unknown) => void
	onMouseEnter?: MouseEventHandler
	onMouseLeave?: MouseEventHandler
}

function OperationResultList({
	toolData,
	loading = false,
	className,
	onSelectDetail,
	onMouseEnter,
	onMouseLeave,
}: OperationResultListProps) {
	const { t } = useTranslation("super")
	const filesStore = useMessageListProjectFilesStore()
	const contentId = useId()
	// 沿用消息作用域和滚动保护；虚拟行重新挂载仍保留用户的展开选择。
	const [open, toggle] = useToggleWithScrollPreserve(false, "operation-result-list-expanded")
	const data = getOperationResultListData(toolData.detail)
	const items = data?.items
	const reportDetail = getOperationResultListReportDetail(toolData.detail)
	const failedCount =
		data?.failed_count ?? items?.filter((item) => item.status === "error").length ?? 0
	const total = data?.total_count ?? items?.length ?? 0
	const successCount =
		data?.success_count ?? items?.filter((item) => item.status === "success").length ?? 0
	const skippedCount =
		data?.skipped_count ?? items?.filter((item) => item.status === "skipped").length ?? 0
	// 中断、响应缺失或无失败明细的工具异常可能保留占位行，不能据此宣布成功。
	// 有逐项失败的批次仍保留成功项，避免把部分成功误标为整批不可用。
	const resultUnavailable =
		toolData.status === "suspended" ||
		toolData.status === "response_missing" ||
		(toolData.status === "error" && failedCount === 0)
	const unavailable = loading
		? t("operationResultList.running")
		: toolData.status === "suspended"
			? t("operationResultList.interrupted")
			: t("operationResultList.unavailable")
	const web =
		items?.some((item) => item.target?.type === "url") &&
		(toolData.name === "web_search" || toolData.name === "read_webpages_as_markdown")
	const search = toolData.name === "web_search"
	const unit = web
		? "webpages"
		: toolData.name === "visual_understanding"
			? "images"
			: toolData.name === "video_understanding"
				? "videos"
				: "files"
	const unitLabels = {
		webpages: t("operationResultList.units.webpages", { count: total }),
		images: t("operationResultList.units.images", { count: total }),
		videos: t("operationResultList.units.videos", { count: total }),
		files: t("operationResultList.units.files", { count: total }),
	}
	const stageLabels = {
		read: t("operationResultList.stages.read"),
		edit: t("operationResultList.stages.edit"),
		find: t("operationResultList.stages.find"),
		download: t("operationResultList.stages.download"),
		analyze: t("operationResultList.stages.analyze"),
		load: t("operationResultList.stages.load"),
		completed: t("operationResultList.stages.completed"),
		transcribed: t("operationResultList.stages.transcribed"),
	}
	const label = search ? toolData.remark : total === 1 ? items?.[0]?.label : unitLabels[unit]
	const stage =
		toolData.name === "audio_understanding" ? "transcribed" : (data?.stage ?? "completed")
	// 单次范围尝试仍保留真实失败状态；面向用户以中性提示说明下一步，不当作整项任务失败。
	const isRangeTool = toolData.name === "find_file_ranges" || toolData.name === "edit_file_ranges"
	// 范围批次只有一个文件；定位／修改了几处由工具的实际结果说明，不能按文件项数推算。
	const rangeSummary = total === 1 && isRangeTool ? items?.[0]?.message : undefined
	const status =
		loading || resultUnavailable || !items
			? unavailable
			: failedCount > 0
				? rangeSummary || t("operationResultList.failedCount", { count: failedCount })
				: search
					? t("operationResultList.searchCount", { count: total })
					: skippedCount === total
						? t("operationResultList.skipped")
						: rangeSummary || stageLabels[stage]
	const neutralStatus =
		isRangeTool && !loading && (resultUnavailable || !items || failedCount > 0)
	const StatusIcon = loading
		? Loader2
		: resultUnavailable || !items
			? CircleAlert
			: failedCount
				? successCount
					? CircleAlert
					: CircleX
				: CircleCheck
	const canToggle = !web || Boolean(items && items.length > 3)
	const displayed = web ? items?.slice(0, open ? 8 : 3) : open ? items : undefined
	const openReport = () => {
		if (!reportDetail) return
		const detail = {
			...reportDetail,
			id: toolData.id,
			name: toolData.name,
			action: toolData.action,
			remark: toolData.remark,
		}
		// 音频直接打开已生成的转写文件；读取正文、diff 和其他报告仍走原详情。
		if (
			toolData.name === "audio_understanding" &&
			selectToolFile({
				detail,
				target: getToolCardInteractionTarget(toolData.name, detail),
				filesStore,
				onSelectDetail,
			})
		)
			return
		selectToolDetail({ detail, onSelectDetail })
	}
	const headerContent = (
		<>
			<ToolIconBadge toolName={toolData.name} size={16} iconSize={12} />
			<span className="shrink-0 text-xs leading-4 text-foreground">
				{toolData.action || t("operationResultList.title")}
			</span>
			{label && (
				<SmartTooltip
					fileName
					elementType="span"
					placement="top"
					align="start"
					content={
						total === 1 && items?.[0]?.target?.type === "file"
							? items[0].target.relative_file_path
							: label
					}
					className="min-w-0 text-xs leading-4 text-muted-foreground"
				>
					{label}
				</SmartTooltip>
			)}
			<span
				className={cn(
					"inline-flex h-4 items-center gap-0.5 text-xs leading-4 text-muted-foreground",
					// 细线区分文件与状态；需要重新定位时直接显示原因，减少提示图标的视觉干扰。
					isRangeTool ? "ml-1.5 border-l border-border pl-2" : "ml-1",
					// 范围错误说明比计数长；窄屏允许截断，完整原因在展开行和详情中保留。
					rangeSummary && failedCount > 0 ? "min-w-0 shrink" : "shrink-0",
				)}
				aria-live="polite"
			>
				{!neutralStatus && (
					<StatusIcon
						size={13}
						strokeWidth={1.5}
						aria-hidden
						className={cn(
							"shrink-0",
							loading && "animate-spin",
							!loading &&
								!resultUnavailable &&
								(failedCount ? "text-destructive" : "text-success"),
						)}
					/>
				)}
				{rangeSummary ? <span className="truncate">{status}</span> : status}
			</span>
			{canToggle && (
				<ChevronRight
					size={16}
					aria-hidden
					className={cn("ml-auto shrink-0 text-muted-foreground", open && "rotate-90")}
				/>
			)}
		</>
	)
	return (
		<div
			className={cn(
				"h-fit min-w-0 max-w-full flex-none",
				open || web ? "w-full max-w-lg" : "w-fit",
				className,
			)}
			data-tool={toolData.id}
			onMouseEnter={onMouseEnter}
			onMouseLeave={onMouseLeave}
		>
			<div className="min-w-0 overflow-hidden rounded-md border border-border bg-card shadow-sm">
				{/* 标题、报告分别使用原生按钮；报告点击不冒泡成展开动作，也不嵌套按钮。 */}
				<div className="flex min-w-0 items-center hover:bg-accent">
					{canToggle ? (
						<Button
							type="button"
							variant="ghost"
							onClick={toggle}
							aria-expanded={open}
							aria-controls={contentId}
							className={cn(
								"h-8 min-w-0 flex-1 justify-start rounded-none text-xs font-normal hover:bg-transparent dark:hover:bg-transparent",
								// 范围卡片同时展示动作和位置计数，紧凑间距为窄消息列保留详情入口。
								rangeSummary ? "gap-1 px-1.5" : "gap-1.5 px-2",
							)}
						>
							{headerContent}
						</Button>
					) : (
						<div className="flex h-8 min-w-0 flex-1 items-center gap-1.5 px-2 text-xs">
							{headerContent}
						</div>
					)}
					{reportDetail && (
						<MagicTooltip title={t("operationResultList.openReport")}>
							<Button
								type="button"
								variant="ghost"
								className="size-8 shrink-0 rounded-none border-l border-border p-0"
								aria-label={t("operationResultList.openReport")}
								disabled={
									loading ||
									toolData.status === "response_missing" ||
									toolData.status === "suspended"
								}
								onClick={openReport}
							>
								<MonitorPlay size={16} aria-hidden />
							</Button>
						</MagicTooltip>
					)}
				</div>
				{displayed && (
					<div id={contentId} className="border-t border-border">
						<ScrollArea viewportClassName="max-h-80 [&>div]:!block">
							<ul className="m-0 list-none divide-y divide-border p-0">
								{displayed.map((item, index) => (
									<OperationResultRow
										key={`${item.label}-${index}`}
										item={item}
										stage={data?.stage}
										loading={loading}
										errorTone={isRangeTool ? "neutral" : "destructive"}
										progressAnchorKey={`${toolData.id || "operation-result"}:${
											item.target?.type === "canvas_element"
												? `${item.target.element_id}:${item.target.content_id ?? ""}`
												: index
										}`}
										unavailable={resultUnavailable ? unavailable : undefined}
										onLocate={(target, showDetails) => {
											// 普通图片沿用项目文件预览，画布元素保留原定位与生成详情流程。
											if (target.type === "url") return
											if (target.type === "file") {
												// 显式相对入口保留 ~、冒号等 POSIX 文件名，不被解析成个人文件或 URL。
												const filePath = `./${target.relative_file_path}`
												selectToolFile({
													detail: {
														data: { target_file_path: filePath },
													},
													target: { type: "file-reference", filePath },
													filesStore,
												})
												return
											}
											focusCanvasElementByProjectPath({
												projectPath: target.project_path,
												elementId: target.element_id,
												contentId: target.content_id,
												showGenerationDetails: showDetails,
												filesStore,
											})
										}}
									/>
								))}
							</ul>
						</ScrollArea>
						{web && !open && (items?.length ?? 0) > 3 && (
							<button
								type="button"
								onClick={toggle}
								className="w-full border-t border-border py-1.5 text-[11px] text-muted-foreground hover:bg-accent"
							>
								{t("operationResultList.moreWebpages", {
									count: (items?.length ?? 0) - 3,
								})}
							</button>
						)}
						{(open || !web) && Boolean(data?.omitted_count) && (
							<p className="m-0 border-t border-border px-2 py-1.5 text-[11px] text-muted-foreground">
								{t("operationResultList.omitted", { count: data?.omitted_count })}
							</p>
						)}
					</div>
				)}
				{open && !items && (
					<p className="m-0 px-2 py-2 text-xs text-muted-foreground">{unavailable}</p>
				)}
			</div>
		</div>
	)
}

export default observer(OperationResultList)
