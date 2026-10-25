import { useEffect, useState } from "react"
import { Check, Loader2, RefreshCw, X } from "lucide-react"
import { useTranslation } from "react-i18next"
import MagicTooltip from "@/components/base/MagicTooltip"
import { Button } from "@/components/shadcn-ui/button"
import { cn } from "@/utils/cn"
import type { DownloadProgress } from "@/pages/superMagic/utils/api"
import type { HtmlPreviewPhase } from "../hooks/useHtmlPreviewFreshness"
import type { SaveConfirmationStage } from "../hooks/useSaveConfirmation"

// SI units like the rest of the file UI; kept local so this chip does not pull in i18n.
function formatReceivedBytes(bytes: number) {
	if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(2)} MB`
	return `${Math.max(1, Math.round(bytes / 1000))} KB`
}

export function HtmlPreviewFreshness({
	phase,
	hasRendered,
	slow = false,
	progress = null,
	onRetry,
	saveStage = "idle",
	previewStatusEnabled = true,
}: {
	phase: HtmlPreviewPhase
	hasRendered: boolean
	/** Past the slow threshold but not failed: say so instead of showing nothing or failing early. */
	slow?: boolean
	/** Download progress of the remote file while `phase` is `updating`. */
	progress?: DownloadProgress | null
	onRetry: () => void
	saveStage?: SaveConfirmationStage
	/** Preview refresh notices are meaningless while the editor is open. */
	previewStatusEnabled?: boolean
}) {
	const { t } = useTranslation("super")
	const [dismissed, setDismissed] = useState(false)
	// Keep dismissal through processing/rendering; the next completed cycle resets it.
	useEffect(() => {
		if (phase === "idle" && saveStage === "idle") setDismissed(false)
	}, [phase, saveStage])

	const isFailed = previewStatusEnabled && phase === "failed"
	// Save feedback owns the notice, so the refreshes it triggers do not flash again.
	const showSaveStatus = !isFailed && saveStage !== "idle"
	const showPreviewStatus =
		previewStatusEnabled && phase !== "idle" && (hasRendered || slow || phase === "failed")
	if (dismissed || (!isFailed && !showSaveStatus && !showPreviewStatus)) return null

	const label = isFailed
		? t("htmlEditor.previewRefreshFailed")
		: showSaveStatus
			? saveStage === "saved"
				? t("common.saveSuccess")
				: t("detail.fileSave.syncing")
			: slow
				? t(
						phase === "rendering"
							? "htmlEditor.previewSlowRendering"
							: "htmlEditor.previewSlowLoading",
					)
				: t("htmlEditor.previewUpdating")
	const showProgress = !isFailed && !showSaveStatus && phase === "updating" && progress !== null
	const percent =
		progress?.total !== undefined
			? Math.min(100, Math.floor((progress.loaded / progress.total) * 100))
			: null

	// Transient save chips dismiss themselves; only durable preview states need a close control.
	const showDismiss = !showSaveStatus

	return (
		<div
			role="status"
			aria-live="polite"
			// Glass chip over the canvas: light enough to sit on slides without looking like a modal.
			className={cn(
				"absolute right-3 top-3 z-30 flex max-w-[calc(100%-1.5rem)] items-center gap-1.5",
				"rounded-full border border-border/50 bg-background/85 px-2.5 py-1",
				"text-xs text-muted-foreground shadow-sm backdrop-blur-md",
				"duration-200 animate-in fade-in-0 zoom-in-95",
				isFailed && "border-destructive/30 text-destructive",
			)}
			data-testid="html-preview-freshness"
		>
			{showSaveStatus ? (
				saveStage === "saved" ? (
					<Check className="size-3.5 shrink-0" strokeWidth={2} />
				) : (
					<Loader2 className="size-3.5 shrink-0 animate-spin" strokeWidth={2} />
				)
			) : !isFailed ? (
				<Loader2 className="size-3.5 shrink-0 animate-spin" strokeWidth={2} />
			) : null}
			<span className="truncate font-normal leading-none">{label}</span>
			{showProgress && progress && (
				<>
					{percent !== null && (
						<span
							role="progressbar"
							aria-valuemin={0}
							aria-valuemax={100}
							aria-valuenow={percent}
							className="h-1 w-14 shrink-0 overflow-hidden rounded-full bg-muted"
						>
							<span
								className="block h-full rounded-full bg-primary transition-[width] duration-150"
								style={{ width: `${percent}%` }}
							/>
						</span>
					)}
					<span className="shrink-0 tabular-nums leading-none">
						{percent !== null ? `${percent}%` : formatReceivedBytes(progress.loaded)}
					</span>
				</>
			)}
			{isFailed && (
				<MagicTooltip title={t("htmlEditor.previewRefreshTooltip")}>
					<Button
						variant="ghost"
						size="sm"
						onClick={onRetry}
						className="h-6 gap-1 rounded-full px-2 text-xs"
					>
						<RefreshCw className="size-3.5" strokeWidth={2} />
						{t("htmlEditor.previewRetry")}
					</Button>
				</MagicTooltip>
			)}
			{showDismiss && (
				<MagicTooltip title={t("common.close")}>
					<Button
						variant="ghost"
						size="icon"
						className="size-6 shrink-0 rounded-full text-muted-foreground hover:text-foreground"
						aria-label={t("common.close")}
						onClick={() => setDismissed(true)}
					>
						<X className="size-3.5" strokeWidth={2} />
					</Button>
				</MagicTooltip>
			)}
		</div>
	)
}
