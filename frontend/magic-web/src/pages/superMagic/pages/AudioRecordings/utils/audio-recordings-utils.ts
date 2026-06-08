import i18next from "i18next"
import type {
	AudioProjectListItem,
	AudioProjectSortBy,
	AudioProjectSortOrder,
	AudioRecordingSummaryFilter,
	QueryAudioProjectsParams,
} from "@/types/audioProject"
import { formatTime } from "@/utils/string"

/** Maps UI summary filter to API current_phase values (coarse server-side filter) */
export function resolveSummaryPhaseFilter(
	filter: AudioRecordingSummaryFilter,
): string[] | undefined {
	if (filter === "not_summarized") return ["merging"]
	if (filter === "summarized") return ["summarizing"]
	return undefined
}

/** Applies client-side card_status filter to align tabs with PC-visible states */
export function applyClientSummaryFilter(
	items: AudioProjectListItem[],
	filter: AudioRecordingSummaryFilter,
): AudioProjectListItem[] {
	if (filter === "not_summarized") {
		return items.filter((item) => item.card_status === "not_summarized")
	}
	if (filter === "summarized") {
		return items.filter((item) => item.card_status === "summarized")
	}
	return items
}

/** Builds request payload from store filter state */
export function buildAudioProjectsQueryParams(options: {
	page: number
	pageSize: number
	keyword: string
	summaryFilter: AudioRecordingSummaryFilter
	createdAtStart?: number
	createdAtEnd?: number
	sortBy: AudioProjectSortBy
	sortOrder: AudioProjectSortOrder
	projectIds?: string[]
}): QueryAudioProjectsParams {
	const params: QueryAudioProjectsParams = {
		page: options.page,
		page_size: options.pageSize,
		is_hidden: 0,
		sort_by: options.sortBy,
		sort_order: options.sortOrder,
	}

	const keyword = options.keyword.trim()
	if (keyword) params.keyword = keyword

	const currentPhase = resolveSummaryPhaseFilter(options.summaryFilter)
	if (currentPhase) params.current_phase = currentPhase

	if (options.createdAtStart != null) params.created_at_start = options.createdAtStart
	if (options.createdAtEnd != null) params.created_at_end = options.createdAtEnd
	if (options.projectIds?.length) params.project_ids = options.projectIds

	return params
}

/** Formats recording duration in seconds to mm:ss or h:mm:ss */
export function formatRecordingDuration(seconds: number): string {
	if (!Number.isFinite(seconds) || seconds <= 0) return "0:00"

	const totalSeconds = Math.floor(seconds)
	const hours = Math.floor(totalSeconds / 3600)
	const minutes = Math.floor((totalSeconds % 3600) / 60)
	const remainingSeconds = totalSeconds % 60

	if (hours > 0) {
		return `${hours}:${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`
	}

	return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`
}

/** Whether the card should navigate to the summarized HTML detail page */
export function isAudioProjectDetailReady(item: AudioProjectListItem): boolean {
	return item.card_status === "summarized"
}

/** Whether the card can open raw audio playback while summary is pending or in progress */
export function canPreviewRawAudioRecording(item: AudioProjectListItem): boolean {
	const hasAudioFileId = Boolean(item.audio_file_id?.trim())
	if (!hasAudioFileId) return false
	return item.card_status === "not_summarized" || item.card_status === "summarizing"
}

/** Whether the card can open a preview: HTML summary, or raw audio before summary completes */
export function isAudioProjectPreviewReady(item: AudioProjectListItem): boolean {
	if (item.card_status === "summarized") return true
	return canPreviewRawAudioRecording(item)
}

/** Parses API created_at / create_timestamp (unix seconds) into a numeric timestamp */
export function parseAudioProjectTimestamp(timestamp: string | number): number | null {
	const parsed = typeof timestamp === "number" ? timestamp : Number(timestamp)
	if (!Number.isFinite(parsed) || parsed <= 0) return null
	return parsed
}

/** Formats recording created time for card metadata (today → HH:mm, else localized date) */
export function formatRecordingCreatedTime(timestamp: string | number): string {
	const seconds = parseAudioProjectTimestamp(timestamp)
	if (seconds == null) return String(timestamp)
	return formatTime(seconds)
}

/** Builds the localized fallback title from created_at when project_name is missing */
export function formatRecordingDefaultName(timestamp: string | number): string {
	const seconds = parseAudioProjectTimestamp(timestamp)
	if (seconds == null) return ""

	const datetime = formatTime(seconds, "YYYY/MM/DD HH:mm")
	return i18next.t("defaultName", { ns: "audioRecordings", datetime })
}

/** Resolves the user-visible recording title shared by list cards and detail header */
export function resolveRecordingDisplayName(
	projectName: string | null | undefined,
	createdAt: string | number,
): string {
	const trimmedName = projectName?.trim()
	if (trimmedName) return trimmedName
	return formatRecordingDefaultName(createdAt)
}

/** Resolves source label from normalized fields: device name preferred, then audio_source fallback */
export function resolveRecordingSourceLabel(
	item: AudioProjectListItem,
	labels: { sourceRecorded: string; sourceImported: string; sourceDevice: string },
): string {
	const deviceName = item.device_id?.trim()
	if (deviceName) return deviceName

	if (item.audio_source === "imported") return labels.sourceImported
	if (item.audio_source === "recorded") return labels.sourceRecorded
	return labels.sourceRecorded
}

/** Converts Date to unix timestamp (seconds) at start of local day */
export function toStartOfDayTimestamp(date: Date): number {
	const normalized = new Date(date)
	normalized.setHours(0, 0, 0, 0)
	return Math.floor(normalized.getTime() / 1000)
}

/** Converts Date to unix timestamp (seconds) at end of local day */
export function toEndOfDayTimestamp(date: Date): number {
	const normalized = new Date(date)
	normalized.setHours(23, 59, 59, 999)
	return Math.floor(normalized.getTime() / 1000)
}
