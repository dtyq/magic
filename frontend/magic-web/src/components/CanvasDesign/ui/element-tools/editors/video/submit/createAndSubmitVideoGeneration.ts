import type { Canvas } from "../../../../../runtime/core/Canvas"
import { VideoElement as VideoElementClass } from "../../../../../runtime/elements/video/VideoElement"
import { ElementTypeEnum, type VideoElement } from "../../../../../runtime/document/types"
import { ElementFactory } from "../../../../../runtime/elements/core/ElementFactory"
import { generateElementId } from "../../../../../runtime/shared/ids"
import { resolveDerivedRightPlacement } from "../../../../../runtime/shared/placement/placementEngine"
import type { GenerateVideoRequest } from "../../../../../public/magic-types"
import { calculateCanvasSizeFromAspectRatio } from "../generation/video-editor-config.generation"
import { hasVideoGenerationRequestSubmitIntent } from "../../../../../runtime/shared/videoGenerationRequestIntent"
import { getActiveContent } from "../../../../../runtime/document/elementContent"
import { buildMediaEditSourceFingerprint } from "../../../../../runtime/interaction/media-edit-recovery/MediaEditRecoveryManager"

interface CreateAndSubmitVideoGenerationOptions {
	canvas: Canvas | null | undefined
	sourceVideoElement: VideoElement
	request: GenerateVideoRequest
	newElementSize?: { width: number; height: number } | null
}

export async function createAndSubmitVideoGeneration(
	options: CreateAndSubmitVideoGenerationOptions,
): Promise<boolean> {
	const { canvas, sourceVideoElement, request, newElementSize } = options
	if (!canvas || !request.model_id || !hasVideoGenerationRequestSubmitIntent(request)) {
		return false
	}

	const sourceElementInstance = canvas.elementManager.getElementInstance(sourceVideoElement.id)
	if (!(sourceElementInstance instanceof VideoElementClass)) {
		return false
	}

	const newPosition = resolveDerivedRightPlacement(
		sourceVideoElement,
		sourceElementInstance,
		canvas.elementManager,
	)
	if (!newPosition) {
		return false
	}

	const newElementId = generateElementId()
	const newZIndex = canvas.elementManager.getNextZIndexInLevel()
	const resolvedNewElementSize =
		normalizeVideoElementSize(newElementSize) ??
		calculateCanvasSizeFromAspectRatio(request.generation?.aspect_ratio) ??
		normalizeVideoElementSize(sourceVideoElement)
	const size = VideoElementClass.getDefaultConfig(
		resolvedNewElementSize?.width,
		resolvedNewElementSize?.height,
	)

	const newVideoElement = ElementFactory.createElementData(
		ElementTypeEnum.Video,
		newElementId,
		newPosition.x,
		newPosition.y,
		size.width,
		size.height,
		newZIndex,
	) as VideoElement

	// 后端确认任务创建成功前，生成结果节点只属于运行时占位态。
	// 这样即使创建事件触发画布导出，也不会把尚未成立的 video_id 写入 DSL。
	canvas.elementManager.createTemporaryElement(newVideoElement, { silent: true })
	canvas.selectionManager.select(newElementId)

	const newElementInstance = canvas.elementManager.getElementInstance(newElementId)
	if (!(newElementInstance instanceof VideoElementClass)) {
		canvas.elementManager.delete(newElementId)
		return false
	}

	const requestToSubmit: GenerateVideoRequest = {
		...request,
		prompt: request.prompt?.trim() || undefined,
	}
	const activeContent = getActiveContent(newVideoElement)
	if (activeContent) {
		canvas.mediaEditRecoveryManager?.saveDraft(
			{
				elementId: newElementId,
				contentId: activeContent.contentId,
				intent: "generate",
			},
			buildMediaEditSourceFingerprint(activeContent.contentId, activeContent.src),
			{ request: requestToSubmit, modeDrafts: {} },
		)
	}

	let submitted: boolean
	try {
		submitted = await newElementInstance.generateVideo(requestToSubmit)
	} catch (error) {
		if (!canvas.elementManager.hasElement(newElementId)) {
			throw error
		}
		if (canvas.generationRuntimeManager.getTargetState(newElementId)) {
			throw error
		}
		canvas.generationAttemptCoordinator.resolveDetachedPlaceholderFailure(
			newElementId,
			"promote-empty",
		)
		throw error
	}

	if (!submitted) {
		if (!canvas.elementManager.hasElement(newElementId)) {
			return false
		}
		// false 也可能来自被更新 attempt 取代的旧请求；旧 helper 不得覆盖新任务。
		if (canvas.generationRuntimeManager.getTargetState(newElementId)) {
			return false
		}
		// generateVideo 已按 attempt 的 promote-empty 策略完成收尾；这里只处理建立 attempt 前的兜底。
		canvas.generationAttemptCoordinator.resolveDetachedPlaceholderFailure(
			newElementId,
			"promote-empty",
		)
		return false
	}

	// generateVideo 已在后端确认后原子写入任务并转正。
	return true
}

function normalizeVideoElementSize(
	size?: { width?: number; height?: number } | null,
): { width: number; height: number } | null {
	if (!size) return null
	const { width, height } = size
	if (!Number.isFinite(width) || !Number.isFinite(height)) return null
	if (!width || !height || width <= 0 || height <= 0) return null
	return {
		width,
		height,
	}
}
