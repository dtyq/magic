import {
	CircleAlert,
	CircleCheck,
	CircleX,
	FileText,
	Image,
	Globe,
	ExternalLink,
	Info,
	Loader2,
	LocateFixed,
} from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/shadcn-ui/button"
import MagicTooltip from "@/components/base/MagicTooltip"
import MagicFileIcon from "@/components/base/MagicFileIcon"
import SmartTooltip from "@/components/other/SmartTooltip"
import { cn } from "@/utils/cn"
import type {
	OperationResultItem,
	OperationResultTarget,
	OperationResultSummary,
} from "@/pages/superMagic/components/Detail/types"
import { GenerationProgress } from "@/pages/superMagic/components/MessageList/components/shared/ToolGenerationProgress"

interface OperationResultRowProps {
	item: OperationResultItem
	stage?: OperationResultSummary["stage"]
	loading: boolean
	errorTone?: "neutral" | "destructive"
	unavailable?: string
	progressAnchorKey: string
	onLocate: (target: OperationResultTarget, showDetails?: boolean) => void
}

export default function OperationResultRow({
	item,
	stage,
	loading,
	errorTone = "destructive",
	unavailable,
	progressAnchorKey,
	onLocate,
}: OperationResultRowProps) {
	const { t } = useTranslation("super")
	const pending =
		loading && item.status === "success" && item.is_processing !== false && !unavailable
	const neutralStatus =
		errorTone === "neutral" &&
		Boolean(unavailable || item.status === "error" || item.status === "skipped")
	const ResultIcon =
		unavailable || item.status === "skipped"
			? CircleAlert
			: pending
				? Loader2
				: item.status === "error"
					? CircleX
					: CircleCheck
	const target = item.target
	const web = target?.type === "url" ? new URL(target.url) : undefined
	const extension = item.kind === "directory" ? "folder" : item.label.split(".").pop()
	const image = Boolean(extension && /^(png|jpe?g|gif|webp|svg|bmp|avif|ico)$/i.test(extension))
	const fullName =
		target?.type === "file"
			? target.relative_file_path
			: web
				? `${web.origin}${web.pathname}`
				: item.label
	const changes = item.status === "success" ? item.changes : undefined
	const showProgress = pending && Boolean(item.expected_finished_at)
	const message =
		unavailable ||
		(pending
			? t("operationResultList.running")
			: item.status === "skipped"
				? `${t("operationResultList.skipped")} · ${item.message}`
				: item.message)
	const locate = () => {
		if (target) onLocate(target)
	}
	const viewText = image ? t("operationResultList.viewImage") : t("operationResultList.viewFile")
	const targetLabel =
		target?.type === "canvas_element"
			? t("operationResultList.locateCanvasElement", { label: item.label })
			: `${viewText}：${item.label}`
	const name = (
		<SmartTooltip
			fileName
			elementType="span"
			placement="top"
			align="start"
			content={fullName}
			className={cn("block min-w-0 text-xs leading-5", (changes || web) && "font-medium")}
		>
			{item.label}
		</SmartTooltip>
	)
	const ViewIcon = image ? Image : FileText
	const viewAction =
		target?.type === "file" && !unavailable && !pending ? (
			<Button
				type="button"
				variant={changes ? "outline" : "ghost"}
				onClick={locate}
				aria-label={targetLabel}
				className={cn(
					"shrink-0 gap-1 text-xs font-normal text-muted-foreground shadow-none",
					changes ? "h-6 px-2" : "h-5 px-1",
				)}
			>
				<ViewIcon size={16} strokeWidth={1.75} aria-hidden />
				{viewText}
			</Button>
		) : null
	return (
		<li className="min-w-0 px-2 py-2 text-xs">
			<div className="flex min-w-0 items-start gap-2">
				{!neutralStatus &&
					(pending ||
						unavailable ||
						item.status !== "success" ||
						stage === "analyze") && (
						<span className="flex h-5 w-4 shrink-0 items-center justify-center">
							<ResultIcon
								size={13}
								strokeWidth={1.5}
								aria-hidden
								className={cn(
									pending && "animate-spin",
									!pending && !unavailable && item.status === "success"
										? "text-success"
										: item.status === "error"
											? "text-destructive"
											: "text-muted-foreground",
								)}
							/>
						</span>
					)}
				{item.kind !== "text" || web ? (
					<span className="flex h-5 w-4 shrink-0 items-center justify-center">
						{web ? (
							<Globe
								size={16}
								strokeWidth={1.5}
								className="text-muted-foreground"
								aria-hidden
							/>
						) : (
							<MagicFileIcon type={extension} size={16} />
						)}
					</span>
				) : null}
				<div className="min-w-0 flex-1">
					<div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
						{web ? (
							<a
								href={target?.type === "url" ? target.url : undefined}
								target="_blank"
								rel="noopener noreferrer"
								className="min-w-0 max-w-full shrink text-foreground hover:text-primary"
							>
								{name}
							</a>
						) : target && !unavailable && !pending ? (
							<button
								type="button"
								onClick={locate}
								aria-label={targetLabel}
								className="min-w-0 max-w-full shrink rounded-sm text-left text-xs leading-5 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
							>
								{name}
							</button>
						) : (
							<div className="min-w-0 max-w-full shrink">{name}</div>
						)}
						{!changes && !web && message && !showProgress && (
							<span className="min-w-0 text-xs leading-5 text-muted-foreground [overflow-wrap:anywhere]">
								{message}
							</span>
						)}
					</div>
					{web && (
						<div className="flex min-w-0 items-center gap-2 text-[11px] leading-5 text-muted-foreground">
							<SmartTooltip elementType="span" content={fullName} className="min-w-0">
								{web.hostname}
							</SmartTooltip>
							{stage === "read" && (
								<span className="inline-flex shrink-0 items-center gap-0.5">
									<ResultIcon
										size={13}
										strokeWidth={1.5}
										className={
											item.status === "error"
												? "text-destructive"
												: "text-success"
										}
									/>
									{t(
										item.status === "error"
											? "operationResultList.readFailed"
											: "operationResultList.stages.read",
									)}
								</span>
							)}
						</div>
					)}
					{showProgress && (
						<p className="m-0 mt-0.5 text-xs leading-5 text-muted-foreground">
							<GenerationProgress
								anchorKey={progressAnchorKey}
								active
								startedAt={item.started_at}
								expectedFinishedAt={item.expected_finished_at}
							/>
						</p>
					)}
					{/* 终态挂载一次用于清理虚拟列表重挂载时保存的本地进度锚点。 */}
					{!showProgress && item.expected_finished_at && (
						<GenerationProgress
							anchorKey={progressAnchorKey}
							active={false}
							startedAt={item.started_at}
							expectedFinishedAt={item.expected_finished_at}
						/>
					)}
					{showProgress && <span className="sr-only">{message}</span>}
					{item.description && (
						<p className="m-0 mt-0.5 text-xs leading-5 text-muted-foreground [overflow-wrap:anywhere]">
							{item.description}
						</p>
					)}
				</div>
				{!changes && viewAction}
				{web && (
					<MagicTooltip title={t("operationResultList.openWebpage")}>
						<a
							href={web.href}
							target="_blank"
							rel="noopener noreferrer"
							aria-label={t("operationResultList.openWebpage")}
							className="flex size-5 shrink-0 items-center justify-center rounded-sm text-muted-foreground hover:bg-accent"
						>
							<ExternalLink size={14} aria-hidden />
						</a>
					</MagicTooltip>
				)}
				{target?.type === "canvas_element" && !unavailable && (
					<span className="flex shrink-0 items-center gap-0.5">
						{target.content_type === "image" && (
							<MagicTooltip title={t("operationResultList.generationDetails")}>
								<Button
									type="button"
									variant="ghost"
									className="h-5 gap-1 px-1 text-xs font-normal text-muted-foreground"
									onClick={() => onLocate(target, true)}
								>
									<Info size={16} aria-hidden />
									{t("operationResultList.detailsShort")}
								</Button>
							</MagicTooltip>
						)}
						<MagicTooltip title={t("operationResultList.viewInCanvas")}>
							<Button
								type="button"
								variant="ghost"
								className="h-5 gap-1 px-1 text-xs font-normal text-muted-foreground"
								onClick={locate}
							>
								<LocateFixed size={16} aria-hidden />
								{t("operationResultList.locateShort")}
							</Button>
						</MagicTooltip>
					</span>
				)}
			</div>
			{changes && (
				<div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 pl-6">
					<div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-normal leading-5 text-muted-foreground">
						<span>
							{t("operationResultList.added")}{" "}
							<span className="text-success">
								+{changes.added_lines} {t("operationResultList.lines")}
							</span>
						</span>
						<span>
							{t("operationResultList.deleted")}{" "}
							<span className="text-destructive">
								−{changes.deleted_lines} {t("operationResultList.lines")}
							</span>
						</span>
						{Boolean(changes.modified_lines) && (
							<span>
								{t("operationResultList.modifiedLines", {
									count: changes.modified_lines,
								})}
							</span>
						)}
					</div>
					{viewAction}
				</div>
			)}
		</li>
	)
}
