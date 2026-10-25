import type { GenerateVideoRequest } from "../../public/magic-types"

type MutableRecord = Record<string, unknown>

const URI_ARRAY_INPUT_FIELDS = [
	"frames",
	"reference_images",
	"reference_videos",
	"reference_audios",
	"audio",
] as const

function asRecord(value: unknown): MutableRecord | null {
	return value && typeof value === "object" ? (value as MutableRecord) : null
}

function hasNonEmptyString(value: unknown): boolean {
	return typeof value === "string" && value.trim().length > 0
}

function hasUriRecord(value: unknown): boolean {
	return hasNonEmptyString(asRecord(value)?.uri)
}

function hasDraftTaskReference(value: unknown): boolean {
	const record = asRecord(value)
	return hasNonEmptyString(record?.video_id) || hasNonEmptyString(record?.uri)
}

function hasUriRecordArray(value: unknown): boolean {
	if (!Array.isArray(value)) return false
	return value.some((item) => hasUriRecord(item))
}

function hasStringArray(value: unknown): boolean {
	if (!Array.isArray(value)) return false
	return value.some((item) => hasNonEmptyString(item))
}

export function hasVideoGenerationRequestMediaIntent(
	request: Partial<GenerateVideoRequest> | null | undefined,
): boolean {
	const requestRecord = asRecord(request)
	const inputs = asRecord(request?.inputs)

	if (inputs) {
		for (const field of URI_ARRAY_INPUT_FIELDS) {
			if (hasUriRecordArray(inputs[field])) return true
		}
		if (hasUriRecord(inputs.video)) return true
		if (hasUriRecord(inputs.mask)) return true
	}

	return (
		hasStringArray(requestRecord?.reference_images) || hasUriRecordArray(requestRecord?.frames)
	)
}

export function hasVideoGenerationRequestEstimateIntent(
	request: Partial<GenerateVideoRequest> | null | undefined,
): boolean {
	if (request?.input_mode === "draft_task") {
		return hasDraftTaskReference(asRecord(request.inputs)?.draft_task)
	}
	// Edit mode needs real reference media; a leftover prompt from another mode is not enough.
	const isEditTask = request?.task === "edit" || request?.input_mode === "video_edit"
	if (isEditTask) return hasVideoGenerationRequestMediaIntent(request)
	return Boolean(request?.prompt?.trim()) || hasVideoGenerationRequestMediaIntent(request)
}

export function hasVideoGenerationRequestSubmitIntent(
	request: Partial<GenerateVideoRequest> | null | undefined,
): boolean {
	if (request?.generation_type === "canvas_composition") {
		return Boolean(request.composition?.videos?.some((video) => video.path?.trim()))
	}
	if (request?.input_mode === "draft_task") {
		return hasDraftTaskReference(asRecord(request.inputs)?.draft_task)
	}
	return Boolean(request?.prompt?.trim())
}
