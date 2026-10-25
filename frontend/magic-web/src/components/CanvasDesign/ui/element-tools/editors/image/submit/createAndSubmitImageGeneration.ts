import type { Canvas } from "../../../../../runtime/core/Canvas"
import type { ImageElement } from "../../../../../runtime/document/types"
import { ImageElement as ImageElementClass } from "../../../../../runtime/elements/image/ImageElement"
import type { GenerateImageRequest } from "../../../../../public/magic-types"
import { buildMediaEditSourceFingerprint } from "../../../../../runtime/interaction/media-edit-recovery/MediaEditRecoveryManager"

interface CreateAndSubmitImageGenerationOptions {
	canvas: Canvas | null | undefined
	newImageElement: ImageElement
	request: GenerateImageRequest
	onSubmitStarted?: () => void
	onSubmitFailed?: () => void
}

/** 创建图片生成结果节点，并在后端确认任务后再允许其进入持久化 DSL。 */
export async function createAndSubmitImageGeneration(
	options: CreateAndSubmitImageGenerationOptions,
): Promise<boolean> {
	const { canvas, newImageElement, request, onSubmitStarted, onSubmitFailed } = options
	if (!canvas || !request.model_id || !request.prompt?.trim()) {
		return false
	}

	const elementId = newImageElement.id
	// 后端确认任务创建成功前，生成结果节点只属于运行时占位态，避免无效 image_id 进入 DSL。
	canvas.elementManager.createTemporaryElement(newImageElement, { silent: true })

	const elementInstance = canvas.elementManager.getElementInstance(elementId)
	if (!(elementInstance instanceof ImageElementClass)) {
		canvas.elementManager.delete(elementId)
		return false
	}

	const requestToSubmit: GenerateImageRequest = {
		...request,
		prompt: request.prompt.trim(),
	}
	const activeContent = newImageElement.contents?.find(
		(content) => content.contentId === newImageElement.activeContentId,
	)
	if (activeContent) {
		canvas.mediaEditRecoveryManager?.saveDraft(
			{
				elementId,
				contentId: activeContent.contentId,
				intent: "generate",
			},
			buildMediaEditSourceFingerprint(activeContent.contentId, activeContent.src),
			{ request: requestToSubmit },
		)
	}
	onSubmitStarted?.()

	let submitted: boolean
	try {
		submitted = await elementInstance.submitInitialGeneration(requestToSubmit)
	} catch {
		if (!canvas.elementManager.hasElement(elementId)) {
			return false
		}
		if (canvas.generationRuntimeManager.getTargetState(elementId)) return false
		canvas.generationAttemptCoordinator.resolveDetachedPlaceholderFailure(
			elementId,
			"promote-empty",
		)
		onSubmitFailed?.()
		return false
	}

	if (!submitted) {
		if (!canvas.elementManager.hasElement(elementId)) {
			return false
		}
		// false 也可能表示较早的请求已被同元素上的新 attempt 取代。
		// 此时失败收尾权属于新 attempt，旧 helper 不能转正或清空它的状态。
		if (canvas.generationRuntimeManager.getTargetState(elementId)) {
			return false
		}
		// submitInitialGeneration 已按 attempt 的 promote-empty 策略完成收尾；这里只处理建立 attempt 前的兜底。
		canvas.generationAttemptCoordinator.resolveDetachedPlaceholderFailure(
			elementId,
			"promote-empty",
		)
		onSubmitFailed?.()
		return false
	}

	// submitInitialGeneration 已在后端确认后原子写入任务并转正。
	return true
}
