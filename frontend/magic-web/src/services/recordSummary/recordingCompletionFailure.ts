import { ERROR_CODES, getBusinessErrorCode } from "./RecordingErrorManager"

interface RecordingCompletionFailureActions {
	error: Error
	isCurrentSession: () => boolean
	clearSummaryMessage: () => void
	terminateSession: () => Promise<void>
	pauseSession: () => void | Promise<void>
	onError: (error: Error) => void
}

/** A missing project is terminal; transient failures remain recoverable in the same session. */
export async function handleRecordingCompletionFailure(actions: RecordingCompletionFailureActions) {
	if (actions.isCurrentSession()) {
		if (getBusinessErrorCode(actions.error) === ERROR_CODES.PROJECT_NOT_FOUND) {
			actions.clearSummaryMessage()
			await actions.terminateSession()
		} else {
			await actions.pauseSession()
		}
	}
	// Notify the original consumer only after cleanup, without touching a replacement recording.
	actions.onError(actions.error)
}
