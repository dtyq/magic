import { MentionListItem } from "@/components/business/MentionPanel/tiptap-plugin/types"
import { FileData } from "../types"

/**
 * Statistics for mention items processing
 */
export interface MentionItemsStatistics {
	/** Total number of mention items */
	total: number
	/** Number of upload file mentions */
	uploadFiles: number
	/** Number of project file mentions */
	projectFiles: number
	/** Number of other mention types */
	other: number
}

/**
 * Validation result for mention items
 */
export interface MentionItemsValidationResult {
	/** Valid mention items that can be processed */
	validItems: MentionListItem[]
	/** Invalid mention items that cannot be processed */
	invalidItems: MentionListItem[]
	/** Whether validation passed (no invalid items) */
	isValid: boolean
	/** Error messages for invalid items */
	errors: string[]
}

/**
 * Processing result for mention items
 */
export interface MentionItemsProcessingResult {
	/** Processed mention items */
	processedItems: MentionListItem[]
	/** Number of items successfully processed */
	processedCount: number
	/** Number of items that failed processing */
	failedCount: number
	/** Processing statistics */
	statistics: MentionItemsStatistics
	/** Any warnings or errors encountered */
	warnings: string[]
}

/**
 * Configuration for mention items processing
 */
export interface MentionItemsProcessingConfig {
	/** Target project ID */
	projectId: string
	/** Target topic ID (optional) */
	topicId?: string
	/** Whether to continue processing if some items fail */
	continueOnError?: boolean
	/** Maximum number of retry attempts for failed items */
	maxRetries?: number
	/** Validation options */
	validation?: {
		/** Whether to validate file paths */
		checkFilePaths?: boolean
		/** Whether to validate file sizes */
		checkFileSizes?: boolean
		/** Maximum allowed file size in bytes */
		maxFileSize?: number
	}
}

/**
 * Options for file saving operations
 */
export interface FileSaveOptions {
	/** Whether to overwrite existing files */
	overwrite?: boolean
	/** Whether to preserve original file names */
	preserveNames?: boolean
	/** Custom file name prefix */
	namePrefix?: string
	/** Custom file name suffix */
	nameSuffix?: string
}

/**
 * Enhanced file data with additional metadata
 */
export interface EnhancedFileData extends FileData {
	/** Processing timestamp */
	processedAt?: Date
	/** Processing status */
	processingStatus?: "pending" | "processing" | "completed" | "failed"
	/** Processing error message */
	processingError?: string
	/** Retry count */
	retryCount?: number
}

/**
 * Type guard to check if a value is a valid MentionListItem
 */
export function isMentionListItem(value: unknown): value is MentionListItem {
	return (
		typeof value === "object" &&
		value !== null &&
		"type" in value &&
		"attrs" in value &&
		(value as any).type === "mention"
	)
}

/**
 * Type guard to check if mention items array is valid
 */
export function isValidMentionItemsArray(value: unknown): value is MentionListItem[] {
	return Array.isArray(value) && value.every(isMentionListItem)
}

/**
 * Type for mention processing error
 */
export interface MentionProcessingError extends Error {
	/** Error code */
	code: string
	/** Additional error details */
	details?: Record<string, unknown>
	/** Original error */
	originalError?: Error
}

/**
 * Create a mention processing error
 */
export function createMentionProcessingError(
	message: string,
	code: string,
	details?: Record<string, unknown>,
	originalError?: Error,
): MentionProcessingError {
	const error = new Error(message) as MentionProcessingError
	error.code = code
	error.details = details
	error.originalError = originalError
	return error
}

/**
 * Common error codes for mention processing
 */
export const MentionProcessingErrorCodes = {
	INVALID_PROJECT_ID: "INVALID_PROJECT_ID",
	INVALID_TOPIC_ID: "INVALID_TOPIC_ID",
	INVALID_MENTION_ITEMS: "INVALID_MENTION_ITEMS",
	FILE_SAVE_FAILED: "FILE_SAVE_FAILED",
	TRANSFORMATION_FAILED: "TRANSFORMATION_FAILED",
	VALIDATION_FAILED: "VALIDATION_FAILED",
	NETWORK_ERROR: "NETWORK_ERROR",
	UNKNOWN_ERROR: "UNKNOWN_ERROR",
} as const

/**
 * Type for mention processing error codes
 */
export type MentionProcessingErrorCode =
	(typeof MentionProcessingErrorCodes)[keyof typeof MentionProcessingErrorCodes]
