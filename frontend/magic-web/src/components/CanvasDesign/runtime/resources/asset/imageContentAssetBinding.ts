import type { Canvas } from "../../core/Canvas"
import {
	CLEARED_MEDIA_COMPLIANCE_PATCH,
	getContentById,
	updateContent,
} from "../../document/elementContent"
import { purgeWorkspaceMediaComplianceFields } from "../../document/mediaSourceReplacement"
import { ElementTypeEnum, type ImageElement, type VideoElement } from "../../document/types"

export interface ImageContentAssetBindingParams {
	elementId: string
	contentId: string
	sourcePath: string
	assetId: string
}

export type ImageContentAssetBindingResult =
	"bound" | "already-bound" | "target-missing" | "source-changed" | "asset-changed"

type AssetBindableElement = ImageElement | VideoElement

function isAssetBindableElement(element: { type: string }): element is AssetBindableElement {
	return element.type === ElementTypeEnum.Image || element.type === ElementTypeEnum.Video
}

/**
 * 将素材库返回的稳定 ID 绑定到发起保存时的图片或视频 Content。
 * 保存请求是异步的，因此提交前必须重新读取目标并核对 src，避免把结果写到已删除或已替换的媒体上。
 */
export function bindMediaContentToAsset(
	canvas: Pick<Canvas, "elementManager">,
	params: ImageContentAssetBindingParams,
): ImageContentAssetBindingResult {
	if (!params.assetId.trim()) throw new Error("assetId must be a non-empty string")

	const element = canvas.elementManager.getElementData(params.elementId)
	if (!element || !isAssetBindableElement(element)) return "target-missing"

	const content = getContentById(element, params.contentId)
	if (!content) return "target-missing"
	if (content.src !== params.sourcePath) return "source-changed"
	const currentAssetId = content.assetId?.trim()
	if (currentAssetId === params.assetId) return "already-bound"
	// Saving or checking is asynchronous. If another action has already bound a
	// different asset to this exact Content, preserve that newer binding instead of
	// replacing it with a late response from the older request.
	if (currentAssetId) return "asset-changed"

	const next = updateContent(element, params.contentId, {
		assetId: params.assetId,
		...CLEARED_MEDIA_COMPLIANCE_PATCH,
	})
	const boundContent = getContentById(next, params.contentId)
	if (boundContent) {
		purgeWorkspaceMediaComplianceFields(boundContent)
	}
	canvas.elementManager.update(
		params.elementId,
		{ contents: next.contents },
		// 保存到素材库是外部业务事实，不应随画布视觉操作的撤销栈被解除绑定。
		{ mode: "data-only", historyPolicy: "exclude" },
	)
	return "bound"
}

export const bindImageContentToAsset = bindMediaContentToAsset
