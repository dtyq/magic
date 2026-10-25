import type { Canvas } from "../../core/Canvas"
import {
	ElementTypeEnum,
	type AudioElement,
	type CanvasDocument,
	type ImageElement,
	type LayerElement,
	type VideoElement,
} from "../../document/types"
import {
	getDownstreamContent,
	getUsableDownstreamImageContent,
} from "../../document/elementContent"
import {
	UploadSubDir,
	type CanvasAssetMediaType,
	type UploadSubDirType,
} from "../../../public/magic-types"
import {
	getCanvasResourceFileName,
	isRemoteOrSpecialPath,
	parseAssetResourcePath,
	resolveCanvasStorageResourceReference,
} from "../../shared/path/canvasResourcePath"

type AssetMediaElement = ImageElement | VideoElement | AudioElement
type AssetMediaContent = AssetMediaElement["contents"][number]

function isAssetMediaElement(element: LayerElement): element is AssetMediaElement {
	return (
		element.type === ElementTypeEnum.Image ||
		element.type === ElementTypeEnum.Video ||
		element.type === ElementTypeEnum.Audio
	)
}

function collectAssetIdsFromElement(element: LayerElement, assetIds: Set<string>): void {
	if (isAssetMediaElement(element)) {
		for (const content of element.contents) {
			const assetId = content.assetId?.trim()
			if (assetId) assetIds.add(assetId)
			const legacyAssetId = content.src ? parseAssetResourcePath(content.src) : undefined
			if (legacyAssetId) assetIds.add(legacyAssetId)
		}
	}

	const children = (element as LayerElement & { children?: LayerElement[] }).children
	children?.forEach((child) => collectAssetIdsFromElement(child, assetIds))
}

/** 收集加载/刷新 Canvas 资产时需要向素材服务查询的逻辑 ID。 */
export function collectCanvasAssetIds(document: CanvasDocument): string[] {
	const assetIds = new Set<string>()
	for (const element of document.elements ?? []) {
		collectAssetIdsFromElement(element, assetIds)
	}
	return [...assetIds]
}

export interface CanvasAssetMediaBinding {
	assetId: string
	mediaType: CanvasAssetMediaType
	workspacePath: string
	fileName: string
	dimensions: { width: number; height: number }
	elementId: string
	contentId: string
}

export interface CanvasAssetMediaConnection extends CanvasAssetMediaBinding {
	connectionId: string
}

interface FindCanvasAssetMediaBindingOptions {
	assetId: string
	allowedMediaTypes: readonly CanvasAssetMediaType[]
}

export interface CanvasWorkspaceMediaFile {
	mediaType: CanvasAssetMediaType
	workspacePath: string
	fileName: string
}

type CanvasAssetBindingHost = Pick<
	Canvas,
	"connectionManager" | "elementManager" | "canvasFileUploadManager" | "magicConfigManager"
>

function getMediaType(element: LayerElement): CanvasAssetMediaType | null {
	if (element.type === ElementTypeEnum.Image) return "image"
	if (element.type === ElementTypeEnum.Video) return "video"
	if (element.type === ElementTypeEnum.Audio) return "audio"
	return null
}

export function getAssetUploadSubDir(mediaType: CanvasAssetMediaType): UploadSubDirType {
	if (mediaType === "image") return UploadSubDir.Images
	if (mediaType === "video") return UploadSubDir.Videos
	return UploadSubDir.Audios
}

/**
 * 按素材服务的权威媒体类型，只在当前 Canvas 对应目录中查找唯一同名文件。
 * pending、歧义和目录外引用均不复用，交由导入流程继续下载上传。
 */
export function findCanvasWorkspaceMediaFile(
	canvas: CanvasAssetBindingHost,
	options: { mediaType: CanvasAssetMediaType; fileName: string },
): CanvasWorkspaceMediaFile | null {
	const fileName = options.fileName.trim()
	if (!fileName || /[\\/?#]/.test(fileName)) return null

	const resolver = canvas.magicConfigManager.config?.methods?.resolveResourceReference
	if (!resolver) return null

	const candidatePath = `./${getAssetUploadSubDir(options.mediaType)}/${fileName}`
	const resolution = resolveCanvasStorageResourceReference(candidatePath, resolver, {
		requireAttachment: true,
	})
	if (resolution.status !== "resolved" || resolution.resourceKind !== "workspace-file") {
		return null
	}

	return {
		mediaType: options.mediaType,
		workspacePath: resolution.storagePath,
		fileName,
	}
}

function getOrderedContents(element: AssetMediaElement): AssetMediaContent[] {
	const byId = new Map(element.contents.map((content) => [content.contentId, content]))
	const ordered: AssetMediaContent[] = []
	const append = (contentId?: string | null) => {
		if (!contentId) return
		const content = byId.get(contentId)
		if (!content || ordered.includes(content)) return
		ordered.push(content)
	}

	append(element.activeContentId)
	append(element.mainContentId)
	element.contents.forEach((content) => append(content.contentId))
	return ordered
}

function getConnectedMediaContent(element: AssetMediaElement): AssetMediaContent | undefined {
	if (element.type === ElementTypeEnum.Image) {
		return getUsableDownstreamImageContent(element)
	}
	return getDownstreamContent(element)
}

function createCanvasAssetMediaBinding(options: {
	assetId: string
	mediaType: CanvasAssetMediaType
	element: AssetMediaElement
	contentId: string
	workspacePath: string
}): CanvasAssetMediaBinding {
	const { assetId, mediaType, element, contentId, workspacePath } = options
	return {
		assetId,
		mediaType,
		workspacePath,
		fileName:
			element.name || getCanvasResourceFileName(workspacePath) || `${mediaType}-${assetId}`,
		dimensions: {
			width: Math.max(1, element.width ?? 1),
			height: Math.max(1, element.height ?? 1),
		},
		elementId: element.id,
		contentId,
	}
}

function resolveReusableWorkspacePath(
	canvas: CanvasAssetBindingHost,
	path: string | undefined,
): string | null {
	const trimmedPath = path?.trim()
	if (!trimmedPath || isRemoteOrSpecialPath(trimmedPath)) return null

	const resolver = canvas.magicConfigManager.config?.methods?.resolveResourceReference
	if (resolver) {
		const resolution = resolveCanvasStorageResourceReference(trimmedPath, resolver, {
			requireAttachment: true,
		})
		if (resolution.status === "resolved" && resolution.resourceKind === "workspace-file") {
			return resolution.storagePath
		}
	}

	// 上传回调可能早于附件树刷新；只信任上传管理器登记过的短暂 pending path。
	return canvas.canvasFileUploadManager.isPendingResourcePath(trimmedPath) ? trimmedPath : null
}

/**
 * 从当前 Canvas 文档中查找素材绑定。该扫描只发生在用户确认素材时，
 * 不维护第二份持久索引，避免 assetId 与真实 Content 生命周期分叉。
 */
export function findCanvasAssetMediaBinding(
	canvas: CanvasAssetBindingHost,
	options: FindCanvasAssetMediaBindingOptions,
): CanvasAssetMediaBinding | null {
	const assetId = options.assetId.trim()
	if (!assetId) return null
	const allowedMediaTypes = new Set(options.allowedMediaTypes)

	for (const elementId of canvas.elementManager.getAllElementIds()) {
		const element = canvas.elementManager.getElementData(elementId)
		if (!element) continue
		const mediaType = getMediaType(element)
		if (!mediaType || !allowedMediaTypes.has(mediaType)) continue

		for (const content of getOrderedContents(element as AssetMediaElement)) {
			if (content.assetId?.trim() !== assetId) continue
			const workspacePath = resolveReusableWorkspacePath(canvas, content.src)
			if (!workspacePath) continue
			return createCanvasAssetMediaBinding({
				assetId,
				mediaType,
				element: element as AssetMediaElement,
				contentId: content.contentId,
				workspacePath,
			})
		}
	}

	return null
}

/**
 * 只查找目标元素的直接上游素材连接。
 *
 * 画布中存在同一 assetId 并不代表它已经服务于当前编辑器；只有当前
 * 连接源的有效 Content 命中时，才能复用连接并跳过重复建图。
 */
export function findConnectedCanvasAssetMediaBinding(
	canvas: CanvasAssetBindingHost,
	options: FindCanvasAssetMediaBindingOptions & { targetElementId: string },
): CanvasAssetMediaConnection | null {
	const assetId = options.assetId.trim()
	if (!assetId) return null
	const allowedMediaTypes = new Set(options.allowedMediaTypes)

	for (const connection of canvas.connectionManager.getUpstreamConnections(
		options.targetElementId,
	)) {
		const element = canvas.elementManager.getElementData(connection.sourceElementId)
		if (!element) continue
		const mediaType = getMediaType(element)
		if (!mediaType || !allowedMediaTypes.has(mediaType)) continue

		const content = getConnectedMediaContent(element as AssetMediaElement)
		if (content?.assetId?.trim() !== assetId) continue
		const workspacePath = resolveReusableWorkspacePath(canvas, content.src)
		if (!workspacePath) continue

		return {
			...createCanvasAssetMediaBinding({
				assetId,
				mediaType,
				element: element as AssetMediaElement,
				contentId: content.contentId,
				workspacePath,
			}),
			connectionId: connection.id,
		}
	}

	return null
}
