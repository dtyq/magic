import type { GenerateVideoRequest } from "../../../../../public/magic-types"
import type { ResolveCanvasResourceReference } from "../../../../../public/resource-reference"
import { getClipboardResourcePathKey } from "../../../../../runtime/resources/clipboard/clipboardResourceReferences"

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

function addPath(
	paths: string[],
	seen: Set<string>,
	value: unknown,
	resolveResourceReference?: ResolveCanvasResourceReference,
): void {
	if (typeof value !== "string") return
	const path = value.trim()
	if (!path) return

	const pathKey = getClipboardResourcePathKey(path, resolveResourceReference)
	if (!pathKey || seen.has(pathKey)) return

	seen.add(pathKey)
	paths.push(path)
}

function collectUriArray(
	paths: string[],
	seen: Set<string>,
	value: unknown,
	resolveResourceReference?: ResolveCanvasResourceReference,
): void {
	if (!Array.isArray(value)) return
	for (const item of value) {
		const record = asRecord(item)
		addPath(paths, seen, record?.uri, resolveResourceReference)
	}
}

function collectPathArray(
	paths: string[],
	seen: Set<string>,
	value: unknown,
	resolveResourceReference?: ResolveCanvasResourceReference,
): void {
	if (!Array.isArray(value)) return
	for (const item of value) {
		addPath(paths, seen, item, resolveResourceReference)
	}
}

/**
 * Collects only schema resource fields used by video generation. Prompt text is intentionally ignored.
 */
export function collectVideoGenerationRequestResourcePaths(
	request: Partial<GenerateVideoRequest> | null | undefined,
	resolveResourceReference?: ResolveCanvasResourceReference,
): string[] {
	const paths: string[] = []
	const seen = new Set<string>()
	const requestRecord = asRecord(request)
	const inputs = asRecord(request?.inputs)

	if (inputs) {
		for (const field of URI_ARRAY_INPUT_FIELDS) {
			collectUriArray(paths, seen, inputs[field], resolveResourceReference)
		}
		addPath(paths, seen, asRecord(inputs.video)?.uri, resolveResourceReference)
		addPath(paths, seen, asRecord(inputs.mask)?.uri, resolveResourceReference)
		// video_id 是业务任务标识，不参与资源等待或路径解析。
		addPath(paths, seen, asRecord(inputs.draft_task)?.uri, resolveResourceReference)
	}

	// Tolerate legacy API-shaped request objects if they are passed through this hook.
	collectPathArray(paths, seen, requestRecord?.reference_images, resolveResourceReference)
	collectUriArray(paths, seen, requestRecord?.frames, resolveResourceReference)

	return paths
}

export function collectPendingVideoGenerationRequestResourcePaths(
	request: Partial<GenerateVideoRequest> | null | undefined,
	shouldDefer: (path: string) => boolean,
	resolveResourceReference?: ResolveCanvasResourceReference,
): string[] {
	return collectVideoGenerationRequestResourcePaths(request, resolveResourceReference).filter(
		(path) => shouldDefer(path),
	)
}
