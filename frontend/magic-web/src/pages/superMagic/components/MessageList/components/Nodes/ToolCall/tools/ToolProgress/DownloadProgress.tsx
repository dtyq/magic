import {
	ChevronRight,
	CircleCheck,
	CircleMinus,
	CircleX,
	Clock3,
	Files,
	LoaderCircle,
} from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/shadcn-ui/button"
import { Progress } from "@/components/shadcn-ui/progress"
import { ScrollArea } from "@/components/shadcn-ui/scroll-area"
import MagicFileIcon from "@/components/base/MagicFileIcon"
import MagicTooltip from "@/components/base/MagicTooltip"
import SmartTooltip from "@/components/other/SmartTooltip"
import { ToolIconBadge } from "../../../../shared/ToolIconConfig"
import { useToggleWithScrollPreserve } from "../../../shared/hooks/useToggleWithScrollPreserve"
import type {
	DownloadProgressState,
	DownloadItemProgress,
} from "@/pages/superMagic/stores/download-progress"
import { cn } from "@/utils/cn"

interface Props {
	data: Record<string, unknown>
	action?: string
	progress: number | null
	state?: DownloadProgressState
	rawArguments?: string
	showScan: boolean
}
function getPaths(rawArguments?: string): string[] {
	try {
		const parsed: unknown = JSON.parse(rawArguments || "")
		if (
			!parsed ||
			typeof parsed !== "object" ||
			!("downloads" in parsed) ||
			!Array.isArray(parsed.downloads)
		)
			return []
		return parsed.downloads.map((item: unknown) =>
			item &&
			typeof item === "object" &&
			"file_path" in item &&
			typeof item.file_path === "string"
				? item.file_path
				: "",
		)
	} catch {
		return []
	}
}

export default function DownloadProgress({
	data,
	action,
	progress,
	state,
	rawArguments,
	showScan,
}: Props) {
	const { t } = useTranslation("super")
	const statusLabels = {
		pending: t("operationResultList.download.pending"),
		downloading: t("operationResultList.download.downloading"),
		retrying: t("operationResultList.download.retrying"),
		completed: t("operationResultList.download.completed"),
		skipped: t("operationResultList.download.skipped"),
		failed: t("operationResultList.download.failed"),
		cancelled: t("operationResultList.download.cancelled"),
	}
	const [open, toggle] = useToggleWithScrollPreserve(false, "download-progress-expanded")
	const paths = getPaths(rawArguments)
	const total = typeof data.total_files === "number" ? data.total_files : paths.length
	const completed = typeof data.completed_files === "number" ? data.completed_files : 0
	const currentFile = typeof data.current_file === "string" ? data.current_file : ""
	const known = state?.items || []
	const pending: DownloadItemProgress[] =
		state?.started && !state.truncated
			? paths.slice(0, 8).flatMap((path, index) =>
					path && !known.some((item) => item.index === index)
						? [
								{
									index,
									fileName: path.split("/").pop() || path,
									status: "pending" as const,
									downloadedBytes: 0,
									totalBytes: null,
								},
							]
						: [],
				)
			: []
	const items = [...known, ...pending].slice(0, 8).sort((left, right) => left.index - right.index)
	const countText = t("operationResultList.download.processed", { completed, total })
	return (
		<div
			className="w-full min-w-0 overflow-hidden rounded-md border border-border bg-card shadow-sm"
			data-testid="download-progress"
		>
			<Button
				type="button"
				variant="ghost"
				aria-label={
					open ? t("operationResultList.collapse") : t("operationResultList.expand")
				}
				aria-expanded={open}
				onClick={toggle}
				className="relative flex h-8 w-full min-w-0 justify-start gap-1.5 overflow-hidden rounded-none px-2 text-xs font-normal"
			>
				{showScan && (
					<span
						aria-hidden
						className="pointer-events-none absolute -left-[120px] top-0 h-full w-[120px] animate-scan bg-gradient-to-r from-transparent from-[40%] to-[#eee] will-change-transform"
					/>
				)}
				<span className="relative inline-flex shrink-0 items-center gap-1.5">
					<ToolIconBadge toolName="download_from_urls" />
					<span>{action}</span>
				</span>
				<SmartTooltip
					fileName
					elementType="span"
					content={currentFile}
					className="relative min-w-0 flex-1 text-left text-xs leading-4 text-muted-foreground"
				>
					{currentFile}
				</SmartTooltip>
				{total > 0 && (
					<MagicTooltip title={countText}>
						<span
							aria-label={countText}
							className="relative inline-flex h-5 shrink-0 items-center gap-1 rounded bg-muted/50 px-1.5 text-[11px] font-normal tabular-nums leading-4 text-muted-foreground"
						>
							<Files size={12} strokeWidth={1.5} aria-hidden />
							<span>
								{completed}/{total}
							</span>
						</span>
					</MagicTooltip>
				)}
				{progress !== null && (
					<MagicTooltip
						title={t(
							data.indeterminate
								? "operationResultList.download.estimated"
								: "operationResultList.download.batch",
						)}
					>
						<span className="relative inline-flex h-5 shrink-0 items-center rounded-full bg-fill px-2 text-[11px] font-normal tabular-nums leading-4 text-muted-foreground">
							{progress}%
						</span>
					</MagicTooltip>
				)}
				<ChevronRight
					size={16}
					aria-hidden
					className={cn("relative shrink-0 text-muted-foreground", open && "rotate-90")}
				/>
			</Button>
			{open && (
				<ScrollArea
					className="border-t border-border"
					viewportClassName="max-h-80 [&>div]:!block"
				>
					<ul className="m-0 list-none divide-y divide-border p-0">
						{items.map((item) => {
							const done = item.status === "completed"
							const active =
								item.status === "downloading" || item.status === "retrying"
							const percent = done
								? 100
								: item.totalBytes
									? Math.min(
											100,
											Math.floor(
												(item.downloadedBytes * 100) / item.totalBytes,
											),
										)
									: null
							const StatusIcon = done
								? CircleCheck
								: item.status === "failed" || item.status === "cancelled"
									? CircleX
									: item.status === "skipped"
										? CircleMinus
										: active
											? LoaderCircle
											: Clock3
							const path = paths[item.index] || item.fileName
							const label = path.split("/").pop() || path
							const text = done
								? "100%"
								: active && percent !== null
									? `${percent}%`
									: statusLabels[item.status]
							return (
								<li key={item.index} className="min-w-0 px-2 py-2">
									<div className="flex min-w-0 items-center gap-2">
										<MagicFileIcon
											type={label.split(".").pop()}
											size={16}
											className="shrink-0"
										/>
										<SmartTooltip
											fileName
											elementType="span"
											content={path}
											className="min-w-0 flex-1 text-xs leading-4"
										>
											{label}
										</SmartTooltip>
										<span className="inline-flex shrink-0 items-center gap-0.5 text-[11px] tabular-nums leading-4 text-muted-foreground">
											<StatusIcon
												size={13}
												strokeWidth={1.5}
												aria-hidden
												className={cn(
													done
														? "text-success"
														: item.status === "failed"
															? "text-destructive"
															: active && "animate-spin",
												)}
											/>
											{text}
										</span>
									</div>
									{active && (
										<div className="mt-1.5 pl-6">
											{percent !== null ? (
												<Progress
													value={percent}
													aria-label={label}
													className="h-1 bg-muted"
												/>
											) : (
												<div
													role="status"
													aria-label={t(
														"operationResultList.download.unknownSize",
													)}
													className="relative h-1 overflow-hidden rounded-full bg-muted"
												>
													<span
														aria-hidden
														className="absolute -left-[120px] h-full w-[120px] animate-scan bg-gradient-to-r from-transparent to-muted-foreground/30"
													/>
												</div>
											)}
										</div>
									)}
								</li>
							)
						})}
					</ul>
					{items.length === 0 && (
						<p className="m-0 px-2 py-2 text-xs text-muted-foreground">
							{t("operationResultList.download.noFileProgress")}
						</p>
					)}
					{total > items.length && items.length > 0 && (
						<p className="m-0 border-t border-border px-2 py-1.5 text-[11px] text-muted-foreground">
							{t("operationResultList.download.more", {
								count: total - items.length,
							})}
						</p>
					)}
				</ScrollArea>
			)}
		</div>
	)
}
