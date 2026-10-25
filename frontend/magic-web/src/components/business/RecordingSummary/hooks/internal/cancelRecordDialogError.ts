/**
 * Rejection reason used when the user closes the stop-recording dialog without choosing an action.
 * Flow callers (logout, organization switch) rely on the rejection to abort; click-handler callers
 * should swallow it via `isCancelRecordDialogDismissedError` to avoid an unhandled rejection.
 */
export class CancelRecordDialogDismissedError extends Error {
	constructor() {
		super("cancel recording dialog dismissed")
		this.name = "CancelRecordDialogDismissedError"
	}
}

export function isCancelRecordDialogDismissedError(
	error: unknown,
): error is CancelRecordDialogDismissedError {
	return error instanceof CancelRecordDialogDismissedError
}
