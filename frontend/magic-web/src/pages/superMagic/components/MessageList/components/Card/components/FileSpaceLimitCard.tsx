import { FolderOpen, MessageCircleWarning } from "lucide-react"
import { useTranslation } from "react-i18next"
import { showOnlineFeedbackModal } from "@/components/business/OnlineFeedbackModal"
import { Button } from "@/components/shadcn-ui/button"

export interface FileSpaceLimitData {
	reason: "project_file_count_exceeded" | "user_space_file_count_exceeded"
	space_type: "project" | "user"
	required_cleanup_count: number
	temporary_protection: true
	current_count?: number
	limit?: number
}

export function getFileSpaceLimitData(value: unknown): FileSpaceLimitData | null {
	if (!value || typeof value !== "object") return null
	const data = value as Partial<FileSpaceLimitData>
	if (
		(data.reason !== "project_file_count_exceeded" &&
			data.reason !== "user_space_file_count_exceeded") ||
		(data.space_type !== "project" && data.space_type !== "user") ||
		data.temporary_protection !== true ||
		typeof data.required_cleanup_count !== "number" ||
		data.required_cleanup_count < 1
	)
		return null
	return data as FileSpaceLimitData
}

export function FileSpaceLimitCard({
	data,
	onOpenProjectFiles,
}: {
	data: FileSpaceLimitData
	onOpenProjectFiles?: () => void
}) {
	const { t } = useTranslation("super")
	const cleanupCount = Math.ceil(data.required_cleanup_count)
	const feedbackDetails = {
		reason: data.reason,
		space_type: data.space_type,
		required_cleanup_count: cleanupCount,
		temporary_protection: data.temporary_protection,
	}

	return (
		<section
			className="mt-2 max-w-[520px] rounded-xl border border-border bg-background p-4 shadow-sm"
			data-testid="file-space-limit-card"
		>
			<div className="flex items-start gap-3">
				<div className="mt-0.5 rounded-lg bg-amber-500/10 p-2 text-amber-600 dark:text-amber-400">
					<MessageCircleWarning size={18} />
				</div>
				<div className="min-w-0 flex-1">
					<h3 className="text-sm font-medium text-foreground">
						{t("fileSpaceLimit.title")}
					</h3>
					<p className="mt-1 text-xs leading-5 text-muted-foreground">
						{t("fileSpaceLimit.description")}
					</p>
					<p className="mt-2 text-sm font-medium text-foreground">
						{t("fileSpaceLimit.cleanupCount", { count: cleanupCount })}
					</p>
					<p className="mt-1 text-xs text-muted-foreground">
						{t("fileSpaceLimit.temporaryNotice")}
					</p>
					<div className="mt-3 flex flex-wrap gap-2">
						{onOpenProjectFiles && (
							<Button type="button" size="sm" onClick={onOpenProjectFiles}>
								<FolderOpen size={14} />
								{t("fileSpaceLimit.openFiles")}
							</Button>
						)}
						<Button
							type="button"
							size="sm"
							variant="outline"
							onClick={() =>
								void showOnlineFeedbackModal({
									defaultValue: t("fileSpaceLimit.feedbackDefault", {
										count: cleanupCount,
									}),
									details: feedbackDetails,
								})
							}
						>
							<MessageCircleWarning size={14} />
							{t("fileSpaceLimit.feedback")}
						</Button>
					</div>
				</div>
			</div>
		</section>
	)
}
