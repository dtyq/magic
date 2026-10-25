import { makeAutoObservable } from "mobx"
import type {
	VideoGenerationConstraints,
	VideoModelItem,
} from "@/components/CanvasDesign/public/magic-types"
import {
	buildVideoAspectRatioOptions,
	buildVideoDurationOptions,
	buildVideoResolutionOptions,
} from "@/components/CanvasDesign/ui/element-tools/editors/video/generation/video-editor-config.generation"
import type { ModelItem } from "../components/ModelSwitch/types"

export type VideoProductionGenerationMode = "normal" | "detailed"

export interface VideoProductionConfig {
	generationMode?: VideoProductionGenerationMode
	skillId?: string
	aspectRatio?: string
	durationSeconds?: number
	resolution?: string
}

export interface VideoProductionDurationCapabilities {
	type: "options" | "range"
	options: number[]
	min?: number
	max?: number
	step?: number
}

export interface VideoProductionCapabilities {
	aspectRatioOptions: ReturnType<typeof buildVideoAspectRatioOptions>
	resolutionOptions: ReturnType<typeof buildVideoResolutionOptions>
	duration: VideoProductionDurationCapabilities
	showAspectRatio: boolean
	showDuration: boolean
	showResolution: boolean
	skillOptions: []
}

export interface ResolveVideoProductionCapabilitiesParams {
	model?: ModelItem | null
	inputMode: "standard"
	constraints?: VideoGenerationConstraints
	selectedResolution?: string
}

const DEFAULT_GENERATION_MODE: VideoProductionGenerationMode = "normal"
const EMPTY_CONFIG: VideoProductionConfig = {
	generationMode: DEFAULT_GENERATION_MODE,
}

function asCanvasVideoModel(model?: ModelItem | null): VideoModelItem | undefined {
	return model ? (model as VideoModelItem) : undefined
}

function resolveInputModeConstraints(
	model: ModelItem | null | undefined,
	inputMode: "standard",
	constraints?: VideoGenerationConstraints,
): VideoGenerationConstraints | undefined {
	const modeConstraints =
		model?.video_generation_config?.input_modes?.[inputMode]?.generation_constraints
	if (!modeConstraints && !constraints) return undefined
	return {
		resolutions: constraints?.resolutions ?? modeConstraints?.resolutions,
		aspect_ratios: constraints?.aspect_ratios ?? modeConstraints?.aspect_ratios,
		durations: constraints?.durations ?? modeConstraints?.durations,
		sizes: constraints?.sizes ?? modeConstraints?.sizes,
	}
}

function getDurationCapabilities(
	model: ModelItem | null | undefined,
	constraints?: VideoGenerationConstraints,
) {
	if (constraints?.durations !== undefined) {
		return {
			type: "options" as const,
			options: buildVideoDurationOptions(asCanvasVideoModel(model), constraints),
		}
	}
	const generation = model?.video_generation_config?.generation
	const rawDurations = generation?.durations
	if (generation?.duration_type === "range" && rawDurations && !Array.isArray(rawDurations)) {
		return {
			type: "range" as const,
			options: [],
			min: rawDurations.min,
			max: rawDurations.max,
			step: rawDurations.step ?? 1,
		}
	}
	return {
		type: "options" as const,
		options: buildVideoDurationOptions(asCanvasVideoModel(model), constraints),
	}
}

export function resolveVideoProductionCapabilities({
	model,
	inputMode,
	constraints,
	selectedResolution,
}: ResolveVideoProductionCapabilitiesParams): VideoProductionCapabilities {
	void inputMode
	const canvasModel = asCanvasVideoModel(model)
	const effectiveConstraints = resolveInputModeConstraints(model, inputMode, constraints)
	const hasGenerationConfig = Boolean(model?.video_generation_config?.generation)
	const resolutionOptions = hasGenerationConfig
		? buildVideoResolutionOptions(canvasModel, effectiveConstraints)
		: []
	const aspectOptions = hasGenerationConfig
		? buildVideoAspectRatioOptions(canvasModel, selectedResolution, effectiveConstraints)
		: []
	const duration = hasGenerationConfig
		? getDurationCapabilities(model, effectiveConstraints)
		: { type: "options" as const, options: [] }
	return {
		aspectRatioOptions: aspectOptions,
		resolutionOptions,
		duration,
		showAspectRatio: aspectOptions.length > 0,
		showDuration:
			duration.type === "range"
				? duration.min != null && duration.max != null
				: duration.options.length > 0,
		showResolution: resolutionOptions.length > 0,
		skillOptions: [],
	}
}

function mergeValidConfig(
	current: Partial<VideoProductionConfig> | undefined,
	capabilities: VideoProductionCapabilities,
): VideoProductionConfig {
	const next: VideoProductionConfig = {
		generationMode:
			current?.generationMode === "detailed" ? "detailed" : DEFAULT_GENERATION_MODE,
	}
	if (typeof current?.skillId === "string" && current.skillId) next.skillId = current.skillId
	if (capabilities.showAspectRatio) {
		if (current?.aspectRatio !== undefined) {
			const aspectRatio = capabilities.aspectRatioOptions.some(
				(item) => item.value === current?.aspectRatio,
			)
				? current?.aspectRatio
				: undefined
			if (aspectRatio !== undefined) next.aspectRatio = aspectRatio
		}
	}
	if (capabilities.showResolution) {
		if (current?.resolution !== undefined) {
			const resolution = capabilities.resolutionOptions.some(
				(item) => item.value === current?.resolution,
			)
				? current?.resolution
				: undefined
			if (resolution !== undefined) next.resolution = resolution
		}
	}
	if (capabilities.showDuration && current?.durationSeconds !== undefined) {
		const duration = current?.durationSeconds
		if (capabilities.duration.type === "options") {
			const durationSeconds = capabilities.duration.options.includes(duration ?? NaN)
				? duration
				: undefined
			if (durationSeconds !== undefined) next.durationSeconds = durationSeconds
		} else {
			const min = capabilities.duration.min ?? -Infinity
			const max = capabilities.duration.max ?? Infinity
			const step = capabilities.duration.step ?? 1
			const isStepAligned =
				typeof duration === "number" &&
				Number.isFinite(step) &&
				Math.abs((duration - min) / step - Math.round((duration - min) / step)) < 1e-9
			const durationSeconds =
				isStepAligned && duration >= min && duration <= max ? duration : undefined
			if (durationSeconds !== undefined) next.durationSeconds = durationSeconds
		}
	}
	return next
}

export class VideoProductionConfigStore {
	config: VideoProductionConfig = { ...EMPTY_CONFIG }
	capabilities: VideoProductionCapabilities = resolveVideoProductionCapabilities({
		inputMode: "standard",
	})
	currentModelId = ""
	private model?: ModelItem | null
	private modelSignature = ""
	private inputScopeKey: string | undefined
	private active = false

	constructor() {
		makeAutoObservable(this, {}, { autoBind: true })
	}

	setContext({
		model,
		inputScopeKey = "",
	}: {
		model?: ModelItem | null
		inputScopeKey?: string
	}) {
		const nextModelId = model?.model_id || ""
		const nextModelSignature = JSON.stringify(model?.video_generation_config ?? null)
		const modelChanged = this.modelSignature !== nextModelSignature
		const scopeChanged = this.inputScopeKey !== inputScopeKey
		if (nextModelId === this.currentModelId && !modelChanged && !scopeChanged && this.active) {
			return
		}
		this.active = true
		this.model = model
		this.modelSignature = nextModelSignature
		this.currentModelId = nextModelId
		this.inputScopeKey = inputScopeKey
		this.capabilities = resolveVideoProductionCapabilities({ model, inputMode: "standard" })
		if (scopeChanged) {
			this.config = { ...EMPTY_CONFIG }
		} else if (modelChanged) {
			this.config = mergeValidConfig(this.config, this.capabilities)
		}
	}

	deactivate() {
		this.active = false
	}

	setConfig(patch: Partial<VideoProductionConfig>) {
		const candidate = { ...this.config, ...patch }
		const nextCapabilities = resolveVideoProductionCapabilities({
			model: this.model,
			inputMode: "standard",
			selectedResolution: candidate.resolution,
		})
		this.capabilities = nextCapabilities
		this.config = mergeValidConfig(candidate, nextCapabilities)
	}

	clearCurrentConfig() {
		this.config = {
			...EMPTY_CONFIG,
			generationMode:
				this.config.generationMode === "detailed" ? "detailed" : DEFAULT_GENERATION_MODE,
		}
	}
}
