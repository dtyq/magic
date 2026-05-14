import { env } from "@/utils/env"
import { normalizeConflictingBackgroundDeclarations } from "./background-style"
import { getEditingScript } from "./editing-script"

interface ShouldPromptForServerUpdateOptions {
	latestContent: string
	sessionBaselineContent?: string | null
	lastLocalSavedContent?: string | null
}

interface ResolveServerUpdateStateResult {
	shouldPrompt: boolean
	nextLastLocalSavedContent: string | null
}

interface AttemptHtmlSaveFlowOptions {
	shouldExitAfterSave?: boolean
	refreshServerUpdateState: () => Promise<boolean>
	showConflictDialog: () => void
	checkServerUpdateBeforeSave: () => boolean
	performSave: () => Promise<void>
	exitEditMode?: () => void
	onRefreshServerUpdateError?: (error: unknown) => void
}

interface AttemptHtmlSaveFlowResult {
	didSave: boolean
	isAwaitingConflictConfirmation: boolean
}

interface ConfirmHtmlConflictSaveOptions {
	shouldExitAfterSave?: boolean
	performSave: () => Promise<void>
	exitEditMode?: () => void
}

export function shouldPromptForServerUpdate({
	latestContent,
	sessionBaselineContent,
	lastLocalSavedContent,
}: ShouldPromptForServerUpdateOptions) {
	// No prompt is needed when the latest server payload still matches the baseline
	// that this edit session is built on.
	if (latestContent === sessionBaselineContent) return false
	// Ignore the refresh caused by the user's own successful save, even if the editor keeps extra markers locally.
	if (lastLocalSavedContent && latestContent === lastLocalSavedContent) return false

	return true
}

export function resolveServerUpdateState({
	latestContent,
	sessionBaselineContent,
	lastLocalSavedContent,
}: ShouldPromptForServerUpdateOptions): ResolveServerUpdateStateResult {
	const matchedLastLocalSave =
		lastLocalSavedContent !== null &&
		lastLocalSavedContent !== undefined &&
		latestContent === lastLocalSavedContent

	return {
		shouldPrompt: shouldPromptForServerUpdate({
			latestContent,
			sessionBaselineContent,
			lastLocalSavedContent,
		}),
		// Clear the local-save marker once it has been consumed by a matching server refresh.
		nextLastLocalSavedContent: matchedLastLocalSave ? null : (lastLocalSavedContent ?? null),
	}
}

export async function attemptHtmlSaveFlow({
	shouldExitAfterSave = false,
	refreshServerUpdateState,
	showConflictDialog,
	checkServerUpdateBeforeSave,
	performSave,
	exitEditMode,
	onRefreshServerUpdateError,
}: AttemptHtmlSaveFlowOptions): Promise<AttemptHtmlSaveFlowResult> {
	try {
		const hasLatestConflict = await refreshServerUpdateState()
		if (hasLatestConflict) {
			showConflictDialog()
			return {
				didSave: false,
				isAwaitingConflictConfirmation: true,
			}
		}
	} catch (error) {
		onRefreshServerUpdateError?.(error)
		if (!checkServerUpdateBeforeSave()) {
			return {
				didSave: false,
				isAwaitingConflictConfirmation: true,
			}
		}
	}

	await performSave()
	if (shouldExitAfterSave) exitEditMode?.()

	return {
		didSave: true,
		isAwaitingConflictConfirmation: false,
	}
}

export async function confirmHtmlConflictSave({
	shouldExitAfterSave = false,
	performSave,
	exitEditMode,
}: ConfirmHtmlConflictSaveOptions) {
	await performSave()
	if (shouldExitAfterSave) exitEditMode?.()
}

// 外部资源URL
// const TAILWIND_CSS_URL = "https://cdnjs.cloudflare.com/ajax/libs/tailwindcss/2.2.0/tailwind.min.css"
// const ECHARTS_JS_URL = "https://cdnjs.cloudflare.com/ajax/libs/echarts/5.6.0/echarts.min.js"

// 路径计算函数：处理相对路径拼接
export function resolveRelativePath(basePath: string, relativePath: string): string {
	// 防护检查：参数不能为空
	if (!basePath || !relativePath) {
		console.warn("resolveRelativePath: basePath or relativePath is empty", {
			basePath,
			relativePath,
		})
		return relativePath || ""
	}

	const normalizedBase = basePath.endsWith("/") ? basePath.slice(0, -1) : basePath

	// 如果相对路径是绝对路径，直接返回
	if (relativePath.startsWith("/")) {
		// return relativePath
		return normalizedBase + "/" + relativePath.slice(1)
	}

	// 标准化基础路径（移除末尾的斜杠）

	// 处理以 "./" 开头的路径
	if (relativePath.startsWith("./")) {
		return normalizedBase + "/" + relativePath.slice(2)
	}

	// 处理以 "../" 开头的路径
	if (relativePath.startsWith("../")) {
		const baseParts = normalizedBase.split("/")
		let relativeParts = relativePath.split("/")

		// 计算需要回退的层级数
		let backLevels = 0
		while (relativeParts[0] === "..") {
			backLevels++
			relativeParts = relativeParts.slice(1)
		}

		// 回退基础路径
		if (backLevels >= baseParts.length) {
			// 如果回退层级超过基础路径层级，返回根路径
			return "/" + relativeParts.join("/")
		}

		const newBaseParts = baseParts.slice(0, -backLevels)
		return newBaseParts.join("/") + "/" + relativeParts.join("/")
	}

	// 处理其他相对路径（直接拼接）
	return normalizedBase + "/" + relativePath
}

export function flattenAttachments(items: any[]): any[] {
	return items.reduce((acc: any[], item) => {
		if (item.is_directory && item.children) {
			return [...acc, ...flattenAttachments(item.children)]
		}
		return [...acc, item]
	}, [])
}

// Helper function to check if a URL is a relative path
export function isRelativePath(url: string): boolean {
	return !url.match(/^(https?:\/\/|data:|blob:|\/\/)/i)
}

// Helper function to find matching file in attachments
export function findMatchingFile(data: {
	path: string
	allFiles: any[]
	htmlRelativeFolderPath: string
}): any | null {
	const { path, allFiles, htmlRelativeFolderPath } = data
	// if (path.includes("slide-bridge") || path.includes("magic.project.js")) {
	// 	return null
	// }
	if (path.includes("slide-bridge")) {
		return null
	}
	// 使用新的路径计算函数
	const resolvedPath = resolveRelativePath(htmlRelativeFolderPath, path)

	return allFiles.find((file) => {
		return file.relative_file_path === resolvedPath
	})
}

// Generic function to process elements with src/href attributes
export function processElementsWithAttribute(data: {
	elements: HTMLCollectionOf<Element>
	attributeName: string
	tagName: string
	allFiles: any[]
	urlsToReplace: string[]
	fileIdsToFetch: string[]
	urlMap: Map<string, any>
	additionalFilter?: (element: Element) => boolean
	htmlRelativeFolderPath: string
}): void {
	const {
		elements,
		attributeName,
		tagName,
		allFiles,
		urlsToReplace,
		fileIdsToFetch,
		urlMap,
		additionalFilter,
		htmlRelativeFolderPath,
	} = data
	for (let i = 0; i < elements.length; i++) {
		const element = elements[i]

		// Apply additional filter if provided (e.g., for link tags to check rel="stylesheet")
		if (additionalFilter && !additionalFilter(element)) {
			continue
		}

		const attributeValue = element.getAttribute(attributeName)
		if (attributeValue && isRelativePath(attributeValue)) {
			const matchedFile = findMatchingFile({
				path: attributeValue,
				allFiles,
				htmlRelativeFolderPath,
			})
			if (matchedFile) {
				urlsToReplace.push(attributeValue)
				fileIdsToFetch.push(matchedFile.file_id)
				urlMap.set(matchedFile.file_id, {
					path: attributeValue,
					attr: attributeName,
					tag: tagName,
				})
			}
		}
	}
}

// Helper function to extract slides array from script content
export function extractSlidesFromScript(scriptContent: string): string[] {
	const slides: string[] = []
	try {
		// Match slides array in various formats
		const slidesRegex = /(?:const|let|var)\s+slides\s*=\s*\[([\s\S]*?)\]/g
		const match = slidesRegex.exec(scriptContent)

		if (match && match[1]) {
			// Extract string values from the array
			const arrayContent = match[1]
			const stringRegex = /['"`]([^'"`]+)['"`]/g
			let stringMatch
			while ((stringMatch = stringRegex.exec(arrayContent)) !== null) {
				slides.push(stringMatch[1])
			}
		}
	} catch (error) {
		console.error("Error extracting slides from script:", error)
	}
	return slides
}

// Helper function to process slides array and collect file IDs
export function processSlidesArray(data: {
	htmlDoc: Document
	allFiles: any[]
	fileIdsToFetch: string[]
	urlMap: Map<string, any>
	slidesMap: Map<string, string>
	htmlRelativeFolderPath: string
	displayConfig?: any
}): void {
	const {
		htmlDoc,
		allFiles,
		fileIdsToFetch,
		urlMap,
		slidesMap,
		htmlRelativeFolderPath,
		displayConfig,
	} = data
	const slides = displayConfig?.slides || []
	//新的ppt模式
	if (slides.length > 0) {
		slides.forEach((slidePath: string) => {
			if (isRelativePath(slidePath)) {
				const matchedFile = findMatchingFile({
					path: slidePath,
					allFiles,
					htmlRelativeFolderPath,
				})
				if (matchedFile) {
					fileIdsToFetch.push(matchedFile.file_id)
					urlMap.set(matchedFile.file_id, {
						path: slidePath,
						attr: "slides",
						tag: "script",
						contentType: getContentTypeFromExtension(slidePath),
					})
					slidesMap.set(slidePath, matchedFile.file_id)
				}
			}
		})
	} else {
		const scriptElements = htmlDoc.getElementsByTagName("script")
		for (let i = 0; i < scriptElements.length; i++) {
			const script = scriptElements[i]
			const scriptContent = script.textContent || script.innerHTML || ""

			if (scriptContent.includes("slides")) {
				const slides = extractSlidesFromScript(scriptContent)
				slides.forEach((slidePath: string) => {
					if (isRelativePath(slidePath)) {
						const matchedFile = findMatchingFile({
							path: slidePath,
							allFiles,
							htmlRelativeFolderPath,
						})
						if (matchedFile) {
							fileIdsToFetch.push(matchedFile.file_id)
							urlMap.set(matchedFile.file_id, {
								path: slidePath,
								attr: "slides",
								tag: "script",
								contentType: getContentTypeFromExtension(slidePath),
							})
							slidesMap.set(slidePath, matchedFile.file_id)
						}
					}
				})
			}
		}
	}
}

// Helper function to extract URLs from CSS content
export function extractUrlsFromCSS(cssContent: string): string[] {
	const urls: string[] = []
	try {
		// Match url() functions in CSS, supporting both quoted and unquoted URLs
		const urlRegex = /url\(\s*['"]?([^'")]+)['"]?\s*\)/gi
		let match
		while ((match = urlRegex.exec(cssContent)) !== null) {
			const url = match[1].trim()
			if (url) {
				urls.push(url)
			}
		}
	} catch (error) {
		console.error("Error extracting URLs from CSS:", error)
	}
	return urls
}

// Helper function to process style tags and collect file IDs for CSS url() references
export function processStyleUrls(data: {
	htmlDoc: Document
	allFiles: any[]
	fileIdsToFetch: string[]
	filePathMap: Map<string, any>
	htmlRelativeFolderPath: string
	urlMap: Map<string, any>
}): void {
	const { htmlDoc, allFiles, fileIdsToFetch, filePathMap, htmlRelativeFolderPath, urlMap } = data
	const styleElements = htmlDoc.getElementsByTagName("style")

	for (let i = 0; i < styleElements.length; i++) {
		const style = styleElements[i]
		const styleContent = style.textContent || style.innerHTML || ""
		if (styleContent.includes("url(")) {
			const urls = extractUrlsFromCSS(styleContent)

			urls.forEach((urlPath) => {
				if (isRelativePath(urlPath)) {
					const matchedFile = findMatchingFile({
						path: urlPath,
						allFiles,
						htmlRelativeFolderPath,
					})
					if (matchedFile) {
						fileIdsToFetch.push(matchedFile.file_id)
						filePathMap.set(matchedFile.file_id, urlPath)
						urlMap.set(matchedFile.file_id, {
							path: urlPath,
							attr: "css-url",
							tag: "style",
							contentType: getContentTypeFromExtension(urlPath),
						})
					}
				}
			})
		}
	}
}

// Helper function to process inline style attributes and collect file IDs for CSS url() references
export function processInlineStyles(data: {
	htmlDoc: Document
	allFiles: any[]
	fileIdsToFetch: string[]
	filePathMap: Map<string, any>
	htmlRelativeFolderPath: string
	urlMap: Map<string, any>
}): void {
	const { htmlDoc, allFiles, fileIdsToFetch, filePathMap, htmlRelativeFolderPath, urlMap } = data
	// 获取所有带有 style 属性的元素
	const allElements = htmlDoc.querySelectorAll("[style]")
	// 用于跟踪已经处理的文件ID，避免重复添加
	const processedFileIds = new Set<string>()

	for (let i = 0; i < allElements.length; i++) {
		const element = allElements[i]
		const styleAttr = element.getAttribute("style")
		if (styleAttr && styleAttr.includes("url(")) {
			const urls = extractUrlsFromCSS(styleAttr)

			urls.forEach((urlPath) => {
				if (isRelativePath(urlPath)) {
					const matchedFile = findMatchingFile({
						path: urlPath,
						allFiles,
						htmlRelativeFolderPath,
					})
					if (matchedFile && !processedFileIds.has(matchedFile.file_id)) {
						// 只处理第一次遇到的每个文件ID
						processedFileIds.add(matchedFile.file_id)
						fileIdsToFetch.push(matchedFile.file_id)
						filePathMap.set(matchedFile.file_id, urlPath)
						urlMap.set(matchedFile.file_id, {
							path: urlPath,
							attr: "inline-style",
							tag: element.tagName.toLowerCase(),
							contentType: getContentTypeFromExtension(urlPath),
						})
					}
				}
			})
		}
	}
}

// Helper function to determine content type based on file extension
export function getContentTypeFromExtension(filePath: string): string {
	const extension = filePath.split(".").pop()?.toLowerCase()
	switch (extension) {
		case "html":
		case "htm":
			return "text/html"
		case "css":
			return "text/css"
		case "js":
			return "application/javascript"
		case "json":
			return "application/json"
		case "xml":
			return "text/xml"
		case "svg":
			return "image/svg+xml"
		default:
			return "text/plain"
	}
}

/**
 * 将常见公网 CDN 外链改写为 MAGIC_CDNHOST 下的镜像地址。
 *
 * `fetchInterceptor` 会把本函数 `toString()` 注入 iframe：实现必须只依赖参数与函数体内局部变量，
 * 不要引用 env 等模块级绑定，否则压缩后子页面会 ReferenceError（如 `i is not defined`）。
 */
export function rewriteHtmlCdnWithHost(content: string, cdnHost: string): Document {
	if (!cdnHost) {
		const parser = new DOMParser()
		return parser.parseFromString(content, "text/html")
	}

	/** 替换的静态资源包映射 */
	const packages = {
		tailwindcss: {
			"2.2.0": `${cdnHost}/tailwindcss/2.2.0/tailwind.min.css`,
			"3.4.17": `${cdnHost}/tailwindcss/3.4.17/tailwind.min.js`,
		},
		fontAwesome: `${cdnHost}/font-awesome/6.7.2/css/all.min.css`,
		marked: {
			"11.1.1": `${cdnHost}/marked/11.1.1/marked.min.js`,
		},
		simpleMindMap: {
			"0.10.2": {
				js: `${cdnHost}/simple-mind-map/0.10.2/simpleMindMap.umd.min.js`,
				css: `${cdnHost}/simple-mind-map/0.10.2/simpleMindMap.esm.css`,
			},
		},
		"countup.js": {
			"2.8.0": {
				js: `${cdnHost}/countup.js/2.8.0/countUp.umd.js`,
			},
		},
		echarts: {
			["5.6.0"]: `${cdnHost}/echarts/5.6.0/echarts.min.js`,
			["6.0.0"]: `${cdnHost}/echarts/6.0.0/echarts.min.js`,
		},
		qrcode: {
			["1.0.0"]: `${cdnHost}/qrcodejs/1.0.0/qrcode.min.js`,
		},
	}

	const GOOGLE_FONT_HOSTS: ReadonlySet<string> = new Set([
		"fonts.googleapis.com",
		"fonts.googlefonts.cn",
	])

	function parseHref(href: string): URL | null {
		let urlStr = href
		if (urlStr.startsWith("//")) urlStr = "https:" + urlStr
		if (!urlStr.startsWith("http")) urlStr = "https://" + urlStr
		try {
			return new URL(urlStr)
		} catch (_) {
			return null
		}
	}

	function parseFontFamilies(parsed: URL): string[] {
		const rawEntries =
			parsed.pathname === "/css2"
				? parsed.searchParams.getAll("family")
				: (parsed.searchParams.get("family") || "").split("|")

		return rawEntries
			.map((entry) => entry.split(":")[0].replace(/\+/g, " ").trim())
			.filter(Boolean)
	}

	function toSafeFontName(familyName: string): string {
		return familyName.replace(/\s+/g, "_")
	}

	// 谷歌资源重写规则
	const googleRewriteRules: {
		match: (parsed: URL) => boolean
		rewrite: (href: string, parsed: URL) => string | string[]
	}[] = [
		{
			// "https://fonts.googleapis.com/icon?family=Material+Icons"
			match: (parsed) =>
				GOOGLE_FONT_HOSTS.has(parsed.hostname) && parsed.pathname === "/icon",
			rewrite: () => cdnHost + "/googleapis/icon/v145/index.css",
		},
		{
			// "https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;500;700;900&display=swap"
			// "https://fonts.googlefonts.cn/css2?family=Ma+Shan+Zheng&display=swap"
			// "https://fonts.googleapis.com/css?family=Open+Sans:400,700|Lato:300"
			// "https://fonts.googlefonts.cn/css?family=Open+Sans:400,700|Lato:300"
			match: (parsed) =>
				GOOGLE_FONT_HOSTS.has(parsed.hostname) &&
				(parsed.pathname === "/css2" || parsed.pathname === "/css"),
			rewrite: (href, parsed) => {
				const families = parseFontFamilies(parsed)
				if (families.length === 0) return href.replace(parsed.hostname, "fonts.loli.net")
				return families.map(
					(f) => cdnHost + "/google-fonts/css/woff2/" + toSafeFontName(f) + "_woff2.css",
				)
			},
		},
		{
			// "https://fonts.googleapis.com/earlyaccess/notosanssc.css"
			match: (parsed) => GOOGLE_FONT_HOSTS.has(parsed.hostname),
			rewrite: (href, parsed) => href.replace(parsed.hostname, "fonts.loli.net"),
		},
		{
			// "https://ajax.googleapis.com/ajax/libs/jquery/3.7.1/jquery.min.js"
			match: (parsed) => parsed.hostname === "ajax.googleapis.com",
			rewrite: (href) => href.replace("ajax.googleapis.com", "ajax.loli.net"),
		},
	]

	function applyGoogleRewrite(link: Element, href: string, doc: Document): void {
		const parsed = parseHref(href)
		if (!parsed) return

		const rule = googleRewriteRules.find((r) => r.match(parsed))
		if (!rule) return

		link.setAttribute("data-original-href", href)
		const result = rule.rewrite(href, parsed)

		if (typeof result === "string") {
			link.setAttribute("href", result)
			return
		}

		link.setAttribute("href", result[0])
		for (let i = result.length - 1; i >= 1; i--) {
			const newLink = doc.createElement("link")
			newLink.setAttribute("rel", "stylesheet")
			newLink.setAttribute("data-original-href", href)
			newLink.setAttribute("href", result[i])
			link.parentNode?.insertBefore(newLink, link.nextSibling)
		}
	}

	const parser = new DOMParser()
	const htmlDoc = parser.parseFromString(content, "text/html")

	const linkElements = htmlDoc.getElementsByTagName("link")
	const scriptElements = htmlDoc.getElementsByTagName("script")
	// 从后向前遍历以避免因移除元素导致的索引问题
	for (let li = linkElements.length - 1; li >= 0; li--) {
		const link = linkElements[li]
		const href = link.getAttribute("href")
		if (href && href.includes("tailwind")) {
			// 保存原始URL
			link.setAttribute("data-original-href", href)
			const linkSrc = packages.tailwindcss["2.2.0"]
			link.setAttribute("href", linkSrc)
			link.setAttribute("rel", "stylesheet")
		}
		if (href?.includes("simple-mind-map") && href?.includes("0.10.2")) {
			// 保存原始URL
			link.setAttribute("data-original-href", href)
			const simpleMindMapSrc = packages.simpleMindMap["0.10.2"].css
			link.setAttribute("src", simpleMindMapSrc)
		}
		if (href && href.includes("font-awesome")) {
			// 保存原始URL
			link.setAttribute("data-original-href", href)
			const linkSrc = packages.fontAwesome
			link.setAttribute("href", linkSrc)
		}

		// 谷歌资源重写
		if (href) applyGoogleRewrite(link, href, htmlDoc)

		if (href?.includes("qrcode") && href?.includes("1.0.0")) {
			// 保存原始URL
			link.setAttribute("data-original-href", href)
			const qrcodeSrc = packages.qrcode["1.0.0"]
			link.setAttribute("href", qrcodeSrc)
		}
	}

	for (let si = scriptElements.length - 1; si >= 0; si--) {
		const script = scriptElements[si]
		const src = script.getAttribute("src")

		// Remove invalid script tags that cause loading errors
		if (src?.includes("slide-bridge.js")) {
			script.remove()
			continue
		}

		if (src?.includes("tailwind")) {
			// 保存原始URL
			script.setAttribute("data-original-src", src)
			const tailwindSrc = packages.tailwindcss["3.4.17"]
			script.setAttribute("src", tailwindSrc)
		}
		if (src?.includes("marked") && src?.includes("11.1.1")) {
			// 保存原始URL
			script.setAttribute("data-original-src", src)
			const markedSrc = packages.marked["11.1.1"]
			script.setAttribute("src", markedSrc)
		}
		if (src?.includes("simple-mind-map") && src?.includes("0.10.2")) {
			// 保存原始URL
			script.setAttribute("data-original-src", src)
			const simpleMindMapSrc = packages.simpleMindMap["0.10.2"].js
			script.setAttribute("src", simpleMindMapSrc)
		}
		if (src?.includes("countup") && src?.includes("2.8.0")) {
			// 保存原始URL
			script.setAttribute("data-original-src", src)
			const countupJSSrc = packages["countup.js"]["2.8.0"].js
			script.setAttribute("src", countupJSSrc)
		}
		if (src?.includes("echarts")) {
			// 保存原始URL
			script.setAttribute("data-original-src", src)
			let version: "5.6.0" | "6.0.0" = "5.6.0"
			if (src.includes("6.0.0")) {
				version = "6.0.0"
			}
			const scriptSrc = packages.echarts[version]
			script.setAttribute("src", scriptSrc)
		}
		if (src?.includes("qrcode") && src?.includes("1.0.0")) {
			// 保存原始URL
			script.setAttribute("data-original-src", src)
			const qrcodeSrc = packages.qrcode["1.0.0"]
			script.setAttribute("src", qrcodeSrc)
		}
	}

	return htmlDoc
}

export const handleHtCdnUrl = (content: string) =>
	rewriteHtmlCdnWithHost(content, env("MAGIC_CDNHOST") || "")

function restoreSerializedEntitiesForCdnRewrite(html: string): string {
	const ENTITY_PATTERN = /&(?:[a-z0-9]+|#\d+|#x[0-9a-f]+);/gi
	const el = document.createElement("div")
	return html.replace(ENTITY_PATTERN, (entity) => {
		el.innerHTML = entity
		return el.textContent ?? entity
	})
}

function serializeCdnRewrittenDocument(doc: Document): string {
	return restoreSerializedEntitiesForCdnRewrite(new XMLSerializer().serializeToString(doc))
}

const REWRITE_HTML_WITH_MAGIC_CDN_CACHE_MAX = 64
const rewriteHtmlWithMagicCdnCache = new Map<string, string>()

/**
 * 仅对 HTML 做麦吉 CDN 外链替换（handleHtCdnUrl：script / link 等），
 * 不处理附件、相对路径。用于消息列表 HTML 预览等无附件场景。
 * 序列化方式与 htmlProcessor 内 serializeDocToHtml 一致。
 * 对相同输入字符串做有界缓存，避免在电脑/移动端预览间切换时重复执行 handleHtCdnUrl。
 */
export function rewriteHtmlWithMagicCdn(html: string): string {
	if (!html || typeof html !== "string") return html

	const cached = rewriteHtmlWithMagicCdnCache.get(html)
	if (cached !== undefined) return cached

	try {
		const htmlDoc = handleHtCdnUrl(html)
		const result = serializeCdnRewrittenDocument(htmlDoc)
		rewriteHtmlWithMagicCdnCache.set(html, result)
		if (rewriteHtmlWithMagicCdnCache.size > REWRITE_HTML_WITH_MAGIC_CDN_CACHE_MAX) {
			const oldestKey = rewriteHtmlWithMagicCdnCache.keys().next().value
			if (oldestKey !== undefined) rewriteHtmlWithMagicCdnCache.delete(oldestKey)
		}
		return result
	} catch (error) {
		console.error("rewriteHtmlWithMagicCdn failed:", error)
		return html
	}
}

export function escapeHTML(html: string): string {
	return html
		.replace(/\\/g, "\\\\") // 先转义反斜杠
		.replace(/"/g, '\\"') // 双引号转义
		.replace(/\r/g, "") // 去除回车符（可选）
		.replace(/\n/g, "\\n") // 换行符转为 \n
}

export function createEditableContent(content: string, isEditMode: boolean = false): string {
	const editScript = isEditMode ? getEditingScript() : ""

	return `${content}${editScript ? `<script data-injected="true">${editScript}</script>` : ""}
	`
}

/**
 * 过滤HTML字符串中所有带有data-injected="true"属性的标签
 * @param htmlString - 需要过滤的HTML字符串
 * @returns 过滤后的HTML字符串
 */
export function filterInjectedTags(htmlString: string, filePathMapping: Map<string, string>): any {
	if (!htmlString || typeof htmlString !== "string") {
		return htmlString
	}

	try {
		const removableInjectedValues = new Set([
			"true",
			"at-polyfill",
			"fetch-interceptor",
			"media-interceptor",
			"iframe-chain",
		])

		// 使用DOMParser解析HTML字符串
		const parser = new DOMParser()
		const doc = parser.parseFromString(htmlString, "text/html")

		// 移除所有带有 data-injected 或历史 data-runtime 标记的元素
		const injectedElements = doc.querySelectorAll("[data-injected], [data-runtime]")
		injectedElements.forEach((element) => {
			// 移除注入的 script、style、link、meta 元素
			if (
				element.tagName === "SCRIPT" ||
				element.tagName === "STYLE" ||
				element.tagName === "LINK" ||
				element.tagName === "META"
			) {
				// 兼容旧的 data-runtime 标记和当前的 data-injected 标记
				const injectedValue = element.getAttribute("data-injected")
				const runtimeValue = element.getAttribute("data-runtime")
				if (
					(runtimeValue === "true" && element.tagName === "SCRIPT") ||
					(injectedValue && removableInjectedValues.has(injectedValue))
				) {
					element.parentNode?.removeChild(element)
				} else {
					// 其他情况只移除属性
					element.removeAttribute("data-injected")
					element.removeAttribute("data-runtime")
				}
			} else {
				// 对于其他元素，只移除编辑器注入标记
				element.removeAttribute("data-injected")
				element.removeAttribute("data-runtime")
			}
		})

		// 清理编辑相关的UI元素和属性
		// 移除编辑工具栏相关的元素
		const toolbarElements = doc.querySelectorAll(
			"[data-hover-toolbar], [data-resize-handles], [data-resize-handle], [data-drag-handle], [data-ai-dropdown]",
		)
		toolbarElements.forEach((element) => {
			element.parentNode?.removeChild(element)
		})

		// 清理所有元素上的编辑相关属性
		const allElements = doc.querySelectorAll("*")
		allElements.forEach((element) => {
			// 移除编辑相关的 data 属性
			element.removeAttribute("data-hover-toolbar")
			element.removeAttribute("data-resize-handles")
			element.removeAttribute("data-resize-handle")
			element.removeAttribute("data-drag-handle")
			element.removeAttribute("data-ai-dropdown")
			element.removeAttribute("data-ppt-editable")

			// 移除编辑相关的类名
			element.classList.remove("magic-ppt-tip-focus")
			element.classList.remove("magic-ppt-tip-hover")
		})

		// 清理ECharts动态添加的内容
		// 如果元素有 _echarts_instance_ 属性，说明是ECharts容器，直接清空其内容
		const echartsContainers = doc.querySelectorAll("[_echarts_instance_]")
		echartsContainers.forEach((container) => {
			// 移除 _echarts_instance_ 属性
			container.removeAttribute("_echarts_instance_")
			// 清空ECharts添加的所有子元素
			container.innerHTML = ""
			// 清理ECharts添加的内联样式
			const styleAttr = container.getAttribute("style")
			if (styleAttr) {
				// 移除ECharts添加的样式属性
				const echartsStyles = [
					"user-select:\\s*none",
					"-webkit-tap-highlight-color:\\s*rgba\\(0,\\s*0,\\s*0,\\s*0\\)",
					"position:\\s*relative",
				]
				let cleanedStyle = styleAttr
				echartsStyles.forEach((pattern) => {
					const regex = new RegExp(pattern + "[;\\s]*", "gi")
					cleanedStyle = cleanedStyle.replace(regex, "")
				})
				// 清理多余的分号和空格
				cleanedStyle = cleanedStyle
					.replace(/^[;\s]+|[;\s]+$/g, "")
					.replace(/[;\s]{2,}/g, "; ")
				if (cleanedStyle.trim()) {
					container.setAttribute("style", cleanedStyle.trim())
				} else {
					container.removeAttribute("style")
				}
			}
		})

		// 删除包含 https://tailwindcss.com 字符串的 style 标签
		const styleElements = doc.querySelectorAll("style")
		styleElements.forEach((element) => {
			const styleContent = element.textContent || element.innerHTML
			if (styleContent && styleContent.includes("https://tailwindcss.com")) {
				element.parentNode?.removeChild(element)
			}
		})

		// 处理data-src属性
		const dataSrcElements = doc.querySelectorAll("[data-src]")
		dataSrcElements.forEach((element) => {
			const dataSrc = element.getAttribute("data-src")
			if (dataSrc) {
				if (element.tagName.toLowerCase() === "link") {
					element.setAttribute("href", dataSrc)
				} else {
					element.setAttribute("src", dataSrc)
				}
				// 移除 data-src 属性
				element.removeAttribute("data-src")
			}
		})

		// 检查是否需要恢复slide-bridge.js（PPT场景）
		const hasSlideBridgeMarker = doc.body?.hasAttribute("data-has-slide-bridge")

		// 清理 html 标签上的 translate 属性（如果是注入的）
		if (doc.documentElement.hasAttribute("translate")) {
			doc.documentElement.removeAttribute("translate")
		}

		// 清理 body 标签上的 data-has-slide-bridge 标记
		if (doc.body?.hasAttribute("data-has-slide-bridge")) {
			doc.body.removeAttribute("data-has-slide-bridge")
		}

		// 如果原始HTML有slide-bridge.js，在保存时恢复它
		if (hasSlideBridgeMarker) {
			// 检查是否已经存在slide-bridge.js（避免重复添加）
			const existingSlideBridge = doc.querySelector('script[src*="slide-bridge.js"]')
			if (!existingSlideBridge && doc.body) {
				const slideBridgeScript = doc.createElement("script")
				slideBridgeScript.setAttribute("src", "slide-bridge.js")
				doc.body.appendChild(slideBridgeScript)
			}
		}

		// 恢复原始CDN URL（script标签）
		const scriptsWithOriginalSrc = doc.querySelectorAll("script[data-original-src]")
		scriptsWithOriginalSrc.forEach((script) => {
			const originalSrc = script.getAttribute("data-original-src")
			if (originalSrc) {
				script.setAttribute("src", originalSrc)
				script.removeAttribute("data-original-src")
			}
		})

		// 恢复原始CDN URL（link标签）
		const linksWithOriginalHref = doc.querySelectorAll("link[data-original-href]")
		linksWithOriginalHref.forEach((link) => {
			const originalHref = link.getAttribute("data-original-href")
			if (originalHref) {
				link.setAttribute("href", originalHref)
				link.removeAttribute("data-original-href")
			}
		})

		// 恢复相对路径
		const elementsWithOriginalPath = doc.querySelectorAll("[data-original-path]")
		elementsWithOriginalPath.forEach((element) => {
			const originalPath = element.getAttribute("data-original-path")
			if (originalPath) {
				const tagName = element.tagName.toLowerCase()
				// 恢复 src 或 href
				if (element.hasAttribute("src")) {
					element.setAttribute("src", originalPath)
				}
				if (element.hasAttribute("href")) {
					element.setAttribute("href", originalPath)
				}
				// object/embed 场景使用 data 属性承载资源地址
				if (element.hasAttribute("data")) {
					element.setAttribute("data", originalPath)
				}
				// 嵌套 iframe 在运行时可能被改成 srcdoc，保存时需还原为 src
				if (tagName === "iframe") {
					element.setAttribute("src", originalPath)
					element.removeAttribute("srcdoc")
					element.removeAttribute("data-magic-iframe-loading")
					element.removeAttribute("data-magic-iframe-skipped")
					element.removeAttribute("data-magic-iframe-skipped-path")
				}
				// 清理标记
				element.removeAttribute("data-original-path")
			}
		})

		// 恢复CSS中的url()路径
		const styleElementsForRestore = doc.querySelectorAll("style")
		styleElementsForRestore.forEach((style) => {
			if (style.textContent && style.textContent.includes("/*__ORIGINAL_URL__:")) {
				style.textContent = style.textContent.replace(
					/\/\*__ORIGINAL_URL__:(.*?)__\*\/url\(['"].*?['"]\)/g,
					"url('$1')",
				)
			}
		})

		// 恢复内联样式中的url()路径
		const elementsWithStyle = doc.querySelectorAll("[style]")
		elementsWithStyle.forEach((element) => {
			const styleAttr = element.getAttribute("style")
			if (styleAttr && styleAttr.includes("/*__ORIGINAL_URL__:")) {
				const restoredStyle = styleAttr.replace(
					/\/\*__ORIGINAL_URL__:(.*?)__\*\/url\(['"].*?['"]\)/g,
					"url('$1')",
				)
				element.setAttribute(
					"style",
					normalizeConflictingBackgroundDeclarations(restoredStyle),
				)
			}
		})

		// 恢复 window.location.reload()
		const scriptElements = doc.querySelectorAll("script:not([src])")
		scriptElements.forEach((script) => {
			if (script.textContent) {
				if (script.textContent.includes("/*__ORIGINAL_RELOAD__:")) {
					script.textContent = script.textContent.replace(
						/\/\*__ORIGINAL_RELOAD__:(.*?)__\*\/window\.Magic\.reload\(\)/g,
						"$1",
					)
				}
				// 恢复全局 let/const 声明
				if (script.textContent.includes("/*__ORIGINAL_LET__:")) {
					// 匹配魔法标记并恢复：/*__ORIGINAL_LET__:let varName =__*/var varName =
					// 支持简单声明和解构赋值
					script.textContent = script.textContent.replace(
						/\/\*__ORIGINAL_LET__:(let|const)\s+(\{[^}]*\}|\[[^\]]*\]|\w+)\s*=__\*\/var\s+\2\s*=/g,
						(match, keyword, originalVar) => {
							return `${keyword} ${originalVar} =`
						},
					)
				}
			}
		})

		// 获取DOCTYPE
		const doctype = doc.doctype
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

		// 构建完整的HTML结构
		const htmlElement = doc.documentElement

		// 获取 html 标签的属性
		const htmlAttrs: string[] = []
		Array.from(htmlElement.attributes).forEach((attr) => {
			htmlAttrs.push(`${attr.name}="${attr.value}"`)
		})
		const htmlAttrString = htmlAttrs.length > 0 ? " " + htmlAttrs.join(" ") : ""

		// 获取清理后的 head 和 body 内容
		const headContent = doc.head?.innerHTML || ""
		const bodyContent = doc.body?.innerHTML || ""

		// 获取 body 标签的属性
		const bodyAttrs: string[] = []
		if (doc.body) {
			Array.from(doc.body.attributes).forEach((attr) => {
				bodyAttrs.push(`${attr.name}="${attr.value}"`)
			})
		}
		const bodyAttrString = bodyAttrs.length > 0 ? " " + bodyAttrs.join(" ") : ""

		// 重新构建完整的HTML文档
		let processedHtml = `${doctypeString}<html${htmlAttrString}>
<head>
${headContent}
</head>
<body${bodyAttrString}>
${bodyContent}
</body>
</html>`

		// 清理移除元素后产生的多余空行
		processedHtml = processedHtml.replace(/\n\s*\n/g, "\n")

		// 返回清理后的HTML字符串
		return processedHtml
	} catch (error) {
		console.error("过滤注入标签时出错:", error)
		// 如果解析失败，使用正则表达式作为备选方案
		return filterInjectedTagsWithRegex(htmlString)
	}
}

/**
 * 使用正则表达式过滤注入标签的备选方案
 * @param htmlString - 需要过滤的HTML字符串
 * @returns 过滤后的HTML字符串
 */
function filterInjectedTagsWithRegex(htmlString: string): string {
	// 匹配带有 data-injected 或历史 data-runtime 属性的标签（包括自闭合标签和配对标签）
	// 处理所有编辑器已知的注入标记值
	const injectedTagRegex =
		/<([a-zA-Z][a-zA-Z0-9]*)[^>]*(?:\s+data-injected\s*=\s*["'](?:true|at-polyfill|fetch-interceptor|media-interceptor|iframe-chain)["']|\s+data-runtime\s*=\s*["']true["'])[^>]*>(?:[\s\S]*?<\/\1>)?/gi

	// 移除匹配的标签
	let result = htmlString.replace(injectedTagRegex, "")

	// 移除所有剩余的 data-injected / data-runtime 属性（不管值是什么）
	result = result.replace(/\s+data-injected\s*=\s*["'][^"']*["']/gi, "")
	result = result.replace(/\s+data-runtime\s*=\s*["'][^"']*["']/gi, "")

	// 移除编辑相关的UI元素（通过属性匹配）
	const toolbarElementRegex =
		/<([a-zA-Z][a-zA-Z0-9]*)[^>]*\s+data-(?:hover-toolbar|resize-handles|resize-handle|drag-handle|ai-dropdown|ppt-editable)\s*=\s*["'][^"']*["'][^>]*>(?:[\s\S]*?<\/\1>)?/gi
	result = result.replace(toolbarElementRegex, "")

	// 移除所有编辑相关的 data 属性
	result = result.replace(
		/\s+data-(?:hover-toolbar|resize-handles|resize-handle|drag-handle|ai-dropdown|ppt-editable)\s*=\s*["'][^"']*["']/gi,
		"",
	)

	// 移除编辑相关的类名
	result = result.replace(
		/\s+class\s*=\s*["'][^"']*\b(?:magic-ppt-tip-focus|magic-ppt-tip-hover)\b[^"']*["']/gi,
		(match) => {
			const cleaned = match
				.replace(/\b(?:magic-ppt-tip-focus|magic-ppt-tip-hover)\b/g, "")
				.trim()
			return cleaned === 'class=""' ? "" : cleaned
		},
	)

	return result
}

/**
 * 获取HTML字符串中所有注入标签的信息
 * @param htmlString - 需要检查的HTML字符串
 * @returns 注入标签的信息数组
 */
export function getInjectedTagsInfo(htmlString: string): Array<{
	tagName: string
	outerHTML: string
	attributes: Record<string, string>
}> {
	if (!htmlString || typeof htmlString !== "string") {
		return []
	}

	try {
		const parser = new DOMParser()
		const doc = parser.parseFromString(htmlString, "text/html")
		const injectedElements = doc.querySelectorAll('[data-injected="true"]')

		return Array.from(injectedElements).map((element) => ({
			tagName: element.tagName.toLowerCase(),
			outerHTML: element.outerHTML,
			attributes: Array.from(element.attributes).reduce(
				(acc, attr) => {
					acc[attr.name] = attr.value
					return acc
				},
				{} as Record<string, string>,
			),
		}))
	} catch (error) {
		console.error("获取注入标签信息时出错:", error)
		return []
	}
}

// 递归获取文件夹内所有文件的 file_id
function getAllFileIdsInDirectory(items: any[]): string[] {
	const fileIds: string[] = []

	items.forEach((item) => {
		if (item.is_directory) {
			// 如果是文件夹，递归获取其子文件
			if (item.children && item.children.length > 0) {
				fileIds.push(...getAllFileIdsInDirectory(item.children))
			}
		} else {
			// 如果是文件，添加其 file_id
			fileIds.push(item.file_id)
		}
	})

	return fileIds
}

// 递归查找目标文件所在的层级
function findSiblingLevel(items: any[], targetId: string): any[] | null {
	// 检查当前层级是否包含目标文件
	const targetExists = items.some((item) => item.file_id === targetId)
	if (targetExists) {
		return items
	}

	// 递归检查子文件夹
	for (const item of items) {
		if (item.is_directory && item.children && item.children.length > 0) {
			const result = findSiblingLevel(item.children, targetId)
			if (result) {
				return result
			}
		}
	}

	return null
}

export function getExportAllFileIds(file_id: string, attachments: any[]) {
	// 查找目标文件所在的层级
	const siblingLevel = findSiblingLevel(attachments, file_id)

	if (!siblingLevel) {
		// 如果没有找到目标文件，返回空数组
		return []
	}

	const allFileIds: string[] = []

	// 遍历同层级的所有项目
	siblingLevel.forEach((item) => {
		if (item.is_directory) {
			// 如果是文件夹，获取其所有子文件的 file_id
			if (item.children && item.children.length > 0) {
				allFileIds.push(...getAllFileIdsInDirectory(item.children))
			}
		} else {
			// 如果是文件，直接添加其 file_id
			allFileIds.push(item.file_id)
		}
	})

	// 去重并返回
	return Array.from(new Set(allFileIds))
}

export function processAudioArray(data: {
	htmlDoc: Document
	allFiles: any[]
	fileIdsToFetch: string[]
	urlMap: Map<string, any>
	htmlRelativeFolderPath: string
}): void {
	const { allFiles, fileIdsToFetch, urlMap, htmlRelativeFolderPath } = data

	// 定义支持的媒体文件扩展名
	const mediaExtensions = [
		".mp3",
		".wav",
		".ogg",
		".m4a",
		".aac",
		".flac", // 音频格式
		".mp4",
		".webm",
		".avi",
		".mov",
		".mkv",
		".wmv", // 视频格式
	]

	// 遍历所有文件，查找同目录下的媒体文件
	allFiles.forEach((file) => {
		if (file.relative_file_path?.startsWith(htmlRelativeFolderPath)) {
			const fileRelativePath = file.relative_file_path.replace(htmlRelativeFolderPath, "")
			const filePathSplit = fileRelativePath.split("/")

			// 检查是否为同目录下的媒体文件
			// filePathSplit.length === 1 表示文件在同一目录下（没有子目录）
			const isMediaFile =
				filePathSplit.length === 1 &&
				mediaExtensions.some((ext) => file.file_name?.toLowerCase().endsWith(ext))

			const isNotAlreadyFetched = !fileIdsToFetch.includes(file.file_id)

			if (isMediaFile && isNotAlreadyFetched) {
				fileIdsToFetch.push(file.file_id)
				urlMap.set(file.file_id, {
					path: file.relative_file_path,
					attr: "audio-media",
					fileName: file.file_name,
					tag: "script",
					contentType: getContentTypeFromExtension(file.relative_file_path),
				})
			}
		}
	})
}
