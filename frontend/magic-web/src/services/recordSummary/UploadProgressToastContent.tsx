import { useTranslation } from "react-i18next"
import MagicTooltip from "@/components/base/MagicTooltip"
import { Button } from "@/components/shadcn-ui/button"

interface UploadProgressToastContentProps {
	text: string
	showRetry?: boolean
	onRetry?: () => void
}

export function UploadProgressToastContent({
	text,
	showRetry = false,
	onRetry,
}: UploadProgressToastContentProps) {
	const { t } = useTranslation("super")

	return (
		<div
			className="flex min-w-0 flex-wrap items-center gap-2.5"
			data-testid="recording-summary-upload-toast"
		>
			<span className="min-w-0 flex-1 whitespace-pre-line text-[13px] leading-[21px] text-muted-foreground [overflow-wrap:anywhere] first-line:font-medium first-line:text-foreground">
				{text}
			</span>
			{showRetry ? (
				<MagicTooltip title={t("recordingSummary.message.retryUploadTooltip")}>
					<Button
						type="button"
						variant="ghost"
						size="sm"
						className="relative h-6 shrink-0 rounded-full border border-border/70 bg-background px-2 text-[12px] font-medium leading-none text-primary shadow-none transition-colors hover:border-primary/30 hover:bg-primary/5 hover:text-primary [@media(pointer:coarse)]:before:absolute [@media(pointer:coarse)]:before:-inset-2.5 [@media(pointer:coarse)]:before:content-['']"
						data-testid="recording-summary-upload-retry-button"
						onClick={onRetry}
					>
						{t("recordingSummary.message.retryUpload")}
					</Button>
				</MagicTooltip>
			) : null}
		</div>
	)
}
