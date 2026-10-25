import type { JSONContent } from "@/infrastructure/editors/tiptap/core"

export const VIDEO_PRODUCTION_AGENT_CODE = "video-production"
export const VIDEO_PRODUCTION_SUFFIX_SOURCE = "video-production-config"

export interface VideoProductionContextLike {
	topicMode?: string
	agentCode?: string | null
	selectedTopic?: { agent_code?: string | null } | null
}

export function isVideoProductionContext(context?: VideoProductionContextLike): boolean {
	if (!context) return false
	return [context.topicMode, context.agentCode, context.selectedTopic?.agent_code].some(
		(value) => value === VIDEO_PRODUCTION_AGENT_CODE,
	)
}

export interface VideoProductionPresetInput {
	generationMode?: string
	generationModeKey?: "normal" | "detailed"
	aspectRatio?: string
	durationSeconds?: number
	resolution?: string
	showAspectRatio?: boolean
	showDuration?: boolean
	showResolution?: boolean
	labels?: {
		generationMode?: string
		aspectRatio?: string
		duration?: string
		resolution?: string
	}
}

/** Build the selected video configuration as a natural-language message suffix. */
export function buildVideoProductionPresetContent(
	input: VideoProductionPresetInput,
): JSONContent | undefined {
	const labels = {
		generationMode: "generation mode",
		aspectRatio: "aspect ratio",
		duration: "duration",
		resolution: "resolution",
		...input.labels,
	}
	const generationMode = input.generationMode?.trim() || "normal"
	const generationModeKey =
		input.generationModeKey ?? (generationMode === "detailed" ? "detailed" : "normal")
	const hasAspectRatio = Boolean(input.showAspectRatio && input.aspectRatio?.trim())
	const hasDuration =
		Boolean(input.showDuration) &&
		typeof input.durationSeconds === "number" &&
		Number.isFinite(input.durationSeconds)
	const hasResolution = Boolean(input.showResolution && input.resolution?.trim())
	const hasOtherConfiguration = hasAspectRatio || hasDuration || hasResolution
	if (generationModeKey === "normal" && !hasOtherConfiguration) return undefined

	const segments = [
		`${labels.generationMode}: ${generationMode}`,
		...(hasAspectRatio ? [`${labels.aspectRatio}: ${input.aspectRatio?.trim()}`] : []),
		...(hasDuration ? [`${labels.duration}: ${input.durationSeconds}s`] : []),
		...(hasResolution ? [`${labels.resolution}: ${input.resolution?.trim()}`] : []),
	]

	if (segments.length === 0) return undefined

	return {
		type: "doc",
		content: [
			{
				type: "paragraph",
				content: [{ type: "text", text: `${segments.join("; ")}.` }],
			},
		],
	}
}
