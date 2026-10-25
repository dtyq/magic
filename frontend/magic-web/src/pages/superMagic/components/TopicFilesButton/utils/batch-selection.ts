interface TopicFileSelectionOptions {
	isSelectMode: boolean
	allowEdit: boolean
	allowDownload?: boolean
	allowCopyTo?: boolean
	hasLogin: boolean
	allowReadonlySelection?: boolean
}

/**
 * Read-only file trees normally require a signed-in user before exposing persistent checkboxes.
 * A public share with download permission is the exception: its temporary share token already
 * authorizes downloads, so the share host may explicitly enable anonymous batch selection.
 */
export function shouldEnableTopicFileSelection(options: TopicFileSelectionOptions): boolean {
	const {
		isSelectMode,
		allowEdit,
		allowDownload,
		allowCopyTo = false,
		hasLogin,
		allowReadonlySelection = false,
	} = options

	if (isSelectMode) return true
	if (allowEdit || (!allowDownload && !allowCopyTo)) return false
	return hasLogin || allowReadonlySelection
}

export function shouldShowMobileBatchActions(options: {
	isMobile: boolean
	isSelectMode: boolean
	hasSelection: boolean
}): boolean {
	return options.isMobile && (options.isSelectMode || options.hasSelection)
}
