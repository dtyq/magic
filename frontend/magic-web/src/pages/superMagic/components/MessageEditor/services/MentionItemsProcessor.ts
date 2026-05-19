import {
	MentionListItem,
	TiptapMentionAttributes,
} from "@/components/business/MentionPanel/tiptap-plugin/types"
import {
	DirectoryMentionData,
	MentionItemType,
	ProjectFileMentionData,
	UploadFileMentionData,
} from "@/components/business/MentionPanel/types"
import { FileData } from "../types"
import {
	CopiedProjectReferenceMentionData,
	filterUploadFileMentions,
	getProjectReferenceSourceId,
	getUploadFileMentionData,
	isPendingProjectReferenceMention,
	transformMentionItemsToProjectFiles,
	transformPendingProjectReferenceMentions,
	validateMentionItems,
} from "../utils/mention"
import { superMagicUploadTokenService } from "./UploadTokenService"
import { MentionItemsStatistics } from "./types"
import { JSONContent } from "@tiptap/core"
import { SuperMagicApi } from "@/apis"
import type { AttachmentItem } from "@/pages/superMagic/components/TopicFilesButton/hooks"
import pubsub, { PubSubEvents } from "@/utils/pubsub"

interface BatchOperationResult {
	status?: "success" | "processing" | "completed" | "failed"
	batch_key?: string
	message?: string
}

interface PendingProjectFileGroup {
	sourceProjectId: string
	fileIds: string[]
	items: MentionListItem[]
}

const BATCH_OPERATION_POLL_INTERVAL = 1000
const BATCH_OPERATION_MAX_ATTEMPTS = 30

/**
 * MentionItemsProcessor - Service class for processing mention items
 *
 * This service handles the conversion of UPLOAD_FILE mentions to PROJECT_FILE mentions
 * and manages the temporary file saving process.
 */
export class MentionItemsProcessor {
	/**
	 * Process mention items by saving temporary files and converting them to project files
	 * @param content - JSONContent to process
	 * @param mentionItems - Array of mention items to process
	 * @param projectId - Target project ID
	 * @param topicId - Target topic ID (optional)
	 * @returns Promise resolving to processed mention items and transformed content
	 */
	async processMentionItems(
		content: JSONContent,
		mentionItems: MentionListItem[],
		projectId: string,
		topicId?: string,
	): Promise<{ mentionItems: MentionListItem[]; content: JSONContent }> {
		// Validate input parameters
		if (!mentionItems || mentionItems.length === 0) {
			return { mentionItems, content }
		}

		if (!projectId) {
			throw new Error("Project ID is required for processing mention items")
		}

		try {
			const uploadResult = await this.processUploadFileMentions(
				content,
				mentionItems,
				projectId,
				topicId,
			)
			const pendingProjectReferences = this.filterPendingProjectReferenceMentions(
				uploadResult.mentionItems,
			)

			if (pendingProjectReferences.length === 0) return uploadResult

			const copiedReferences = await this.copyPendingProjectReferencesToProject(
				pendingProjectReferences,
				projectId,
			)

			return transformPendingProjectReferenceMentions(
				uploadResult.content,
				uploadResult.mentionItems,
				copiedReferences,
			)
		} catch (error) {
			console.error("Failed to process mention items:", error)
			throw new Error(
				`Failed to process mention items: ${
					error instanceof Error ? error.message : String(error)
				}`,
			)
		}
	}

	private async processUploadFileMentions(
		content: JSONContent,
		mentionItems: MentionListItem[],
		projectId: string,
		topicId?: string,
	): Promise<{ mentionItems: MentionListItem[]; content: JSONContent }> {
		const processedItems = [...mentionItems]
		const tempFiles = filterUploadFileMentions(processedItems)

		if (tempFiles.length === 0) return { mentionItems: processedItems, content }

		const { validItems, invalidItems } = validateMentionItems(tempFiles)

		if (invalidItems.length > 0) {
			console.warn(
				`Found ${invalidItems.length} invalid upload file mentions:`,
				invalidItems.map((item) => {
					const data = item.attrs.data as UploadFileMentionData
					return `${data.file_name} (missing file_path: ${!data.file_path})`
				}),
			)
		}

		if (validItems.length === 0) {
			console.warn("No valid upload files found to process")
			return { mentionItems: processedItems, content }
		}

		const saveResults = await this.saveTempFilesToProject(validItems, projectId, topicId)
		const transformedResult = transformMentionItemsToProjectFiles(
			content,
			processedItems,
			saveResults,
		)

		return transformedResult
	}

	private filterPendingProjectReferenceMentions(
		mentionItems: MentionListItem[],
	): MentionListItem[] {
		return mentionItems.filter((item) => isPendingProjectReferenceMention(item.attrs))
	}

	private async copyPendingProjectReferencesToProject(
		pendingItems: MentionListItem[],
		targetProjectId: string,
	): Promise<CopiedProjectReferenceMentionData[]> {
		const beforeAttachments = await this.getProjectAttachments(targetProjectId)
		const groups = this.groupPendingProjectFilesBySourceProject(pendingItems)
		const copiedReferencesFromSameProject = this.resolveSameProjectPendingReferences(
			groups,
			targetProjectId,
		)
		const copyGroups = groups.filter((group) => group.sourceProjectId !== targetProjectId)

		for (const group of copyGroups) {
			const result = (await SuperMagicApi.copyFiles({
				file_ids: group.fileIds,
				project_id: group.sourceProjectId,
				target_project_id: targetProjectId,
				target_parent_id: "",
				pre_file_id: "",
				keep_both_file_ids: group.fileIds,
			})) as BatchOperationResult

			await this.waitForBatchOperation(result)
		}

		const sourceIds = new Set(
			pendingItems
				.map((item) => getProjectReferenceSourceId(item.attrs))
				.filter((sourceId): sourceId is string => Boolean(sourceId)),
		)
		if (copiedReferencesFromSameProject.length >= sourceIds.size)
			return copiedReferencesFromSameProject
		const resolvedSourceIds = new Set(
			copiedReferencesFromSameProject.map((reference) => reference.sourceId),
		)
		const unresolvedSourceIds = new Set(
			Array.from(sourceIds).filter((sourceId) => !resolvedSourceIds.has(sourceId)),
		)

		const copiedFiles = await this.waitForCopiedProjectFiles({
			targetProjectId,
			pendingItems: pendingItems.filter((item) => {
				const sourceId = getProjectReferenceSourceId(item.attrs)
				return Boolean(sourceId && unresolvedSourceIds.has(sourceId))
			}),
			beforeAttachments,
			sourceIds: unresolvedSourceIds,
		})

		if (copiedFiles.length > 0) pubsub.publish(PubSubEvents.Update_Attachments)

		return [...copiedReferencesFromSameProject, ...copiedFiles]
	}

	private resolveSameProjectPendingReferences(
		groups: PendingProjectFileGroup[],
		targetProjectId: string,
	): CopiedProjectReferenceMentionData[] {
		return groups
			.filter((group) => group.sourceProjectId === targetProjectId)
			.flatMap((group) =>
				group.items.map((item) => {
					const sourceId = getProjectReferenceSourceId(item.attrs) || ""
					return {
						sourceId,
						attrs: this.resolvePendingReferenceAttrs(item.attrs),
					}
				}),
			)
	}

	private groupPendingProjectFilesBySourceProject(
		pendingItems: MentionListItem[],
	): PendingProjectFileGroup[] {
		const groupMap = new Map<string, PendingProjectFileGroup>()

		for (const item of pendingItems) {
			const data = item.attrs.data as ProjectFileMentionData | DirectoryMentionData
			const sourceProjectId = data.source_project_id
			const sourceFileId = getProjectReferenceSourceId(item.attrs)
			if (!sourceProjectId || !sourceFileId) continue

			const group = groupMap.get(sourceProjectId) ?? {
				sourceProjectId,
				fileIds: [],
				items: [],
			}

			if (!group.fileIds.includes(sourceFileId)) group.fileIds.push(sourceFileId)
			group.items.push(item)
			groupMap.set(sourceProjectId, group)
		}

		return Array.from(groupMap.values())
	}

	private async waitForBatchOperation(result: BatchOperationResult): Promise<void> {
		if (result.status === "failed") {
			throw new Error(result.message || "Project file copy failed")
		}

		if (result.status !== "processing" || !result.batch_key) return

		for (let attempt = 0; attempt < BATCH_OPERATION_MAX_ATTEMPTS; attempt += 1) {
			await this.sleep(BATCH_OPERATION_POLL_INTERVAL)
			const checkResult = (await SuperMagicApi.checkBatchOperationStatus(
				result.batch_key,
			)) as BatchOperationResult

			if (checkResult.status === "failed") {
				throw new Error(checkResult.message || "Project file copy failed")
			}
			if (checkResult.status !== "processing") return
		}

		throw new Error("Project file copy timed out")
	}

	private async waitForCopiedProjectFiles({
		targetProjectId,
		pendingItems,
		beforeAttachments,
		sourceIds,
	}: {
		targetProjectId: string
		pendingItems: MentionListItem[]
		beforeAttachments: AttachmentItem[]
		sourceIds: Set<string>
	}): Promise<CopiedProjectReferenceMentionData[]> {
		if (sourceIds.size === 0) return []

		for (let attempt = 0; attempt < BATCH_OPERATION_MAX_ATTEMPTS; attempt += 1) {
			const afterAttachments = await this.getProjectAttachments(targetProjectId)
			const copiedFiles = this.matchCopiedProjectFiles({
				pendingItems,
				beforeAttachments,
				afterAttachments,
			})

			if (copiedFiles.length >= sourceIds.size) return copiedFiles
			await this.sleep(BATCH_OPERATION_POLL_INTERVAL)
		}

		throw new Error("Copied project files were not found in target project")
	}

	private matchCopiedProjectFiles({
		pendingItems,
		beforeAttachments,
		afterAttachments,
	}: {
		pendingItems: MentionListItem[]
		beforeAttachments: AttachmentItem[]
		afterAttachments: AttachmentItem[]
	}): CopiedProjectReferenceMentionData[] {
		const beforeFileIds = new Set(
			beforeAttachments
				.map((item) => item.file_id)
				.filter((fileId): fileId is string => Boolean(fileId)),
		)
		const copiedCandidates = afterAttachments.filter(
			(item) => item.file_id && !beforeFileIds.has(item.file_id),
		)
		const usedFileIds = new Set<string>()
		const copiedFiles: CopiedProjectReferenceMentionData[] = []

		for (const item of pendingItems) {
			const data = item.attrs.data as ProjectFileMentionData | DirectoryMentionData
			const sourceId = getProjectReferenceSourceId(item.attrs)
			if (!sourceId || copiedFiles.some((file) => file.sourceId === sourceId)) continue

			const copiedFile = copiedCandidates.find((candidate) => {
				if (!candidate.file_id || usedFileIds.has(candidate.file_id)) return false
				return this.isCopiedAttachmentMatch(candidate, data)
			})

			if (!copiedFile?.file_id) continue

			usedFileIds.add(copiedFile.file_id)
			copiedFiles.push({
				sourceId,
				attrs: this.convertAttachmentToProjectReferenceAttrs(copiedFile, item.attrs),
			})
		}

		return copiedFiles
	}

	private isCopiedAttachmentMatch(
		attachment: AttachmentItem,
		sourceData: ProjectFileMentionData | DirectoryMentionData,
	): boolean {
		const attachmentName = attachment.file_name ?? attachment.name ?? attachment.filename ?? ""
		const attachmentPath =
			attachment.relative_file_path ?? attachment.file_key ?? attachment.path ?? ""
		const isDirectory = "directory_id" in sourceData
		const sourceName = isDirectory ? sourceData.directory_name : sourceData.file_name
		const sourcePath = isDirectory ? sourceData.directory_path : sourceData.file_path
		const normalizedAttachmentPath = this.normalizeMentionPath(attachmentPath)
		const normalizedSourcePath = this.normalizeMentionPath(sourcePath)

		if (
			attachmentName &&
			sourceName &&
			attachmentName !== sourceName &&
			!this.isFileNameVariant(attachmentName, sourceName)
		) {
			return false
		}

		const attachmentSize = Number(attachment.file_size ?? 0)
		if (
			!isDirectory &&
			sourceData.file_size &&
			attachmentSize &&
			attachmentSize !== sourceData.file_size
		)
			return false

		if (isDirectory)
			return this.isCopiedDirectoryPathMatch({
				attachmentName,
				sourceName,
				attachmentPath: normalizedAttachmentPath,
				sourcePath: normalizedSourcePath,
			})

		return this.isCopiedFilePathMatch({
			attachmentName,
			sourceName,
			attachmentPath: normalizedAttachmentPath,
			sourcePath: normalizedSourcePath,
		})
	}

	private isCopiedDirectoryPathMatch({
		attachmentName,
		sourceName,
		attachmentPath,
		sourcePath,
	}: {
		attachmentName: string
		sourceName: string
		attachmentPath: string
		sourcePath: string
	}): boolean {
		if (!sourcePath || !attachmentPath) return true
		if (attachmentPath === sourcePath) return true
		if (this.isPathSuffixBySegments(attachmentPath, sourcePath)) return true

		const attachmentBaseName = this.getPathBaseName(attachmentPath)
		const sourceBaseName = this.getPathBaseName(sourcePath) || sourceName
		if (attachmentBaseName === sourceBaseName) return true
		if (!attachmentName || !sourceBaseName) return false

		return this.isFileNameVariant(attachmentBaseName || attachmentName, sourceBaseName)
	}

	private isCopiedFilePathMatch({
		attachmentName,
		sourceName,
		attachmentPath,
		sourcePath,
	}: {
		attachmentName: string
		sourceName: string
		attachmentPath: string
		sourcePath: string
	}): boolean {
		if (!sourcePath || !attachmentPath) return true
		if (attachmentPath === sourcePath) return true
		if (this.isPathSuffixBySegments(attachmentPath, sourcePath)) return true

		const attachmentBaseName = this.getPathBaseName(attachmentPath)
		return (
			attachmentBaseName === sourceName ||
			Boolean(attachmentName && attachmentBaseName === attachmentName)
		)
	}

	private isFileNameVariant(fileName: string, sourceName: string): boolean {
		const extension = sourceName.includes(".") ? `.${sourceName.split(".").pop()}` : ""
		const baseName = extension ? sourceName.slice(0, -extension.length) : sourceName

		if (!fileName.startsWith(baseName)) return false
		if (!extension) return this.isCopyNameVariant(fileName, baseName)
		if (!fileName.endsWith(extension)) return false

		const fileBaseName = fileName.slice(0, -extension.length)
		return this.isCopyNameVariant(fileBaseName, baseName)
	}

	private isCopyNameVariant(fileName: string, baseName: string): boolean {
		const suffix = fileName.slice(baseName.length).trim()
		if (!suffix) return true

		return /^(?:[\s_-]*[（(]\d+[）)]|[\s_-]+\d+|[\s_-]+copy(?:\s+\d+)?|[\s_-]+副本(?:\s+\d+)?)$/i.test(
			suffix,
		)
	}

	private normalizeMentionPath(path?: string): string {
		return (path ?? "")
			.trim()
			.replace(/\\/g, "/")
			.replace(/\/+/g, "/")
			.replace(/^\/+|\/+$/g, "")
	}

	private getPathBaseName(path: string): string {
		const segments = this.normalizeMentionPath(path).split("/").filter(Boolean)
		return segments.at(-1) ?? ""
	}

	private isPathSuffixBySegments(path: string, suffixPath: string): boolean {
		const pathSegments = this.normalizeMentionPath(path).split("/").filter(Boolean)
		const suffixSegments = this.normalizeMentionPath(suffixPath).split("/").filter(Boolean)

		if (suffixSegments.length === 0) return false
		if (suffixSegments.length > pathSegments.length) return false

		return suffixSegments.every((segment, index) => {
			const pathIndex = pathSegments.length - suffixSegments.length + index
			return pathSegments[pathIndex] === segment
		})
	}

	private resolvePendingReferenceAttrs(attrs: TiptapMentionAttributes): TiptapMentionAttributes {
		if (attrs.type === MentionItemType.FOLDER) {
			const data = attrs.data as DirectoryMentionData
			return {
				type: MentionItemType.FOLDER,
				data: {
					directory_id: data.source_directory_id || data.directory_id,
					directory_name: data.directory_name,
					directory_path: data.directory_path,
					directory_metadata: data.directory_metadata,
				},
			}
		}

		const data = attrs.data as ProjectFileMentionData
		return {
			type: MentionItemType.PROJECT_FILE,
			data: {
				file_id: data.source_file_id || data.file_id,
				file_name: data.file_name,
				file_path: data.file_path,
				file_extension: data.file_extension,
				file_size: data.file_size,
			},
		}
	}

	private convertAttachmentToProjectReferenceAttrs(
		attachment: AttachmentItem,
		fallbackAttrs: TiptapMentionAttributes,
	): TiptapMentionAttributes {
		if (fallbackAttrs.type === MentionItemType.FOLDER) {
			const fallback = fallbackAttrs.data as DirectoryMentionData
			return {
				type: MentionItemType.FOLDER,
				data: {
					directory_id: attachment.file_id || "",
					directory_name:
						attachment.file_name ??
						attachment.name ??
						attachment.filename ??
						fallback.directory_name,
					directory_path:
						attachment.relative_file_path ??
						attachment.file_key ??
						attachment.path ??
						fallback.directory_path,
					directory_metadata: fallback.directory_metadata,
				},
			}
		}

		const fallback = fallbackAttrs.data as ProjectFileMentionData
		return {
			type: MentionItemType.PROJECT_FILE,
			data: {
				file_id: attachment.file_id || "",
				file_name:
					attachment.file_name ??
					attachment.name ??
					attachment.filename ??
					fallback.file_name,
				file_path:
					attachment.relative_file_path ??
					attachment.file_key ??
					attachment.path ??
					fallback.file_path,
				file_extension: attachment.file_extension ?? fallback.file_extension,
				file_size: attachment.file_size ?? fallback.file_size,
			},
		}
	}

	private async getProjectAttachments(projectId: string): Promise<AttachmentItem[]> {
		const result = await SuperMagicApi.getAttachmentsByProjectId({
			projectId,
			temporaryToken: "",
		})
		return result.list ?? []
	}

	private sleep(ms: number): Promise<void> {
		return new Promise((resolve) => {
			globalThis.setTimeout(resolve, ms)
		})
	}

	/**
	 * Save temporary files to project
	 * @param tempFileItems - Array of temporary file mention items
	 * @param projectId - Target project ID
	 * @param topicId - Target topic ID (optional)
	 * @returns Promise resolving to save results
	 */
	private async saveTempFilesToProject(
		tempFileItems: MentionListItem[],
		projectId: string,
		topicId?: string,
	): Promise<FileData["saveResult"][]> {
		const uploadFilesData = getUploadFileMentionData(tempFileItems)

		if (uploadFilesData.length === 0) {
			return []
		}

		return await superMagicUploadTokenService.saveTempFilesToProject(
			uploadFilesData,
			projectId,
			topicId,
		)
	}

	/**
	 * Check if mention items contain upload files
	 * @param mentionItems - Array of mention items to check
	 * @returns Boolean indicating if upload files are present
	 */
	hasUploadFiles(mentionItems: MentionListItem[]): boolean {
		return mentionItems.some((item) => item.attrs.type === MentionItemType.UPLOAD_FILE)
	}

	/**
	 * Get statistics about mention items
	 * @param mentionItems - Array of mention items to analyze
	 * @returns Statistics object
	 */
	getStatistics(mentionItems: MentionListItem[]): MentionItemsStatistics {
		const stats = {
			total: mentionItems.length,
			uploadFiles: 0,
			projectFiles: 0,
			other: 0,
		}

		mentionItems.forEach((item) => {
			switch (item.attrs.type) {
				case MentionItemType.UPLOAD_FILE:
					stats.uploadFiles++
					break
				case MentionItemType.PROJECT_FILE:
					stats.projectFiles++
					break
				default:
					stats.other++
					break
			}
		})

		return stats
	}

	/**
	 * Validate project and topic for processing
	 * @param projectId - Project ID to validate
	 * @param topicId - Topic ID to validate (optional)
	 * @returns Boolean indicating if validation passed
	 */
	validateProjectAndTopic(projectId?: string, topicId?: string): boolean {
		if (!projectId) {
			console.error("Project ID is required for processing mention items")
			return false
		}

		// Topic ID is optional, but if provided, should not be empty
		if (topicId !== undefined && topicId.trim() === "") {
			console.error("Topic ID cannot be empty when provided")
			return false
		}

		return true
	}
}

// Export singleton instance
export const mentionItemsProcessor = new MentionItemsProcessor()
