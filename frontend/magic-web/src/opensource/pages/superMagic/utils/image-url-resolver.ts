import { getTemporaryDownloadUrl } from "./api"

/**
 * Represents an attachment file in the project
 */
export interface AttachmentFile {
	file_id: string
	file_name: string
	relative_file_path: string
	children?: AttachmentFile[]
}

/**
 * Represents resolved image URL with metadata
 */
export interface ResolvedImageData {
	fileId: string
	url: string
	width: number | null
	height: number | null
	rawPath: string
	align?: string
}

/**
 * Type for image URL map
 */
export type ImageUrlMap = Map<string, ResolvedImageData>

/**
 * Parse image size from markdown image syntax
 * Supports multiple formats:
 * - =WxH (e.g., =284x218)
 * - =Wx (e.g., =284x)
 * - =xH (e.g., =x218)
 * - "=WxH" inside title (e.g., "=284x218")
 *
 * @param path - Image path with optional size syntax
 * @returns Object containing width and height (null if not specified)
 *
 * @example
 * parseImageSize("./image.png =284x218") // { width: 284, height: 218 }
 * parseImageSize('./image.png "=284x218"') // { width: 284, height: 218 }
 * parseImageSize("./image.png =284x") // { width: 284, height: null }
 */
export function parseImageSize(path: string): {
	width: number | null
	height: number | null
} {
	// First try to match size inside title: "=WxH"
	const titleSizeMatch = path.match(/"=(\d*)x(\d*)"/)
	if (titleSizeMatch) {
		const width = titleSizeMatch[1] ? parseInt(titleSizeMatch[1], 10) : null
		const height = titleSizeMatch[2] ? parseInt(titleSizeMatch[2], 10) : null
		return { width, height }
	}

	// Then try to match inline size syntax: =WxH
	const inlineSizeMatch = path.match(/\s*=(\d*)x(\d*)\s*$/)
	if (inlineSizeMatch) {
		const width = inlineSizeMatch[1] ? parseInt(inlineSizeMatch[1], 10) : null
		const height = inlineSizeMatch[2] ? parseInt(inlineSizeMatch[2], 10) : null
		return { width, height }
	}

	return { width: null, height: null }
}

/**
 * Normalize image path by removing size syntax and title attributes
 * Handles multiple markdown image formats:
 * - "./image.png =284x218" -> "./image.png"  (inline size)
 * - './image.png "=284x218"' -> "./image.png"  (title with size)
 * - './image.png "some title"' -> "./image.png"  (regular title)
 *
 * @param path - Image path with optional size syntax or title
 * @returns Normalized path without size syntax or title
 */
export function normalizeImagePath(path: string): string {
	let normalized = path.trim()

	// Remove markdown title syntax: url "title"
	// Matches: './image.png "=302x203"' or './image.png "any title"'
	normalized = normalized.replace(/\s+"[^"]*"$/, "")

	// Remove inline size syntax: url =WxH
	// Matches: './image.png =302x203'
	normalized = normalized.replace(/\s*=\d*x\d*$/, "")

	return normalized.trim()
}

/**
 * Normalize a path for comparison
 * Handles various path formats and encodings
 */
function normalizePathForComparison(path: string): string {
	if (!path) return ""

	let normalized = path.trim()

	// Try to decode URI, fallback to original if fails
	try {
		const decoded = decodeURI(normalized)
		normalized = decoded
	} catch {
		// Keep original if decoding fails
	}

	// Remove leading ./
	normalized = normalized.replace(/^\.\//, "/")

	// Ensure leading /
	if (!normalized.startsWith("/")) {
		normalized = `/${normalized}`
	}

	// Remove trailing slash (except for root)
	if (normalized.length > 1 && normalized.endsWith("/")) {
		normalized = normalized.slice(0, -1)
	}

	return normalized
}

/**
 * Find a file in the attachment tree by relative path
 * Recursively searches through the tree structure
 * Handles path normalization for better matching
 *
 * @param attachments - Array of attachment files to search
 * @param targetPath - Target relative file path to find
 * @returns Found file or undefined
 */
export function findFileByPath(
	attachments: AttachmentFile[],
	targetPath: string,
): AttachmentFile | undefined {
	if (!Array.isArray(attachments) || attachments.length === 0) {
		return undefined
	}

	const normalizedSearchPath = normalizePathForComparison(targetPath)

	for (const file of attachments) {
		// Recursively search in children
		if (file.children) {
			const found = findFileByPath(file.children, targetPath)
			if (found) return found
		}

		// Check if the relative_file_path matches
		if (file.relative_file_path) {
			const normalizedItemPath = normalizePathForComparison(file.relative_file_path)
			if (normalizedItemPath === normalizedSearchPath) {
				return file
			}
		}
	}

	return undefined
}

/**
 * Resolve relative path based on document directory
 * Handles ".." and "." path segments
 *
 * @param documentDir - Directory path of the document (e.g., "./docs/guide")
 * @param relativePath - Relative path from document (e.g., "../images/photo.png")
 * @returns Resolved path relative to project root
 *
 * @example
 * resolveRelativePath("./docs/guide", "../images/photo.png") // "./docs/images/photo.png"
 * resolveRelativePath("./docs", "./photo.png") // "./docs/photo.png"
 */
export function resolveRelativePath(documentDir: string, relativePath: string): string {
	// Remove leading "./" from paths
	const cleanDocDir = documentDir.replace(/^\.\//, "")
	const cleanRelPath = relativePath.replace(/^\.\//, "")

	// Split paths into segments
	const dirSegments = cleanDocDir.split("/").filter(Boolean)
	const relSegments = cleanRelPath.split("/").filter(Boolean)

	// Process relative path segments
	for (const segment of relSegments) {
		if (segment === "..") {
			dirSegments.pop()
		} else if (segment !== ".") {
			dirSegments.push(segment)
		}
	}

	// Reconstruct path with "./" prefix
	return `./${dirSegments.join("/")}`
}

/**
 * Build image URL map entries from download URLs
 * Maps image paths to their temporary download URLs with metadata
 *
 * @param downloadUrls - Array of file IDs with their download URLs
 * @param fileIdToPaths - Map of file IDs to their related paths (including size variants)
 * @returns Map of image paths to resolved image data
 */
export function buildImageUrlMapEntries(
	downloadUrls: Array<{ file_id: string; url: string }>,
	fileIdToPaths: Map<string, Set<string>>,
): ImageUrlMap {
	const resolvedMap: ImageUrlMap = new Map()

	for (const urlInfo of downloadUrls) {
		const relatedPaths = fileIdToPaths.get(urlInfo.file_id)
		if (!relatedPaths || !urlInfo?.url) continue

		relatedPaths.forEach((path) => {
			// Parse image size from path
			const { width, height } = parseImageSize(path)

			// Create resolved entry
			const resolvedEntry: ResolvedImageData = {
				fileId: urlInfo.file_id,
				url: urlInfo.url,
				width,
				height,
				rawPath: path,
			}

			// Use the raw path (with size syntax) as key to preserve different size variants
			resolvedMap.set(path, resolvedEntry)

			// Also create an entry with normalized path for backward compatibility
			const normalizedPath = normalizeImagePath(path)
			if (!resolvedMap.has(normalizedPath)) {
				resolvedMap.set(normalizedPath, resolvedEntry)
			}
		})
	}

	return resolvedMap
}

/**
 * Extract image paths from markdown content
 * Matches both markdown syntax and HTML img tags
 *
 * @param content - Markdown content to parse
 * @returns Array of image paths found in content
 *
 * @example
 * // Markdown syntax: ![alt](./image.png)
 * // HTML syntax: <img src="./image.png" />
 */
export function extractImagePaths(content: string): string[] {
	const imagePaths: string[] = []

	// Match markdown images
	// Format: ![alt text](./path/to/image.png) or ![alt](./image.png =284x218)
	const markdownImageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g
	const markdownMatches = [...content.matchAll(markdownImageRegex)]

	for (const match of markdownMatches) {
		const imgUrl = match[2]?.trim()
		if (imgUrl && !isExternalUrl(imgUrl)) {
			imagePaths.push(imgUrl)
		}
	}

	// Match HTML img tags
	// Format: <img src="./image.png" /> or <img src="./image.png" width="284" height="218">
	const htmlImageRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi
	const htmlMatches = [...content.matchAll(htmlImageRegex)]

	for (const match of htmlMatches) {
		const imgUrl = match[1]?.trim()
		if (imgUrl && !isExternalUrl(imgUrl)) {
			imagePaths.push(imgUrl)
		}
	}

	return imagePaths
}

/**
 * Check if URL is an external/remote URL
 *
 * @param url - URL to check
 * @returns True if URL is external (http://, https://, //, data:)
 */
export function isExternalUrl(url: string): boolean {
	return (
		url.startsWith("http://") ||
		url.startsWith("https://") ||
		url.startsWith("//") ||
		url.startsWith("data:")
	)
}

/**
 * Process markdown content and resolve image URLs
 * Main function that orchestrates the entire image URL resolution process
 *
 * @param content - Markdown content to process
 * @param attachments - Project attachment files
 * @param documentPath - Current document's relative path
 * @returns Object containing processed content and image URL map
 */
export async function processMarkdownImages(
	content: string,
	attachments: AttachmentFile[],
	documentPath?: string,
): Promise<{
	processedContent: string
	imageUrlMap: ImageUrlMap
}> {
	const imagePaths = extractImagePaths(content)

	if (imagePaths.length === 0) {
		return {
			processedContent: content,
			imageUrlMap: new Map(),
		}
	}

	// Get document directory path for resolving relative image paths
	const documentDir = documentPath ? documentPath.substring(0, documentPath.lastIndexOf("/")) : ""

	// Collect images to process and build file ID to paths mapping
	const imagesToProcess = new Set<string>()
	const fileIdToPaths = new Map<string, Set<string>>()

	for (const imgUrl of imagePaths) {
		// Normalize path to remove size syntax for file lookup
		const pathForLookup = normalizeImagePath(imgUrl)

		// Convert relative path to project root path
		const resolvedPath = documentDir
			? resolveRelativePath(documentDir, pathForLookup)
			: pathForLookup

		// Find the matched file in attachments tree
		const matchedFile = findFileByPath(attachments, resolvedPath)
		if (matchedFile) {
			imagesToProcess.add(matchedFile.file_id)
			const existingPaths = fileIdToPaths.get(matchedFile.file_id) || new Set<string>()
			existingPaths.add(imgUrl)
			fileIdToPaths.set(matchedFile.file_id, existingPaths)
		}
	}

	if (imagesToProcess.size === 0) {
		return {
			processedContent: content,
			imageUrlMap: new Map(),
		}
	}

	try {
		// Batch fetch temporary download URLs
		const downloadUrls =
			(await getTemporaryDownloadUrl({
				file_ids: Array.from(imagesToProcess),
			})) || []

		// Build image URL map
		const resolvedMap = buildImageUrlMapEntries(downloadUrls, fileIdToPaths)

		return {
			processedContent: content,
			imageUrlMap: resolvedMap,
		}
	} catch (error) {
		console.error("Error fetching download URLs:", error)
		return {
			processedContent: content,
			imageUrlMap: new Map(),
		}
	}
}

/**
 * Resolve a single image URL on demand
 * Used for lazy loading individual images
 *
 * @param relativePath - 相对于文档的相对路径(e.g., "./images/photo.png")
 * @param attachments - Project attachment files
 * @param documentPath - 当前文档相对于工作区的相对路径(e.g., "/recording/session-xxx/note.md")
 * @param imageUrlMap - 现有的图片 URL 映射 (用于缓存检查)
 * @returns 解析后的图片 URL 或原始路径如果解析失败
 */
export async function resolveSingleImageUrl(
	relativePath: string,
	attachments: AttachmentFile[],
	documentPath?: string,
	imageUrlMap?: ImageUrlMap,
): Promise<string> {
	// Check if URL is already cached
	if (imageUrlMap?.has(relativePath)) {
		const cached = imageUrlMap.get(relativePath)
		if (cached) {
			return cached.url
		}
	}

	// Normalize path and find file
	let normalizedRelativePath = normalizeImagePath(relativePath)

	// Decode URI component if needed (for paths with special characters like Chinese)
	try {
		normalizedRelativePath = decodeURIComponent(normalizedRelativePath)
	} catch {
		// If decode fails, use the original normalized path
	}

	// Get document directory path
	const documentDir = documentPath ? documentPath.substring(0, documentPath.lastIndexOf("/")) : ""

	// Convert relative path to project root path
	const resolvedPath = documentDir
		? resolveRelativePath(documentDir, normalizedRelativePath)
		: normalizedRelativePath

	const file = findFileByPath(attachments, resolvedPath)

	if (!file?.file_id) {
		return relativePath
	}

	try {
		// Request temporary download URL
		const downloadUrls = await getTemporaryDownloadUrl({
			file_ids: [file.file_id],
			options: {
				// 默认获取webp格式，质量85
				xMagicImageProcess: {
					quality: 85,
					format: "webp",
				},
			},
		})

		if (!downloadUrls?.[0]?.url) {
			return relativePath
		}

		return downloadUrls[0].url
	} catch (error) {
		console.error("Error fetching download URL:", error)
		return relativePath
	}
}
