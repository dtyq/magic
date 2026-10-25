import { MagicFSApi, SuperMagicApi } from "@/apis"
import { flattenAttachments } from "./index"
import { parseMagicProjectConfigContent } from "@/pages/superMagic/utils/magicProjectConfigParser"
import { reconcilePPTTransitions } from "../../../components/PPTRender/utils/pptTransitions"
import { createFileApi, type FileApi } from "@/pages/superMagic/fileAccess/fileApi"
import {
	createSessionFileAccess,
	isSharePageLocation,
} from "@/pages/superMagic/fileAccess/fileAccessContext"
import {
	createPPTFileMutationClient,
	PPTFileMutationError,
} from "../../../components/PPTRender/services/pptFileMutation"
import { logger } from "@/infrastructure/logger"
import { t } from "i18next"
import { AttachmentItem } from "../../../../TopicFilesButton/hooks/types"
export { findMagicProjectJsFile } from "./magicProjectFileFinder"
export type { MagicProjectJsFileInfo } from "./magicProjectFileFinder"

const pptLogger = logger.createLogger("PPTSlideOperations")

interface SlideMutationAccess {
	fileApi?: FileApi
	isCurrent?: () => boolean
}

function getMutationAccess(options: SlideMutationAccess, projectId?: string) {
	const fileApi = options.fileApi ?? createFileApi(createSessionFileAccess({ projectId }))
	const isCurrent = options.isCurrent ?? (() => !isSharePageLocation())
	return { fileApi, isCurrent }
}

function assertMutationAccess({ fileApi, isCurrent }: ReturnType<typeof getMutationAccess>) {
	if (!fileApi.identityKey.startsWith("session:") || !isCurrent())
		throw new PPTFileMutationError("stale")
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
 * Parse magic.project.js content to extract slides array
 */
export function parseMagicProjectJs(content: string): { slides: string[]; config: any } | null {
	if (!content) {
		return null
	}

	const config = parseMagicProjectConfigContent(content)
	if (!config) {
		return null
	}

	const slides = Array.isArray(config.slides)
		? config.slides.filter((slide): slide is string => typeof slide === "string")
		: []

	return { slides, config }
}

/**
 * Generate updated magic.project.js content with new slides order
 */
export function generateUpdatedMagicProjectJs(config: any, newSlidesOrder: string[]): string {
	if (
		config.hidden_slides !== undefined &&
		(!Array.isArray(config.hidden_slides) ||
			config.hidden_slides.some((path: unknown) => typeof path !== "string"))
	)
		throw new Error("Invalid hidden slide configuration")
	// Update slides array in config
	const updatedConfig = {
		...config,
		slides: newSlidesOrder,
		...(config.transitions !== undefined
			? { transitions: reconcilePPTTransitions(config.transitions, newSlidesOrder) }
			: {}),
		...(config.hidden_slides !== undefined
			? {
					hidden_slides: config.hidden_slides.filter((path: string) =>
						newSlidesOrder.includes(path),
					),
				}
			: {}),
	}

	// Generate formatted JavaScript content
	const jsonString = JSON.stringify(updatedConfig, null, 4)
	return `window.magicProjectConfig = ${jsonString};\n\nwindow.magicProjectConfigure(window.magicProjectConfig);`
}

/**
 * Update slides order in magic.project.js file
 */
export async function updateSlidesOrder(
	params: SlideMutationAccess & {
		fileId: string
		newSlidesOrder: string[]
		expectedSlides?: string[]
		renamePath?: { from: string; to: string }
		duplicatePath?: { from: string; to: string }
	},
): Promise<void> {
	const { fileId, newSlidesOrder, expectedSlides, renamePath, duplicatePath } = params

	try {
		// Load current content
		const access = getMutationAccess(params)
		const client = createPPTFileMutationClient(access.fileApi, { isCurrent: access.isCurrent })
		const snapshot = await client.read(fileId)

		// Parse content
		const parsed = parseMagicProjectJs(snapshot.content)
		if (!parsed) {
			throw new Error("Failed to parse magic.project.js content")
		}
		if (
			!Array.isArray(parsed.config.slides) ||
			parsed.config.slides.some((path: unknown) => typeof path !== "string")
		)
			throw new Error("Invalid slide configuration")
		if (
			expectedSlides &&
			(expectedSlides.length !== parsed.slides.length ||
				expectedSlides.some((path, index) => path !== parsed.slides[index]))
		)
			throw new PPTFileMutationError("conflict")
		if (Array.isArray(parsed.config.hidden_slides)) {
			if (renamePath)
				parsed.config.hidden_slides = parsed.config.hidden_slides.map((path: string) =>
					path === renamePath.from ? renamePath.to : path,
				)
			if (duplicatePath && parsed.config.hidden_slides.includes(duplicatePath.from))
				parsed.config.hidden_slides = [...parsed.config.hidden_slides, duplicatePath.to]
		}
		if (parsed.config.transitions !== undefined) {
			parsed.config.transitions = reconcilePPTTransitions(
				parsed.config.transitions,
				newSlidesOrder,
				{
					renamePath,
					duplicatePath,
				},
			)
		}

		// Generate updated content
		const updatedContent = generateUpdatedMagicProjectJs(parsed.config, newSlidesOrder)

		// Save to server
		await client.save(snapshot, updatedContent)
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

function getFileName(path: string): string {
	return path.split("/").pop() || path
}

function getDuplicateFileName(
	sourcePath: string,
	currentSlides: string[],
	attachments?: AttachmentItem[],
) {
	const sourceFileName = getFileName(sourcePath)
	const extensionMatch = sourceFileName.match(/(\.html?)$/i)
	const extension = extensionMatch?.[1] || ".html"
	const baseName = sourceFileName.slice(0, sourceFileName.length - extension.length)
	const directory = sourcePath.slice(0, sourcePath.length - sourceFileName.length)
	const usedNames = new Set(currentSlides.map(getFileName))

	const collectAttachmentNames = (items: AttachmentItem[]) => {
		for (const attachment of items) {
			if (attachment.children?.length) {
				collectAttachmentNames(attachment.children)
				continue
			}
			if (!attachment.file_name) continue
			const attachmentPath = attachment.relative_file_path || attachment.file_name
			const isSameDirectory = directory
				? attachmentPath.endsWith(`${directory}${attachment.file_name}`)
				: !attachmentPath.includes("/")
			if (isSameDirectory) usedNames.add(attachment.file_name)
		}
	}
	collectAttachmentNames(attachments || [])

	let suffix = 1
	let fileName = `${baseName} (${suffix})${extension}`
	while (usedNames.has(fileName)) {
		suffix += 1
		fileName = `${baseName} (${suffix})${extension}`
	}

	return { fileName, filePath: `${directory}${fileName}` }
}

function findAttachmentById(items: AttachmentItem[], fileId: string): AttachmentItem | undefined {
	for (const item of items) {
		if (item.file_id === fileId) return item
		if (item.children) {
			const match = findAttachmentById(item.children, fileId)
			if (match) return match
		}
	}
	return undefined
}

function resolveSlideParentId({
	parentId,
	magicProjectFileId,
	attachments,
}: {
	parentId?: string
	magicProjectFileId: string
	attachments?: AttachmentItem[]
}) {
	let resolvedParentId = parentId
	if (attachments && magicProjectFileId) {
		const magicProjectFile = findAttachmentById(attachments, magicProjectFileId)
		if (magicProjectFile) resolvedParentId = magicProjectFile.parent_id ?? undefined
	}
	return resolvedParentId
}

/**
 * Insert a new slide at the specified position
 */
export async function insertSlide(
	params: SlideMutationAccess & {
		projectId: string
		parentId?: string
		position: number
		direction: "before" | "after"
		currentSlides: string[]
		magicProjectFileId: string
		attachments?: AttachmentItem[]
	},
): Promise<{
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
	const access = getMutationAccess(params, projectId)

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
		const correctParentId = resolveSlideParentId({
			parentId,
			magicProjectFileId,
			attachments,
		})

		// Validate that we have a valid parent_id
		// Use a specific error code that can be mapped to i18n message
		if (!correctParentId) {
			const error = new Error("Invalid PPT folder structure")
			;(error as { code?: string }).code = "INVALID_FOLDER_STRUCTURE"

			// Log error with context
			pptLogger.error({
				eventKey: "new_slide_parent_directory_resolution_failed",
				errorKind: "unknown",
				error: error,
				message: "Failed to determine parent directory for new slide",
				context: {
					operation: "insertSlide",
					metadata: {
						projectId,
						magicProjectFileId,
						hadAttachments: !!attachments,
						attachmentsCount: attachments?.length || 0,
						fallbackParentId: parentId,
					},
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
		assertMutationAccess(access)
		const newFile = await SuperMagicApi.createFile({
			project_id: projectId,
			parent_id: correctParentId,
			file_name: fileName,
			is_directory: false,
			ignore_duplicate: false,
		})

		if (!newFile || !newFile.file_id) {
			const error = new Error("Failed to create new slide file")

			// Log error with context
			pptLogger.error({
				eventKey: "create_slide_file_failed",
				errorKind: "unknown",
				error: error,
				message: "Failed to create slide file",
				context: {
					operation: "insertSlide",
					metadata: {
						projectId,
						parentId: correctParentId,
						fileName,
					},
				},
			})

			throw error
		}

		// Save blank content to the new file
		const blankContent = generateBlankSlideContent({
			slideTitle: fileName.replace(".html", ""),
		})
		await createPPTFileMutationClient(access.fileApi, {
			isCurrent: access.isCurrent,
		}).initializeCreatedFile(String(newFile.file_id), blankContent)

		// Calculate insertion index
		const insertIndex = direction === "before" ? position : position + 1

		// Insert the new file path into slides array
		const newFilePath = fileName
		const newSlides = [...currentSlides]
		newSlides.splice(insertIndex, 0, newFilePath)

		// Update magic.project.js
		await updateSlidesOrder({
			...access,
			fileId: magicProjectFileId,
			newSlidesOrder: newSlides,
			expectedSlides: currentSlides,
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
		pptLogger.error({
			eventKey: "insert_slide_operation_failed",
			errorKind: "unknown",
			error: error,
			message: "Insert slide operation failed",
			context: {
				operation: "insertSlide",
				metadata: {
					projectId,
					position,
					direction,
					currentSlidesCount: currentSlides.length,
					magicProjectFileId,
				},
			},
		})
		throw error
	}
}

/** Duplicate an existing slide and insert the copy immediately after it. */
export async function duplicateSlide(
	params: SlideMutationAccess & {
		projectId: string
		parentId?: string
		slidePath: string
		position: number
		currentSlides: string[]
		magicProjectFileId: string
		sourceFileId: string
		attachments?: AttachmentItem[]
	},
): Promise<{
	newFilePath: string
	newSlides: string[]
	newFileId: string
	insertIndex: number
	newFile: AttachmentItem
	content: string
}> {
	const {
		projectId,
		slidePath,
		position,
		currentSlides,
		magicProjectFileId,
		sourceFileId,
		attachments,
	} = params
	const access = getMutationAccess(params, projectId)
	assertMutationAccess(access)
	// The source directory is authoritative. The deck manifest can live elsewhere;
	// placing copies beside it would break the HTML's relative asset references.
	const sourceFile = (await MagicFSApi.getFileInfo(sourceFileId)).file
	assertMutationAccess(access)
	if (sourceFile.id !== sourceFileId) throw new PPTFileMutationError("failed")
	const parent = sourceFile.parent_id
	if (!parent) throw new Error("Invalid PPT folder structure")

	const sourceContent = await access.fileApi.getFileContentById(sourceFileId, {
		responseType: "text",
		forceRefresh: true,
	})
	if (typeof sourceContent !== "string") throw new Error("Failed to load source slide")

	const { fileName, filePath } = getDuplicateFileName(slidePath, currentSlides, attachments)
	assertMutationAccess(access)
	const newFile = (await SuperMagicApi.createFile({
		project_id: projectId,
		parent_id: parent,
		file_name: fileName,
		is_directory: false,
		ignore_duplicate: false,
	})) as AttachmentItem
	if (!newFile?.file_id) throw new Error("Failed to create duplicated slide file")

	const insertIndex = Math.min(Math.max(0, position + 1), currentSlides.length)
	const newSlides = [...currentSlides]
	newSlides.splice(insertIndex, 0, filePath)

	try {
		await createPPTFileMutationClient(access.fileApi, {
			isCurrent: access.isCurrent,
		}).initializeCreatedFile(String(newFile.file_id), sourceContent)
		await updateSlidesOrder({
			...access,
			fileId: magicProjectFileId,
			newSlidesOrder: newSlides,
			expectedSlides: currentSlides,
			duplicatePath: { from: slidePath, to: filePath },
		})
		return {
			newFilePath: filePath,
			newSlides,
			newFileId: String(newFile.file_id),
			insertIndex,
			newFile,
			content: sourceContent,
		}
	} catch (error) {
		// An unknown manifest result may already reference this copy. Preserve it;
		// deleting it here could turn a successful insertion into a broken slide.
		throw Object.assign(error instanceof Error ? error : new Error("Slide copy failed"), {
			retainedFileId: String(newFile.file_id),
		})
	}
}

/**
 * Delete a slide by path (more reliable than index-based deletion)
 */
export async function deleteSlide(
	params: SlideMutationAccess & {
		slidePath: string
		currentSlides: string[]
		magicProjectFileId: string
		minSlidesCount?: number
	},
): Promise<string[]> {
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
			...getMutationAccess(params),
			fileId: magicProjectFileId,
			newSlidesOrder: newSlides,
			expectedSlides: currentSlides,
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
export async function renameSlide(
	params: SlideMutationAccess & {
		oldPath: string
		newFileName: string
		currentSlides: string[]
		magicProjectFileId: string
		fileId: string
	},
): Promise<{ newFilePath: string; newSlides: string[] }> {
	const { oldPath, newFileName, currentSlides, magicProjectFileId, fileId } = params
	const access = getMutationAccess(params)

	try {
		// Find slide by path
		const slideIndex = currentSlides.findIndex((path) => path === oldPath)
		if (slideIndex === -1) {
			throw new Error("Slide not found")
		}

		// Ensure the file name ends with .html
		const fileName = newFileName.endsWith(".html") ? newFileName : `${newFileName}.html`
		if (!newFileName.trim() || /[/\\]/.test(fileName))
			throw new Error("Invalid slide file name")
		const client = createPPTFileMutationClient(access.fileApi, { isCurrent: access.isCurrent })
		const snapshot = await client.read(magicProjectFileId)
		const parsed = parseMagicProjectJs(snapshot.content)
		if (
			!parsed ||
			parsed.slides.length !== currentSlides.length ||
			parsed.slides.some((path, index) => path !== currentSlides[index])
		)
			throw new PPTFileMutationError("conflict")

		// Rename the file via API
		assertMutationAccess(access)
		await SuperMagicApi.renameFile({
			file_id: fileId,
			target_name: fileName,
		})

		// Update the path in slides array
		const newFilePath = `${oldPath.slice(0, oldPath.lastIndexOf("/") + 1)}${fileName}`
		const newSlides = currentSlides.map((path) => (path === oldPath ? newFilePath : path))

		// Update magic.project.js with new slides order
		await updateSlidesOrder({
			...access,
			fileId: magicProjectFileId,
			newSlidesOrder: newSlides,
			expectedSlides: currentSlides,
			renamePath: { from: oldPath, to: newFilePath },
		})

		return { newFilePath, newSlides }
	} catch (error) {
		console.error("Failed to rename slide:", error)
		throw error
	}
}
