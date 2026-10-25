import type { VideoElementContent } from "../../document/types"

/** 视频元素面向展示层的独立状态。视频不复用图片状态类型。 */
export type VideoDisplayStatus =
	| "empty"
	| "uploading"
	| "compliance"
	| "generating"
	| "composing"
	| "loading"
	| "completed"
	| "failed"

export type VideoDisplaySurface = "empty" | "placeholder" | "preview" | "loading" | "error"

export type VideoDisplayFailureSource = "generation" | "resource"

export interface VideoDisplayState {
	status: VideoDisplayStatus
	surface: VideoDisplaySurface
	contentId: string
	failureSource?: VideoDisplayFailureSource
	errorMessage?: string
}

export interface ResolveVideoDisplayStateOptions {
	content: VideoElementContent
	isTemporary: boolean
	isComplianceActive: boolean
	hasActiveGeneration: boolean
	hasActiveGenerationTask: boolean
	isCompositionActive: boolean
	isReplacementUploading: boolean
	isResourceError: boolean
	isGenerationError: boolean
	hasPreview: boolean
	isPreviewLoading: boolean
}

/**
 * 将视频 Content、生成/合成运行态、临时上传和预览资源状态投影为统一展示结果。
 *
 * 该解析器只描述“视频资源该如何展示”，不包含播放请求、暂停、缓冲等播放状态。
 * 因此播放会话失败不会把一个仍有有效预览的视频误判为资源失败。
 */
export function resolveVideoDisplayState(
	options: ResolveVideoDisplayStateOptions,
): VideoDisplayState {
	const {
		content,
		isTemporary,
		isComplianceActive,
		hasActiveGeneration,
		hasActiveGenerationTask,
		isCompositionActive,
		isReplacementUploading,
		isResourceError,
		isGenerationError,
		hasPreview,
		isPreviewLoading,
	} = options
	const hasSource = Boolean(content.src || content.status === "completed")
	const base = {
		contentId: content.contentId,
		errorMessage: content.errorMessage,
	}
	const sourceSurface: VideoDisplaySurface = hasPreview ? "preview" : "loading"
	const pendingSurface: VideoDisplaySurface = hasPreview
		? "preview"
		: hasSource || isPreviewLoading
			? "loading"
			: "placeholder"

	if (isReplacementUploading) {
		return { ...base, status: "uploading", surface: "placeholder" }
	}

	if (isComplianceActive) {
		return { ...base, status: "compliance", surface: "placeholder" }
	}

	if (isCompositionActive) {
		return {
			...base,
			status: "composing",
			surface: hasPreview ? "preview" : hasSource ? "loading" : "placeholder",
		}
	}

	const hasPersistedActiveGeneration =
		hasActiveGenerationTask &&
		(content.status === "pending" ||
			content.status === "processing" ||
			(!hasSource && content.status !== "completed" && content.status !== "failed"))

	if (hasActiveGeneration || hasPersistedActiveGeneration) {
		return { ...base, status: "generating", surface: pendingSurface }
	}

	if (content.status === "failed" || isGenerationError) {
		return {
			...base,
			status: "failed",
			surface: "error",
			failureSource: "generation",
		}
	}

	if (isResourceError) {
		return {
			...base,
			status: "failed",
			surface: hasPreview ? "preview" : "error",
			failureSource: "resource",
		}
	}

	if (content.status === "processing") {
		return {
			...base,
			status: isTemporary ? "uploading" : "generating",
			surface: pendingSurface,
		}
	}

	if (content.status === "pending") {
		return { ...base, status: "uploading", surface: pendingSurface }
	}

	if (hasSource) {
		return {
			...base,
			status: hasPreview ? "completed" : "loading",
			surface: sourceSurface,
		}
	}

	return { ...base, status: "empty", surface: "empty" }
}
