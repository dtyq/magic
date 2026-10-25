import type { Canvas } from "../../core/Canvas"
import type { CropConfig } from "../../document/types"
import { ImageElement } from "../../elements/image/ImageElement"
import { resolveConnectedImageReferences } from "../connection/connectedMediaInputs"

/**
 * 分镜生成与节点预览共用的运行时参考图快照。
 *
 * 参考图仍由上游 CanvasConnection 派生，不能写入 Storyboard DSL；这里确保
 * 预览与实际提交给图片生成接口的路径、裁剪和版本一致。
 */
export interface StoryboardReferenceImage {
	path: string
	crop?: CropConfig
	sourceContentId?: string
}

export function resolveStoryboardReferenceImages(
	canvas: Canvas,
	targetElementId: string,
): StoryboardReferenceImage[] {
	if (!canvas.connectionManager?.getUpstreamConnections) return []
	const resolver = canvas.magicConfigManager.config?.methods?.resolveResourceReference
	const { references } = resolveConnectedImageReferences(canvas, targetElementId, {
		resolveResourceReference: resolver,
		resolveImageContent: (element) => {
			const instance = canvas.elementManager.getElementInstance(element.id)
			return instance instanceof ImageElement
				? instance.getAssociatedContentData()
				: undefined
		},
	})

	return references.map((reference) => ({
		path: reference.path,
		crop: reference.sourceCrop,
		sourceContentId: reference.sourceContentId,
	}))
}
