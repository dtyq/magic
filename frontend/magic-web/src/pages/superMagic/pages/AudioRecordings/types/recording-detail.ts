import type { AttachmentItem } from "@/pages/superMagic/components/TopicFilesButton/hooks/types"

export type RecordingSummaryType =
	| "summary"
	| "topics"
	| "highlights"
	| "insights"
	| "metrics"
	| "mindmap"
	| "followup"
	| "power_dynamics"
	| "intent"

export interface MagicProjectConfig {
	version?: string
	type?: string
	name?: string
	files?: Record<string, string>
	metadata?: {
		title?: string
		date?: string
		duration?: number
		speakers?: Record<string, string>
		scene_type?: string
		tags?: string[]
	}
}

export interface RecordingDetailFileRef {
	type: string
	fileName: string
	/** Config can describe a file before the backend attachment exists. */
	file?: AttachmentItem
}

export interface RecordingDetailFileMap {
	/** Root path of the recording bundle used to scope shared document dependencies. */
	bundleRootPath?: string
	audio?: AttachmentItem
	transcript?: AttachmentItem
	notes?: AttachmentItem
	summaryFiles: RecordingDetailFileRef[]
	magicProject?: AttachmentItem
	indexHtml?: AttachmentItem
	magicProjectConfig?: MagicProjectConfig
}

export interface RecordingTranscriptSegment {
	id: string
	start: number
	end?: number
	speaker?: string
	text: string
}

export interface RecordingTopicItem {
	time: number
	timeEnd?: number
	speakers: string[]
	text: string
}

export interface RecordingTopicSection {
	id: string
	name: string
	color: string
	summaryTitle: string
	summaryText: string
	summarySpeakers: string[]
	itemsTitle: string
	items: RecordingTopicItem[]
}

export interface LoadedRecordingTextFile {
	fileId: string
	content: string
	url?: string
}
