import {
	getTemporaryDownloadUrl,
	type GetTemporaryDownloadUrlItem,
} from "@/pages/superMagic/utils/api"
import {
	extractSlidesFromScript,
	flattenAttachments,
	processElementsWithAttribute,
	processSlidesArray,
	processStyleUrls,
	processInlineStyles,
	processAudioArray,
	handleHtCdnUrl,
} from "./utils"
import { processDashboardArray } from "./dashboard/utils"
import {
	createPreloadedUrlMapping,
	injectMediaInterceptorScript,
	type FileItem,
} from "./utils/mediaInterceptor"
import { injectAtPolyfillScript } from "./utils/polyfill"
import { UrlCacheManager } from "./utils/urlCache"

/**
 * URL 缓存管理器实例
 * 使用模块级缓存，避免重复请求未过期的 URL
 */
const urlCacheManager = new UrlCacheManager()

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
	// 匹配 window.location.reload() 的各种写法
	// 包括：window.location.reload()、window.location.reload(true)、window.location.reload(false)
	// 以及可能的空格变体
	return htmlContent.replace(
		/window\.location\.reload\s*\(\s*(?:true|false)?\s*\)/gi,
		(match) => {
			// 保存原始代码到注释中，以便保存时恢复
			return `/*__ORIGINAL_RELOAD__:${match}__*/window.Magic.reload()`
		},
	)
}

function restoreSerializedEntities(html: string): string {
	/** 匹配 HTML 实体（命名或数字），用 DOM 解码，不维护映射表且支持 &#123; / &#x7B; */
	const ENTITY_PATTERN = /&(?:[a-z0-9]+|#\d+|#x[0-9a-f]+);/gi
	const el = document.createElement("div")
	return html.replace(ENTITY_PATTERN, (entity) => {
		el.innerHTML = entity
		return el.textContent ?? entity
	})
}

/** 将 Document 序列化为 HTML 字符串并还原实体，保证输出格式与 DOM 语义一致 */
function serializeDocToHtml(doc: Document): string {
	return restoreSerializedEntities(new XMLSerializer().serializeToString(doc))
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
	/** 文件元数据 */
	metadata?: any
	/** 预加载的 fileId -> url 映射 (用于批量处理时避免重复请求) */
	preloadedUrlMapping?: Map<string, string>
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
}

/**
 * Internal helper: Process HTML document and collect file IDs
 * Shared logic used by both collectFileIdsFromHtml and processHtmlContent
 * @param htmlDoc - Parsed HTML document
 * @param allFiles - Flattened attachments array
 * @param relativeFolderPath - Relative folder path
 * @param metadata - File metadata
 * @returns Object containing fileIdsToFetch and other tracking maps
 */
function processHtmlDocForFileIds(
	htmlDoc: Document,
	allFiles: any[],
	relativeFolderPath: string,
	metadata?: any,
): {
	fileIdsToFetch: string[]
	urlMap: Map<string, any>
	filePathMap: Map<string, string>
	slidesMap: Map<string, string>
} {
	const fileIdsToFetch: string[] = []
	const urlsToReplace: string[] = []
	const urlMap = new Map<string, any>()
	const filePathMap = new Map<string, string>()
	const slidesMap = new Map<string, string>()

	// Process all elements with src/href attributes
	processElementsWithAttribute({
		elements: htmlDoc.getElementsByTagName("img"),
		attributeName: "src",
		tagName: "img",
		allFiles,
		urlsToReplace,
		fileIdsToFetch,
		urlMap,
		htmlRelativeFolderPath: relativeFolderPath,
	})

	processElementsWithAttribute({
		elements: htmlDoc.getElementsByTagName("link"),
		attributeName: "href",
		tagName: "link",
		allFiles,
		urlsToReplace,
		fileIdsToFetch,
		urlMap,
		additionalFilter: (element) => element.getAttribute("rel") === "stylesheet",
		htmlRelativeFolderPath: relativeFolderPath,
	})

	processElementsWithAttribute({
		elements: htmlDoc.getElementsByTagName("script"),
		attributeName: "src",
		tagName: "script",
		allFiles,
		urlsToReplace,
		fileIdsToFetch,
		urlMap,
		htmlRelativeFolderPath: relativeFolderPath,
	})

	processElementsWithAttribute({
		elements: htmlDoc.getElementsByTagName("iframe"),
		attributeName: "src",
		tagName: "iframe",
		allFiles,
		urlsToReplace,
		fileIdsToFetch,
		urlMap,
		htmlRelativeFolderPath: relativeFolderPath,
	})

	processElementsWithAttribute({
		elements: htmlDoc.getElementsByTagName("source"),
		attributeName: "src",
		tagName: "source",
		allFiles,
		urlsToReplace,
		fileIdsToFetch,
		urlMap,
		htmlRelativeFolderPath: relativeFolderPath,
	})

	processElementsWithAttribute({
		elements: htmlDoc.getElementsByTagName("video"),
		attributeName: "src",
		tagName: "video",
		allFiles,
		urlsToReplace,
		fileIdsToFetch,
		urlMap,
		htmlRelativeFolderPath: relativeFolderPath,
	})

	processElementsWithAttribute({
		elements: htmlDoc.getElementsByTagName("audio"),
		attributeName: "src",
		tagName: "audio",
		allFiles,
		urlsToReplace,
		fileIdsToFetch,
		urlMap,
		htmlRelativeFolderPath: relativeFolderPath,
	})

	processElementsWithAttribute({
		elements: htmlDoc.getElementsByTagName("object"),
		attributeName: "src",
		tagName: "object",
		allFiles,
		urlsToReplace,
		fileIdsToFetch,
		urlMap,
		htmlRelativeFolderPath: relativeFolderPath,
	})

	// Process slides array
	processSlidesArray({
		htmlDoc,
		allFiles,
		fileIdsToFetch,
		urlMap,
		slidesMap,
		htmlRelativeFolderPath: relativeFolderPath,
		metadata,
	})

	// Process style URLs (CSS background images)
	processStyleUrls({
		htmlDoc,
		allFiles,
		fileIdsToFetch,
		filePathMap,
		htmlRelativeFolderPath: relativeFolderPath,
		urlMap,
	})

	// Process inline style attributes (e.g., style="background-image: url(...)")
	processInlineStyles({
		htmlDoc,
		allFiles,
		fileIdsToFetch,
		filePathMap,
		htmlRelativeFolderPath: relativeFolderPath,
		urlMap,
	})

	// Process dashboard arrays
	if (metadata?.type === "dashboard") {
		processDashboardArray({
			htmlDoc,
			allFiles,
			fileIdsToFetch,
			urlMap,
			htmlRelativeFolderPath: relativeFolderPath,
		})
	}

	// Process audio/video arrays
	if (metadata?.type === "audio" || metadata?.type === "video") {
		processAudioArray({
			htmlDoc,
			allFiles,
			fileIdsToFetch,
			urlMap,
			htmlRelativeFolderPath: relativeFolderPath,
		})
	}

	return { fileIdsToFetch, urlMap, filePathMap, slidesMap }
}

/**
 * Collect all file IDs needed from HTML content (without fetching URLs)
 * Used for batch processing to avoid duplicate requests
 * @param input Input parameters (same as processHtmlContent)
 * @returns Set of file IDs that need to be fetched
 */
export function collectFileIdsFromHtml(input: ProcessHtmlContentInput): Set<string> {
	const { content, attachments, html_relative_path, metadata } = input

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
	const { fileIdsToFetch } = processHtmlDocForFileIds(
		htmlDoc,
		allFiles,
		relativeFolderPath,
		metadata,
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
	const { content, attachments, fileId, metadata, attachmentList, html_relative_path } = input

	// 初始化返回值
	const result: ProcessHtmlContentOutput = {
		processedContent: content || "",
		hasSlides: false,
		filePathMapping: new Map<string, string>(),
		slidesMap: new Map<string, string>(),
		originalSlidesPaths: [],
	}

	// 如果没有内容，直接返回
	if (!content) {
		return result
	}

	// 如果没有附件，应用替换后直接返回
	if (!attachments || attachments.length === 0) {
		let processedContent = replaceLocationReload(content)
		// 注入 at() polyfill 脚本
		processedContent = injectAtPolyfillScript(processedContent)
		result.processedContent = processedContent
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
	let contentWithMarker = content
	const tempParser = new DOMParser()
	const tempDoc = tempParser.parseFromString(content, "text/html")
	const hasSlideBridge = Array.from(tempDoc.querySelectorAll("script")).some((script) =>
		script.getAttribute("src")?.includes("slide-bridge.js"),
	)
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

	// 将 Document 转成字符串（并还原序列化产生的实体），供后续 URL 替换、脚本注入等使用。
	const modifiedHtmlContent = serializeDocToHtml(htmlDoc)

	// 创建新的解析器和文档对象，使用修改后的内容继续处理
	const newParser = new DOMParser()
	const newHtmlDoc = newParser.parseFromString(content, "text/html")

	const allFiles = flattenAttachments(attachments)

	// 从已扁平化的 allFiles 构建文件 ID 到更新时间的映射，用于 URL 缓存判断
	// 复用已扁平化的结果，避免重复扁平化 attachmentList
	const fileUpdatedAtMap = new Map<string, string>()
	for (const file of allFiles) {
		if (file.file_id && file.updated_at) {
			fileUpdatedAtMap.set(file.file_id, file.updated_at)
		}
	}

	// 首先提取slides数组
	let extractedSlides: string[] = []
	let foundSlides = false
	const scriptElements2 = newHtmlDoc.getElementsByTagName("script")
	for (let i = 0; i < scriptElements2.length; i++) {
		const script = scriptElements2[i]
		const scriptContent = script.textContent || script.innerHTML || ""
		if (scriptContent.includes("slides")) {
			foundSlides = true
			const slides = metadata?.slides || extractSlidesFromScript(scriptContent)
			if (slides.length > 0) {
				extractedSlides = slides
				break
			}
		}
	}
	result.hasSlides = foundSlides

	// 支持传入html_relative_path，用于处理ppt场景下iframe的相对路径
	const relativeFolderPath = html_relative_path || htmlRelativeFolderPath

	// Use shared logic to collect file IDs and build tracking maps
	const { fileIdsToFetch, urlMap, filePathMap, slidesMap } = processHtmlDocForFileIds(
		newHtmlDoc,
		allFiles,
		relativeFolderPath,
		metadata,
	)

	const magicProjectJSConfig: Record<string, unknown> = {}

	const filePathandOssUrlMap = new Map<string, string>()
	// If there are resources to replace, fetch their temporary URLs
	if (fileIdsToFetch.length > 0) {
		try {
			// Use preloaded URL mapping if provided, otherwise fetch from API
			let urlData: GetTemporaryDownloadUrlItem[] = []
			if (input.preloadedUrlMapping) {
				// Construct urlData from preloaded mapping
				urlData = fileIdsToFetch
					.map((fileId) => ({
						file_id: fileId,
						url: input.preloadedUrlMapping!.get(fileId),
					}))
					.filter((item) => item.url) as GetTemporaryDownloadUrlItem[] // Only include items with valid URLs
			} else {
				// 先检查缓存，传入文件更新时间映射用于判断文件是否已更新
				// 如果文件的 updated_at 更新了，即使 URL 未过期，也会重新获取最新的 URL
				const { cached, missing } = urlCacheManager.getCachedUrls(
					fileIdsToFetch,
					fileUpdatedAtMap,
				)
				urlData = [...cached]

				// 如果有需要重新获取的 file_id（包括 updated_at 更新的文件），调用 API 获取最新的 URL
				if (missing.length > 0) {
					const response = await getTemporaryDownloadUrl({ file_ids: missing })
					const fetchedUrls = response || []
					// 更新缓存，保存最新的 URL 和文件的 updated_at，用于后续判断文件是否已更新
					urlCacheManager.updateUrlCache(fetchedUrls, fileUpdatedAtMap)
					// 合并缓存的 URL 和新获取的 URL
					urlData = [...urlData, ...fetchedUrls]
				}
			}
			// Replace URLs in the HTML content
			let updatedContent = modifiedHtmlContent
			urlData.forEach((item: GetTemporaryDownloadUrlItem) => {
				const resourceInfo = urlMap.get(item.file_id)
				const path = filePathMap.get(item.file_id)
				filePathandOssUrlMap.set(item.url || "", path || "")
				if (resourceInfo && item.url) {
					// 将OSS URL更新到urlMap中，供mediaInterceptor使用
					urlMap.set(item.file_id, { ...resourceInfo, url: item.url })

					if (resourceInfo.attr === "slides") {
						// For slides, we keep original paths in the result
						// No need to replace in HTML content for PPT mode
						// PPTStore will handle URL conversion internally
					} else if (resourceInfo.attr === "data-analyst-dashboard") {
						// 兼容旧页面结构
						const escapedPath = resourceInfo.path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
						const urlRegex = new RegExp(
							`(url\\s*:\\s*)(['"\`])${escapedPath}(['"\`])`,
							"g",
						)
						updatedContent = updatedContent.replace(urlRegex, `$1$2${item.url}$3`)
					} else if (resourceInfo.attr === "data-analyst-project") {
						// 数据分析新页面magic.project.js注入
						switch (resourceInfo.type) {
							case "geo":
								if (!magicProjectJSConfig.geo) {
									magicProjectJSConfig.geo = []
								}
								; (magicProjectJSConfig as any).geo.push({
									name: resourceInfo.fileName.split(".")[0],
									url: item.url,
								})
								break
							case "cleaned_data":
								if (!magicProjectJSConfig.dataSources) {
									magicProjectJSConfig.dataSources = []
								}
								; (magicProjectJSConfig as any).dataSources.push({
									name: resourceInfo.fileName.split(".")[0],
									url: item.url,
								})
								break
							default:
								break
						}
					} else if (resourceInfo.attr === "css-url") {
						// 处理CSS中的url()背景图片
						const escapedPath = resourceInfo.path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
						// 匹配CSS中的url()函数，支持带引号和不带引号的URL
						const cssUrlRegex = new RegExp(
							`url\\(\\s*['"]?${escapedPath}['"]?\\s*\\)`,
							"g",
						)
						// 使用CSS注释保存原始路径
						updatedContent = updatedContent.replace(
							cssUrlRegex,
							`/*__ORIGINAL_URL__:${resourceInfo.path}__*/url('${item.url}')`,
						)
					} else if (resourceInfo.attr === "inline-style") {
						// 处理内联style属性中的url()背景图片
						const escapedPath = resourceInfo.path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
						// 匹配内联style属性中的url()函数，需要匹配整个style属性
						// 使用更精确的正则，匹配包含该URL的style属性
						const inlineStyleRegex = new RegExp(
							`(<${resourceInfo.tag}[^>]*?style=["'])([^"']*?url\\(\\s*['"]?${escapedPath}['"]?\\s*\\)[^"']*?)(["'][^>]*?>)`,
							"gi",
						)
						updatedContent = updatedContent.replace(
							inlineStyleRegex,
							(match, beforeStyle, styleContent, afterStyle) => {
								// 替换style内容中的URL，使用CSS注释保存原始路径
								const replacedStyleContent = styleContent.replace(
									new RegExp(`url\\(\\s*['"]?${escapedPath}['"]?\\s*\\)`, "g"),
									`/*__ORIGINAL_URL__:${resourceInfo.path}__*/url('${item.url}')`,
								)
								return `${beforeStyle}${replacedStyleContent}${afterStyle}`
							},
						)
					} else if (resourceInfo.attr === "data" && resourceInfo.tag === "object") {
						// 对于object标签的data属性，直接使用OSS链接
						const escapedPath = resourceInfo.path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
						const regex = new RegExp(`${resourceInfo.attr}=["']${escapedPath}["']`, "g")
						updatedContent = updatedContent.replace(
							regex,
							`${resourceInfo.attr}="${item.url}"`,
						)
					} else {
						// 处理普通的src/href属性
						const escapedPath = resourceInfo.path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
						// 如果是src属性，需要同时添加data-original-path属性
						if (resourceInfo.attr === "src") {
							// 匹配src属性，并在替换时添加data-original-path属性
							const regex = new RegExp(
								`<(${resourceInfo.tag})([^>]*?)${resourceInfo.attr}=["']${escapedPath}["']([^>]*?)>`,
								"gi",
							)
							updatedContent = updatedContent.replace(
								regex,
								(match, tagName, beforeAttr, afterAttr) => {
									// 添加data-original-path属性保存原始路径，并替换src值
									return `<${tagName}${beforeAttr}${resourceInfo.attr}="${item.url}" data-original-path="${resourceInfo.path}"${afterAttr}>`
								},
							)
						} else {
							// 对于非src属性（如href），也添加data-original-path属性
							const regex = new RegExp(
								`<(${resourceInfo.tag})([^>]*?)${resourceInfo.attr}=["']${escapedPath}["']([^>]*?)>`,
								"gi",
							)
							updatedContent = updatedContent.replace(
								regex,
								(match, tagName, beforeAttr, afterAttr) => {
									// 添加data-original-path属性保存原始路径，并替换属性值
									return `<${tagName}${beforeAttr}${resourceInfo.attr}="${item.url}" data-original-path="${resourceInfo.path}"${afterAttr}>`
								},
							)
						}
					}
				}
			})

			// hook配置进去
			if (metadata?.type === "dashboard" && Object.keys(magicProjectJSConfig).length > 0) {
				const splitUpdatedContent = updatedContent.split("</head>")
				updatedContent = `
					${splitUpdatedContent[0]}
					<script data-injected="true">
						if (window.magicProjectConfigure) {
							window.magicProjectConfigure(${JSON.stringify(magicProjectJSConfig)});
						}
					</script>
					</head>
					${splitUpdatedContent[1]}
				`
			}

			if (metadata?.type === "audio" || metadata?.type === "video") {
				// 为 audio/video 类型注入拦截器，使用预加载的URL映射
				const preloadedMapping = createPreloadedUrlMapping(
					allFiles as FileItem[],
					urlMap,
					relativeFolderPath,
				)

				updatedContent = injectMediaInterceptorScript(updatedContent, {
					enableRelativePathInterception: true,
					preloadedUrlMapping: preloadedMapping,
				})
			}

			// 替换 window.location.reload 为 window.Magic.reload
			updatedContent = replaceLocationReload(updatedContent)
			// 注入 at() polyfill 脚本
			updatedContent = injectAtPolyfillScript(updatedContent)

			result.processedContent = updatedContent
			result.filePathMapping = filePathandOssUrlMap
		} catch (error) {
			console.error("Error fetching resource URLs:", error)
			// 即使出错，也要替换脚本
			let processedContent = replaceLocationReload(modifiedHtmlContent)
			// 注入 at() polyfill 脚本
			processedContent = injectAtPolyfillScript(processedContent)
			result.processedContent = processedContent
		}
	} else {
		// 没有需要替换的资源，但仍需要替换脚本
		let processedContent = replaceLocationReload(modifiedHtmlContent)
		// 注入 at() polyfill 脚本
		processedContent = injectAtPolyfillScript(processedContent)
		result.processedContent = processedContent
	}

	// 将 slidesMap 和原始路径添加到结果中
	result.slidesMap = slidesMap
	result.originalSlidesPaths = extractedSlides

	return result
}
