export interface ShouldClearEditorAfterSendParams {
	isFromQueue?: boolean
	shouldClearEditorAfterSend?: boolean
}

export function shouldClearEditorAfterSend({
	isFromQueue,
	shouldClearEditorAfterSend,
}: ShouldClearEditorAfterSendParams) {
	if (isFromQueue) return false
	return shouldClearEditorAfterSend !== false
}
