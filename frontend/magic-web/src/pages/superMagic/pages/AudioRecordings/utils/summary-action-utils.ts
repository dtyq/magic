import type { AudioProjectAudioSource } from "@/types/audioProject"

export type SummaryButtonVariant = "generate" | "retry"

export interface SummarySubmitExtra {
	task_key?: string
	topic_id?: string
	audio_file_id?: string
	audio_source?: AudioProjectAudioSource | null
	model_id?: string
}

/**
 * Coerces API ids to strings for ASR request bodies.
 * Large snowflake integers must be quoted at JSON parse time — unsafe numbers are already corrupted.
 */
export function coerceIdToString(value: string | number | null | undefined): string | undefined {
	if (value == null || value === "") return undefined
	if (typeof value === "number" && !Number.isSafeInteger(value)) {
		console.warn(
			"[audioRecordings] coerceIdToString received an unsafe integer; enable parseJsonLargeIntAsString on the API request",
		)
	}
	return String(value)
}

/** Whether the list card should render a summary action button */
export function shouldShowSummaryButton(phase: string | null, status: string | null): boolean {
	if (!phase || !status) return false
	if (phase === "merging" && status === "completed") return true
	if (phase === "summarizing" && status === "failed") return true
	return false
}

/** Whether the summary button is interactive (not disabled by in-flight submit) */
export function canClickSummaryButton(
	phase: string | null,
	status: string | null,
	isSubmitting = false,
): boolean {
	if (isSubmitting) return false
	if (!phase || !status) return false
	if (phase === "summarizing" && status === "in_progress") return false
	if (phase === "merging" && status === "completed") return true
	if (phase === "summarizing" && status === "failed") return true
	return false
}

/** Resolves which summary button label variant to show */
export function getSummaryButtonVariant(
	phase: string | null,
	status: string | null,
): SummaryButtonVariant | null {
	if (phase === "summarizing" && status === "failed") return "retry"
	if (phase === "merging" && status === "completed") return "generate"
	return null
}

/** Validates required fields before calling summarize APIs */
export function canSubmitSummary(extra: SummarySubmitExtra): boolean {
	if (!extra.task_key || !extra.topic_id) return false
	if (extra.audio_source === "imported" && !extra.audio_file_id) return false
	return true
}

/** Picks model_id from list item extra first, else API-resolved auto model */
export function resolveSummaryModelId(
	itemModelId: string | undefined,
	autoModelId: string | undefined,
): string | undefined {
	if (itemModelId) return itemModelId
	return autoModelId
}

/** Whether a list item should be registered for background progress polling */
export function shouldPollSummaryProgress(
	phase: string | null,
	status: string | null,
	taskKey: string | undefined,
): boolean {
	if (!taskKey) return false
	return phase === "summarizing" && status === "in_progress"
}
