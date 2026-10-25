import type { PPTNotesAction } from "./PPTNotesActions"

export interface PPTNotesSlide {
	key: string
	fileId: string
	slideIndex: number
	rawContent?: string
	loadingError?: boolean
}

export interface PPTSpeakerNotesPanelProps {
	onPendingChangesChange?: (pending: boolean) => void
	visible?: boolean
	layout?: "default" | "presenter"
	slides?: PPTNotesSlide[]
	onLoadSlide?: (key: string) => Promise<boolean>
	slideIndex: number
	rawContent: string
	fileId: string
	getLatestRawContent?: (fileId: string) => string
	allowEdit: boolean
	saveEditContent?: (
		content: any,
		fileId?: string,
		enable_shadow?: boolean,
		fetchFileVersions?: (fileId: string) => void,
		isPPTEditMode?: boolean,
		shouldExitEditMode?: boolean,
		options?: { silent?: boolean },
	) => Promise<boolean | void>
	onSaved: (content: string, fileId: string) => Promise<void>
	onGenerate?: (
		action: PPTNotesAction,
		fileId: string,
		notes: string,
		signal: AbortSignal,
		instruction?: string,
	) => Promise<string>
}
