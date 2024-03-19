import { memo, useEffect } from "react"
import { useTranslation } from "react-i18next"
import { Mic, TriangleAlert } from "lucide-react"
import MagicModal from "@/opensource/components/base/MagicModal"
import { RecordingSession } from "@/opensource/types/recordSummary"
import { RECORD_SUMMARY_EVENTS } from "@/opensource/services/recordSummary/const/events"
import { formatDuration } from "@/opensource/services/recordSummary/utils/format"
import { initializeService } from "@/opensource/services/recordSummary/serviceInstance"
import SuperMagicService from "@/opensource/pages/superMagic/services"
import FileContentChangeModal from "../FileContentChangeModal"
import { RecordSummaryActionButton, RecordSummaryAlertIcon } from "../RecordSummaryAlertCard"

function renderDescriptionLines(content: string) {
	return (
		<div className="space-y-1.5">
			{content.split("\n").map((line, index) => (
				<p key={`${line}-${index}`} className="m-0">
					{line}
				</p>
			))}
		</div>
	)
}

function RecordSummaryServiceListenerModal() {
	const { t } = useTranslation("super")
	const recordSummaryService = initializeService()

	useEffect(() => {
		return recordSummaryService.on(
			RECORD_SUMMARY_EVENTS.RECORDING_ERROR,
			({ session }: { session: RecordingSession }) => {
				if (!session) return

				const modalInstance = MagicModal.warning({
					title: t("recordingSummary.cancelModal.title", { ns: "super" }),
					content: t("recordingSummary.cancelModal.downloadMessage", {
						ns: "super",
					}),
					closable: false,
					maskClosable: false,
					icon: (
						<RecordSummaryAlertIcon tone="danger">
							<TriangleAlert size={16} />
						</RecordSummaryAlertIcon>
					),
					footer: (
						<div className="flex items-center justify-end gap-2 border-t border-border bg-muted/60 p-4">
							<RecordSummaryActionButton
								appearance="danger"
								onClick={() => {
									recordSummaryService.reset()
									modalInstance.destroy()
								}}
								data-testid="record-summary-error-end-button"
							>
								{t("recordingSummary.cancelModal.endRecording", {
									ns: "super",
								})}
							</RecordSummaryActionButton>
							<RecordSummaryActionButton
								appearance="primary"
								onClick={() => {
									modalInstance.destroy()
									recordSummaryService.resetCancelledRecordingSession(session)
								}}
								data-testid="record-summary-error-retry-button"
							>
								{t("recordingSummary.actions.retry", {
									ns: "super",
								})}
							</RecordSummaryActionButton>
						</div>
					),
				})
			},
		)
	}, [recordSummaryService, t])

	useEffect(() => {
		return recordSummaryService.on(
			RECORD_SUMMARY_EVENTS.RECORDING_DURATION_EXCEEDED,
			({ session }: { session: RecordingSession }) => {
				if (!session) return

				const modalInstance = MagicModal.info({
					title: t("recordingSummary.cancelModal.title", { ns: "super" }),
					content: t("recordingSummary.cancelModal.durationExceededMessage", {
						ns: "super",
						duration: 12,
					}),
					closable: false,
					maskClosable: false,
					icon: (
						<RecordSummaryAlertIcon tone="danger">
							<TriangleAlert size={16} />
						</RecordSummaryAlertIcon>
					),
					footer: (
						<div className="flex items-center gap-2 border-t border-border bg-muted/60 p-4">
							<RecordSummaryActionButton
								appearance="primary"
								fullWidth
								onClick={() => {
									modalInstance.destroy()
									if (session.project?.id) {
										SuperMagicService.switchProjectById(session.project.id)
									}
								}}
								data-testid="record-summary-duration-go-project-button"
							>
								{t("recordingSummary.cancelModal.goToProject", {
									ns: "super",
								})}
							</RecordSummaryActionButton>
						</div>
					),
				})
			},
		)
	}, [recordSummaryService, t])

	useEffect(() => {
		return recordSummaryService.on(
			RECORD_SUMMARY_EVENTS.CONFIRM_OVERWRITE_SESSION,
			({ session, onConfirm, onCancel }) => {
				const duration = formatDuration(session.totalDuration)
				const organizationName = session.organizationName || ""
				const content = organizationName
					? t("recordingSummary.userLogout.confirmOverwriteMessage", {
							organizationName,
							duration,
							ns: "super",
						})
					: t("recordingSummary.userLogout.confirmOverwriteMessageWithoutOrg", {
							duration,
							ns: "super",
						})

				const modalInstance = MagicModal.confirm({
					title: t("recordingSummary.userLogout.confirmOverwriteTitle", { ns: "super" }),
					content: renderDescriptionLines(content),
					closable: false,
					maskClosable: false,
					icon: (
						<RecordSummaryAlertIcon tone="neutral">
							<Mic size={16} />
						</RecordSummaryAlertIcon>
					),
					footer: (
						<div className="flex items-center justify-end gap-2 border-t border-border bg-muted/60 p-4">
							<RecordSummaryActionButton
								appearance="secondary"
								onClick={() => {
									modalInstance.destroy()
									onCancel()
								}}
								data-testid="record-summary-overwrite-cancel-button"
							>
								{t("recordingSummary.userLogout.cancelButton", { ns: "super" })}
							</RecordSummaryActionButton>
							<RecordSummaryActionButton
								appearance="primary"
								onClick={() => {
									modalInstance.destroy()
									onConfirm()
								}}
								data-testid="record-summary-overwrite-confirm-button"
							>
								{t("recordingSummary.userLogout.confirmButton", { ns: "super" })}
							</RecordSummaryActionButton>
						</div>
					),
				})
			},
		)
	}, [recordSummaryService, t])

	return <FileContentChangeModal />
}

export default memo(RecordSummaryServiceListenerModal)
