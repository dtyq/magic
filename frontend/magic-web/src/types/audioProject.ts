/** Summary status filter for audio project list queries */
export type AudioRecordingSummaryFilter = "all" | "not_summarized" | "summarized"

/** Sort field supported by audio-projects queries API */
export type AudioProjectSortBy = "updated_at" | "created_at"

/** Sort direction supported by audio-projects queries API */
export type AudioProjectSortOrder = "asc" | "desc"

/** Audio pipeline phase returned by backend */
export type AudioProjectPhase = "waiting" | "merging" | "summarizing" | (string & {})

/** How the audio file was created on the client */
export type AudioProjectAudioSource = "recorded" | "imported" | (string & {})

/** PC list card status — only items past APP upload/merge pipeline reach these states */
export type AudioRecordingCardStatus = "not_summarized" | "summarizing" | "summarized"

export interface QueryAudioProjectsParams {
	page: number
	page_size: number
	is_hidden: 0 | 1
	keyword?: string
	created_at_start?: number
	created_at_end?: number
	current_phase?: string[]
	workspace_id?: string
	sort_by?: AudioProjectSortBy
	sort_order?: AudioProjectSortOrder
	project_ids?: string[]
}

/** Nested metadata from the real audio-projects queries API */
export interface AudioProjectExtra {
	duration?: number
	device_id?: string
	tags?: string[]
	current_phase?: AudioProjectPhase
	phase_status?: string
	phase_percent?: number
	phase_error?: string | null
	audio_source?: AudioProjectAudioSource
	source?: string
	/** Backend returns integer; parsed as string when parseJsonLargeIntAsString is enabled */
	audio_file_id?: string | number
	file_size?: number
	auto_summary?: boolean
	task_key?: string
	/** Backend returns integer; parsed as string when parseJsonLargeIntAsString is enabled */
	topic_id?: string | number
	model_id?: string
}

/** Raw list item shape returned by POST audio-projects/queries */
export interface AudioProjectApiItem {
	id: string
	project_name: string
	created_at?: number
	updated_at?: number
	project_status?: string
	current_topic_status?: string
	project_mode?: string
	workspace_id?: string | null
	workspace_name?: string | null
	is_hidden?: boolean
	extra?: AudioProjectExtra | null
	/** Legacy flat fields — kept for backward compatibility when backend flattens the payload */
	is_summarized?: 0 | 1
	source?: number
	device_id?: string
	create_timestamp?: string
	duration?: number
	tags?: string[]
}

/** Normalized view model consumed by list UI components */
export interface AudioProjectListItem {
	id: string
	project_name: string
	created_at: number
	duration: number
	tags: string[]
	device_id: string
	audio_source: AudioProjectAudioSource | null
	current_phase: AudioProjectPhase | null
	phase_status: string | null
	phase_percent?: number
	card_status: AudioRecordingCardStatus
	/** Derived from card_status === "summarized" for detail navigation compatibility */
	is_summarized: boolean
	project_status?: string
	current_topic_status?: string
	/** ASR task key required for summarize/progress APIs */
	task_key?: string
	topic_id?: string
	audio_file_id?: string
	model_id?: string
}

export interface QueryAudioProjectsResponse {
	list: AudioProjectApiItem[]
	total?: number
	page?: number
	page_size?: number
}
