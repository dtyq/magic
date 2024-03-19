import { GetRecordingSummaryResultResponse } from "@/opensource/apis/modules/superMagic/recordSummary"
import showWaitingTipModal from "../components/WaitingTipModal"
import showRecordErrorModal from "../components/RecordErrorModal"

export function onSummarizeSuccessDefaultCallback(
	res: GetRecordingSummaryResultResponse & {
		model_id: string
		workspace_id: string
		project_name: string
	},
) {
	if (res.success) {
		showWaitingTipModal({
			projectName: res.project_name,
			workspaceName: res.workspace_name,
		})
	} else {
		showRecordErrorModal({ response: res })
	}
}
