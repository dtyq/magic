import { AlertCircle, Check, Loader2 } from "lucide-react"
import { useTranslation } from "react-i18next"
import { cn } from "@/utils/cn"

type RednoteMetaSaveState = "saving" | "saved" | "error"

interface RednoteMetaSaveStatusProps {
	state: RednoteMetaSaveState
}

export function RednoteMetaSaveStatus({ state }: RednoteMetaSaveStatusProps) {
	const { t } = useTranslation("super")

	return (
		<div
			className={cn(
				"mb-1 ml-auto flex min-h-5 w-fit items-center justify-end gap-1 rounded-full bg-black/[0.03] px-2 py-0.5 text-[11px]",
				state === "saving" && "text-[#1f6fff]",
				state === "saved" && "text-[#16a34a]",
				state === "error" && "text-[#dc2626]",
			)}
			aria-live="polite"
			data-testid="red-detail-meta-save-status"
		>
			{state === "saving" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
			{state === "saved" ? <Check className="h-3.5 w-3.5 text-[#16a34a]" /> : null}
			{state === "error" ? <AlertCircle className="h-3.5 w-3.5 text-[#dc2626]" /> : null}
			{state === "saving" ? t("detail.selfMedia.platform.rednote.metaEdit.saving") : null}
			{state === "saved" ? t("detail.selfMedia.platform.rednote.metaEdit.saved") : null}
			{state === "error" ? t("detail.selfMedia.platform.rednote.metaEdit.failed") : null}
		</div>
	)
}
