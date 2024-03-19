import { TiptapMentionAttributes } from "@/opensource/components/business/MentionPanel/tiptap-plugin"
import { MentionListItem } from "@/opensource/components/business/MentionPanel/tiptap-plugin/types"
import {
	MentionItemType,
	UploadFileMentionData,
	ProjectFileMentionData,
	AgentMentionData,
	McpMentionData,
	SkillMentionData,
	ToolMentionData,
	DirectoryMentionData,
	CanvasMarkerMentionData,
	DataService,
	TransformedCanvasMarkerMentionData,
	MentionData,
} from "@/opensource/components/business/MentionPanel/types"
import { DraftData, FileData } from "../types"
import { keyBy } from "lodash-es"
import { JSONContent } from "@tiptap/core"
import { SaveUploadFileToProjectResponse } from "../../../utils/api"
import { MarkerTypeEnum, type MarkerArea } from "@/opensource/components/CanvasDesign/canvas/types"

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

export const isAllowedMention = (attrs: TiptapMentionAttributes, dataService: DataService) => {
	const { type, data } = attrs
	if (!data) return false

	if (type === MentionItemType.PROJECT_FILE) {
		const fileId = (data as ProjectFileMentionData).file_id
		const hasProjectFile = dataService.hasProjectFile(fileId)
		return hasProjectFile
	}

	switch (type) {
		case MentionItemType.AGENT:
			return dataService.hasAgent((data as AgentMentionData).agent_id)
		case MentionItemType.MCP:
			return dataService.hasMcp((data as McpMentionData).id)
		case MentionItemType.SKILL:
			return dataService.hasSkill((data as SkillMentionData).id)
		case MentionItemType.TOOL:
			return dataService.hasTool((data as ToolMentionData).id)
		case MentionItemType.UPLOAD_FILE:
			// Always allow UPLOAD_FILE mentions to be inserted
			// They are temporary and will be replaced with PROJECT_FILE after upload completes
			return true
		case MentionItemType.FOLDER:
			return dataService.hasFolder((data as DirectoryMentionData).directory_id)
		case MentionItemType.DESIGN_MARKER:
			return true
		default:
			return false
	}
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
			const markerData = item.attrs.data as CanvasMarkerMentionData
			return markerData.loading === true
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
			const markerData = attrs.data as CanvasMarkerMentionData
			if (markerData.loading === true) return true
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
						const markerData = attrs.data as CanvasMarkerMentionData
						const designProjectId = markerData?.design_project_id ?? ""
						const markId = markerData?.data?.id ?? ""
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
					const data = attrs.data as CanvasMarkerMentionData
					if (data.design_project_id && data.data?.id) {
						result.push(data)
					}
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
		const key = `${data.design_project_id}:${data.data?.id}`
		if (!key || key === ":" || seen.has(key)) return
		seen.add(key)
		sync(data)
	}

	for (const item of draft.mentionItems ?? []) {
		if (item.attrs.type === MentionItemType.DESIGN_MARKER && item.attrs.data) {
			processMarker(item.attrs.data as CanvasMarkerMentionData)
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

function transformCanvasMarkerMentionData(mentionItem: MentionListItem): MentionListItem {
	const markerData = mentionItem.attrs.data as CanvasMarkerMentionData
	const selectedSuggestionIndex = markerData.data?.selectedSuggestionIndex || 0
	const suggestion = markerData.data?.result?.suggestions?.[selectedSuggestionIndex]
	if (suggestion && markerData.data) {
		const marker = markerData.data
		const transformedData: TransformedCanvasMarkerMentionData = {
			image: markerData.image_path || "",
			...suggestion,
			mark:
				marker.type === MarkerTypeEnum.Mark
					? [marker.relativeX, marker.relativeY]
					: undefined,
			mark_number: markerData.mark_number || 1,
			mark_type: marker.type,
			area:
				marker.type === MarkerTypeEnum.Area &&
				markerData.element_width &&
				markerData.element_height
					? (() => {
							const areaMarker = marker as MarkerArea
							return [
								areaMarker.relativeX,
								areaMarker.relativeY,
								areaMarker.areaWidth * markerData.element_width,
								areaMarker.areaHeight * markerData.element_height,
							]
						})()
					: undefined,
		}
		return {
			...mentionItem,
			attrs: {
				type: MentionItemType.DESIGN_MARKER,
				data: transformedData as unknown as MentionData,
			},
		}
	}
	return mentionItem
}

/**
 * Transform mention items for sending to agent
 * Customize the mention data structure before sending to the backend
 * Currently handles CanvasMarkerMentionData transformation, but can be extended for other types
 * @param mentionItems - Array of mention items to transform
 * @returns Array of transformed mention items with customized data
 */
export function transformMentions(mentionItems: MentionListItem[]): MentionListItem[] {
	return mentionItems.map((item) => {
		switch (item.attrs.type) {
			case MentionItemType.DESIGN_MARKER:
				return transformCanvasMarkerMentionData(item)
			default:
				return item
		}
	})
}
