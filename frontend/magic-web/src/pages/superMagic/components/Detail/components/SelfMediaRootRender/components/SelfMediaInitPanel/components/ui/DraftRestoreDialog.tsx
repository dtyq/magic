import { ArrowLeft, FileClock, Loader2, RotateCcw } from "lucide-react"
import { useEffect, useRef } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/shadcn-ui/button"
import { cn } from "@/utils/cn"
import { selfMediaOverlayStyles } from "../../../selfMediaOverlayStyles"

interface DraftRestoreDialogProps {
	open: boolean
	onRestore: () => void
	onDiscard: () => void
	onBackHome?: () => void
	isDiscarding?: boolean
}

export default function DraftRestoreDialog({
	open,
	onRestore,
	onDiscard,
	onBackHome,
	isDiscarding = false,
}: DraftRestoreDialogProps) {
	const { t } = useTranslation("super")
	const restoreButtonRef = useRef<HTMLButtonElement>(null)
	const actionGridClassName = onBackHome ? "sm:grid-cols-3" : "sm:grid-cols-2"

	useEffect(() => {
		if (!open) return
		restoreButtonRef.current?.focus()
	}, [open])

	if (!open) return null

	return (
		<div
			className={`absolute inset-0 z-30 flex items-center justify-center ${selfMediaOverlayStyles.manualOverlay}`}
		>
			<div
				role="dialog"
				aria-modal="true"
				className={`grid max-w-[420px] gap-4 ${selfMediaOverlayStyles.manualPanel}`}
				data-testid="self-media-draft-restore-dialog"
			>
				<div className="grid gap-3 text-center">
					<div className="mx-auto inline-flex size-11 items-center justify-center rounded-[18px] bg-white text-[#18181b] shadow-[inset_0_0_0_1px_rgba(24,24,27,0.08)]">
						<FileClock className="size-5" aria-hidden="true" />
					</div>
					<div className="space-y-2">
						<h2 className="text-lg font-[800] leading-tight text-[#18181b]">
							{t("detail.selfMedia.initPanel.draft.detected")}
						</h2>
						<p className="text-balance text-sm leading-relaxed text-[#71717a]">
							{t("detail.selfMedia.initPanel.draft.confirmDescription")}
						</p>
					</div>
				</div>
				<div className={cn("grid grid-cols-1 gap-2", actionGridClassName)}>
					{onBackHome ? (
						<Button
							type="button"
							variant="outline"
							className={selfMediaOverlayStyles.secondaryButton}
							onClick={onBackHome}
							disabled={isDiscarding}
							data-testid="self-media-draft-restore-back-button"
						>
							<ArrowLeft className="size-4" aria-hidden="true" />
							{t("detail.selfMedia.initPanel.draft.backHome")}
						</Button>
					) : null}
					<Button
						type="button"
						variant="outline"
						className={selfMediaOverlayStyles.secondaryButton}
						onClick={onDiscard}
						disabled={isDiscarding}
						aria-busy={isDiscarding}
						data-testid="self-media-draft-restore-clear-button"
					>
						{isDiscarding ? (
							<Loader2 className="size-4 animate-spin" aria-hidden="true" />
						) : (
							<RotateCcw className="size-4" aria-hidden="true" />
						)}
						{t(
							isDiscarding
								? "detail.selfMedia.initPanel.draft.clearing"
								: "detail.selfMedia.initPanel.draft.clear",
						)}
					</Button>
					<Button
						ref={restoreButtonRef}
						type="button"
						className={selfMediaOverlayStyles.primaryButton}
						onClick={onRestore}
						disabled={isDiscarding}
						data-testid="self-media-draft-restore-load-button"
					>
						<FileClock className="size-4" aria-hidden="true" />
						{t("detail.selfMedia.initPanel.draft.load")}
					</Button>
				</div>
			</div>
		</div>
	)
}
