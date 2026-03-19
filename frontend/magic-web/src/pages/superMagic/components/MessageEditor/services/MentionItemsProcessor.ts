import { MentionListItem } from "@/components/business/MentionPanel/tiptap-plugin/types"
import {
	MentionItemType,
	UploadFileMentionData,
} from "@/components/business/MentionPanel/types"
import { FileData } from "../types"
import {
	filterUploadFileMentions,
	getUploadFileMentionData,
	transformMentionItemsToProjectFiles,
	validateMentionItems,
} from "../utils/mention"
import { superMagicUploadTokenService } from "./UploadTokenService"
import { MentionItemsStatistics } from "./types"
import { JSONContent } from "@tiptap/core"

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

		// Clone the items to avoid mutating the original array
		const processedItems = [...mentionItems]

		// Find temporary files that need to be saved
		const tempFiles = filterUploadFileMentions(processedItems)

		if (tempFiles.length === 0) {
			return { mentionItems: processedItems, content }
		}

		// Validate temporary files
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

		try {
			// Save temporary files to project
			const saveResults = await this.saveTempFilesToProject(validItems, projectId, topicId)

			// Transform upload file mentions to project file mentions
			const transformedResult = transformMentionItemsToProjectFiles(
				content,
				processedItems,
				saveResults,
			)

			console.log(`Successfully processed ${validItems.length} upload files to project files`)

			return transformedResult
		} catch (error) {
			console.error("Failed to process mention items:", error)
			throw new Error(
				`Failed to process mention items: ${error instanceof Error ? error.message : String(error)
				}`,
			)
		}
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

		console.log(`Saving ${uploadFilesData.length} temporary files to project ${projectId}`)

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
