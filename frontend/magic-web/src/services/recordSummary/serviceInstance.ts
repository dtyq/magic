import { RecordSummaryService } from "./RecordSummaryService"

let recordSummaryServiceInstance: RecordSummaryService | null = null

function initializeService(): RecordSummaryService {
	if (!recordSummaryServiceInstance) {
		recordSummaryServiceInstance = new RecordSummaryService()
	}
	return recordSummaryServiceInstance
}

function getServiceInstance(): RecordSummaryService | undefined {
	if (!recordSummaryServiceInstance) return undefined
	return recordSummaryServiceInstance
}

export { initializeService, getServiceInstance }

export default recordSummaryServiceInstance
