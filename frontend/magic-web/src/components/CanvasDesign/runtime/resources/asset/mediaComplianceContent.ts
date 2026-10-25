import type { Canvas } from "../../core/Canvas"
import {
	CLEARED_MEDIA_COMPLIANCE_PATCH,
	getContentById,
	updateContent,
} from "../../document/elementContent"
import { purgeWorkspaceMediaComplianceFields } from "../../document/mediaSourceReplacement"
import { ElementTypeEnum, type ImageElement, type VideoElement } from "../../document/types"
import type { CanvasAssetComplianceStatus } from "../../../public/magic-types"

type MediaElement = ImageElement | VideoElement

function isMediaElement(element: { type: string }): element is MediaElement {
	return element.type === ElementTypeEnum.Image || element.type === ElementTypeEnum.Video
}

export interface MediaComplianceWriteParams {
	elementId: string
	contentId: string
	sourcePath: string
	complianceStatus: CanvasAssetComplianceStatus
	complianceFailedReason?: string | null
	complianceCheckId: string
}

export interface MediaComplianceTargetRef {
	elementId: string
	contentId: string
	sourcePath: string
}

function canWriteWorkspaceCompliance(
	canvas: Pick<Canvas, "elementManager">,
	target: MediaComplianceTargetRef,
): { element: ImageElement | VideoElement; content: ImageElement["contents"][number] } | null {
	const element = canvas.elementManager.getElementData(target.elementId)
	if (!element || !isMediaElement(element)) return null

	const content = getContentById(element, target.contentId)
	if (!content || content.src !== target.sourcePath) return null
	if (content.assetId?.trim()) return null
	return { element, content }
}

/**
 * 接口若返回 UNVERIFIED，表示尚未校验，不应在 DSL 中保留合规快照。
 */
export function clearWorkspaceMediaComplianceState(
	canvas: Pick<Canvas, "elementManager">,
	target: MediaComplianceTargetRef,
): boolean {
	const resolved = canWriteWorkspaceCompliance(canvas, target)
	if (!resolved) return false

	const { element, content } = resolved
	if (
		content.complianceStatus === undefined &&
		content.complianceFailedReason === undefined &&
		content.complianceCheckId === undefined
	) {
		return false
	}

	const next = updateContent(element, target.contentId, CLEARED_MEDIA_COMPLIANCE_PATCH)
	const clearedContent = getContentById(next, target.contentId)
	if (clearedContent) {
		purgeWorkspaceMediaComplianceFields(clearedContent)
	}
	canvas.elementManager.update(
		target.elementId,
		{ contents: next.contents },
		{
			mode: "data-only",
			historyPolicy: "exclude",
		},
	)
	return true
}

/**
 * 兼容旧 workspace 合规记录的写回工具；新发起流程绑定 assetId 后不再调用它。
 * UNVERIFIED 走清空而非落库。
 */
export function applyWorkspaceMediaComplianceState(
	canvas: Pick<Canvas, "elementManager">,
	params: MediaComplianceWriteParams,
): boolean {
	if (params.complianceStatus === "UNVERIFIED") {
		return clearWorkspaceMediaComplianceState(canvas, params)
	}
	return writeMediaComplianceState(canvas, params)
}

/**
 * 把元素自有的合规结果写回图片或视频 Content。
 * 目标已绑定素材、已被替换或已删除时放弃写入，避免覆盖素材服务上的状态。
 */
export function writeMediaComplianceState(
	canvas: Pick<Canvas, "elementManager">,
	params: MediaComplianceWriteParams,
): boolean {
	const checkId = params.complianceCheckId.trim()
	if (!checkId) return false
	if (params.complianceStatus === "UNVERIFIED") return false

	const resolved = canWriteWorkspaceCompliance(canvas, params)
	if (!resolved) return false
	const { element, content } = resolved

	const reason = params.complianceFailedReason?.trim() || undefined
	if (
		content.complianceStatus === params.complianceStatus &&
		(content.complianceFailedReason ?? undefined) === reason &&
		content.complianceCheckId === checkId
	) {
		return false
	}

	const next = updateContent(element, params.contentId, {
		complianceStatus: params.complianceStatus,
		complianceFailedReason: reason,
		complianceCheckId: checkId,
	})
	canvas.elementManager.update(
		params.elementId,
		{ contents: next.contents },
		{
			mode: "data-only",
			historyPolicy: "exclude",
		},
	)
	return true
}
