import { CircleCheck, CircleX, Image, Loader2 } from "lucide-react"
import type { ReactNode } from "react"
import { cn } from "@/utils/cn"
import { useCanvasDesignI18n } from "../../../app/providers/I18nProvider"
import { useReferenceImageUrls } from "../../../app/hooks/resources/useReferenceImageUrls"
import type { ImageElement } from "../../../runtime/document/types"
import { splitRenameFileName, type ImageRenameRow } from "./useImageRename"
import RenameNameField from "./RenameNameField"

const nameRowClass = "grid grid-cols-[64px_minmax(0,1fr)] items-start gap-2 py-2 text-sm leading-5"
const fileInputRowClass = "flex min-w-0 flex-col py-2 text-sm leading-5"
const labelClass = "whitespace-nowrap text-muted-foreground"
const versionBadgeClass =
	"pointer-events-none inline-flex h-[18px] items-center whitespace-nowrap rounded bg-black/70 px-1 font-[Arial,sans-serif] text-[10px] leading-[18px] text-white"

function RenameThumbnail({
	path,
	processing,
	badges,
}: {
	path: string
	processing: boolean
	badges: ReactNode
}) {
	const { lowUrl, isLoading } = useReferenceImageUrls(path, {
		enabled: Boolean(path) && !processing,
	})
	return (
		<div
			data-testid="rename-file-thumbnail"
			className={cn(
				"relative mt-0.5 flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted/30",
				processing &&
					"bg-gradient-to-br from-violet-100 via-rose-50 to-blue-100 dark:from-violet-950 dark:via-rose-950 dark:to-blue-950",
			)}
		>
			{processing || isLoading ? (
				<Loader2 size={16} className="animate-spin text-muted-foreground" />
			) : lowUrl ? (
				<img src={lowUrl} alt="" className="size-full object-cover" />
			) : (
				<Image size={16} className="text-muted-foreground" />
			)}
			<div
				data-testid="rename-file-version-badges"
				className="pointer-events-none absolute left-1 top-1 z-10 flex flex-wrap gap-1"
			>
				{badges}
			</div>
		</div>
	)
}

export default function ImageRenameFileRow({
	row,
	element,
	saving,
	onChange,
}: {
	row: ImageRenameRow
	element: ImageElement
	saving: boolean
	onChange: (fileId: string, name: string) => void
}) {
	const { t } = useCanvasDesignI18n()
	const file = row.file
	const edited = Boolean(file && row.name !== file.fileName)
	const parts = splitRenameFileName(row.name)
	const isMain = element.mainContentId === row.content.contentId
	const isCurrent = element.activeContentId === row.content.contentId
	const status = row.processing ? (
		<span className="flex items-center gap-1">
			<Loader2 size={16} className="animate-spin" />
			{t("rename.generating", "生成中")}
		</span>
	) : row.status === "saving" ? (
		<span className="flex items-center gap-1">
			<Loader2 size={16} className="animate-spin" />
			{t("rename.saving", "正在保存")}
		</span>
	) : row.status === "success" ? (
		<span className="flex items-center gap-1 text-success">
			<CircleCheck size={16} />
			{t("rename.renamed", "文件已改名")}
		</span>
	) : row.status === "error" ? (
		<span className="flex items-center gap-1 text-destructive">
			<CircleX size={16} />
			{t("rename.failed", "重命名失败")}
		</span>
	) : edited ? (
		<span>{t("rename.awaitingConfirmation", "待确认")}</span>
	) : null
	return (
		<li
			data-testid="rename-file-row"
			className="grid min-w-0 grid-cols-[80px_minmax(0,1fr)] items-start gap-3 py-2.5"
		>
			<RenameThumbnail
				path={row.content.src || ""}
				processing={row.processing}
				badges={
					<>
						{isMain && (
							<span className={versionBadgeClass}>{t("rename.main", "主版本")}</span>
						)}
						{isCurrent && (
							<span className={versionBadgeClass}>{t("rename.current", "当前")}</span>
						)}
					</>
				}
			/>
			<div className="min-w-0">
				{row.shared && (
					<div className="mb-1 min-h-5 text-xs leading-5 text-muted-foreground">
						{t("rename.sharedFile", "共用同一文件")}
					</div>
				)}
				{status && (
					<div className="mb-1 flex min-h-5 items-center text-xs text-muted-foreground">
						{status}
					</div>
				)}
				{file ? (
					<div
						className={cn(
							"rounded-lg border focus-within:border-ring focus-within:ring-1 focus-within:ring-ring",
							row.error && "border-destructive/50",
						)}
					>
						<div className="overflow-hidden rounded-[inherit]">
							{edited && (
								<div className={cn(nameRowClass, "bg-muted/35")}>
									<span className={labelClass}>
										{t("rename.originalFileName", "原文件名")}
									</span>
									<span className="min-w-0 text-muted-foreground [overflow-wrap:anywhere]">
										{file.fileName}
									</span>
								</div>
							)}
							{/* 固定 key 保留输入 DOM：首次改动插入原名行时，光标仍在同一字段。 */}
							<div
								key="file-input"
								className={cn(
									fileInputRowClass,
									"bg-background",
									edited && "border-t",
								)}
							>
								{/* 窄版本行内限制输入高度，避免长文件名撑满整个重命名面板。 */}
								<RenameNameField
									value={parts.base}
									extension={splitRenameFileName(file.fileName).extension}
									label={t("rename.fileName", {
										defaultValue: "第 {{number}} 版文件名",
										number: row.version,
									})}
									disabled={saving}
									maxRows={4}
									invalid={Boolean(row.error)}
									onChange={(name) =>
										onChange(
											file.fileId,
											`${name}${splitRenameFileName(file.fileName).extension}`,
										)
									}
								/>
							</div>
						</div>
					</div>
				) : row.processing ? (
					<div className="rounded-lg border border-dashed">
						<div className={nameRowClass}>
							<span className={labelClass}>
								{t("rename.expectedName", "预计名称")}
							</span>
							<span className="min-w-0 [overflow-wrap:anywhere]">
								{row.expectedName || t("rename.nameUndetermined", "名称尚未确定")}
							</span>
						</div>
						<p className="m-0 pb-2 text-xs leading-5 text-muted-foreground">
							{t("rename.notGenerated", "生成后可修改文件名")}
						</p>
					</div>
				) : (
					<p className="m-0 text-xs leading-5 text-muted-foreground">
						{t("rename.fileUnavailable", "当前文件不可重命名")}
					</p>
				)}
				{row.error && (
					<p role="alert" className="mb-0 mt-1.5 text-xs leading-5 text-destructive">
						{row.error}
					</p>
				)}
			</div>
		</li>
	)
}
