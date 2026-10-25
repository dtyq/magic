import {
	processAudioArray,
	extractUrlsFromCSS,
	findMatchingFile,
	isRelativePath,
	processElementsWithAttribute,
	processInlineStyles,
	processSlidesArray,
	processStyleUrls,
	getResourceContentType,
} from "./index"
import { processDashboardArray } from "../dashboard/utils"
import type { FileItem } from "./fetchInterceptor"
import type { FileAccessContext } from "@/pages/superMagic/fileAccess/fileAccessContext"
import type { FileApi } from "@/pages/superMagic/fileAccess/fileApi"
import { getFileContentById } from "@/pages/superMagic/utils/api"

export interface HtmlDisplayConfig {
	type?: string
	slides?: string[]
	[key: string]: unknown
}

export interface HtmlResourceInfo {
	path: string
	attr: string
	tag: string
	contentType?: string
	type?: string
	fileName?: string
	url?: string
}

export interface HtmlResourcePlan {
	fileIdsToFetch: string[]
	urlMap: Map<string, HtmlResourceInfo>
	filePathMap: Map<string, string>
	slidesMap: Map<string, string>
	imageFileIds: Set<string>
	/** 可安全转换为 WebP 的静态图片文件 ID 集合；动画 GIF 保持原格式。 */
	imageProcessingFileIds: Set<string>
}

export interface ExternalCssResource {
	fileId: string
	/** The path used by the HTML link element, before URL replacement. */
	htmlPath: string
	content: string
	references: Array<{ fileId: string; path: string }>
}

interface ResolveExternalCssResourcesOptions {
	plan: HtmlResourcePlan
	allFiles: FileItem[]
	access?: FileAccessContext | null
	fileApi?: FileApi
}

function getFolderPath(file: FileItem): string {
	const path = file.relative_file_path || ""
	if (file.file_name && path.endsWith(file.file_name)) {
		return path.slice(0, -file.file_name.length)
	}
	const slashIndex = path.lastIndexOf("/")
	return slashIndex >= 0 ? path.slice(0, slashIndex + 1) : ""
}

function stripUrlSuffix(path: string): string {
	return path.split(/[?#]/, 1)[0]
}

function extractCssImportPaths(cssContent: string): Set<string> {
	const paths = new Set<string>()
	const importPattern =
		/@import\s+(?:(?:url\(\s*)?["']([^"']+)["']|url\(\s*([^\s)]+)\s*\))[^;]*(?:;|$)/gi
	for (const match of cssContent.matchAll(importPattern)) {
		const path = match[1] ?? match[2]
		if (path) paths.add(path)
	}
	return paths
}

function collectCssReferences({
	content,
	folderPath,
	allFiles,
}: {
	content: string
	folderPath: string
	allFiles: FileItem[]
}): Array<{ fileId: string; path: string }> {
	const importPaths = extractCssImportPaths(content)
	const references: Array<{ fileId: string; path: string }> = []

	for (const path of extractUrlsFromCSS(content)) {
		if (importPaths.has(path) || !isRelativePath(path)) continue
		const cleanPath = stripUrlSuffix(path)
		if (!cleanPath) continue
		const matchedFile = findMatchingFile({
			path: cleanPath,
			allFiles,
			htmlRelativeFolderPath: folderPath,
		})
		if (matchedFile) references.push({ fileId: matchedFile.file_id, path })
	}

	return references
}

async function inlineCssImports({
	content,
	folderPath,
	allFiles,
	readFileContent,
	access,
	visited,
}: {
	content: string
	folderPath: string
	allFiles: FileItem[]
	readFileContent: FileApi["getFileContentById"]
	access?: FileAccessContext | null
	visited: Set<string>
}): Promise<{ content: string; references: Array<{ fileId: string; path: string }> }> {
	const references = collectCssReferences({ content, folderPath, allFiles })
	let processedContent = content
	const importPattern =
		/@import\s+(?:(?:url\(\s*)?["']([^"']+)["']|url\(\s*([^\s)]+)\s*\))[^;]*(?:;|$)/gi
	const imports = [...content.matchAll(importPattern)]

	for (const match of imports) {
		const importPath = match[1] ?? match[2]
		if (!importPath || !isRelativePath(importPath)) continue
		const matchedFile = findMatchingFile({
			path: stripUrlSuffix(importPath),
			allFiles,
			htmlRelativeFolderPath: folderPath,
		})
		if (!matchedFile || getResourceContentType(matchedFile, importPath) !== "text/css") continue
		if (visited.has(matchedFile.file_id)) continue
		visited.add(matchedFile.file_id)

		const importedContent = await readFileContent(matchedFile.file_id, {
			responseType: "text",
			access: access ?? undefined,
		})
		if (typeof importedContent !== "string") continue
		const nested = await inlineCssImports({
			content: importedContent,
			folderPath: getFolderPath(matchedFile),
			allFiles,
			readFileContent,
			access,
			visited,
		})
		processedContent = processedContent.replace(match[0], nested.content)
		references.push(...nested.references)
	}

	return { content: processedContent, references }
}

/**
 * Read linked CSS files before replacing HTML URLs. CSS is otherwise fetched by the
 * browser after the HTML has been written, which leaves its relative `url(...)`
 * references outside the host-side resource replacement pipeline.
 */
export async function resolveExternalCssResources({
	plan,
	allFiles,
	access,
	fileApi,
}: ResolveExternalCssResourcesOptions): Promise<ExternalCssResource[]> {
	const cssResources = [...plan.urlMap.entries()].filter(
		([, info]) => info.attr === "href" && info.contentType === "text/css",
	)
	if (cssResources.length === 0) return []

	const readFileContent = fileApi?.getFileContentById ?? getFileContentById
	const resolvedResources: ExternalCssResource[] = []

	await Promise.all(
		cssResources.map(async ([fileId, info]) => {
			try {
				const rawContent = await readFileContent(fileId, {
					responseType: "text",
					access: access ?? undefined,
				})
				if (typeof rawContent !== "string") return

				const cssFile = allFiles.find((file) => file.file_id === fileId)
				if (!cssFile) return
				const cssFolderPath = getFolderPath(cssFile)
				const inlinedCss = await inlineCssImports({
					content: rawContent,
					folderPath: cssFolderPath,
					allFiles,
					readFileContent,
					access,
					visited: new Set([fileId]),
				})
				const references = [...inlinedCss.references]
				const registerReference = (path: string, matchedFile: FileItem) => {
					if (
						!references.some(
							(reference) =>
								reference.fileId === matchedFile.file_id && reference.path === path,
						)
					) {
						references.push({ fileId: matchedFile.file_id, path })
					}
					if (!plan.fileIdsToFetch.includes(matchedFile.file_id)) {
						plan.fileIdsToFetch.push(matchedFile.file_id)
					}
					const cleanPath = stripUrlSuffix(path)
					if (!plan.filePathMap.has(matchedFile.file_id)) {
						plan.filePathMap.set(matchedFile.file_id, path)
					}
					// Keep the first HTML/inline-style mapping for shared files. CSS
					// references are tracked separately and replaced by their path below.
					if (!plan.urlMap.has(matchedFile.file_id)) {
						plan.urlMap.set(matchedFile.file_id, {
							path,
							attr: "css-url",
							tag: "style",
							contentType: getResourceContentType(matchedFile, cleanPath),
						})
					}
					const contentType = getResourceContentType(matchedFile, cleanPath)
					if (contentType.startsWith("image/")) {
						plan.imageFileIds.add(matchedFile.file_id)
						if (contentType !== "image/gif") {
							plan.imageProcessingFileIds.add(matchedFile.file_id)
						}
					}
				}

				for (const reference of inlinedCss.references) {
					const matchedFile = allFiles.find((file) => file.file_id === reference.fileId)
					if (matchedFile) registerReference(reference.path, matchedFile)
				}

				if (references.length > 0 || inlinedCss.content !== rawContent) {
					resolvedResources.push({
						fileId,
						htmlPath: info.path,
						content: inlinedCss.content,
						references,
					})
				}
			} catch (error) {
				console.warn("Failed to read linked CSS resource:", { fileId, error })
			}
		}),
	)

	return resolvedResources
}

/**
 * Collect relative resources referenced by an HTML document and classify images.
 * Image classification is kept here so URL resolution can apply processing only
 * to visual assets without affecting scripts, stylesheets, fonts, or media files.
 */
export function collectHtmlResourcePlan(
	htmlDoc: Document,
	allFiles: FileItem[],
	relativeFolderPath: string,
	displayConfig?: HtmlDisplayConfig,
): HtmlResourcePlan {
	const fileIdsToFetch: string[] = []
	const urlsToReplace: string[] = []
	const urlMap = new Map<string, HtmlResourceInfo>()
	const filePathMap = new Map<string, string>()
	const slidesMap = new Map<string, string>()
	const imageFileIds = new Set<string>()
	const imageProcessingFileIds = new Set<string>()

	const collectElementResource = (
		tagName: string,
		attributeName: string,
		additionalFilter?: (element: Element) => boolean,
	) => {
		processElementsWithAttribute({
			elements: htmlDoc.getElementsByTagName(tagName),
			attributeName,
			tagName,
			allFiles,
			urlsToReplace,
			fileIdsToFetch,
			urlMap,
			additionalFilter,
			htmlRelativeFolderPath: relativeFolderPath,
		})
	}

	collectElementResource("img", "src")
	collectElementResource(
		"link",
		"href",
		(element) => element.getAttribute("rel") === "stylesheet",
	)
	collectElementResource("script", "src")
	collectElementResource("iframe", "src")
	collectElementResource("source", "src")
	collectElementResource("video", "src")
	collectElementResource("audio", "src")
	collectElementResource("object", "src")

	processSlidesArray({
		htmlDoc,
		allFiles,
		fileIdsToFetch,
		urlMap,
		slidesMap,
		htmlRelativeFolderPath: relativeFolderPath,
		displayConfig,
	})

	processStyleUrls({
		htmlDoc,
		allFiles,
		fileIdsToFetch,
		filePathMap,
		htmlRelativeFolderPath: relativeFolderPath,
		urlMap,
	})

	processInlineStyles({
		htmlDoc,
		allFiles,
		fileIdsToFetch,
		filePathMap,
		htmlRelativeFolderPath: relativeFolderPath,
		urlMap,
	})

	if (displayConfig?.type === "dashboard") {
		processDashboardArray({
			htmlDoc,
			allFiles,
			fileIdsToFetch,
			urlMap,
			htmlRelativeFolderPath: relativeFolderPath,
		})
	}

	if (displayConfig?.type === "audio" || displayConfig?.type === "video") {
		processAudioArray({
			htmlDoc,
			allFiles,
			fileIdsToFetch,
			urlMap,
			htmlRelativeFolderPath: relativeFolderPath,
		})
	}

	urlMap.forEach((info, id) => {
		if (info.contentType?.startsWith("image/")) {
			imageFileIds.add(id)
			// TOS 的 WebP 转换会破坏或拒绝动画 GIF，因此保留原始 GIF URL。
			if (info.contentType !== "image/gif") imageProcessingFileIds.add(id)
		}
	})

	return {
		fileIdsToFetch,
		urlMap,
		filePathMap,
		slidesMap,
		imageFileIds,
		imageProcessingFileIds,
	}
}
