import { Sparkles } from "lucide-react"
import type { WaitingTipModalProps } from "./types"
import { useTranslation } from "react-i18next"
import {
	AlertDialog,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogTitle,
} from "@/components/shadcn-ui/alert-dialog"
import { RecordSummaryActionButton, RecordSummaryAlertIcon } from "../RecordSummaryAlertCard"

function WaitingTipModal({
	open = false,
	onClose,
	projectName,
	workspaceName,
}: WaitingTipModalProps) {
	const { t } = useTranslation("super")
	const displayProjectName = projectName || t("project.unnamedProject")
	const displayWorkspaceName = workspaceName || t("workspace.unnamedWorkspace")

	return (
		<AlertDialog
			open={open}
			onOpenChange={(nextOpen) => {
				if (!nextOpen) {
					onClose?.()
				}
			}}
		>
			<AlertDialogContent
				className="w-[calc(100vw-32px)] max-w-96 gap-0 overflow-hidden rounded-[14px] border border-border bg-background p-0 shadow-[0_10px_15px_-3px_rgba(0,0,0,0.1),0_4px_6px_-4px_rgba(0,0,0,0.1)] ring-0"
				data-testid="record-summary-waiting-tip-modal"
			>
				<div className="flex items-start gap-3.5 p-4">
					<RecordSummaryAlertIcon tone="neutral">
						<Sparkles size={16} />
					</RecordSummaryAlertIcon>
					<div className="min-w-0 flex-1">
						<AlertDialogTitle className="text-base font-semibold leading-6 text-foreground">
							{t("recordingSummary.waitingTipModal.title")}
						</AlertDialogTitle>
						<AlertDialogDescription className="mt-1.5 space-y-0 text-left text-sm leading-5 text-muted-foreground">
							<p className="m-0">
								{t("recordingSummary.waitingTipModal.organizingRecording")}
							</p>
							<p className="m-0">
								{t("recordingSummary.waitingTipModal.contentWillBeSavedTo", {
									projectName: `${displayWorkspaceName} - ${displayProjectName}`,
								})}
							</p>
						</AlertDialogDescription>
					</div>
				</div>
				<div className="border-t border-border bg-muted/60 p-4">
					<RecordSummaryActionButton
						appearance="secondary"
						fullWidth
						onClick={onClose}
						data-testid="record-summary-waiting-tip-confirm-button"
					>
						{t("recordingSummary.waitingTipModal.understood")}
					</RecordSummaryActionButton>
				</div>
			</AlertDialogContent>
		</AlertDialog>
	)
}

export default WaitingTipModal
