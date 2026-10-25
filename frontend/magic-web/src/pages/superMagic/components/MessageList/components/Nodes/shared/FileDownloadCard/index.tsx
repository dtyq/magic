import { useId, type MouseEventHandler, type ReactNode } from "react"
import { ChevronDown, ChevronRight, Download, Loader2, RotateCcw, X } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/shadcn-ui/button"
import { Checkbox } from "@/components/shadcn-ui/checkbox"
import VIPTag from "@/pages/superMagic/components/VIPTag"
import { ScrollArea } from "@/components/shadcn-ui/scroll-area"
import MagicFileIcon from "@/components/base/MagicFileIcon"
import SmartTooltip from "@/components/other/SmartTooltip"
import { cn } from "@/utils/cn"
import { formatFileSize } from "@/utils/string"
import type { FileDownloadData } from "@/pages/superMagic/components/Detail/types"
import { containsDownloadImages } from "@/pages/superMagic/hooks/useFileBundleDownload"
import { useMessageListContext } from "../../../../context"
import { useMessageViewState } from "../../../../view-state/MessageViewStateContext"
import { selectToolFile } from "../../toolDetailSelection"
import DefaultTool from "../../MessageNode/tool-call/tools/Default"

interface FileDownloadCardProps {
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
	onMouseEnter?: MouseEventHandler
	onMouseLeave?: MouseEventHandler
}

function record(value: unknown): value is Record<string, unknown> {
	return Boolean(value && typeof value === "object" && !Array.isArray(value))
}

/** 下载清单是执行输入；任何损坏或重复成员都不能被静默过滤。 */
export function getFileDownloadData(detail: unknown): FileDownloadData | undefined {
	if (!record(detail) || detail.type !== "file_download" || !record(detail.data)) return
	const data = detail.data
	if (
		typeof data.title !== "string" ||
		!data.title.trim() ||
		typeof data.archive_name !== "string" ||
		!data.archive_name ||
		data.archive_name.includes("/") ||
		data.archive_name.includes("\\") ||
		data.archive_name.includes("\u0000") ||
		typeof data.project_id !== "string" ||
		!data.project_id ||
		typeof data.total_bytes !== "number" ||
		!Number.isSafeInteger(data.total_bytes) ||
		data.total_bytes < 0 ||
		!Array.isArray(data.items) ||
		!data.items.length
	)
		return
	const seen = new Set<string>()
	for (const item of data.items) {
		if (
			!record(item) ||
			typeof item.file_id !== "string" ||
			!item.file_id ||
			seen.has(item.file_id) ||
			typeof item.relative_file_path !== "string" ||
			!item.relative_file_path ||
			typeof item.file_name !== "string" ||
			!item.file_name ||
			typeof item.file_size !== "number" ||
			!Number.isSafeInteger(item.file_size) ||
			item.file_size < 0
		)
			return
		seen.add(item.file_id)
	}
	return data as unknown as FileDownloadData
}

export default function FileDownloadCard({
	toolData,
	loading = false,
	className,
	onMouseEnter,
	onMouseLeave,
}: FileDownloadCardProps) {
	const { t } = useTranslation("super")
	const { fileBundleDownload: download, projectFilesStore } = useMessageListContext()
	const [open, setOpen] = useMessageViewState("file-download-expanded", false)
	const [noWatermark, setNoWatermark] = useMessageViewState(
		`file-download-quality:${toolData.id}`,
		true,
	)
	const qualityId = useId()
	const contentId = useId()
	const data = getFileDownloadData(toolData.detail)
	const failureText =
		record(toolData.detail) &&
		record(toolData.detail.data) &&
		typeof toolData.detail.data.content === "string"
			? toolData.detail.data.content
			: undefined
	const state = download && download.state.toolId === toolData.id ? download.state : undefined
	const running = state?.phase === "running"
	const unavailable =
		loading ||
		toolData.status === "error" ||
		toolData.status === "suspended" ||
		toolData.status === "response_missing" ||
		!data
	const disabled =
		unavailable || !toolData.id || !download?.canDownload || download.state.phase === "running"
	const start = () => {
		if (data && toolData.id && !disabled) download?.start(toolData.id, data, noWatermark)
	}
	const toggle = () => setOpen((value) => !value)
	const summary = data
		? `${data.title} · ${t("fileDownload.fileCount", { count: data.items.length })} · ${formatFileSize(data.total_bytes)}`
		: toolData.remark
	const action = running ? (
		<Button
			size="sm"
			variant="ghost"
			className="h-6 shrink-0 gap-1 px-1.5 text-xs"
			onClick={download?.cancel}
		>
			<Loader2 size={14} className="animate-spin" /> {Math.round(download?.progress ?? 0)}%{" "}
			<X size={14} />
			<span className="sr-only">{t("common.cancel")}</span>
		</Button>
	) : (
		<Button
			size="sm"
			variant="ghost"
			className="h-6 shrink-0 gap-1 px-1.5 text-xs"
			disabled={disabled}
			onClick={() => start()}
		>
			{state?.phase === "error" && !state.fileId ? (
				<RotateCcw size={14} />
			) : (
				<Download size={14} />
			)}
			{state?.phase === "error" && !state.fileId
				? t("fileDownload.retry")
				: t("fileDownload.download")}
		</Button>
	)
	return (
		<div
			className={cn("max-w-full", open ? "w-full max-w-lg" : "w-fit", className)}
			data-file-download={toolData.id}
		>
			<DefaultTool
				toolData={{
					id: toolData.id,
					name: "create_client_side_file_bundle",
					action: t("fileDownload.title"),
					remark: summary,
					status: toolData.status,
					detail: { data: {} },
				}}
				loading={loading}
				onClick={toggle}
				onMouseEnter={onMouseEnter}
				onMouseLeave={onMouseLeave}
				cardClassName={cn(open && "w-full rounded-b-none")}
				suffix={
					<div className="ml-auto flex shrink-0 items-center gap-0.5 pr-1">
						{action}
						<Button
							size="icon"
							variant="ghost"
							className="size-6"
							aria-label={t("fileDownload.files")}
							aria-expanded={open}
							aria-controls={contentId}
							onClick={toggle}
						>
							{open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
						</Button>
					</div>
				}
			/>
			{open && (
				<div
					id={contentId}
					className="rounded-b-md border border-t-0 border-border bg-card shadow-sm"
				>
					{data ? (
						<>
							<div className="flex items-start justify-between gap-3 border-b border-border px-3 py-2 text-xs">
								<div className="min-w-0 flex-1">
									<SmartTooltip
										elementType="div"
										content={data.title}
										className="m-0 truncate font-medium text-foreground"
									>
										{data.title}
									</SmartTooltip>
									<p className="m-0 mt-1 text-muted-foreground">
										{t("fileDownload.fileCount", { count: data.items.length })}{" "}
										· {formatFileSize(data.total_bytes)}
									</p>
								</div>
								{containsDownloadImages(data) && (
									<div className="flex shrink-0 items-center gap-1.5 whitespace-nowrap">
										<Checkbox
											id={qualityId}
											checked={noWatermark}
											onCheckedChange={(value) =>
												setNoWatermark(value === true)
											}
											disabled={disabled}
										/>
										<label
											htmlFor={qualityId}
											className="cursor-pointer text-xs text-foreground"
										>
											{t("fileDownload.noWatermark")}
										</label>
										{download?.noWatermarkRequiresVip && <VIPTag />}
									</div>
								)}
							</div>
							<ScrollArea viewportClassName="max-h-72 [&>div]:!block">
								<ul className="m-0 list-none divide-y divide-border p-0">
									{data.items.map((item) => (
										<li
											key={item.file_id}
											className="flex min-w-0 items-center gap-2 px-3 py-2"
										>
											<MagicFileIcon
												type={item.file_name.split(".").pop()}
												size={16}
											/>
											<SmartTooltip
												fileName
												elementType="span"
												content={item.relative_file_path}
												className="min-w-0 flex-1 truncate text-xs"
											>
												{item.relative_file_path}
											</SmartTooltip>
											<span className="shrink-0 text-[11px] text-muted-foreground">
												{formatFileSize(item.file_size)}
											</span>
											<Button
												size="sm"
												variant="ghost"
												className="h-6 px-1.5 text-xs"
												onClick={() =>
													selectToolFile({
														detail: {},
														target: {
															type: "file",
															fileId: item.file_id,
														},
														filesStore: projectFilesStore,
													})
												}
											>
												{t("fileDownload.view")}
											</Button>
											<Button
												size="icon"
												variant="ghost"
												className="size-6 shrink-0"
												disabled={disabled}
												aria-label={t("fileDownload.downloadFile", {
													name: item.file_name,
												})}
												title={t("fileDownload.downloadOne")}
												onClick={() => {
													if (toolData.id)
														download?.startFile(
															toolData.id,
															data,
															item.file_id,
															noWatermark,
														)
												}}
											>
												<Download size={14} />
											</Button>
										</li>
									))}
								</ul>
							</ScrollArea>
						</>
					) : (
						<p className="m-0 p-3 text-xs text-muted-foreground">
							{loading
								? t("fileDownload.preparing")
								: failureText || t("fileDownload.unavailable")}
						</p>
					)}
				</div>
			)}
			{state?.phase === "error" && (
				<div role="status" className="mt-1 text-xs text-destructive">
					{state.error}
					{state.failedFiles?.length ? ` ${state.failedFiles.join("、")}` : ""}
				</div>
			)}
			{state?.phase === "saved" && (
				<p className="m-0 mt-1 text-xs text-muted-foreground">
					{t("fileDownload.started")}
				</p>
			)}
			{state?.phase === "cancelled" && (
				<p className="m-0 mt-1 text-xs text-muted-foreground">
					{t("fileDownload.cancelled")}
				</p>
			)}
		</div>
	)
}
