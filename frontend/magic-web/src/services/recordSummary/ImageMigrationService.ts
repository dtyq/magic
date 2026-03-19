import type { Editor, JSONContent } from "@tiptap/core"
import type { Node as ProseMirrorNode, Fragment, NodeType } from "@tiptap/pm/model"
import { loadTipTapModules, type TipTapModules } from "@/lib/tiptap"
import { ImageStorageDatabase } from "@/services/tiptap-image-storage"
import { projectImageStorage } from "@/services/tiptap-image-project"
import { logger as Logger } from "@/utils/log"
import { calculateRelativePath } from "@/utils/path"

const logger = Logger.createLogger("ImageMigrationService")

/**
 * Storage image node information with path in document tree
 */
interface StorageImageInfo {
	node: {
		type: "storageImage"
		attrs: {
			id: string
			alt?: string
			width?: number
			height?: number
			align?: string | null
			objectFit?: string | null
		}
	}
	path: number[] // Position in document tree
}

/**
 * Project image node structure
 */
interface ProjectImageNode {
	type: "image"
	attrs: {
		src: string
		width?: number | null
		height?: number | null
		align?: string | null
		objectFit?: string | null
	}
}

/**
 * Image Migration Service
 * Handles conversion of storage images to project images in markdown content
 */
export class ImageMigrationService {
	/**
	 * Main entry point: migrate all storage images in markdown to project images
	 * @param markdownContent - Markdown content to process
	 * @param projectId - Project ID for uploading images
	 * @param documentPath - Current document path (relative to project root) for calculating relative paths
	 */
	async migrateStorageImagesToProject(
		markdownContent: string,
		projectId: string,
		documentPath?: string,
	): Promise<string> {
		if (!markdownContent || !markdownContent.trim()) {
			return markdownContent
		}

		let editor: Editor | null = null

		try {
			// Load TipTap modules on demand
			const tiptapModules = await loadTipTapModules()

			// Create headless TipTap editor instance
			editor = this.createEditor(markdownContent, tiptapModules)

			// Get JSON representation
			const docJSON = editor.getJSON()

			// Find all storageImage nodes
			const storageImages = this.findStorageImageNodes(docJSON)

			if (storageImages.length === 0) {
				logger.log("No storage images found in content")
				return markdownContent
			}

			logger.log(`Found ${storageImages.length} storage image(s) to migrate`)

			// Convert all storage images to project images (parallel)
			const conversionResults = await Promise.all(
				storageImages.map((imageInfo) =>
					this.convertStorageImageNode(imageInfo, projectId, documentPath),
				),
			)

			// Replace nodes in JSON (process in reverse order to maintain paths)
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			let updatedJSON: any = docJSON
			const sortedImages = [...storageImages].reverse()
			const sortedResults = [...conversionResults].reverse()

			for (let i = 0; i < sortedImages.length; i++) {
				const imageInfo = sortedImages[i]
				const projectNode = sortedResults[i]

				if (projectNode) {
					// Successfully converted, replace with project image node
					updatedJSON = this.replaceNodeAtPath(updatedJSON, imageInfo.path, projectNode)
					logger.log(`Migrated storage image ${imageInfo.node.attrs.id} to project`)
				} else {
					// Conversion failed, keep original storage image node
					logger.warn(
						`Failed to migrate storage image ${imageInfo.node.attrs.id}, keeping original`,
					)
				}
			}

			// Update editor content with modified JSON
			editor.commands.setContent(updatedJSON)

			// Convert back to Markdown
			const storage = editor.storage as unknown as { markdown: { getMarkdown: () => string } }
			const resultMarkdown = storage.markdown.getMarkdown()

			return resultMarkdown
		} catch (error) {
			logger.error("Failed to migrate storage images", error)
			// Return original content on error
			return markdownContent
		} finally {
			// Clean up editor instance
			if (editor) {
				editor.destroy()
			}
		}
	}

	/**
	 * Create headless TipTap editor instance for conversion
	 *
	 * Key points:
	 * 1. Image extension is REQUIRED for Markdown parser to have the base "image" rule
	 * 2. StorageImageNode's updateRule modifies the Image rule to intercept storage:// URLs
	 * 3. ProjectImageNode provides custom serialization for project images with width/align
	 * 4. Extension order: Image → StorageImage → ProjectImage → Markdown
	 * 5. Manual conversion needed for headless mode as onCreate/plugins may not trigger
	 */
	private createEditor(markdownContent: string, modules: TipTapModules): Editor {
		const { Editor, StarterKit, Markdown, StorageImageNode, ProjectImageNode } = modules

		const editor = new Editor({
			extensions: [
				StarterKit.configure({
					// Configure basic extensions (StarterKit doesn't include Image by default)
					heading: { levels: [1, 2, 3, 4, 5, 6] },
					bulletList: {},
					orderedList: {},
					blockquote: {},
					codeBlock: {},
					horizontalRule: {},
				}),
				// ProjectImageNode provides custom serialization with width/align support
				// Dummy urlResolver since we're only using this for serialization
				ProjectImageNode.configure({
					allowBase64: false,
					inline: false,
					urlResolver: (path) => path,
				}),

				// StorageImageNode's updateRule will modify the Image rule to handle storage:// protocol
				StorageImageNode.configure({
					imageStorage: ImageStorageDatabase.getInstance(),
				}),

				// Markdown extension - must be last to use all registered node parse rules
				Markdown.configure({
					html: true,
					tightLists: false,
					breaks: true,
					linkify: true,
				}),
			],
			content: markdownContent, // Markdown is automatically parsed to JSON
		})

		// In headless mode, StorageImageNode's onCreate hook and plugins may not trigger
		// Manually convert image nodes with storage:// protocol to storageImage nodes
		this.convertStorageProtocolImages(editor)

		return editor
	}

	/**
	 * Convert image nodes with storage:// protocol to storageImage nodes
	 * This is necessary in headless editor where automatic conversion may not trigger
	 */
	private convertStorageProtocolImages(editor: Editor): void {
		const { state } = editor
		const storageImageType = state.schema.nodes.storageImage

		if (!storageImageType) {
			logger.warn("storageImage node type not found in schema")
			return
		}

		let hasChanges = false
		const { doc } = state

		// Build a new document by traversing and replacing nodes
		const newDoc = doc.type.create(
			doc.attrs,
			this.convertImageNodesInContent(doc.content, storageImageType, () => {
				hasChanges = true
			}),
			doc.marks,
		)

		// Update editor content if there were changes
		if (hasChanges) {
			editor.commands.setContent(newDoc.toJSON())
			logger.log("Converted storage:// images to storageImage nodes")
		}
	}

	/**
	 * Recursively convert image nodes in content
	 */
	private convertImageNodesInContent(
		content: Fragment,
		storageImageType: NodeType,
		onConvert: () => void,
	): ProseMirrorNode[] {
		const newContent: ProseMirrorNode[] = []

		content.forEach((node: ProseMirrorNode) => {
			// Check if this is an image node with storage:// protocol
			if (node.type.name === "image" && node.attrs.src?.startsWith("storage://")) {
				// Extract storage ID from URL
				const storageUrl = node.attrs.src.split(" ")[0]
				const id = storageUrl.replace("storage://", "")

				// Parse dimensions from title
				const { width, height } = this.parseImageTitle(node.attrs.title || "")

				// Create storage image node (old storage:// format has no align info)
				const storageImageNode = storageImageType.create({
					id,
					alt: node.attrs.alt || null,
					width,
					height,
					align: null,
				})

				newContent.push(storageImageNode)
				onConvert()
			} else if (node.content && node.content.size > 0) {
				// Recursively process child nodes
				const newChildContent = this.convertImageNodesInContent(
					node.content,
					storageImageType,
					onConvert,
				)
				newContent.push(node.type.create(node.attrs, newChildContent, node.marks))
			} else {
				// Keep node as is
				newContent.push(node)
			}
		})

		return newContent
	}

	/**
	 * Parse image size syntax
	 * Format: =WxH or =Wx (height auto)
	 * Examples: =300x200, =300x
	 */
	private parseImageTitle(title: string): {
		width: number | null
		height: number | null
	} {
		const sizeMatch = title.match(/=(\d+)x(\d*)/)

		return {
			width: sizeMatch ? parseInt(sizeMatch[1], 10) : null,
			height: sizeMatch && sizeMatch[2] ? parseInt(sizeMatch[2], 10) : null,
		}
	}

	/**
	 * Recursively find all storageImage nodes in document JSON
	 */
	private findStorageImageNodes(node: JSONContent, path: number[] = []): StorageImageInfo[] {
		const results: StorageImageInfo[] = []

		if (node.type === "storageImage") {
			results.push({
				node: node as StorageImageInfo["node"],
				path,
			})
		}

		if (node.content && Array.isArray(node.content)) {
			node.content.forEach((child, index) => {
				results.push(...this.findStorageImageNodes(child, [...path, index]))
			})
		}

		return results
	}

	/**
	 * Convert a single storage image node to project image node
	 * Returns null if conversion fails (image will be kept as storage image)
	 */
	private async convertStorageImageNode(
		imageInfo: StorageImageInfo,
		projectId: string,
		documentPath?: string,
	): Promise<ProjectImageNode | null> {
		const imageId = imageInfo.node.attrs.id

		try {
			// 1. Get image blob from IndexedDB
			const imageStorage = ImageStorageDatabase.getInstance()
			const blob = await imageStorage.getImage(imageId)

			if (!blob) {
				logger.warn(`Image not found in storage: ${imageId}`)
				return null // Keep original storage image
			}

			// 2. Convert blob to File object
			const extension = blob.type.split("/")[1] || "png"
			const fileName = imageInfo.node.attrs.alt
				? `${imageInfo.node.attrs.alt}.${extension}`
				: `image_${imageId}.${extension}`

			const file = new File([blob], fileName, { type: blob.type })

			// 3. Upload to project
			logger.log(`Uploading storage image ${imageId} to project ${projectId}`)

			const result = await projectImageStorage.uploadImage(
				file,
				projectId,
				"images", // folderPath
			)

			logger.log(`Successfully uploaded image ${imageId} as ${result.file_id}`)

			// 4. Calculate relative path from document to image if documentPath is provided
			let finalPath: string | undefined
			if (documentPath && result.relative_file_path) {
				// Use calculateRelativePath to handle all path normalization
				finalPath = calculateRelativePath(documentPath, result.relative_file_path)
			} else if (result.relative_file_path) {
				// Ensure path starts with "./" when no documentPath is provided
				finalPath =
					result.relative_file_path.startsWith("./") ||
						result.relative_file_path.startsWith("../")
						? result.relative_file_path
						: `./${result.relative_file_path}`
			} else {
				finalPath = result.relative_file_path
			}

			// 5. Construct project image node (preserve align attribute)
			return {
				type: "image",
				attrs: {
					src: finalPath,
					width: imageInfo.node.attrs.width || null,
					height: imageInfo.node.attrs.height || null,
					align: imageInfo.node.attrs.align || null,
					objectFit: imageInfo.node.attrs.objectFit || null,
				},
			}
		} catch (error) {
			logger.error(`Failed to convert storage image ${imageId}`, {
				projectId,
				error: error instanceof Error ? error.message : String(error),
			})
			return null // Keep original storage image on error
		}
	}

	/**
	 * Replace a node at a specific path in the document tree
	 */
	private replaceNodeAtPath(doc: JSONContent, path: number[], newNode: JSONContent): JSONContent {
		if (path.length === 0) {
			return newNode
		}

		const [index, ...restPath] = path
		const newContent = [...(doc.content || [])]

		if (restPath.length === 0) {
			// Replace at this level
			newContent[index] = newNode
		} else {
			// Recurse deeper
			newContent[index] = this.replaceNodeAtPath(newContent[index], restPath, newNode)
		}

		return {
			...doc,
			content: newContent,
		}
	}
}

// Export singleton instance
export const imageMigrationService = new ImageMigrationService()
