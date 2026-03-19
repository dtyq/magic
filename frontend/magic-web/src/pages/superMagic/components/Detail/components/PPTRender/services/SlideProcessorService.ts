import {
	processHtmlContent,
	collectFileIdsFromHtml,
} from "@/pages/superMagic/components/Detail/contents/HTML/htmlProcessor"
import type {
	ProcessHtmlContentInput,
	ProcessHtmlContentOutput,
} from "@/pages/superMagic/components/Detail/contents/HTML/htmlProcessor"

/**
 * Configuration for processing slides
 */
export interface SlideProcessorConfig {
	attachments?: any[]
	attachmentList?: any[]
	mainFileId?: string
	mainFileName?: string
	metadata?: any
}

/**
 * SlideProcessorService - Responsible for processing HTML content
 * Pure service layer without state management
 */
export class SlideProcessorService {
	private config: SlideProcessorConfig

	constructor(config: SlideProcessorConfig) {
		this.config = config
	}

	/**
	 * Process raw HTML content for a slide
	 * @param content - Raw HTML string
	 * @param slideIndex - Index of the slide
	 * @param relativeFilePath - Relative file path for the slide
	 * @returns Processed HTML string
	 */
	async processSlide(
		content: string,
		slideIndex: number,
		relativeFilePath?: string,
	): Promise<string> {
		if (!content) {
			return ""
		}

		try {
			const input: ProcessHtmlContentInput = {
				content,
				attachments: this.config.attachments,
				fileId: this.config.mainFileId,
				fileName: this.config.mainFileName || `slide_${slideIndex}.html`,
				attachmentList: this.config.attachmentList,
				html_relative_path: relativeFilePath,
				// metadata: this.config.metadata,
			}

			const result: ProcessHtmlContentOutput = await processHtmlContent(input)
			return result.processedContent
		} catch (error) {
			console.error(`Failed to process slide at index ${slideIndex}:`, error)
			return content // Return original content on error
		}
	}

	/**
	 * Collect file IDs needed for a slide (without fetching URLs)
	 * Used for batch processing to collect all file IDs first
	 * @param content - Raw HTML string
	 * @param slideIndex - Index of the slide
	 * @param relativeFilePath - Relative file path for the slide
	 * @returns Set of file IDs needed
	 */
	collectFileIds(content: string, slideIndex: number, relativeFilePath?: string): Set<string> {
		if (!content) {
			return new Set()
		}

		try {
			const input: ProcessHtmlContentInput = {
				content,
				attachments: this.config.attachments,
				fileId: this.config.mainFileId,
				fileName: this.config.mainFileName || `slide_${slideIndex}.html`,
				attachmentList: this.config.attachmentList,
				html_relative_path: relativeFilePath,
				metadata: this.config.metadata,
			}

			return collectFileIdsFromHtml(input)
		} catch (error) {
			console.error(`Failed to collect file IDs for slide ${slideIndex}:`, error)
			return new Set()
		}
	}

	/**
	 * Process slide with pre-fetched URL mapping (for batch processing)
	 * @param content - Raw HTML string
	 * @param slideIndex - Index of the slide
	 * @param relativeFilePath - Relative file path for the slide
	 * @param urlMapping - Pre-fetched fileId -> url mapping
	 * @returns Processed HTML string
	 */
	async processSlideWithUrlMapping(
		content: string,
		slideIndex: number,
		relativeFilePath: string | undefined,
		urlMapping: Map<string, string>,
	): Promise<string> {
		if (!content) {
			return ""
		}

		try {
			const input: ProcessHtmlContentInput = {
				content,
				attachments: this.config.attachments,
				fileId: this.config.mainFileId,
				fileName: this.config.mainFileName || `slide_${slideIndex}.html`,
				attachmentList: this.config.attachmentList,
				html_relative_path: relativeFilePath,
				metadata: this.config.metadata,
				preloadedUrlMapping: urlMapping, // Pass the pre-fetched URL mapping
			}

			const result: ProcessHtmlContentOutput = await processHtmlContent(input)
			return result.processedContent
		} catch (error) {
			console.error(`Failed to process slide at index ${slideIndex}:`, error)
			return content // Return original content on error
		}
	}

	/**
	 * Update processor configuration
	 * @param config - New configuration
	 */
	updateConfig(config: Partial<SlideProcessorConfig>): void {
		this.config = { ...this.config, ...config }
	}
}
