import type { ImageElementContent } from "../../document/types"
import type { ImageGenerationTaskType } from "../../../public/magic-types"
import { isImageGenerationTimedOut, type ImageGenerationTiming } from "./imageGenerationTiming"

/** 图片元素面向展示层的统一状态。 */
export type ImageDisplayStatus =
	| "empty"
	| "uploading"
	| "generating"
	| "timed-out"
	| "loading"
	| "completed"
	| "failed"
	| "terminated"

export type ImageDisplayFailureSource = "generation" | "resource"

export interface ImageDisplayState {
	status: ImageDisplayStatus
	surface: "empty" | "placeholder" | "image" | "loading" | "error"
	contentId: string
	taskType?: ImageGenerationTaskType
	failureSource?: ImageDisplayFailureSource
	errorMessage?: string
}

export interface ResolveImageDisplayStateOptions {
	generationTiming?: ImageGenerationTiming
	content: ImageElementContent
	isTemporary: boolean
	hasActiveGeneration: boolean
	hasActiveGenerationTask: boolean
	hasGenerationRequest: boolean
	taskType?: ImageGenerationTaskType
	isReplacementUploading: boolean
	isResourceError: boolean
	hasLoadedImage: boolean
}

/**
 * 将持久化 Content、生成运行态、临时元素和资源加载态投影为一个展示状态。
 *
 * 优先级刻意与图片元素的现有渲染语义保持一致：替换上传和资源失败优先；运行态
 * 任务仍可覆盖已落库的生成失败，并可保留已有图片作为画布表面；没有资源时再
 * 区分 Agent 生成和临时上传/粘贴，避免同一 Content 在名称、占位图和图层入口
 * 显示出不同状态。
 */
export function resolveImageDisplayState(
	options: ResolveImageDisplayStateOptions,
): ImageDisplayState {
	const {
		content,
		isTemporary,
		hasActiveGeneration,
		hasActiveGenerationTask,
		hasGenerationRequest,
		taskType: activeTaskType,
		isReplacementUploading,
		isResourceError,
		hasLoadedImage,
	} = options
	const taskType = activeTaskType ?? content.imageGenerationTaskMeta?.type
	const base = {
		contentId: content.contentId,
		taskType,
		errorMessage: content.errorMessage,
	}

	const hasSource = Boolean(content.src || content.status === "completed")
	const sourceSurface = hasLoadedImage ? "image" : "loading"

	if (isReplacementUploading) {
		return { ...base, status: "uploading", surface: "placeholder" }
	}

	// 终止态优先于运行态：sandbox 迟到把 Content 写回 completed 时不应盖掉用户已终止的语义。
	if (content.status === "terminated") {
		return { ...base, status: "terminated", surface: "error", failureSource: "generation" }
	}

	if (!isTemporary && isImageGenerationTimedOut(content, options.generationTiming)) {
		return { ...base, status: "timed-out", surface: "error", failureSource: "generation" }
	}

	const hasPersistedActiveGeneration =
		hasActiveGenerationTask &&
		!hasSource &&
		content.status !== "completed" &&
		content.status !== "failed"

	if (hasActiveGeneration || hasPersistedActiveGeneration) {
		return {
			...base,
			status: "generating",
			surface: hasSource ? sourceSurface : "placeholder",
		}
	}

	if (content.status === "failed") {
		return { ...base, status: "failed", surface: "error", failureSource: "generation" }
	}

	if (isResourceError && hasSource) {
		return {
			...base,
			status: "failed",
			surface: hasLoadedImage ? "image" : "error",
			failureSource: "resource",
		}
	}

	if (content.status === "pending" || content.status === "processing") {
		return {
			...base,
			status: isTemporary ? "uploading" : "generating",
			surface: hasSource ? sourceSurface : "placeholder",
		}
	}

	if (hasSource) {
		return { ...base, status: hasLoadedImage ? "completed" : "loading", surface: sourceSurface }
	}

	if (hasGenerationRequest) {
		return { ...base, status: "generating", surface: "placeholder" }
	}

	return { ...base, status: "empty", surface: "empty" }
}
