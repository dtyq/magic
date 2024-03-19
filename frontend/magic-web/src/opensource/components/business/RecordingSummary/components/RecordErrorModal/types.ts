import { GetRecordingSummaryResultResponse } from "@/opensource/apis/modules/superMagic/recordSummary"

export interface RecordErrorModalProps {
	/** Whether to display the modal */
	open?: boolean
	/** Close callback */
	onClose?: () => void
	/** Response */
	response?: GetRecordingSummaryResultResponse & {
		model_id: string
		workspace_id: string
		project_name: string
	}
}

export interface ShowRecordErrorModalOptions {
	/** Modal close callback */
	onClose?: () => void
	/** Response */
	response?: GetRecordingSummaryResultResponse & {
		model_id: string
		workspace_id: string
		project_name: string
	}
}
