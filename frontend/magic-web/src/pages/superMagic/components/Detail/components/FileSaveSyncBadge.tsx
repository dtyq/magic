import { CloudOff, Loader2 } from "lucide-react"
import { useTranslation } from "react-i18next"
import { cn } from "@/utils/cn"
import MagicTooltip from "@/components/base/MagicTooltip"
import { FILE_SAVE_STATUS } from "../services/fileSaveQueue"
import { isFileSaveUnsynced, useFileSaveStatus } from "../hooks/useFileSaveStatus"

interface FileSaveSyncBadgeProps {
	fileId?: string
	className?: string
}

export function FileSaveSyncBadge({ fileId, className }: FileSaveSyncBadgeProps) {
	const { t } = useTranslation("super")
	const status = useFileSaveStatus(fileId)
	if (!fileId || !isFileSaveUnsynced(status)) return null

	const isFailed = status === FILE_SAVE_STATUS.Failed
	const label = isFailed ? t("detail.fileSave.unsynced") : t("detail.fileSave.syncing")

	return (
		<MagicTooltip title={label}>
			<span
				data-testid="file-save-sync-badge"
				data-status={status}
				className={cn(
					"inline-flex h-4 w-4 items-center justify-center rounded-full",
					isFailed ? "text-destructive" : "text-muted-foreground",
					className,
				)}
				aria-label={label}
			>
				{isFailed ? (
					<CloudOff className="h-3.5 w-3.5" />
				) : (
					<Loader2 className="h-3.5 w-3.5 animate-spin" />
				)}
			</span>
		</MagicTooltip>
	)
}
