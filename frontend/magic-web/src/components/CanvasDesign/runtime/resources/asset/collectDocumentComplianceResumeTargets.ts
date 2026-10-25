import type {
	CanvasAssetComplianceTaskHost,
	MediaCompliancePersistTarget,
} from "./CanvasAssetComplianceTaskManager"
import { getContents } from "../../document/elementContent"
import { ElementTypeEnum, type ImageElement, type VideoElement } from "../../document/types"
import { collectElementsByType } from "../../shared/ids"
import { parseAssetResourcePath } from "../../shared/path/canvasResourcePath"

export interface DocumentComplianceResumeGroup {
	checkId: string
	targets: MediaCompliancePersistTarget[]
}

function isMediaElement(element: { type: string }): element is ImageElement | VideoElement {
	return element.type === ElementTypeEnum.Image || element.type === ElementTypeEnum.Video
}

function shouldResumeWorkspaceComplianceContent(content: {
	src?: string
	assetId?: string
	complianceStatus?: string
	complianceCheckId?: string
}): content is {
	src: string
	complianceCheckId: string
	complianceStatus: "PROCESSING"
} {
	const checkId = content.complianceCheckId?.trim()
	if (!checkId || content.complianceStatus !== "PROCESSING") return false
	if (content.assetId?.trim()) return false
	const src = content.src?.trim()
	if (!src || parseAssetResourcePath(src)) return false
	return true
}

/**
 * 扫描旧文档里尚未结束的 workspace 合规任务。
 * 新流程会先绑定 assetId，因此不会再产生这类 DSL 检查记录；保留扫描器只为
 * 让历史进行中的任务不因代码升级而留下无主轮询。
 */
export function collectDocumentComplianceResumeTargets(
	host: CanvasAssetComplianceTaskHost,
): DocumentComplianceResumeGroup[] {
	const groups = new Map<string, MediaCompliancePersistTarget[]>()

	const imageElements = collectElementsByType(
		host.elementManager.getAllElements(),
		ElementTypeEnum.Image,
	) as ImageElement[]
	const videoElements = collectElementsByType(
		host.elementManager.getAllElements(),
		ElementTypeEnum.Video,
	) as VideoElement[]

	for (const element of [...imageElements, ...videoElements]) {
		if (!isMediaElement(element)) continue
		for (const content of getContents(element)) {
			if (!shouldResumeWorkspaceComplianceContent(content)) continue
			const targets = groups.get(content.complianceCheckId) ?? []
			targets.push({
				elementId: element.id,
				contentId: content.contentId,
				sourcePath: content.src,
			})
			groups.set(content.complianceCheckId, targets)
		}
	}

	return Array.from(groups.entries()).map(([checkId, targets]) => ({ checkId, targets }))
}

/**
 * 已绑定 asset:// 的媒体若缓存详情仍为 PROCESSING，也需要续轮询。
 */
export function collectAssetBoundComplianceResumeIds(
	host: CanvasAssetComplianceTaskHost,
): string[] {
	const assetIds = new Set<string>()

	const imageElements = collectElementsByType(
		host.elementManager.getAllElements(),
		ElementTypeEnum.Image,
	) as ImageElement[]
	const videoElements = collectElementsByType(
		host.elementManager.getAllElements(),
		ElementTypeEnum.Video,
	) as VideoElement[]

	for (const element of [...imageElements, ...videoElements]) {
		if (!isMediaElement(element)) continue
		for (const content of getContents(element)) {
			const assetId = content.assetId?.trim()
			if (!assetId) continue
			const cachedStatus =
				host.assetCompliancePollingManager.getState(assetId)?.status ??
				host.assetResourceManager.getCachedResource(assetId)?.complianceStatus ??
				undefined
			if (cachedStatus === "PROCESSING") {
				assetIds.add(assetId)
			}
		}
	}

	return Array.from(assetIds)
}
