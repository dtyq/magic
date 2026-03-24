import {
	SlideLoaderService,
	SlideProcessorService,
} from "@/pages/superMagic/components/Detail/components/PPTRender/services"
import {
	getTemporaryDownloadUrl,
	type GetTemporaryDownloadUrlItem,
} from "@/pages/superMagic/utils/api"
import type { AttachmentItem } from "@/pages/superMagic/components/TopicFilesButton/hooks/types"

interface SlideMetadata {
	name?: string
	slides?: string[]
	[key: string]: unknown
}

export interface PrepareExportSlidesInput {
	slidePaths: string[]
	attachmentList: AttachmentItem[]
	mainFileId: string
	mainFileName?: string
	metadata?: SlideMetadata
}

export interface PrepareExportSlidesOutput {
	htmlSlides: string[]
	fileName: string
}

function resolveRelativePath(basePath: string, relativePath: string): string {
	if (!basePath || !relativePath) return relativePath || ""

	const normalizedBase = basePath.endsWith("/") ? basePath.slice(0, -1) : basePath

	if (relativePath.startsWith("/")) return normalizedBase + "/" + relativePath.slice(1)

	if (relativePath.startsWith("./")) return normalizedBase + "/" + relativePath.slice(2)

	if (relativePath.startsWith("../")) {
		const baseParts = normalizedBase.split("/")
		let parts = relativePath.split("/")

		let backLevels = 0
		while (parts[0] === "..") {
			backLevels++
			parts = parts.slice(1)
		}

		if (backLevels >= baseParts.length) return "/" + parts.join("/")

		return baseParts.slice(0, -backLevels).join("/") + "/" + parts.join("/")
	}

	return normalizedBase + "/" + relativePath
}

function flattenAttachments(items: AttachmentItem[]): AttachmentItem[] {
	const result: AttachmentItem[] = []
	for (const item of items) {
		result.push(item)
		if (item.children?.length) {
			result.push(...flattenAttachments(item.children))
		}
	}
	return result
}

/**
 * Ensure attachmentList is a flat array for searching.
 * If mainFileId is already in the top level, the list is already scoped (e.g. folder children passed directly).
 * Otherwise flatten the tree to handle nested structures.
 */
function ensureFlatScope(attachmentList: AttachmentItem[], mainFileId: string): AttachmentItem[] {
	if (attachmentList.some((item) => item.file_id === mainFileId)) return attachmentList
	return flattenAttachments(attachmentList)
}

function extractFileIdFromPath(
	path: string,
	searchScope: AttachmentItem[],
	mainFileId: string,
): string | undefined {
	const mainFile = searchScope.find((item) => item.file_id === mainFileId)
	if (!mainFile?.relative_file_path || !mainFile?.file_name) return undefined

	const baseFolderPath = mainFile.relative_file_path.replace(mainFile.file_name, "")
	const absolutePath = resolveRelativePath(baseFolderPath, path)

	return searchScope.find((item) => item.relative_file_path === absolutePath)?.file_id
}

/**
 * Prepare a single HTML file for PPTX export.
 * Skips path resolution since we already have the fileId.
 */
export async function prepareSingleSlideExport(input: {
	fileId: string
	fileName?: string
	attachmentList: AttachmentItem[]
}): Promise<PrepareExportSlidesOutput> {
	const { fileId, fileName, attachmentList } = input

	const searchScope = flattenAttachments(attachmentList)

	const [urlItem] = (await getTemporaryDownloadUrl({ file_ids: [fileId] })) ?? []
	if (!urlItem?.url) return { htmlSlides: [], fileName: fileName ?? "slide" }

	const loaderService = new SlideLoaderService()
	const rawContent = await loaderService.loadSlide(urlItem.url)
	if (!rawContent) return { htmlSlides: [], fileName: fileName ?? "slide" }

	const fileItem = searchScope.find((item) => item.file_id === fileId)
	const relativeFilePath = fileItem?.relative_file_path?.replace(fileItem?.file_name || "", "")

	const processorService = new SlideProcessorService({
		attachments: searchScope,
		attachmentList: searchScope,
		mainFileId: fileId,
		mainFileName: fileName,
	})

	const resourceIds = processorService.collectFileIds(rawContent, 0, relativeFilePath)

	let processed = rawContent
	if (resourceIds.size > 0) {
		const resourceUrlMapping = new Map<string, string>()
		try {
			const response = await getTemporaryDownloadUrl({ file_ids: Array.from(resourceIds) })
			response?.forEach((item: GetTemporaryDownloadUrlItem) => {
				if (item.file_id && item.url) resourceUrlMapping.set(item.file_id, item.url)
			})
		} catch (error) {
			console.error("[pptService] Failed to fetch resource URLs:", error)
		}
		processed = await processorService.processSlideWithUrlMapping(
			rawContent,
			0,
			relativeFilePath,
			resourceUrlMapping,
		)
	}

	return {
		htmlSlides: [processed],
		fileName: fileName?.replace(/\.html?$/i, "") ?? "slide",
	}
}

/**
 * Prepare processed HTML slides for export, independent of PPTStore.
 *
 * Replicates the three-phase data pipeline that PPTStore performs
 * (path resolution -> HTML download -> HTML processing) as a
 * single stateless async function.
 */
export async function prepareExportSlides(
	input: PrepareExportSlidesInput,
): Promise<PrepareExportSlidesOutput> {
	const { slidePaths, attachmentList, mainFileId, mainFileName, metadata } = input

	if (!slidePaths.length) return { htmlSlides: [], fileName: metadata?.name || "slides" }

	const searchScope = ensureFlatScope(attachmentList, mainFileId)

	// Phase 1: resolve paths -> fileIds -> temporary download URLs
	const pathToFileId = new Map<string, string>()
	const fileIds: string[] = []

	for (const path of slidePaths) {
		const fileId = extractFileIdFromPath(path, searchScope, mainFileId)
		if (fileId) {
			pathToFileId.set(path, fileId)
			fileIds.push(fileId)
		}
	}

	const pathToUrl = new Map<string, string>()

	if (fileIds.length > 0) {
		try {
			const response = await getTemporaryDownloadUrl({ file_ids: fileIds })
			response?.forEach((item: GetTemporaryDownloadUrlItem) => {
				if (!item.file_id || !item.url) return
				pathToFileId.forEach((fid, path) => {
					if (fid === item.file_id) {
						pathToUrl.set(path, item.url)
					}
				})
			})
		} catch (error) {
			console.error("[pptService] Failed to fetch slide download URLs:", error)
		}
	}

	// Phase 2: download raw HTML in parallel & collect resource file IDs
	const loaderService = new SlideLoaderService()
	const processorService = new SlideProcessorService({
		attachments: searchScope,
		attachmentList: searchScope,
		mainFileId,
		mainFileName,
		metadata,
	})

	const allResourceFileIds = new Set<string>()
	const slideRawData: Array<{
		index: number
		content: string
		relativeFilePath?: string
	}> = []

	await Promise.all(
		slidePaths.map(async (path, index) => {
			const url = pathToUrl.get(path)
			if (!url) return

			try {
				const rawContent = await loaderService.loadSlide(url)

				const fileId = pathToFileId.get(path)
				const fileItem = searchScope.find((item) => item.file_id === fileId)
				const relativeFilePath = fileItem?.relative_file_path?.replace(
					fileItem?.file_name || "",
					"",
				)

				slideRawData.push({ index, content: rawContent, relativeFilePath })

				const resourceIds = processorService.collectFileIds(
					rawContent,
					index,
					relativeFilePath,
				)
				resourceIds.forEach((id) => allResourceFileIds.add(id))
			} catch (error) {
				console.error(`[pptService] Failed to load slide ${index}:`, error)
			}
		}),
	)

	// Phase 3: fetch resource URLs in batch, then process HTML
	const resourceUrlMapping = new Map<string, string>()

	if (allResourceFileIds.size > 0) {
		try {
			const response = await getTemporaryDownloadUrl({
				file_ids: Array.from(allResourceFileIds),
			})
			response?.forEach((item: GetTemporaryDownloadUrlItem) => {
				if (item.file_id && item.url) {
					resourceUrlMapping.set(item.file_id, item.url)
				}
			})
		} catch (error) {
			console.error("[pptService] Failed to fetch resource URLs:", error)
		}
	}

	const processedSlides = new Map<number, string>()

	await Promise.all(
		slideRawData.map(async ({ index, content, relativeFilePath }) => {
			try {
				const processed = await processorService.processSlideWithUrlMapping(
					content,
					index,
					relativeFilePath,
					resourceUrlMapping,
				)
				processedSlides.set(index, processed)
			} catch (error) {
				console.error(`[pptService] Failed to process slide ${index}:`, error)
				processedSlides.set(index, content)
			}
		}),
	)

	const htmlSlides = slidePaths.map((_, index) => processedSlides.get(index) ?? "")

	return {
		htmlSlides,
		fileName: metadata?.name || "slides",
	}
}
