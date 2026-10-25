import {
	processHtmlContent,
	type HtmlPreviewBundledTemplateKind,
} from "@/pages/superMagic/components/Detail/contents/HTML/htmlProcessor"
import { inlineDashboardDataJs } from "@/pages/superMagic/components/Detail/contents/HTML/dashboard/resourceVersioning"
import {
	injectFetchInterceptorScript,
	POST_MESSAGE_TARGET_STRATEGIES,
	type PostMessageTargetStrategy,
} from "@/pages/superMagic/components/Detail/contents/HTML/utils/fetchInterceptor"
import { findMatchingFile } from "@/pages/superMagic/components/Detail/contents/HTML/utils"
import { downloadFileContent, getTemporaryDownloadUrl } from "@/pages/superMagic/utils/api"
import type { FileAccessContext } from "@/pages/superMagic/fileAccess/fileAccessContext"
import type { FileApi } from "@/pages/superMagic/fileAccess/fileApi"

interface HtmlExportAttachment extends Record<string, unknown> {
	file_id?: string
	file_name?: string
	relative_file_path?: string
	is_directory?: boolean
	children?: HtmlExportAttachment[]
}

type HtmlExportDisplayConfig = Record<string, unknown>

const EXPORT_LOCAL_SCRIPT_NAMES = ["config.js", "magic.project.js"] as const
type ExportLocalScriptName = (typeof EXPORT_LOCAL_SCRIPT_NAMES)[number]

export interface PrepareHtmlForExportOptions {
	content: string
	attachments?: HtmlExportAttachment[]
	fileId?: string
	fileName?: string
	attachmentList?: HtmlExportAttachment[]
	displayConfig?: HtmlExportDisplayConfig
	htmlPreviewBundledTemplate?: HtmlPreviewBundledTemplateKind
	postMessageTargetStrategy?: PostMessageTargetStrategy
	access?: FileAccessContext
	fileApi?: FileApi
}

export interface PrepareHtmlPagesForExportOptions extends Omit<
	PrepareHtmlForExportOptions,
	"content"
> {
	pages: Iterable<string | PreparedHtmlPageInput> | AsyncIterable<string | PreparedHtmlPageInput>
	signal?: AbortSignal
}

/** Optional source identity retained while HTML is prepared for PPT export diagnostics. */
export interface PreparedHtmlPageInput {
	html: string
	index?: number
	key?: string
	pageName?: string
	pagePath?: string
	pageFileId?: string
}

export interface PreparedHtmlPage {
	index: number
	html: string
	key?: string
	pageName?: string
	pagePath?: string
	pageFileId?: string
}

function flattenHtmlExportAttachments(items: HtmlExportAttachment[] = []): HtmlExportAttachment[] {
	return items.reduce<HtmlExportAttachment[]>((acc, item) => {
		if (item.is_directory && item.children?.length) {
			return [...acc, ...flattenHtmlExportAttachments(item.children)]
		}
		return [...acc, item]
	}, [])
}

function resolveHtmlPreviewBundledTemplate(
	displayConfig?: HtmlExportDisplayConfig,
): HtmlPreviewBundledTemplateKind | undefined {
	if (displayConfig?.type === "dashboard") return "dashboard"
	if (displayConfig?.type === "audio") return "audio"
	if (displayConfig?.type === "video") return "video"
	return undefined
}

function getHtmlRelativeFolderPath(input: {
	fileId?: string
	attachmentList?: HtmlExportAttachment[]
}): string | undefined {
	const { fileId, attachmentList } = input
	if (!fileId || !attachmentList?.length) return undefined

	const allFiles = flattenHtmlExportAttachments(attachmentList)
	const currentFile = allFiles.find((item) => item.file_id === fileId)
	if (!currentFile?.relative_file_path || !currentFile?.file_name) return undefined

	if (currentFile.is_directory) {
		return currentFile.relative_file_path.endsWith("/")
			? currentFile.relative_file_path
			: `${currentFile.relative_file_path}/`
	}

	const lastSlashIndex = currentFile.relative_file_path.lastIndexOf("/")
	if (lastSlashIndex === -1) return ""

	return currentFile.relative_file_path.slice(0, lastSlashIndex + 1)
}

function findSiblingExportFile(
	fileName: string,
	input: {
		fileId?: string
		attachmentList?: HtmlExportAttachment[]
	},
): HtmlExportAttachment | undefined {
	const htmlRelativeFolderPath = getHtmlRelativeFolderPath(input)
	if (htmlRelativeFolderPath === undefined || !input.attachmentList?.length) return undefined

	const allFiles = flattenHtmlExportAttachments(input.attachmentList)

	return (
		findMatchingFile({
			path: `./${fileName}`,
			allFiles,
			htmlRelativeFolderPath,
		}) ||
		findMatchingFile({
			path: fileName,
			allFiles,
			htmlRelativeFolderPath,
		}) ||
		allFiles.find(
			(item) => item.relative_file_path === `${htmlRelativeFolderPath}${fileName}`,
		) ||
		allFiles.find(
			(item) => item.file_name === fileName || item.file_name?.endsWith(`/${fileName}`),
		)
	)
}

async function loadSiblingExportFileContent(
	fileName: string,
	input: {
		fileId?: string
		attachmentList?: HtmlExportAttachment[]
		access?: FileAccessContext
		fileApi?: FileApi
	},
): Promise<string | undefined> {
	const file = findSiblingExportFile(fileName, input)
	if (!file?.file_id) return undefined

	try {
		const fetchUrls = input.fileApi?.getTemporaryDownloadUrl ?? getTemporaryDownloadUrl
		const [urlItem] =
			(await fetchUrls({
				file_ids: [file.file_id],
				access: input.access,
			})) ?? []
		if (!urlItem?.url) return undefined

		const content = await downloadFileContent(urlItem.url)
		return typeof content === "string" ? content : undefined
	} catch (error) {
		console.warn(`[htmlExportPrepare] Failed to load ${fileName} for export`, error)
		return undefined
	}
}

async function loadDashboardDataJsContent(input: {
	fileId?: string
	attachmentList?: HtmlExportAttachment[]
	access?: FileAccessContext
	fileApi?: FileApi
}): Promise<string | undefined> {
	return loadSiblingExportFileContent("data.js", input)
}

function getHtmlDocumentDoctype(doc: Document): string {
	const { doctype } = doc
	if (!doctype) return ""

	let doctypeString = `<!DOCTYPE ${doctype.name}`
	if (doctype.publicId) {
		doctypeString += ` PUBLIC "${doctype.publicId}"`
	}
	if (doctype.systemId) {
		doctypeString += ` "${doctype.systemId}"`
	}
	return `${doctypeString}>\n`
}

function getScriptFileName(src: string): string | undefined {
	const cleanSrc = src.split(/[?#]/)[0]
	try {
		const url = new URL(src, "https://magic-web.local")
		return url.pathname.split("/").filter(Boolean).pop()
	} catch {
		return cleanSrc.split("/").filter(Boolean).pop()
	}
}

function escapeInlineScriptContent(content: string): string {
	return content.replace(/<\/script/gi, "<\\/script")
}

function isExportLocalScriptName(fileName: string): fileName is ExportLocalScriptName {
	return EXPORT_LOCAL_SCRIPT_NAMES.some((scriptName) => scriptName === fileName)
}

async function inlineExportLocalScripts(
	html: string,
	input: {
		fileId?: string
		attachmentList?: HtmlExportAttachment[]
		access?: FileAccessContext
		fileApi?: FileApi
	},
): Promise<string> {
	if (typeof DOMParser === "undefined") return html

	const doc = new DOMParser().parseFromString(html, "text/html")
	const scripts = Array.from(doc.querySelectorAll("script[src]"))
	const contentCache = new Map<string, string | undefined>()

	for (const script of scripts) {
		const src = script.getAttribute("src")
		if (!src) continue

		const fileName = getScriptFileName(src)
		if (!fileName || !isExportLocalScriptName(fileName)) continue

		if (!contentCache.has(fileName)) {
			contentCache.set(fileName, await loadSiblingExportFileContent(fileName, input))
		}

		const content = contentCache.get(fileName)
		script.setAttribute("data-export-original-src", src)
		script.removeAttribute("src")

		if (content) {
			script.setAttribute("data-export-inlined", fileName)
			script.textContent = escapeInlineScriptContent(content)
		}
	}

	return getHtmlDocumentDoctype(doc) + doc.documentElement.outerHTML
}

export async function prepareHtmlForExport(options: PrepareHtmlForExportOptions): Promise<string> {
	const htmlPreviewBundledTemplate =
		options.htmlPreviewBundledTemplate ??
		resolveHtmlPreviewBundledTemplate(options.displayConfig)

	const result = await processHtmlContent({
		content: options.content,
		attachments: options.attachments,
		fileId: options.fileId,
		fileName: options.fileName,
		attachmentList: options.attachmentList,
		displayConfig: options.displayConfig,
		htmlPreviewBundledTemplate,
		access: options.access,
		fileApi: options.fileApi,
	})

	let processedContent = result.processedContent

	if (htmlPreviewBundledTemplate === "dashboard") {
		processedContent = inlineDashboardDataJs({
			html: processedContent,
			dataJsContent: await loadDashboardDataJsContent({
				fileId: options.fileId,
				attachmentList: options.attachmentList,
				access: options.access,
				fileApi: options.fileApi,
			}),
		})
	}

	processedContent = await inlineExportLocalScripts(processedContent, {
		fileId: options.fileId,
		attachmentList: options.attachmentList,
		access: options.access,
		fileApi: options.fileApi,
	})

	return injectFetchInterceptorScript(processedContent, {
		fileId: options.fileId || "",
		postMessageTargetStrategy:
			options.postMessageTargetStrategy ??
			POST_MESSAGE_TARGET_STRATEGIES.SAME_ORIGIN_ANCESTOR,
	})
}

export async function prepareHtmlPagesForExport(
	options: PrepareHtmlPagesForExportOptions,
): Promise<string[]> {
	const preparedPages: string[] = []
	for await (const page of iteratePreparedHtmlPages(options)) {
		preparedPages.push(page.html)
	}
	return preparedPages
}

/**
 * Prepare one page at a time so a large export never keeps hundreds of page-preparation
 * promises, processed HTML strings, and their attachment lookups alive concurrently.
 */
export async function* iteratePreparedHtmlPages(
	options: PrepareHtmlPagesForExportOptions,
): AsyncIterable<PreparedHtmlPage> {
	const { pages, signal, ...pageOptions } = options
	let index = 0
	for await (const page of pages) {
		throwIfAborted(signal)
		const sourcePage = typeof page === "string" ? { html: page } : page
		const html = await waitForAbortable(
			prepareHtmlForExport({
				...pageOptions,
				content: sourcePage.html,
			}),
			signal,
		)
		throwIfAborted(signal)
		yield {
			index: sourcePage.index ?? index,
			html,
			...(sourcePage.key ? { key: sourcePage.key } : {}),
			...(sourcePage.pageName ? { pageName: sourcePage.pageName } : {}),
			...(sourcePage.pagePath ? { pagePath: sourcePage.pagePath } : {}),
			...(sourcePage.pageFileId ? { pageFileId: sourcePage.pageFileId } : {}),
		}
		index += 1
	}
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

function throwIfAborted(signal?: AbortSignal): void {
	if (signal?.aborted) throw createAbortError(signal)
}

function createAbortError(signal: AbortSignal): Error {
	if (signal.reason instanceof Error && signal.reason.name === "AbortError") return signal.reason
	if (typeof DOMException !== "undefined") {
		return new DOMException(
			signal.reason === undefined ? "The operation was aborted" : String(signal.reason),
			"AbortError",
		)
	}
	const error = new Error(
		signal.reason === undefined ? "The operation was aborted" : String(signal.reason),
	)
	error.name = "AbortError"
	return error
}
