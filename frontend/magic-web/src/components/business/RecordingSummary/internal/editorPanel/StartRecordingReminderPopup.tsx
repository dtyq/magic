import { IconX } from "@tabler/icons-react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/shadcn-ui/button"
import { Dialog, DialogContent, DialogTitle } from "@/components/shadcn-ui/dialog"

interface StartRecordingReminderPopupProps {
	open: boolean
	onClose: () => void
	onConfirm: () => void
}

export function StartRecordingReminderPopup({
	open,
	onClose,
	onConfirm,
}: StartRecordingReminderPopupProps) {
	const { t } = useTranslation("super")

	return (
		<Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
			<DialogContent
				showCloseButton={false}
				className="w-[calc(100%-24px)] max-w-[351px] gap-0 overflow-hidden rounded-[14px] border border-border bg-secondary p-0 shadow-[0px_2px_10px_0px_rgba(0,0,0,0.05)]"
				data-testid="recording-editor-reminder-popup"
			>
				<div
					className="flex h-12 items-center gap-1.5 px-4"
					data-testid="recording-editor-reminder-header"
				>
					<DialogTitle className="sr-only">
						{t("recordingSummary.superEditorPanel.mobileRecordingReminder.title")}
					</DialogTitle>
					<div className="min-w-0 flex-1 truncate text-lg font-medium leading-7 text-foreground">
						{t("recordingSummary.superEditorPanel.mobileRecordingReminder.title")}
					</div>
					<button
						type="button"
						className="flex size-8 items-center justify-center rounded-md text-foreground transition-colors hover:bg-accent"
						onClick={onClose}
						data-testid="recording-editor-reminder-close-button"
					>
						<IconX size={16} />
					</button>
				</div>

				<div className="px-4 py-2" data-testid="recording-editor-reminder-content">
					<p className="text-base leading-6 text-foreground">
						{t("recordingSummary.superEditorPanel.mobileRecordingReminder.description")}
					</p>
				</div>

				<div
					className="flex w-full gap-1.5 p-3"
					data-testid="recording-editor-reminder-actions"
				>
					<Button
						type="button"
						variant="outline"
						className="h-9 flex-1 bg-background text-sm font-medium text-foreground"
						onClick={onClose}
						data-testid="recording-editor-reminder-cancel-button"
					>
						{t("recordingSummary.superEditorPanel.mobileRecordingReminder.cancel")}
					</Button>
					<Button
						type="button"
						className="h-9 flex-1 text-sm font-medium"
						onClick={onConfirm}
						data-testid="recording-editor-reminder-confirm-button"
					>
						{t("recordingSummary.superEditorPanel.mobileRecordingReminder.continue")}
					</Button>
				</div>
			</DialogContent>
		</Dialog>
	)
}
