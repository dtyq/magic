import type { ImageProcessOptions } from "@/utils/image-processing"
import type { FileApi } from "@/pages/superMagic/fileAccess/fileApi"
import {
	extractSlidesFromScript,
	flattenAttachments,
	handleHtCdnUrl,
	SLIDE_BRIDGE_PLACEHOLDER_COMMENT,
} from "./utils"
import { injectAtPolyfillScript } from "./utils/polyfill"
import {
	applyDashboardBundledShellToHtml,
	getBundledTemplateHtmlByKind,
	omitDashboardShellFromFetchPlan,
	type HtmlPreviewBundledTemplateKind,
} from "./html-preview-bundled-shell"
import { parseMagicProjectJsContent } from "./utils/magicProjectParser"
import {
	collectHtmlResourcePlan,
	resolveExternalCssResources,
	type ExternalCssResource,
} from "./utils/htmlResourceCollector"
import { replaceHtmlResourceUrls } from "./utils/htmlResourceReplacement"
import { serializeHtmlDocument } from "./utils/serializeHtmlDocument"

export type { HtmlPreviewBundledTemplateKind }

function mergePreviewBundledMetadata(
	base: any,
	kind: HtmlPreviewBundledTemplateKind | undefined,
): any {
	if (!kind) return base
	if (kind === "dashboard") {
		return base?.type === "dashboard" ? base : { ...base, type: "dashboard" }
	}
	if (kind === "audio") {
		return base?.type === "audio" ? base : { ...base, type: "audio" }
	}
	return base?.type === "video" ? base : { ...base, type: "video" }
}

/**
 * HTML内容处理器 - 可复用的HTML处理逻辑
 *
 * @example
 * ```typescript
 * // 基本用法
 * const result = await processHtmlContent({
 *   content: htmlString,
 *   attachments: fileAttachments,
 *   fileId: 'file123',
 *   fileName: 'example.html',
 *   attachmentList: allAttachments
 * })
 *
 * // 使用结果
 * console.log(result.processedContent) // 处理后的HTML内容
 * console.log(result.processedSlides) // 提取的幻灯片数组
 * console.log(result.hasSlides) // 是否包含幻灯片
 * console.log(result.fileUrlMapping) // 文件URL映射
 * console.log(result.slidesFileIds) // 幻灯片文件ID数组
 * ```
 */

/**
 * 将 window.location.reload 替换为 window.Magic.reload
 * @param htmlContent - HTML 内容字符串
 * @returns 处理后的 HTML 内容
 */
function replaceLocationReload(htmlContent: string): string {
	// 匹配 window.reload() 和 window.location.reload() 的各种写法
	// 包括 reload()、reload(true)、reload(false) 以及可能的空格变体
	return htmlContent.replace(
		/(^|[^\w$.])window(?:\.location)?\.reload\s*\(\s*(?:true|false)?\s*\)/gi,
		(match, prefix: string) => {
			const originalReload = match.slice(prefix.length)
			// 保存原始代码到注释中，以便保存时恢复
			return `${prefix}/*__ORIGINAL_RELOAD__:${originalReload}__*/window.Magic.reload()`
		},
	)
}

/** Replaces slide bridge scripts with inert comments so saving can restore their exact DOM positions. */
function replaceSlideBridgeScriptsWithPlaceholders(doc: Document): boolean {
	const slideBridgeScripts = Array.from(doc.querySelectorAll("script")).filter((script) =>
		script.getAttribute("src")?.includes("slide-bridge.js"),
	)

	slideBridgeScripts.forEach((script) => {
		script.replaceWith(doc.createComment(SLIDE_BRIDGE_PLACEHOLDER_COMMENT))
	})

	return slideBridgeScripts.length > 0
}

function finalizeHtmlPreviewBundledShell(html: string, input: ProcessHtmlContentInput): string {
	if (input.htmlPreviewBundledTemplate !== "dashboard") return html
	return applyDashboardBundledShellToHtml(html)
}

// 输入参数接口
export interface ProcessHtmlContentInput {
	/** HTML内容字符串 */
	content: string
	/** 附件数组 */
	attachments?: any[]
	/** 文件ID */
	fileId?: string
	/** 文件名 */
	fileName?: string
	/** 附件列表 */
	attachmentList?: any[]
	/** 相对文件夹路径 */
	html_relative_path?: string
	/** 文件显示配置 */
	displayConfig?: any
	/** 预加载的 fileId -> url 映射 (用于批量处理时避免重复请求) */
	preloadedUrlMapping?: Map<string, string>
	/** 指定资源文件的版本号，用于按历史版本渲染依赖资源 */
	resourceFileVersions?: Record<string, number | undefined>
	/**
	 * 仅详情页 HTML 可视化预览：使用构建内 templates 入口 HTML；dashboard 另将 index.css / dashboard.js 换为打包 URL；audio/video 仅换 HTML 正文。数据与 magic.project 等仍走附件 OSS。
	 */
	htmlPreviewBundledTemplate?: HtmlPreviewBundledTemplateKind
	/** 图片处理参数，用于对资源图片进行压缩/缩放（通过 X-Magic-Image-Process 请求头） */
	xMagicImageProcess?: ImageProcessOptions
	access?: import("@/pages/superMagic/fileAccess/fileAccessContext").FileAccessContext | null
	/** Bound file client for callers outside the main HTML preview tree. */
	fileApi?: FileApi
}

// 输出结果接口
export interface ProcessHtmlContentOutput {
	/** 处理后的HTML内容 */
	processedContent: string
	/** 是否包含幻灯片 */
	hasSlides: boolean
	/** 文件路径映射关系 */
	filePathMapping: Map<string, string>
	/** 幻灯片路径到文件ID的映射 */
	slidesMap: Map<string, string>
	/** 原始幻灯片路径数组 */
	originalSlidesPaths: string[]
	/** 稳定的引用资源版本；null 表示本次资源不足以支持跨刷新缓存。 */
	resourceVersionSignature?: string | null
}

/**
 * Collect all file IDs needed from HTML content (without fetching URLs)
 * Used for batch processing to avoid duplicate requests
 * @param input Input parameters (same as processHtmlContent)
 * @returns Set of file IDs that need to be fetched
 */
export function collectFileIdsFromHtml(input: ProcessHtmlContentInput): Set<string> {
	const { content, attachments, html_relative_path, displayConfig } = input

	// If no content or no attachments, return empty set
	if (!content || !attachments || attachments.length === 0) {
		return new Set()
	}

	// Parse HTML
	const parser = new DOMParser()
	const htmlDoc = parser.parseFromString(content, "text/html")

	// Flatten attachments
	const allFiles = flattenAttachments(attachments)

	// Get relative folder path
	const relativeFolderPath = html_relative_path || ""

	// Use shared logic to collect file IDs
	const { fileIdsToFetch } = collectHtmlResourcePlan(
		htmlDoc,
		allFiles,
		relativeFolderPath,
		displayConfig,
	)

	// Return unique file IDs
	return new Set(fileIdsToFetch)
}

/**
 * 处理HTML内容，替换相对路径为临时下载URL
 * @param input 输入参数
 * @returns 处理结果
 */
export async function processHtmlContent(
	input: ProcessHtmlContentInput,
): Promise<ProcessHtmlContentOutput> {
	const { content, attachments, fileId, displayConfig, attachmentList, html_relative_path } =
		input

	const previewKind = input.htmlPreviewBundledTemplate
	const bundledTemplateHtml = previewKind ? getBundledTemplateHtmlByKind(previewKind) : ""
	const sourceHtml = bundledTemplateHtml.length > 0 ? bundledTemplateHtml : content || ""
	const parsedMagicProject = parseMagicProjectJsContent(sourceHtml)
	const processingMetadata = mergePreviewBundledMetadata(
		parsedMagicProject?.config
			? {
					...displayConfig,
					...parsedMagicProject.config,
					slides: parsedMagicProject.slides,
				}
			: displayConfig,
		previewKind,
	)

	const applyPreviewShell = (html: string) => finalizeHtmlPreviewBundledShell(html, input)

	// 初始化返回值
	const result: ProcessHtmlContentOutput = {
		processedContent: sourceHtml,
		hasSlides: false,
		filePathMapping: new Map<string, string>(),
		slidesMap: new Map<string, string>(),
		originalSlidesPaths: [],
		resourceVersionSignature: null,
	}

	// 如果没有内容，直接返回
	if (!sourceHtml) {
		result.processedContent = applyPreviewShell(result.processedContent)
		return result
	}

	// 如果没有附件，应用替换后直接返回
	if (!attachments || attachments.length === 0) {
		let processedContent = replaceLocationReload(sourceHtml)
		// 注入 at() polyfill 脚本
		processedContent = injectAtPolyfillScript(processedContent)
		result.processedContent = applyPreviewShell(processedContent)
		return result
	}

	// 获取当前HTML文件的相对文件夹路径
	let htmlRelativeFolderPath = "/"
	if (fileId && attachmentList && attachmentList.length > 0) {
		const currentFile = attachmentList.find((item) => item.file_id === fileId)
		if (currentFile && currentFile.relative_file_path && currentFile.file_name) {
			// 从relative_file_path中去掉file_name，得到文件夹路径
			htmlRelativeFolderPath = currentFile.relative_file_path.replace(
				currentFile.file_name,
				"",
			)
		}
	}

	// 在调用 handleHtCdnUrl 之前，检测原始HTML中是否有 slide-bridge.js
	// 如果有，添加标记以便后续恢复
	let contentWithMarker = sourceHtml
	const tempParser = new DOMParser()
	const tempDoc = tempParser.parseFromString(sourceHtml, "text/html")
	const hasSlideBridge = replaceSlideBridgeScriptsWithPlaceholders(tempDoc)
	if (hasSlideBridge && tempDoc.body) {
		tempDoc.body.setAttribute("data-has-slide-bridge", "true")
		// 获取DOCTYPE
		const doctype = tempDoc.doctype
		let doctypeString = ""
		if (doctype) {
			doctypeString = `<!DOCTYPE ${doctype.name}`
			if (doctype.publicId) {
				doctypeString += ` PUBLIC "${doctype.publicId}"`
			}
			if (doctype.systemId) {
				doctypeString += ` "${doctype.systemId}"`
			}
			doctypeString += ">\n"
		}
		contentWithMarker = doctypeString + tempDoc.documentElement.outerHTML
	}

	const htmlDoc = handleHtCdnUrl(contentWithMarker)

	// 保留文本／属性实体及 script/style 原始内容，供后续 URL 替换、脚本注入等使用。
	const modifiedHtmlContent = serializeHtmlDocument(htmlDoc)

	// 创建新的解析器和文档对象，使用修改后的内容继续处理
	const newParser = new DOMParser()
	const newHtmlDoc = newParser.parseFromString(sourceHtml, "text/html")

	const allFiles = flattenAttachments(attachments)

	// 从已扁平化的 allFiles 构建文件 ID 到更新时间的映射，用于 URL 缓存判断
	// 复用已扁平化的结果，避免重复扁平化 attachmentList
	const fileUpdatedAtMap = new Map<string, string>()
	const fileVersionMap = new Map<string, string>()
	for (const file of allFiles) {
		if (file.file_id && file.updated_at) {
			fileUpdatedAtMap.set(file.file_id, file.updated_at)
		}
		const version: unknown = (file as { file_version?: unknown }).file_version
		if (file.file_id) {
			if (typeof version === "number" && Number.isFinite(version) && version > 0) {
				fileVersionMap.set(file.file_id, `version:${version}`)
			} else if (file.updated_at) {
				fileVersionMap.set(file.file_id, `updated:${file.updated_at}`)
			}
		}
	}

	// 首先提取slides数组
	let extractedSlides: string[] = parsedMagicProject?.slides || []
	let foundSlides = extractedSlides.length > 0
	const scriptElements2 = newHtmlDoc.getElementsByTagName("script")
	if (extractedSlides.length === 0) {
		for (let i = 0; i < scriptElements2.length; i++) {
			const script = scriptElements2[i]
			const scriptContent = script.textContent || script.innerHTML || ""
			if (scriptContent.includes("slides")) {
				foundSlides = true
				const slides = processingMetadata?.slides || extractSlidesFromScript(scriptContent)
				if (slides.length > 0) {
					extractedSlides = slides
					break
				}
			}
		}
	}
	result.hasSlides = foundSlides

	// 支持传入html_relative_path，用于处理ppt场景下iframe的相对路径
	const relativeFolderPath = html_relative_path || htmlRelativeFolderPath

	// Use shared logic to collect file IDs and build tracking maps
	const {
		fileIdsToFetch: collectedFileIds,
		urlMap,
		filePathMap,
		slidesMap,
		imageFileIds,
		imageProcessingFileIds,
	} = collectHtmlResourcePlan(newHtmlDoc, allFiles, relativeFolderPath, processingMetadata)
	const resourcePlan = {
		fileIdsToFetch: collectedFileIds,
		urlMap,
		filePathMap,
		slidesMap,
		imageFileIds,
		imageProcessingFileIds,
	}
	const externalCssResources: ExternalCssResource[] = await resolveExternalCssResources({
		plan: resourcePlan,
		allFiles,
		access: input.access,
		fileApi: input.fileApi,
	})

	let fileIdsToFetch = collectedFileIds
	if (previewKind === "dashboard") {
		fileIdsToFetch = omitDashboardShellFromFetchPlan(fileIdsToFetch, urlMap)
	}

	// 复用已解析的资源计划，只纳入本页依赖；页序和临时签名不代表图片内容变化。
	const resourceVersions: string[][] = []
	let hasResourceVersions = true
	for (const id of [...new Set(fileIdsToFetch)].sort()) {
		if (urlMap.get(id)?.attr === "slides") continue
		const version = input.resourceFileVersions?.[id]
		const resourceVersion =
			typeof version === "number" && Number.isFinite(version) && version > 0
				? `version:${version}`
				: fileVersionMap.get(id)
		if (!resourceVersion) hasResourceVersions = false
		else resourceVersions.push([id, resourceVersion])
	}
	const resourceVersionSignature = hasResourceVersions ? JSON.stringify(resourceVersions) : null

	// If there are resources to replace, fetch their temporary URLs
	if (fileIdsToFetch.length > 0) {
		try {
			const replacedResources = await replaceHtmlResourceUrls({
				fileIds: fileIdsToFetch,
				resourceFileVersions: input.resourceFileVersions,
				preloadedUrlMapping: input.preloadedUrlMapping,
				imageProcessOptions: input.xMagicImageProcess,
				imageFileIds,
				imageProcessingFileIds,
				fileUpdatedAtMap,
				htmlContent: modifiedHtmlContent,
				urlMap,
				filePathMap,
				processingMetadata,
				allFiles,
				relativeFolderPath,
				access: input.access,
				fileApi: input.fileApi,
				externalCssResources,
			})

			// 替换 window.location.reload 为 window.Magic.reload
			let updatedContent = replaceLocationReload(replacedResources.content)
			// 注入 at() polyfill 脚本
			updatedContent = injectAtPolyfillScript(updatedContent)

			result.processedContent = applyPreviewShell(updatedContent)
			result.filePathMapping = replacedResources.filePathMapping
			if (replacedResources.resourcesResolved) {
				result.resourceVersionSignature = resourceVersionSignature
			}
		} catch (error) {
			console.error("Error fetching resource URLs:", error)
			// 即使出错，也要替换脚本
			let processedContent = replaceLocationReload(modifiedHtmlContent)
			// 注入 at() polyfill 脚本
			processedContent = injectAtPolyfillScript(processedContent)
			result.processedContent = applyPreviewShell(processedContent)
		}
	} else {
		// 没有需要替换的资源，但仍需要替换脚本
		result.resourceVersionSignature = resourceVersionSignature
		let processedContent = replaceLocationReload(modifiedHtmlContent)
		// 注入 at() polyfill 脚本
		processedContent = injectAtPolyfillScript(processedContent)
		result.processedContent = applyPreviewShell(processedContent)
	}

	// 将 slidesMap 和原始路径添加到结果中
	result.slidesMap = slidesMap
	result.originalSlidesPaths = extractedSlides

	return result
}
