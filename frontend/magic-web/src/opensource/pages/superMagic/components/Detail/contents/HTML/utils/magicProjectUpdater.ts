import { SuperMagicApi } from "@/opensource/apis"
import { flattenAttachments, findMatchingFile } from "./index"
import { getFileContentById } from "@/opensource/pages/superMagic/utils/api"
import { logger } from "@/opensource/utils/log"
import { t } from "i18next"
import { AttachmentItem } from "../../../../TopicFilesButton/hooks/types"

const pptLogger = logger.createLogger("PPTSlideOperations")

/**
 * magic.project.js file information
 */
export interface MagicProjectJsFileInfo {
	fileId: string
	content: string
}

/**
 * Slide item in the slides array
 */
export interface SlideItem {
	id: string
	path: string
	index: number
}

/**
 * Find magic.project.js file in the same directory as the HTML file
 */
export async function findMagicProjectJsFile(params: {
	attachments: any[]
	currentFileId: string
	currentFileName: string
}): Promise<MagicProjectJsFileInfo | null> {
	const { attachments, currentFileId, currentFileName } = params

	if (!attachments || !currentFileId) {
		return null
	}

	try {
		const allFiles = flattenAttachments(attachments)

		// Find the current file
		const currentFile = allFiles.find((file: any) => file.file_id === currentFileId)
		if (!currentFile) {
			console.error("findMagicProjectJsFile: Current file not found")
			return null
		}

		// Get the folder path from the current file's relative path
		let fileRelativeFolderPath = "/"
		if (currentFile.relative_file_path) {
			const lastSlashIndex = currentFile.relative_file_path.lastIndexOf("/")
			if (lastSlashIndex !== -1) {
				fileRelativeFolderPath = currentFile.relative_file_path.substring(
					0,
					lastSlashIndex + 1,
				)
			}
		}

		// Construct target path: folderPath + magic.project.js
		const targetPath = fileRelativeFolderPath + "magic.project.js"

		// Method 1: If current file is directory, use parent_id relationship
		let magicProjectJsFile: any | undefined
		if (currentFile.is_directory) {
			const currentDirectoryId = currentFile.file_id
			magicProjectJsFile = allFiles.find(
				(file: any) =>
					file.file_name === "magic.project.js" && file.parent_id === currentDirectoryId,
			)
		}

		// Method 2: Strict path matching
		if (!magicProjectJsFile) {
			magicProjectJsFile = allFiles.find(
				(file: any) =>
					file.file_name === "magic.project.js" && file.relative_file_path === targetPath,
			)
		}

		// Method 3: Fallback using findMatchingFile
		if (!magicProjectJsFile) {
			magicProjectJsFile = findMatchingFile({
				path: "./magic.project.js",
				allFiles: allFiles,
				htmlRelativeFolderPath: fileRelativeFolderPath,
			})
		}

		if (!magicProjectJsFile) {
			console.error("findMagicProjectJsFile: magic.project.js file not found", {
				targetPath,
				currentFileId,
			})
			return null
		}

		// Load file content
		const content = await loadMagicProjectJsContent(magicProjectJsFile.file_id)

		return {
			fileId: magicProjectJsFile.file_id,
			content,
		}
	} catch (error) {
		console.error("Failed to load magic.project.js file:", error)
		return null
	}
}

/**
 * Load magic.project.js file content
 */
async function loadMagicProjectJsContent(fileId: string): Promise<string> {
	try {
		const content = await getFileContentById(fileId, {
			responseType: "text",
		})

		if (!content || (typeof content === "string" && content.trim().length === 0)) {
			throw new Error("File content is empty")
		}

		return content as string
	} catch (error) {
		console.error("Failed to load magic.project.js content:", error)
		throw error
	}
}

/**
 * Parse magic.project.js content to extract slides array
 */
export function parseMagicProjectJs(content: string): { slides: string[]; config: any } | null {
	if (!content) {
		return null
	}

	try {
		// Create a temporary window object with mock magicProjectConfigure function
		const tempWindow: { magicProjectConfig?: any; magicProjectConfigure?: any } = {
			magicProjectConfigure: () => {
				// Mock function to prevent execution errors
			},
		}

		// Use Function constructor to execute the code
		const func = new Function("window", content)
		func(tempWindow)

		// Extract magicProjectConfig
		const config = tempWindow.magicProjectConfig

		if (!config || typeof config !== "object") {
			return null
		}

		// Extract slides array from config
		const slides = config.slides || []

		return { slides, config }
	} catch (error) {
		console.error("Failed to parse magic.project.js content:", error)
		return null
	}
}

/**
 * Generate updated magic.project.js content with new slides order
 */
export function generateUpdatedMagicProjectJs(config: any, newSlidesOrder: string[]): string {
	// Update slides array in config
	const updatedConfig = {
		...config,
		slides: newSlidesOrder,
	}

	// Generate formatted JavaScript content
	const jsonString = JSON.stringify(updatedConfig, null, 4)
	return `window.magicProjectConfig = ${jsonString};\n\nwindow.magicProjectConfigure(window.magicProjectConfig);`
}

/**
 * Update slides order in magic.project.js file
 */
export async function updateSlidesOrder(params: {
	fileId: string
	newSlidesOrder: string[]
}): Promise<void> {
	const { fileId, newSlidesOrder } = params

	try {
		// Load current content
		const content = await loadMagicProjectJsContent(fileId)

		// Parse content
		const parsed = parseMagicProjectJs(content)
		if (!parsed) {
			throw new Error("Failed to parse magic.project.js content")
		}

		// Generate updated content
		const updatedContent = generateUpdatedMagicProjectJs(parsed.config, newSlidesOrder)

		// Save to server
		await SuperMagicApi.saveFileContent([
			{
				file_id: fileId,
				content: updatedContent,
				enable_shadow: true,
			},
		])
	} catch (error) {
		console.error("Failed to update slides order:", error)
		throw error
	}
}

/**
 * Blank slide HTML template
 */
const BLANK_SLIDE_TEMPLATE = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>New Slide</title>
    <style>
        body {
            margin: 0;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            background: #ffffff;
        }
        .slide-content {
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
        }
    </style>
</head>
<body>
    <div class="slide-content">
        <h1>New Slide</h1>
    </div>
</body>
</html>`

/**
 * Generate blank slide content
 */
export function generateBlankSlideContent({ slideTitle }: { slideTitle?: string }): string {
	const _slideTitle = slideTitle || t("fileViewer.newSlideFileName", { ns: "super" })
	return BLANK_SLIDE_TEMPLATE.replace(/New Slide/g, _slideTitle)
}

/**
 * Insert a new slide at the specified position
 */
export async function insertSlide(params: {
	projectId: string
	parentId?: string
	position: number
	direction: "before" | "after"
	currentSlides: string[]
	magicProjectFileId: string
	attachments?: any[]
}): Promise<{
	newFilePath: string
	newSlides: string[]
	newFileId: string
	insertIndex: number
	newFile: AttachmentItem
}> {
	const {
		projectId,
		parentId,
		position,
		direction,
		currentSlides,
		magicProjectFileId,
		attachments,
	} = params

	// Log operation start
	pptLogger.log("Starting insert slide operation", {
		operation: "insertSlide",
		position,
		direction,
		magicProjectFileId,
	})

	try {
		// Determine the correct parent_id for the new slide
		// The slide should be created in the same directory as magic.project.js
		let correctParentId = parentId

		if (attachments && magicProjectFileId) {
			const allFiles = flattenAttachments(attachments)
			const magicProjectFile = allFiles.find(
				(file: any) => file.file_id === magicProjectFileId,
			)

			if (magicProjectFile) {
				// Use the parent_id of magic.project.js file as the parent for new slides
				correctParentId = magicProjectFile.parent_id
			}
		}

		// Validate that we have a valid parent_id
		// Use a specific error code that can be mapped to i18n message
		if (!correctParentId) {
			const error = new Error("Invalid PPT folder structure")
			;(error as { code?: string }).code = "INVALID_FOLDER_STRUCTURE"

			// Log error with context
			pptLogger.error("Failed to determine parent directory for new slide", error, {
				operation: "insertSlide",
				metadata: {
					projectId,
					magicProjectFileId,
					hadAttachments: !!attachments,
					attachmentsCount: attachments?.length || 0,
					fallbackParentId: parentId,
				},
			})

			throw error
		}

		// Generate unique filename with incremental number
		const baseFileName = t("fileViewer.newSlideFileName", { ns: "super" })
		// Match files like "新建幻灯片 1.html" or "Slide 1.html" (base name + space + number)
		const pattern = new RegExp(
			`${baseFileName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} (\\d+)\\.html$`,
		)

		// Check existing numbers from currentSlides (magic.project.js)
		const existingNumbers = currentSlides
			.map((slide) => {
				const match = slide.match(pattern)
				return match ? parseInt(match[1], 10) : 0
			})
			.filter((num) => num > 0)

		// Also check existing files in attachments to avoid conflicts
		if (attachments) {
			const allFiles = flattenAttachments(attachments)
			allFiles.forEach((file: any) => {
				if (file.file_name) {
					const match = file.file_name.match(pattern)
					if (match) {
						const num = parseInt(match[1], 10)
						if (num > 0 && !existingNumbers.includes(num)) {
							existingNumbers.push(num)
						}
					}
				}
			})
		}

		const nextNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) + 1 : 1
		const fileName = `${baseFileName} ${nextNumber}.html`

		// Create new file with the correct parent_id
		const newFile = await SuperMagicApi.createFile({
			project_id: projectId,
			parent_id: correctParentId,
			file_name: fileName,
			is_directory: false,
		})

		if (!newFile || !newFile.file_id) {
			const error = new Error("Failed to create new slide file")

			// Log error with context
			pptLogger.error("Failed to create slide file", error, {
				operation: "insertSlide",
				metadata: {
					projectId,
					parentId: correctParentId,
					fileName,
				},
			})

			throw error
		}

		// Save blank content to the new file
		const blankContent = generateBlankSlideContent({
			slideTitle: fileName.replace(".html", ""),
		})
		await SuperMagicApi.saveFileContent([
			{
				file_id: newFile.file_id,
				content: blankContent,
				enable_shadow: true,
			},
		])

		// Calculate insertion index
		const insertIndex = direction === "before" ? position : position + 1

		// Insert the new file path into slides array
		const newFilePath = fileName
		const newSlides = [...currentSlides]
		newSlides.splice(insertIndex, 0, newFilePath)

		// Update magic.project.js
		await updateSlidesOrder({
			fileId: magicProjectFileId,
			newSlidesOrder: newSlides,
		})

		// Log success
		pptLogger.log("Successfully inserted slide", {
			operation: "insertSlide",
			metadata: {
				newFilePath,
				insertIndex,
				newFileId: newFile.file_id,
				totalSlides: newSlides.length,
			},
		})

		return { newFilePath, newSlides, newFileId: newFile.file_id, insertIndex, newFile }
	} catch (error) {
		// Log error with full context
		pptLogger.error("Insert slide operation failed", error, {
			operation: "insertSlide",
			metadata: {
				projectId,
				position,
				direction,
				currentSlidesCount: currentSlides.length,
				magicProjectFileId,
			},
		})
		throw error
	}
}

/**
 * Delete a slide by path (more reliable than index-based deletion)
 */
export async function deleteSlide(params: {
	slidePath: string
	currentSlides: string[]
	magicProjectFileId: string
	minSlidesCount?: number
}): Promise<string[]> {
	const { slidePath, currentSlides, magicProjectFileId, minSlidesCount = 1 } = params

	try {
		// Validate minimum slides count
		if (currentSlides.length <= minSlidesCount) {
			throw new Error("Cannot delete the last slide")
		}

		// Find slide by path
		const slideIndex = currentSlides.findIndex((path) => path === slidePath)
		if (slideIndex === -1) {
			throw new Error("Slide not found")
		}

		// Remove slide from array
		const newSlides = currentSlides.filter((path) => path !== slidePath)

		// Update magic.project.js
		await updateSlidesOrder({
			fileId: magicProjectFileId,
			newSlidesOrder: newSlides,
		})

		return newSlides
	} catch (error) {
		console.error("Failed to delete slide:", error)
		throw error
	}
}

/**
 * Rename a slide by path (more reliable than index-based rename)
 */
export async function renameSlide(params: {
	oldPath: string
	newFileName: string
	currentSlides: string[]
	magicProjectFileId: string
	fileId: string
}): Promise<{ newFilePath: string; newSlides: string[] }> {
	const { oldPath, newFileName, currentSlides, magicProjectFileId, fileId } = params

	try {
		// Find slide by path
		const slideIndex = currentSlides.findIndex((path) => path === oldPath)
		if (slideIndex === -1) {
			throw new Error("Slide not found")
		}

		// Ensure the file name ends with .html
		const fileName = newFileName.endsWith(".html") ? newFileName : `${newFileName}.html`

		// Rename the file via API
		await SuperMagicApi.renameFile({
			file_id: fileId,
			target_name: fileName,
		})

		// Update the path in slides array
		const newFilePath = `./${fileName}`
		const newSlides = currentSlides.map((path) => (path === oldPath ? newFilePath : path))

		// Update magic.project.js with new slides order
		await updateSlidesOrder({
			fileId: magicProjectFileId,
			newSlidesOrder: newSlides,
		})

		return { newFilePath, newSlides }
	} catch (error) {
		console.error("Failed to rename slide:", error)
		throw error
	}
}
