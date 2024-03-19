import { useTranslation } from "react-i18next"
import MagicModal from "@/opensource/components/base/MagicModal"
import magicToast from "@/opensource/components/base/MagicToaster/utils"
import ModelSelector from "@/opensource/components/business/RecordingSummary/components/ModelSelector"
import {
	RecordSummaryActionButton,
	RecordSummaryAlertIcon,
} from "../../components/RecordSummaryAlertCard"
import { Mic } from "lucide-react"

interface UseCancelRecordDialogsOptions {
	noNeedButtonText?: string
	summarizeButtonText?: string
	modalContent?: string
}

interface StopRecordingDialogActions {
	onCancel: () => Promise<unknown> | unknown
	onSummarize: () => Promise<unknown> | unknown
}

export function useCancelRecordDialogs({
	noNeedButtonText,
	summarizeButtonText,
	modalContent,
}: UseCancelRecordDialogsOptions = {}) {
	const { t } = useTranslation("super")

	const showOtherTabRecordingDialog = () => {
		const modalInstance = MagicModal.info({
			zIndex: 1000,
			title: t("recordingSummary.cancelModal.otherTabRecordingTitle"),
			closable: false,
			maskClosable: false,
			icon: (
				<RecordSummaryAlertIcon tone="neutral">
					<Mic size={16} />
				</RecordSummaryAlertIcon>
			),
			footer: (
				<div className="flex items-center gap-2 border-t border-border bg-muted/60 p-4">
					<RecordSummaryActionButton
						appearance="primary"
						fullWidth
						onClick={() => modalInstance.destroy()}
						data-testid="record-summary-other-tab-confirm-button"
					>
						{t("common.confirm")}
					</RecordSummaryActionButton>
				</div>
			),
		})

		return Promise.reject(new Error("other tab is recording"))
	}

	const showStopRecordingDialog = ({ onCancel, onSummarize }: StopRecordingDialogActions) => {
		const promise = new Promise((resolve, reject) => {
			const modalInstance = MagicModal.info({
				zIndex: 1000,
				title: t("recordingSummary.cancelModal.finishAndSummarize"),
				content: (
					<div className="space-y-3">
						<p className="m-0">
							{modalContent || t("recordingSummary.cancelModal.message")}
						</p>
						<div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
							<span>{t("recordingSummary.cancelModal.useModel")}</span>
							<ModelSelector />
							<span>{t("recordingSummary.cancelModal.toSummarize")}</span>
						</div>
					</div>
				),
				closable: true,
				maskClosable: false,
				onCancel: () => {
					reject(new Error("cancel recording dialog dismissed"))
				},
				icon: (
					<RecordSummaryAlertIcon tone="neutral">
						<Mic size={16} />
					</RecordSummaryAlertIcon>
				),
				footer: (
					<div className="flex items-center justify-end gap-2 border-t border-border bg-muted/60 p-4">
						<RecordSummaryActionButton
							appearance="danger"
							className="mr-auto"
							onClick={async () => {
								try {
									modalInstance.destroy()
									magicToast.loading({
										key: "cancel",
										content: t("recordingSummary.cancelModal.canceling"),
										duration: 0,
									})
									resolve(await onCancel())
								} catch (error) {
									reject(error)
								} finally {
									magicToast.destroy("cancel")
								}
							}}
							data-testid="record-summary-stop-discard-button"
						>
							{noNeedButtonText || t("recordingSummary.cancelModal.noNeed")}
						</RecordSummaryActionButton>
						<RecordSummaryActionButton
							appearance="secondary"
							onClick={() => {
								modalInstance.destroy()
								reject(new Error("cancel recording dialog dismissed"))
							}}
							data-testid="record-summary-stop-cancel-button"
						>
							{t("common.cancel")}
						</RecordSummaryActionButton>
						<RecordSummaryActionButton
							appearance="primary"
							onClick={async () => {
								try {
									modalInstance.destroy()
									resolve(await onSummarize())
								} catch (error) {
									reject(error)
								}
							}}
							data-testid="record-summary-stop-summarize-button"
						>
							{summarizeButtonText || t("recordingSummary.cancelModal.summarize")}
						</RecordSummaryActionButton>
					</div>
				),
			})
		})

		return promise
	}

	return {
		showOtherTabRecordingDialog,
		showStopRecordingDialog,
	}
}
