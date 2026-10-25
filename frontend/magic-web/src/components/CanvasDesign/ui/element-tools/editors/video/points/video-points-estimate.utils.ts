import type { GenerateVideoRequest } from "../../../../../public/magic-types"

type VideoPointsEstimateSignaturePayload = Pick<
	Partial<GenerateVideoRequest>,
	"model_id" | "input_mode" | "task" | "inputs" | "generation"
>

export function buildVideoPointsEstimateSignaturePayload(
	request: Partial<GenerateVideoRequest>,
): VideoPointsEstimateSignaturePayload {
	return {
		model_id: request.model_id,
		input_mode: request.input_mode,
		task: request.task,
		inputs: request.inputs,
		generation: request.generation,
	}
}

/**
 * Stable deep serialization for estimate cache keys.
 * Sorts object keys and drops undefined so equivalent request params share one signature.
 */
function stableStringify(value: unknown): string {
	if (value === undefined) return "undefined"
	if (value === null || typeof value !== "object") {
		return JSON.stringify(value) ?? "null"
	}
	if (Array.isArray(value)) {
		return `[${value.map(stableStringify).join(",")}]`
	}
	const entries = Object.entries(value as Record<string, unknown>)
		.filter(([, entryValue]) => entryValue !== undefined)
		.sort(([left], [right]) => left.localeCompare(right))
	return `{${entries
		.map(([key, entryValue]) => `${JSON.stringify(key)}:${stableStringify(entryValue)}`)
		.join(",")}}`
}

export function buildVideoPointsEstimateSignature(request: Partial<GenerateVideoRequest>): string {
	return stableStringify(buildVideoPointsEstimateSignaturePayload(request))
}

export function areVideoPointsEstimateRequestsEqual(
	left: Partial<GenerateVideoRequest> | null | undefined,
	right: Partial<GenerateVideoRequest> | null | undefined,
): boolean {
	if (left === right) return true
	if (!left || !right) return false
	return buildVideoPointsEstimateSignature(left) === buildVideoPointsEstimateSignature(right)
}
