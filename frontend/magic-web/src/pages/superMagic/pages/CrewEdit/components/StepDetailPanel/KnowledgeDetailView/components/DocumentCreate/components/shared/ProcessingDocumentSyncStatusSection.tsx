import { observer } from "mobx-react-lite"
import { useTranslation } from "react-i18next"
import { BookMarked, FileText, Folder, Loader2 } from "lucide-react"
import MagicEllipseWithTooltip from "@/components/base/MagicEllipseWithTooltip/MagicEllipseWithTooltip"
import MagicFileIcon from "@/components/base/MagicFileIcon"
import { DocumentSyncStatusBadge } from "../../../DocumentSyncStatusBadge"
import { CrewKnowledge } from "@/types/crew-knowledge"
import { cn } from "@/lib/utils"

export type ProcessingDocumentRowIconVariant = "file" | "project" | "document"

function getFileExtension(filename: string): string {
	const parts = filename.split(".")
	return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : ""
}

/** 与 FileUploadCard 一致的行首图标：`file` 按扩展名用 MagicFileIcon */
function RowLeadingIcon(props: {
	fileName: string
	iconVariant?: ProcessingDocumentRowIconVariant
}) {
	const { fileName, iconVariant = "file" } = props

	if (iconVariant === "project") {
		return (
			<div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
				<Folder className="size-5 text-muted-foreground" />
			</div>
		)
	}

	if (iconVariant === "document") {
		return (
			<div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
				<BookMarked className="size-5 text-muted-foreground" />
			</div>
		)
	}

	const ext = getFileExtension(fileName)
	return (
		<div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
			{ext ? (
				<MagicFileIcon type={ext} size={20} />
			) : (
				<FileText className="size-5 text-muted-foreground" />
			)}
		</div>
	)
}

export interface ProcessingDocumentSyncRow {
	/** 行稳定 key（文件 uid 或文档 code） */
	id: string
	fileName: string
	/** 与 FileUploadCard 一致：普通文件 / 项目文档 / 书签式文档 */
	iconVariant?: ProcessingDocumentRowIconVariant
	documentCode?: string
	syncStatus?: CrewKnowledge.DocumentSyncStatus
	/** 尚无文档或未拿到 sync_status：右侧显示加载中文案 */
	showLoading?: boolean
	errorMessage?: string
}

export interface ProcessingDocumentSyncStatusSectionProps {
	knowledgeBaseCode: string
	rows: ProcessingDocumentSyncRow[]
	title?: string
	description?: string
	className?: string
	onRetrySuccess?: () => void
}

/**
 * 最后一步数据处理：仅用 DocumentSyncStatusBadge 表达同步阶段，不展示百分比进度条
 */
export const ProcessingDocumentSyncStatusSection = observer(
	function ProcessingDocumentSyncStatusSection({
		knowledgeBaseCode,
		rows,
		title,
		description,
		className,
		onRetrySuccess,
	}: ProcessingDocumentSyncStatusSectionProps) {
		const { t } = useTranslation("crew/create")

		return (
			<div className={cn("flex flex-col gap-4", className)}>
				{(title || description) && (
					<div className="space-y-1">
						{title && <h3 className="text-lg font-semibold">{title}</h3>}
						{description && (
							<p className="text-sm text-muted-foreground">{description}</p>
						)}
					</div>
				)}

				<div className="flex flex-col gap-2">
					{rows.map((row) => (
						<div
							key={row.id}
							className="flex min-h-9 min-w-0 items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2"
						>
							<div className="flex min-w-0 flex-1 items-center gap-2">
								<RowLeadingIcon
									fileName={row.fileName}
									iconVariant={row.iconVariant}
								/>
								<MagicEllipseWithTooltip
									className="min-w-0 text-sm font-medium text-foreground"
									placement="right"
									text={row.fileName}
								/>
							</div>
							<div className="shrink-0">
								{row.errorMessage ? (
									<span className="text-xs text-destructive">
										{row.errorMessage}
									</span>
								) : row.showLoading ||
								  !row.documentCode ||
								  row.syncStatus === undefined ? (
									<span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
										<Loader2 className="size-3.5 shrink-0 animate-spin" />
										{t("documentCreate.processing.statusProcessing")}
									</span>
								) : (
									<DocumentSyncStatusBadge
										syncStatus={row.syncStatus}
										documentCode={row.documentCode}
										knowledgeBaseCode={knowledgeBaseCode}
										onRetrySuccess={onRetrySuccess}
									/>
								)}
							</div>
						</div>
					))}
				</div>
			</div>
		)
	},
)
