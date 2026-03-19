import { Button } from "@/components/shadcn-ui/button"
import { History } from "lucide-react"
import { useTranslation } from "react-i18next"
import type { FileHistoryVersion } from "@/pages/superMagic/pages/Workspace/types"

interface HistoryVersionBannerProps {
	fileVersionsList?: FileHistoryVersion[]
	fileVersion?: number
	onReturnLatest: () => void
	onRollback?: (version?: number) => void
	allowEdit?: boolean
	"data-testid"?: string
}

export function HistoryVersionBanner(props: HistoryVersionBannerProps) {
	const { fileVersionsList, fileVersion, onReturnLatest, onRollback, allowEdit = true } = props
	const { t } = useTranslation("super")

	if (!fileVersionsList || fileVersionsList.length === 0) {
		return null
	}

	return (
		<div
			className="flex w-full items-center justify-between border-b border-[#E5E7EB] bg-[#EEF4FF] px-3.5 py-1.5"
			data-testid={props["data-testid"]}
		>
			<div className="flex items-center gap-1 text-sm text-[#2563EB]">
				<History size={16} />
				<span>{t("common.historyVersionTip")}</span>
			</div>
			<div className="flex items-center gap-2.5">
				{fileVersionsList.length > 0 && (
					<Button
						type="button"
						variant="ghost"
						size="sm"
						className="h-6 rounded-md px-2.5 text-xs text-[#111827] hover:text-[#111827]"
						onClick={onReturnLatest}
						data-testid="detail-header-history-return-latest"
					>
						{t("common.returnLatest")}
					</Button>
				)}
				{onRollback && allowEdit && (
					<Button
						type="button"
						size="sm"
						className="h-6 rounded-md px-2.5 text-xs"
						onClick={() => onRollback(fileVersion)}
						data-testid="detail-header-history-rollback"
					>
						{t("common.rollbackToVersion")}
					</Button>
				)}
			</div>
		</div>
	)
}
