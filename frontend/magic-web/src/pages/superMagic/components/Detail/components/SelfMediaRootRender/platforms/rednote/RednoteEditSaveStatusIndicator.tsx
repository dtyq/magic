import { useTranslation } from "react-i18next"
import { Check, CloudOff, Loader2 } from "lucide-react"
import { cn } from "@/utils/cn"
import { selfMediaOverlayStyles } from "../../components/selfMediaOverlayStyles"

type SaveStatus = "idle" | "saving" | "saved" | "error"

interface RednoteEditSaveStatusIndicatorProps {
	status: SaveStatus
	inline?: boolean
}

export function RednoteEditSaveStatusIndicator({
	status,
	inline = false,
}: RednoteEditSaveStatusIndicatorProps) {
	const { t } = useTranslation("super")

	if (status === "idle") return null

	return (
		<div
			className={cn(
				"flex items-center gap-1.5 px-2.5 py-1 text-xs",
				inline
					? "text-muted-foreground"
					: `absolute right-3 top-3 z-50 ${selfMediaOverlayStyles.floatingPanel}`,
			)}
			data-testid="red-edit-save-status"
		>
			{status === "saving" && (
				<>
					<Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
					<span className="text-muted-foreground">
						{t("detail.selfMedia.edit.saving")}
					</span>
				</>
			)}
			{status === "saved" && (
				<>
					<Check className="h-3 w-3 text-green-500" />
					<span className="text-green-600 dark:text-green-400">
						{t("detail.selfMedia.edit.saved")}
					</span>
				</>
			)}
			{status === "error" && (
				<>
					<CloudOff className="h-3 w-3 text-destructive" />
					<span className="text-destructive">
						{t("detail.selfMedia.edit.saveFailed")}
					</span>
				</>
			)}
		</div>
	)
}
