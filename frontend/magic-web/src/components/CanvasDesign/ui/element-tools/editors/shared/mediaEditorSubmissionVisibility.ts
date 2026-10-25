export interface ResolveMediaEditorSubmissionVisibilityOptions {
	hasActiveSubmission: boolean
	hasDismissedSubmission: boolean
	isGenerating: boolean
	isTimedOut: boolean
	isRetryEditing: boolean
}

/**
 * An editor stays hidden from the final submit action until the user explicitly
 * reopens it. Timeout and retry states are the only automatic reveal paths.
 */
export function resolveMediaEditorSubmissionVisibility(
	options: ResolveMediaEditorSubmissionVisibilityOptions,
): boolean {
	if (options.hasActiveSubmission || options.isGenerating) return true
	if (options.isTimedOut || options.isRetryEditing) return false
	return options.hasDismissedSubmission
}
