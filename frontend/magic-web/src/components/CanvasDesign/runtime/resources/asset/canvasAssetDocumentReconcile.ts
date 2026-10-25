import type { Canvas } from "../../core/Canvas"
import {
	CLEARED_MEDIA_COMPLIANCE_PATCH,
	getContentById,
	getContents,
	updateContent,
} from "../../document/elementContent"
import {
	CLEARED_ASSET_BINDING_PATCH,
	purgeWorkspaceMediaComplianceFields,
} from "../../document/mediaSourceReplacement"
import {
	ElementTypeEnum,
	type AudioElement,
	type ImageElement,
	type LayerElement,
	type VideoElement,
} from "../../document/types"
import { parseAssetResourcePath } from "../../shared/path/canvasResourcePath"

export interface MediaContentAssetBindingRef {
	elementId: string
	contentId: string
	assetId: string
}

type AssetBoundMediaElement = ImageElement | VideoElement | AudioElement

function isAssetBoundMediaElement(element: LayerElement): element is AssetBoundMediaElement {
	return (
		element.type === ElementTypeEnum.Image ||
		element.type === ElementTypeEnum.Video ||
		element.type === ElementTypeEnum.Audio
	)
}

function isComplianceMediaElement(element: LayerElement): element is ImageElement | VideoElement {
	return element.type === ElementTypeEnum.Image || element.type === ElementTypeEnum.Video
}

function contentMatchesAssetId(
	content: { assetId?: string; src?: string },
	assetId: string,
): boolean {
	if (content.assetId?.trim() === assetId) return true
	const legacyAssetId = content.src ? parseAssetResourcePath(content.src) : undefined
	return legacyAssetId === assetId
}

/** 扫描当前文档中仍绑定指定素材 ID 的媒体 Content。 */
export function collectMediaContentAssetBindings(
	canvas: Pick<Canvas, "elementManager">,
	assetId: string,
): MediaContentAssetBindingRef[] {
	const normalizedAssetId = assetId.trim()
	if (!normalizedAssetId) return []

	const bindings: MediaContentAssetBindingRef[] = []
	for (const element of canvas.elementManager.getAllElements()) {
		if (!isAssetBoundMediaElement(element)) continue
		for (const content of getContents(element)) {
			if (!contentMatchesAssetId(content, normalizedAssetId)) continue
			bindings.push({
				elementId: element.id,
				contentId: content.contentId,
				assetId: normalizedAssetId,
			})
		}
	}
	return bindings
}

/**
 * 素材库删除后：工作区 src 可继续使用时仅解绑 assetId；legacy asset:// 源也要
 * 一并清空，避免解绑后仍反复请求已经不存在的逻辑地址。
 */
export function reconcileDeletedAssetOnCanvas(
	canvas: Pick<
		Canvas,
		| "elementManager"
		| "permissionManager"
		| "assetResourceManager"
		| "assetCompliancePollingManager"
		| "refreshMediaComplianceFailedTags"
	>,
	assetId: string,
): number {
	const normalizedAssetId = assetId.trim()
	if (!normalizedAssetId) return 0

	canvas.assetResourceManager.invalidate(normalizedAssetId)
	canvas.assetCompliancePollingManager.stop(normalizedAssetId)

	const bindings = collectMediaContentAssetBindings(canvas, normalizedAssetId)
	if (bindings.length === 0) {
		canvas.refreshMediaComplianceFailedTags?.()
		return 0
	}
	if (!canvas.permissionManager.can("document.write")) {
		canvas.refreshMediaComplianceFailedTags?.()
		return 0
	}

	let updatedCount = 0
	for (const binding of bindings) {
		const element = canvas.elementManager.getElementData(binding.elementId)
		if (!element || !isAssetBoundMediaElement(element)) continue
		const content = getContentById(element, binding.contentId)
		if (!content || !contentMatchesAssetId(content, normalizedAssetId)) continue

		const isLegacyAssetSource =
			content.src !== undefined && parseAssetResourcePath(content.src) === normalizedAssetId
		const patch = isComplianceMediaElement(element)
			? {
					...CLEARED_ASSET_BINDING_PATCH,
					...(isLegacyAssetSource ? { src: undefined } : {}),
				}
			: { assetId: undefined, ...(isLegacyAssetSource ? { src: undefined } : {}) }
		const next = updateContent(element, binding.contentId, patch)
		const nextContent = getContentById(next, binding.contentId)
		if (nextContent && isComplianceMediaElement(element)) {
			purgeWorkspaceMediaComplianceFields(nextContent)
		}
		canvas.elementManager.update(
			binding.elementId,
			{ contents: next.contents },
			{ mode: "data-only", historyPolicy: "exclude" },
		)
		updatedCount += 1
	}

	canvas.refreshMediaComplianceFailedTags?.()
	return updatedCount
}

/** 纠正历史 DSL 中误写入的 UNVERIFIED 合规快照。 */
export function reconcileUnverifiedComplianceInDocument(
	canvas: Pick<Canvas, "elementManager" | "permissionManager">,
): number {
	if (!canvas.permissionManager.can("document.write")) return 0

	let updatedCount = 0
	for (const element of canvas.elementManager.getAllElements()) {
		if (!isComplianceMediaElement(element)) continue
		let nextElement = element
		let elementChanged = false

		for (const content of getContents(element)) {
			if (content.complianceStatus !== "UNVERIFIED") continue
			nextElement = updateContent(
				nextElement,
				content.contentId,
				CLEARED_MEDIA_COMPLIANCE_PATCH,
			)
			const patched = getContentById(nextElement, content.contentId)
			if (patched) {
				purgeWorkspaceMediaComplianceFields(patched)
			}
			elementChanged = true
		}

		if (elementChanged) {
			canvas.elementManager.update(
				element.id,
				{ contents: nextElement.contents },
				{ mode: "data-only", historyPolicy: "exclude" },
			)
			updatedCount += 1
		}
	}

	return updatedCount
}
