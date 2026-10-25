import { Loader2, Sparkles } from "lucide-react"
import { useTranslation } from "react-i18next"
import { cn } from "@/utils/cn"
import type { DetailSummaryVisualStatus } from "@/pages/superMagic/pages/AudioRecordings/utils/summary-action-utils"

interface MobileRecordingSummaryPlaceholderProps {
	status: DetailSummaryVisualStatus
	canGenerate: boolean
	submitting: boolean
	onGenerate: () => void
}

/** Shows the mobile summary state before completed summary files become available. */
export function MobileRecordingSummaryPlaceholder({
	status,
	canGenerate,
	submitting,
	onGenerate,
}: MobileRecordingSummaryPlaceholderProps) {
	const { t } = useTranslation("audioRecordings")
	const generating = status === "generating"
	const failed = status === "failed"
	const title = generating
		? t("detail.summarizingHint")
		: failed
			? t("detail.empty.summaryFailed")
			: t("detail.notSummarized")
	const description = generating
		? ""
		: failed
			? t("detail.empty.summaryFailedHint")
			: t("detail.notSummarizedHint")
	const actionLabel = failed ? t("card.regenerateSummary") : t("card.generateSummary")
	const showGenerateAction = canGenerate

	return (
		<div
			className="flex h-full items-center justify-center px-8 text-center"
			role="status"
			data-testid="mobile-recording-summary-placeholder"
		>
			<div className="flex flex-col items-center gap-3">
				<div
					className={cn(
						"flex items-center justify-center",
						generating
							? "rounded-full bg-muted p-4 text-muted-foreground"
							: "size-12 rounded-2xl bg-card",
					)}
				>
					{generating ? (
						<Loader2 className="size-8 animate-spin" strokeWidth={1.5} />
					) : (
						<Sparkles className="size-5" />
					)}
				</div>
				<p className="text-[16px] font-medium text-foreground">{title}</p>
				<p className="max-w-[280px] text-[14px] leading-6 text-muted-foreground">
					{description}
				</p>
				{showGenerateAction ? (
					<button
						type="button"
						className="mt-5 h-10 rounded-full bg-foreground px-5 text-[14px] font-semibold text-background transition-opacity active:opacity-80 disabled:opacity-50"
						disabled={submitting}
						onClick={onGenerate}
					>
						{submitting ? t("detail.summarizing") : actionLabel}
					</button>
				) : null}
			</div>
		</div>
	)
}
