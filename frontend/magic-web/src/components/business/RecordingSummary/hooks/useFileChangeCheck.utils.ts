export interface NoteFileChangeDecision {
	shouldPromptConflict: boolean
	matchesCurrentContent: boolean
	matchesLastSyncedContent: boolean
}

export function decideNoteFileConflict(options: {
	currentContent: string
	serverContent: string
	lastSyncedContent?: string
}): NoteFileChangeDecision {
	const normalizedCurrentContent = options.currentContent.trim()
	const normalizedServerContent = options.serverContent.trim()
	const normalizedLastSyncedContent = options.lastSyncedContent?.trim()

	const matchesCurrentContent = normalizedServerContent === normalizedCurrentContent
	const matchesLastSyncedContent =
		typeof normalizedLastSyncedContent === "string" &&
		normalizedServerContent === normalizedLastSyncedContent

	return {
		shouldPromptConflict: !matchesCurrentContent && !matchesLastSyncedContent,
		matchesCurrentContent,
		matchesLastSyncedContent,
	}
}
