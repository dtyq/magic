import {
	SlideLoaderService,
	SlideProcessorService,
} from "@/pages/superMagic/components/Detail/components/PPTRender/services"
import {
	getTemporaryDownloadUrl,
	getFileContentById,
	type GetTemporaryDownloadUrlItem,
} from "@/pages/superMagic/utils/api"
import type { AttachmentItem } from "@/pages/superMagic/components/TopicFilesButton/hooks/types"
import type { FileAccessContext } from "@/pages/superMagic/fileAccess/fileAccessContext"
import type { FileApi } from "@/pages/superMagic/fileAccess/fileApi"
import { parseMagicProjectConfigContent } from "@/pages/superMagic/utils/magicProjectConfigParser"
import { filterPptSlidePaths } from "@/pages/superMagic/utils/pptHiddenSlides"

interface SlideMetadata {
	name?: string
	slides?: string[]
	hidden_slides?: unknown
	[key: string]: unknown
}

export interface PrepareExportSlidesInput {
	slidePaths: string[]
	attachmentList: AttachmentItem[]
	mainFileId: string
	mainFileName?: string
	displayConfig?: SlideMetadata
	access?: FileAccessContext
	fileApi?: FileApi
	includeHiddenSlides?: boolean
	/** Internal marker: this export already captured its canonical configuration. */
	configResolved?: boolean
}

export interface PrepareExportSlidesOutput {
	htmlSlides: string[]
	fileName: string
}

/** A lazily prepared page used by the large, forward-only PPTX export path. */
export interface PreparedExportSlidePage {
	index: number
	html: string
	key?: string
	pageName?: string
	pagePath?: string
	pageFileId?: string
}

export interface IterateExportSlidesInput extends PrepareExportSlidesInput {
	signal?: AbortSignal
}

export interface PrepareSingleSlideExportInput {
	fileId: string
	fileName?: string
	attachmentList: AttachmentItem[]
	access?: FileAccessContext
	fileApi?: FileApi
	signal?: AbortSignal
	displayConfig?: SlideMetadata
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
	if (
		attachmentList.some((item) => item.file_id === mainFileId) &&
		attachmentList.every((item) => !item.children?.length)
	)
		return attachmentList
	return flattenAttachments(attachmentList)
}

function fetchTemporaryDownloadUrls(
	fileIds: string[],
	fileApi?: FileApi,
	access?: FileAccessContext,
) {
	return (fileApi?.getTemporaryDownloadUrl ?? getTemporaryDownloadUrl)({
		file_ids: fileIds,
		access,
	})
}

function extractFileIdFromPath(
	path: string,
	searchScope: AttachmentItem[],
	mainFileId: string,
): string | undefined {
	const mainFile = searchScope.find((item) => item.file_id === mainFileId)
	if (!mainFile?.relative_file_path || !mainFile?.file_name) return undefined

	const baseFolderPath = mainFile.is_directory
		? mainFile.relative_file_path
		: mainFile.relative_file_path.slice(0, mainFile.relative_file_path.lastIndexOf("/") + 1)
	const absolutePath = resolveRelativePath(baseFolderPath, path)

	return searchScope.find((item) => item.relative_file_path === absolutePath)?.file_id
}

/** Capture the source configuration once per export, using the same bound access as page reads. */
export async function resolvePptExportSlides(
	input: PrepareExportSlidesInput,
): Promise<PrepareExportSlidesInput> {
	if (input.configResolved) return input
	const scope = flattenAttachments(input.attachmentList)
	const main = scope.find((item) => item.file_id === input.mainFileId)
	const basePath = main?.relative_file_path
		? main.is_directory
			? main.relative_file_path.replace(/\/?$/, "/")
			: main.relative_file_path.slice(0, main.relative_file_path.lastIndexOf("/") + 1)
		: undefined
	const configFile = scope.find((item) =>
		basePath !== undefined
			? item.relative_file_path === `${basePath}magic.project.js`
			: Boolean(
					main?.parent_id &&
					item.parent_id === main.parent_id &&
					item.file_name === "magic.project.js",
				),
	)
	let displayConfig = input.displayConfig
	let slidePaths = input.slidePaths
	if (configFile?.file_id) {
		const readContent = input.fileApi?.getFileContentById ?? getFileContentById
		const content = await readContent(configFile.file_id, {
			responseType: "text",
			access: input.access,
		})
		const parsed = parseMagicProjectConfigContent(String(content))
		if (
			!parsed ||
			!Array.isArray(parsed.slides) ||
			parsed.slides.some((path) => typeof path !== "string")
		) {
			throw new Error("Invalid PPT project configuration")
		}
		displayConfig = {
			...displayConfig,
			...parsed,
			slides: parsed.slides as string[],
			hidden_slides: parsed.hidden_slides,
		}
		slidePaths = parsed.slides as string[]
	}
	return {
		...input,
		displayConfig,
		slidePaths: filterPptSlidePaths(
			slidePaths,
			displayConfig?.hidden_slides,
			input.includeHiddenSlides,
		),
		configResolved: true,
	}
}

/**
 * Prepare a single HTML file for PPTX export.
 * Skips path resolution since we already have the fileId.
 */
export async function prepareSingleSlideExport({
	fileId,
	fileName,
	attachmentList,
	access,
	fileApi,
	signal,
}: PrepareSingleSlideExportInput): Promise<PrepareExportSlidesOutput> {
	throwIfAborted(signal)

	const searchScope = flattenAttachments(attachmentList)
	const fileItem = searchScope.find((item) => item.file_id === fileId)

	const [urlItem] =
		(await waitForAbortable(fetchTemporaryDownloadUrls([fileId], fileApi, access), signal)) ??
		[]
	if (!urlItem?.url) return { htmlSlides: [], fileName: fileName ?? "slide" }

	const loaderService = new SlideLoaderService()
	const rawContent = await waitForAbortable(loaderService.loadSlide(urlItem.url), signal)
	throwIfAborted(signal)
	if (!rawContent) return { htmlSlides: [], fileName: fileName ?? "slide" }

	const relativeFilePath = fileItem?.relative_file_path?.replace(fileItem?.file_name || "", "")

	const processorService = new SlideProcessorService({
		attachments: searchScope,
		attachmentList: searchScope,
		mainFileId: fileId,
		mainFileName: fileName,
		fileApi,
	})

	const resourceIds = processorService.collectFileIds(rawContent, 0, relativeFilePath)

	let processed = rawContent
	if (resourceIds.size > 0) {
		const resourceUrlMapping = new Map<string, string>()
		try {
			const response = await waitForAbortable(
				fetchTemporaryDownloadUrls(Array.from(resourceIds), fileApi, access),
				signal,
			)
			response?.forEach((item: GetTemporaryDownloadUrlItem) => {
				if (item.file_id && item.url) resourceUrlMapping.set(item.file_id, item.url)
			})
		} catch (error) {
			if (signal?.aborted || isAbortError(error)) throw createAbortError(signal, error)
			console.error("[pptService] Failed to fetch resource URLs:", error)
		}
		const processedSlide = await waitForAbortable(
			processorService.processSlideWithUrlMapping(
				rawContent,
				0,
				relativeFilePath,
				resourceUrlMapping,
			),
			signal,
		)
		processed = typeof processedSlide === "string" ? processedSlide : processedSlide.content
	}
	throwIfAborted(signal)

	return {
		htmlSlides: [processed],
		fileName: fileName?.replace(/\.html?$/i, "") ?? "slide",
	}
}

/** A file-menu selection can represent either a whole deck or one standalone HTML file. */
export async function prepareFileExportSlides(
	input: PrepareSingleSlideExportInput,
): Promise<PrepareExportSlidesOutput> {
	const file = flattenAttachments(input.attachmentList).find(
		(item) => item.file_id === input.fileId,
	)
	const displayConfig =
		input.displayConfig ||
		((file?.display_config ?? file?.metadata) as SlideMetadata | undefined)
	if (Array.isArray(displayConfig?.slides) && displayConfig.slides.length > 0) {
		return prepareExportSlides({
			slidePaths: displayConfig.slides,
			displayConfig,
			attachmentList: input.attachmentList,
			mainFileId: input.fileId,
			mainFileName: input.fileName,
			fileApi: input.fileApi,
			access: input.access,
		})
	}
	return prepareSingleSlideExport(input)
}

/** Lazy adapter for the one-page service so business entry points can share one provider shape. */
export async function* iterateSingleExportSlide(
	input: PrepareSingleSlideExportInput,
): AsyncIterable<PreparedExportSlidePage> {
	const result = await prepareSingleSlideExport(input)
	throwIfAborted(input.signal)
	for (let index = 0; index < result.htmlSlides.length; index += 1) {
		yield {
			index,
			html: result.htmlSlides[index],
			key: input.fileId,
			pageName: input.fileName,
			pagePath: input.fileName,
			pageFileId: input.fileId,
		}
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
	const { slidePaths, attachmentList, mainFileId, mainFileName, displayConfig, access, fileApi } =
		await resolvePptExportSlides(input)
	const fileName = displayConfig?.name || mainFileName || "slides"
	if (!slidePaths.length) return { htmlSlides: [], fileName }

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
			const response = await fetchTemporaryDownloadUrls(fileIds, fileApi, access)
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
		displayConfig,
		fileApi,
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
			const response = await fetchTemporaryDownloadUrls(
				Array.from(allResourceFileIds),
				fileApi,
				access,
			)
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
				processedSlides.set(index, processed.content)
			} catch (error) {
				console.error(`[pptService] Failed to process slide ${index}:`, error)
				processedSlides.set(index, content)
			}
		}),
	)

	const htmlSlides = slidePaths.map((_, index) => processedSlides.get(index) ?? "")

	return {
		htmlSlides,
		fileName,
	}
}

/**
 * Prepare multi-page slides one at a time.
 *
 * `prepareExportSlides()` remains the compatibility API for callers that need an array. Large
 * PPTX exports should use this provider so raw HTML, resource URL maps, and processed HTML from
 * an already committed page can be released before the next page is fetched.
 */
export async function* iterateExportSlides(
	input: IterateExportSlidesInput,
): AsyncIterable<PreparedExportSlidePage> {
	const { signal } = input
	const { slidePaths, attachmentList, mainFileId, mainFileName, displayConfig, access, fileApi } =
		await resolvePptExportSlides(input)
	if (!slidePaths.length) return

	const searchScope = ensureFlatScope(attachmentList, mainFileId)
	const pathToFileId = new Map<string, string>()
	const fileIds: string[] = []

	for (const path of slidePaths) {
		const fileId = extractFileIdFromPath(path, searchScope, mainFileId)
		if (!fileId) continue
		pathToFileId.set(path, fileId)
		fileIds.push(fileId)
	}

	const pathToUrl = new Map<string, string>()
	if (fileIds.length > 0) {
		try {
			const response = await waitForAbortable(
				fetchTemporaryDownloadUrls(fileIds, fileApi, access),
				signal,
			)
			response?.forEach((item: GetTemporaryDownloadUrlItem) => {
				if (!item.file_id || !item.url) return
				pathToFileId.forEach((fileId, path) => {
					if (fileId === item.file_id) pathToUrl.set(path, item.url)
				})
			})
		} catch (error) {
			if (signal?.aborted || isAbortError(error)) throw createAbortError(signal, error)
			console.error("[pptService] Failed to fetch slide download URLs:", error)
		}
	}

	const loaderService = new SlideLoaderService()
	const processorService = new SlideProcessorService({
		attachments: searchScope,
		attachmentList: searchScope,
		mainFileId,
		mainFileName,
		displayConfig,
		fileApi,
	})

	let preparedPageCount = 0
	let skippedPageCount = 0
	for (let index = 0; index < slidePaths.length; index += 1) {
		throwIfAborted(signal)
		const path = slidePaths[index]
		const url = pathToUrl.get(path)
		if (!url) {
			skippedPageCount += 1
			console.error(`[pptService] No download URL was available for slide ${index}:`, path)
			continue
		}

		try {
			const rawContent = await waitForAbortable(loaderService.loadSlide(url), signal)
			throwIfAborted(signal)
			const fileId = pathToFileId.get(path)
			const fileItem = searchScope.find((item) => item.file_id === fileId)
			const relativeFilePath = fileItem?.relative_file_path?.replace(
				fileItem?.file_name || "",
				"",
			)

			const resourceIds = processorService.collectFileIds(rawContent, index, relativeFilePath)
			const resourceUrlMapping = new Map<string, string>()
			if (resourceIds.size > 0) {
				try {
					const response = await waitForAbortable(
						fetchTemporaryDownloadUrls(Array.from(resourceIds), fileApi, access),
						signal,
					)
					response?.forEach((item: GetTemporaryDownloadUrlItem) => {
						if (item.file_id && item.url) resourceUrlMapping.set(item.file_id, item.url)
					})
				} catch (error) {
					if (signal?.aborted || isAbortError(error))
						throw createAbortError(signal, error)
					console.error(
						`[pptService] Failed to fetch resources for slide ${index}:`,
						error,
					)
				}
			}

			const processed = await waitForAbortable(
				processorService.processSlideWithUrlMapping(
					rawContent,
					index,
					relativeFilePath,
					resourceUrlMapping,
				),
				signal,
			)
			throwIfAborted(signal)
			preparedPageCount += 1
			yield {
				index,
				key: path,
				html: typeof processed === "string" ? processed : processed.content,
				pageName: fileItem?.file_name || path.split("/").pop() || path,
				pagePath: path,
				pageFileId: fileId,
			}
		} catch (error) {
			if (signal?.aborted || isAbortError(error)) throw createAbortError(signal, error)
			console.error(`[pptService] Failed to prepare slide ${index}:`, error)
			skippedPageCount += 1
		}
	}

	if (preparedPageCount === 0 && skippedPageCount > 0) {
		throw new Error("No exportable slides could be prepared")
	}
}

function throwIfAborted(signal?: AbortSignal): void {
	if (!signal?.aborted) return
	throw createAbortError(signal)
}

function waitForAbortable<T>(promise: PromiseLike<T>, signal?: AbortSignal): Promise<T> {
	if (!signal) return Promise.resolve(promise)
	if (signal.aborted) return Promise.reject(createAbortError(signal))

	return new Promise<T>((resolve, reject) => {
		let settled = false
		const onAbort = () => {
			if (settled) return
			settled = true
			signal.removeEventListener("abort", onAbort)
			reject(createAbortError(signal))
		}
		signal.addEventListener("abort", onAbort, { once: true })
		Promise.resolve(promise).then(
			(value) => {
				if (settled) return
				settled = true
				signal.removeEventListener("abort", onAbort)
				resolve(value)
			},
			(error) => {
				if (settled) return
				settled = true
				signal.removeEventListener("abort", onAbort)
				reject(error)
			},
		)
	})
}

function isAbortError(error: unknown): boolean {
	return (
		(typeof DOMException !== "undefined" &&
			error instanceof DOMException &&
			error.name === "AbortError") ||
		(typeof error === "object" &&
			error !== null &&
			"name" in error &&
			(error as { name?: unknown }).name === "AbortError")
	)
}

function createAbortError(signal?: AbortSignal, cause?: unknown): Error {
	const reason = signal?.reason
	if (reason instanceof Error && reason.name === "AbortError") return reason
	if (typeof DOMException !== "undefined") {
		return new DOMException(
			reason === undefined
				? cause instanceof Error
					? cause.message
					: "The operation was aborted"
				: String(reason),
			"AbortError",
		)
	}
	const error = new Error(
		reason === undefined
			? cause instanceof Error
				? cause.message
				: "The operation was aborted"
			: String(reason),
	)
	error.name = "AbortError"
	return error
}
