import { TiptapMentionAttributes } from "@/components/business/MentionPanel/tiptap-plugin"
import { MentionListItem } from "@/components/business/MentionPanel/tiptap-plugin/types"
import {
	MentionItemType,
	UploadFileMentionData,
	ProjectFileMentionData,
	DirectoryMentionData,
	CanvasMarkerMentionData,
	DataService,
} from "@/components/business/MentionPanel/types"
import {
	getCanvasMarkerMentionImagePath,
	normalizeCanvasMarkerMentionData,
} from "@/components/business/MentionPanel/utils/canvasMarkerMention"
import type { AttachmentItem } from "@/pages/superMagic/components/TopicFilesButton/hooks/types"
import type { FileItem } from "@/pages/superMagic/components/Detail/components/FilesViewer/types"
import { resolveDesignProjectBasePathFromAttachments } from "@/pages/superMagic/components/Detail/contents/Design/utils/utils"
import { resolveDesignDslPathToWorkspaceRelative } from "@/pages/superMagic/components/Detail/contents/Design/utils/designDslPathUtils"
import { validateMentionWithDataService } from "@/components/business/MentionPanel/utils/dataService"
import { DraftData, FileData } from "../types"
import { keyBy } from "lodash-es"
import { JSONContent } from "@tiptap/core"
import { SaveUploadFileToProjectResponse } from "../../../utils/api"

/**
 * Extract file extension from filename
 * @param filename - The filename to extract extension from
 * @returns File extension without dot, or empty string if no extension
 */
export function extractFileExtension(filename: string): string {
	return filename.split(".").pop() || ""
}

/**
 * Create UploadFileMentionData from FileData
 * @param fileData - The file data to convert
 * @returns UploadFileMentionData object
 */
export function createUploadFileMentionData(fileData: FileData): UploadFileMentionData {
	return {
		file_id: fileData.id || "",
		file_name: fileData.file.name || "",
		file_extension: extractFileExtension(fileData.file.name),
		file_size: fileData.file.size,
		file: fileData.file,
		upload_progress: fileData.progress,
		upload_status: fileData.status,
		upload_error: fileData.error,
	}
}

/**
 * Create TiptapMentionAttributes for upload file
 * @param fileData - The file data to convert
 * @returns TiptapMentionAttributes object
 */
export function createUploadFileMentionAttributes(fileData: FileData): TiptapMentionAttributes {
	return {
		type: MentionItemType.UPLOAD_FILE,
		data: createUploadFileMentionData(fileData),
	}
}

/**
 * Transform UPLOAD_FILE mention to PROJECT_FILE mention
 * @param uploadFileData - The upload file mention data
 * @param saveResult - The save result from backend
 * @returns ProjectFileMentionData object
 */
export function transformUploadFileToProjectFile(
	uploadFileData: UploadFileMentionData,
	saveResult: FileData["saveResult"],
): ProjectFileMentionData {
	return {
		file_id: saveResult?.file_id || "",
		file_name: saveResult?.file_name || "",
		file_path: saveResult?.relative_file_path || "",
		file_extension: uploadFileData.file_extension,
		file_size: saveResult?.file_size,
	}
}

/**
 * Filter upload file mentions from mentionItems
 * @param mentionItems - Array of mention items
 * @returns Array of upload file mention items
 */
export function filterUploadFileMentions(mentionItems: MentionListItem[]): MentionListItem[] {
	return mentionItems.filter((item) => item.attrs.type === MentionItemType.UPLOAD_FILE)
}

/**
 * Check if mention item has valid file path
 * @param item - Mention item to check
 * @returns Boolean indicating if the item has a valid file path
 */
export function hasValidFilePath(item: MentionListItem): boolean {
	if (item.attrs.type !== MentionItemType.UPLOAD_FILE) {
		return false
	}

	const uploadFile = item.attrs.data as UploadFileMentionData
	return Boolean(uploadFile?.file_path)
}

/**
 * Transform single mention item from upload_file to project_file
 * @param item - The mention item to transform
 * @param saveResult - The save result from backend
 * @returns Transformed mention item
 */
export function transformMentionItemToProjectFile(
	item: MentionListItem,
	saveResult: FileData["saveResult"],
): MentionListItem {
	if (item.attrs.type !== MentionItemType.UPLOAD_FILE) {
		return item
	}

	const uploadFile = item.attrs.data as UploadFileMentionData

	return {
		...item,
		attrs: {
			type: MentionItemType.PROJECT_FILE,
			data: transformUploadFileToProjectFile(uploadFile, saveResult),
		},
	}
}

/**
 * Recursively transform JSONContent by converting upload_file mentions to project_file mentions
 * @param content - The JSONContent to transform
 * @param saveResultMap - Map of file_key to save results
 * @returns Transformed JSONContent
 */
function transformContentByMentionItems(
	content: JSONContent,
	saveResultMap: Record<string, SaveUploadFileToProjectResponse | undefined>,
): JSONContent {
	if (!content) {
		return content
	}

	// Clone content to avoid mutating the original
	const transformedContent = { ...content }

	// Check if current node is a mention node
	if (content.type === "mention" && content.attrs) {
		const mentionAttrs = content.attrs as TiptapMentionAttributes

		// Check if it's an upload_file mention
		if (mentionAttrs.type === MentionItemType.UPLOAD_FILE && mentionAttrs.data) {
			const uploadFile = mentionAttrs.data as UploadFileMentionData

			// Find corresponding save result
			if (uploadFile.file_path && saveResultMap[uploadFile.file_path]) {
				const saveResult = saveResultMap[uploadFile.file_path]

				if (saveResult) {
					// Transform to project_file mention
					transformedContent.attrs = {
						type: MentionItemType.PROJECT_FILE,
						data: transformUploadFileToProjectFile(uploadFile, saveResult),
					}
				}
			}
		}
	}

	// Recursively transform content array
	if (content.content && Array.isArray(content.content)) {
		transformedContent.content = content.content.map((child) =>
			transformContentByMentionItems(child, saveResultMap),
		)
	}

	return transformedContent
}

/**
 * Transform multiple mention items from upload_file to project_file
 * @param mentionItems - Array of mention items to transform
 * @param saveResults - Array of save results from backend
 * @returns Array of transformed mention items
 */
export function transformMentionItemsToProjectFiles(
	content: JSONContent,
	mentionItems: MentionListItem[],
	saveResults: FileData["saveResult"][],
): { mentionItems: MentionListItem[]; content: JSONContent } {
	// Create a map of file_path to saveResult for efficient lookup
	const saveResultMap = keyBy(saveResults, "file_key")

	const transformedItems = mentionItems.map((item) => {
		if (item.attrs.type === MentionItemType.UPLOAD_FILE && hasValidFilePath(item)) {
			const uploadFile = item.attrs.data as UploadFileMentionData

			if (uploadFile.file_path) {
				const saveResult = saveResultMap[uploadFile.file_path]

				if (saveResult) {
					return transformMentionItemToProjectFile(item, saveResult)
				}
			}
		}

		return item
	})

	const transformedContent = transformContentByMentionItems(content, saveResultMap)

	return {
		mentionItems: transformedItems,
		content: transformedContent,
	}
}

function mapAttachmentsToFileItems(attachments: AttachmentItem[]): FileItem[] {
	return attachments
		.filter((item): item is AttachmentItem & { file_id: string } => Boolean(item.file_id))
		.map((item) => ({
			file_id: item.file_id,
			file_name: item.file_name ?? item.name ?? item.filename ?? "",
			display_filename: item.display_filename,
			filename: item.filename,
			file_extension: item.file_extension,
			relative_file_path: item.relative_file_path,
			is_directory: item.is_directory,
			parent_id: item.parent_id ?? undefined,
			source: item.source,
		}))
}

/**
 * 发送前将 marker 的 image 统一转换为工作区路径（`画布/images/x.png`），
 * 避免后端拿到 design 内部相对路径（`images/x.png`）。
 */
export function transformMarkerImagePathsToWorkspaceAbsolute(
	content: JSONContent,
	attachments: AttachmentItem[],
): JSONContent {
	if (!attachments.length) return content

	const flatAttachments = mapAttachmentsToFileItems(attachments)
	if (!flatAttachments.length) return content

	const basePathCache = new Map<string, string | undefined>()

	const getBasePathByDesignProjectId = (designProjectId?: string) => {
		if (!designProjectId) return undefined
		if (!basePathCache.has(designProjectId)) {
			basePathCache.set(
				designProjectId,
				resolveDesignProjectBasePathFromAttachments({
					currentFile: { id: designProjectId },
					flatAttachments,
				}),
			)
		}
		return basePathCache.get(designProjectId)
	}

	const transformNode = (node: JSONContent): JSONContent => {
		if (!node) return node

		let transformedNode = node

		if (node.type === "mention" && node.attrs) {
			const mentionAttrs = node.attrs as TiptapMentionAttributes
			if (mentionAttrs.type === MentionItemType.DESIGN_MARKER && mentionAttrs.data) {
				// 发送前把历史旧结构也归一成轻量结构，消息体里不再持久化完整 Marker。
				const markerData = normalizeCanvasMarkerMentionData(mentionAttrs.data)
				if (!markerData) return transformedNode

				const imagePath = getCanvasMarkerMentionImagePath(markerData)
				const workspaceImagePath = resolveDesignDslPathToWorkspaceRelative(
					imagePath,
					getBasePathByDesignProjectId(markerData.design_project_id),
				)

				// Agent/后端只需要工作区路径；原始相对路径保留在 image_relative 里，供缩略图兜底。
				const nextMarkerData: CanvasMarkerMentionData = {
					...markerData,
					...(workspaceImagePath && workspaceImagePath !== markerData.image
						? {
								image: workspaceImagePath,
								image_relative: markerData.image_relative || markerData.image,
							}
						: {}),
				}

				if (nextMarkerData !== mentionAttrs.data) {
					transformedNode = {
						...transformedNode,
						attrs: {
							...mentionAttrs,
							data: nextMarkerData,
						},
					}
				}
			}
		}

		if (node.content && Array.isArray(node.content)) {
			const transformedChildren = node.content.map(transformNode)
			if (transformedChildren.some((child, index) => child !== node.content?.[index])) {
				transformedNode = {
					...transformedNode,
					content: transformedChildren,
				}
			}
		}

		return transformedNode
	}

	return transformNode(content)
}

/**
 * Get upload file mention data from mention items
 * @param mentionItems - Array of mention items
 * @returns Array of upload file mention data
 */
export function getUploadFileMentionData(mentionItems: MentionListItem[]): UploadFileMentionData[] {
	return filterUploadFileMentions(mentionItems).map(
		(item) => item.attrs.data as UploadFileMentionData,
	)
}

export type ProjectReferenceMentionData = ProjectFileMentionData | DirectoryMentionData

export function getProjectReferenceSourceId(attrs: TiptapMentionAttributes): string | undefined {
	if (attrs.type === MentionItemType.PROJECT_FILE) {
		const data = attrs.data as ProjectFileMentionData | undefined
		return data?.source_file_id || data?.file_id
	}

	if (attrs.type === MentionItemType.FOLDER) {
		const data = attrs.data as DirectoryMentionData | undefined
		return data?.source_directory_id || data?.directory_id
	}

	return undefined
}

export function isPendingProjectReferenceMention(attrs: TiptapMentionAttributes): boolean {
	if (attrs.type === MentionItemType.PROJECT_FILE) {
		const data = attrs.data as ProjectFileMentionData | undefined
		return Boolean(data?.pending_project_copy && data.source_project_id && data.source_file_id)
	}

	if (attrs.type === MentionItemType.FOLDER) {
		const data = attrs.data as DirectoryMentionData | undefined
		return Boolean(
			data?.pending_project_copy && data.source_project_id && data.source_directory_id,
		)
	}

	return false
}

export const isPendingProjectFileMention = isPendingProjectReferenceMention

export function markProjectReferenceMentionForCopy(
	attrs: TiptapMentionAttributes,
	sourceProjectId?: string,
): TiptapMentionAttributes | null {
	if (!sourceProjectId) return null

	if (attrs.type === MentionItemType.PROJECT_FILE) {
		const data = attrs.data as ProjectFileMentionData | undefined
		if (!data?.file_id) return null

		return {
			...attrs,
			data: {
				...data,
				source_project_id: data.source_project_id || sourceProjectId,
				source_file_id: data.source_file_id || data.file_id,
				pending_project_copy: true,
			},
		}
	}

	if (attrs.type === MentionItemType.FOLDER) {
		const data = attrs.data as DirectoryMentionData | undefined
		if (!data?.directory_id) return null

		return {
			...attrs,
			data: {
				...data,
				source_project_id: data.source_project_id || sourceProjectId,
				source_directory_id: data.source_directory_id || data.directory_id,
				pending_project_copy: true,
			},
		}
	}

	return null
}

export const markProjectFileMentionForCopy = markProjectReferenceMentionForCopy

export interface CopiedProjectReferenceMentionData {
	sourceId: string
	attrs: TiptapMentionAttributes
}

export type CopiedProjectFileMentionData = CopiedProjectReferenceMentionData

export function transformPendingProjectReferenceMentions(
	content: JSONContent,
	mentionItems: MentionListItem[],
	copiedReferences: CopiedProjectReferenceMentionData[],
): { mentionItems: MentionListItem[]; content: JSONContent } {
	const copiedReferenceMap = keyBy(copiedReferences, "sourceId")

	const transformAttrs = (attrs: TiptapMentionAttributes): TiptapMentionAttributes => {
		if (!isPendingProjectReferenceMention(attrs)) return attrs

		const sourceId = getProjectReferenceSourceId(attrs)
		const copiedReference = sourceId ? copiedReferenceMap[sourceId] : undefined
		if (!copiedReference) return attrs

		return copiedReference.attrs
	}

	const transformContent = (node: JSONContent): JSONContent => {
		if (!node) return node

		let transformedNode = node
		if (node.type === "mention" && node.attrs) {
			const nextAttrs = transformAttrs(node.attrs as TiptapMentionAttributes)
			if (nextAttrs !== node.attrs) {
				transformedNode = {
					...node,
					attrs: nextAttrs,
				}
			}
		}

		if (node.content && Array.isArray(node.content)) {
			const transformedChildren = node.content.map(transformContent)
			if (transformedChildren.some((child, index) => child !== node.content?.[index])) {
				transformedNode = {
					...transformedNode,
					content: transformedChildren,
				}
			}
		}

		return transformedNode
	}

	return {
		mentionItems: mentionItems.map((item) => ({
			...item,
			attrs: transformAttrs(item.attrs),
		})),
		content: transformContent(content),
	}
}

export const transformPendingProjectFileMentions = transformPendingProjectReferenceMentions

export const isAllowedMention = (
	attrs: TiptapMentionAttributes,
	dataService?: DataService | null,
) => {
	if (isPendingProjectReferenceMention(attrs)) return true

	return validateMentionWithDataService(dataService, {
		type: attrs.type as MentionItemType,
		data: attrs.data,
	})
}

/**
 * Recursively filter out upload file mentions from JSONContent
 * @param content - The JSONContent to filter
 * @returns Filtered JSONContent with upload file mentions removed
 */
export function filterUploadFileMentionsFromContent(
	content: JSONContent,
	dataService: DataService,
): JSONContent {
	if (!content) {
		return content
	}

	// Clone content to avoid mutating the original
	const filteredContent = { ...content }

	// Recursively filter content array first
	if (content.content && Array.isArray(content.content)) {
		const filteredChildren = content.content
			.filter((child) => {
				// Filter out upload_file mention nodes
				if (child.type === "mention" && child.attrs) {
					const mentionAttrs = child.attrs as TiptapMentionAttributes
					return (
						mentionAttrs.type !== MentionItemType.UPLOAD_FILE &&
						isAllowedMention(mentionAttrs, dataService)
					)
				}
				return true
			})
			.map((child) => filterUploadFileMentionsFromContent(child, dataService))

		filteredContent.content = filteredChildren
	}

	return filteredContent
}

export function filterUploadFileMentionsFromMentionItems(
	mentionItems: MentionListItem[],
	dataService: DataService,
): MentionListItem[] {
	return mentionItems.filter(
		(item) =>
			item.attrs.type !== MentionItemType.UPLOAD_FILE &&
			isAllowedMention(item.attrs, dataService),
	)
}

/**
 * 检查 mentionItems 中是否存在 loading 状态的 marker
 * 用于保存草稿前跳过，避免将未完成的 marker 写入 draft
 */
export function hasLoadingMarkerInMentionItems(items: MentionListItem[]): boolean {
	return items.some((item) => {
		if (item.attrs.type === MentionItemType.DESIGN_MARKER && item.attrs.data) {
			const markerData = normalizeCanvasMarkerMentionData(item.attrs.data)
			return markerData?.loading === true
		}
		return false
	})
}

/**
 * 递归检查 JSONContent 中是否存在 loading 状态的 DESIGN_MARKER mention 节点
 * 用于保存草稿前跳过，避免将未完成的 marker 写入 draft
 */
export function hasLoadingMarkerInContent(content: JSONContent | undefined): boolean {
	if (!content) return false

	if (content.type === "mention" && content.attrs) {
		const attrs = content.attrs as TiptapMentionAttributes
		if (attrs.type === MentionItemType.DESIGN_MARKER && attrs.data) {
			const markerData = normalizeCanvasMarkerMentionData(attrs.data)
			if (markerData?.loading === true) return true
		}
	}

	if (content.content && Array.isArray(content.content)) {
		return content.content.some((child) => hasLoadingMarkerInContent(child))
	}

	return false
}

/** 用于校验 marker 是否仍存在的函数类型 */
export type GetExistentMarkIds = (
	items: Array<{ designProjectId: string; markId: string }>,
) => Set<string>

/**
 * 递归过滤掉已失效的 DESIGN_MARKER 节点（画布已删除的 marker）
 * 草稿恢复时使用，避免刷新后仍显示已删除的 marker
 */
export function filterStaleMarkersFromContent(
	content: JSONContent,
	getExistentMarkIds: GetExistentMarkIds,
): JSONContent {
	if (!content) return content

	const filteredContent = { ...content }

	if (content.content && Array.isArray(content.content)) {
		const filteredChildren = content.content
			.filter((child) => {
				if (child.type === "mention" && child.attrs) {
					const attrs = child.attrs as TiptapMentionAttributes
					if (attrs.type === MentionItemType.DESIGN_MARKER) {
						const markerData = normalizeCanvasMarkerMentionData(attrs.data)
						const designProjectId = markerData?.design_project_id ?? ""
						const markId = markerData?.marker_id ?? ""
						if (!designProjectId || !markId) return false
						const existent = getExistentMarkIds([{ designProjectId, markId }])
						return existent.has(markId)
					}
				}
				return true
			})
			.map((child) => filterStaleMarkersFromContent(child, getExistentMarkIds))

		filteredContent.content = filteredChildren
	}

	return filteredContent
}

/**
 * 从 JSONContent 递归收集所有 DESIGN_MARKER 的 CanvasMarkerMentionData
 */
function collectMarkersFromContent(
	content: JSONContent | undefined,
	result: CanvasMarkerMentionData[],
): void {
	if (!content) return
	if (content.content && Array.isArray(content.content)) {
		for (const child of content.content) {
			if (child.type === "mention" && child.attrs) {
				const attrs = child.attrs as TiptapMentionAttributes
				if (attrs.type === MentionItemType.DESIGN_MARKER && attrs.data) {
					const data = normalizeCanvasMarkerMentionData(attrs.data)
					if (data?.design_project_id && data.marker_id) result.push(data)
				}
			}
			collectMarkersFromContent(child, result)
		}
	}
}

/**
 * 草稿箱恢复前，将草稿中的 marker sync 到 Manager，避免被 removeStaleMarkers 误删
 */
export function syncDraftMarkersToManager(
	draft: DraftData,
	sync: (data: CanvasMarkerMentionData) => void,
): void {
	const seen = new Set<string>()
	const processMarker = (data: CanvasMarkerMentionData) => {
		const key = `${data.design_project_id}:${data.marker_id}`
		if (!key || key === ":" || seen.has(key)) return
		seen.add(key)
		sync(data)
	}

	for (const item of draft.mentionItems ?? []) {
		if (item.attrs.type === MentionItemType.DESIGN_MARKER && item.attrs.data) {
			const markerData = normalizeCanvasMarkerMentionData(item.attrs.data)
			if (markerData) processMarker(markerData)
		}
	}
	const fromContent: CanvasMarkerMentionData[] = []
	collectMarkersFromContent(draft.value, fromContent)
	fromContent.forEach(processMarker)
}

/**
 * Validate mention items before processing
 * @param mentionItems - Array of mention items to validate
 * @returns Object containing valid and invalid items
 */
export function validateMentionItems(mentionItems: MentionListItem[]): {
	validItems: MentionListItem[]
	invalidItems: MentionListItem[]
} {
	const validItems: MentionListItem[] = []
	const invalidItems: MentionListItem[] = []

	mentionItems.forEach((item) => {
		if (item.attrs.type === MentionItemType.UPLOAD_FILE) {
			const uploadFile = item.attrs.data as UploadFileMentionData
			if (uploadFile?.file_path && uploadFile?.file_name) {
				validItems.push(item)
			} else {
				invalidItems.push(item)
			}
		} else {
			validItems.push(item)
		}
	})

	return { validItems, invalidItems }
}

/**
 * Transform mention items for sending to agent
 * Filter out mentions that should stay in editor content only.
 * @param mentionItems - Array of mention items to transform
 * @returns Array of transformed mention items with send-safe data
 */
export function transformMentions(_mentionItems: MentionListItem[]): MentionListItem[] {
	void _mentionItems
	// return mentionItems.map((item) => {
	// 	switch (item.attrs.type) {
	// 		case MentionItemType.DESIGN_MARKER:
	// 			return transformCanvasMarkerMentionData(item)
	// 		default:
	// 			return item
	// 	}
	// })
	return []
}
