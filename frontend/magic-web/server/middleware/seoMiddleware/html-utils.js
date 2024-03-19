/**
 * HTML 处理工具函数和常量
 * 这些在 Pod 启动时初始化，运行时直接使用
 */

// MIME 类型映射（常量，只创建一次）
const MIME_TYPES = {
	png: "image/png",
	jpg: "image/jpeg",
	jpeg: "image/jpeg",
	gif: "image/gif",
	svg: "image/svg+xml",
	ico: "image/x-icon",
	webp: "image/webp",
}

/**
 * HTML 转义函数 - 防止 XSS 攻击
 * 转义特殊字符，防止恶意代码注入
 * @param {string} str - 需要转义的字符串
 * @returns {string} - 转义后的安全字符串
 */
function escapeHtml(str) {
	if (typeof str !== "string") return ""
	return str
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#x27;")
		.replace(/\//g, "&#x2F;")
}

/**
 * URL 转义函数 - 专门用于 URL 属性
 * 除了 HTML 转义，还要确保 URL 的安全性
 * @param {string} url - 需要转义的 URL
 * @returns {string} - 转义后的安全 URL
 */
function escapeUrl(url) {
	if (typeof url !== "string") return ""
	// 首先进行 HTML 转义
	return escapeHtml(url)
}

// 默认平台信息（fallback）
const DEFAULT_PLATFORM_INFO = {
	zh_CN: {
		title: "超级麦吉 - 灯塔引擎新一代企业级 AI 应用创新引擎",
		keywords: "",
		description: "",
	},
	en_US: {
		title: "Super Magic - Lighthouse Engine Next-Gen Enterprise AI Application Engine",
		keywords: "",
		description: "",
	},
}

/**
 * 清理 SEO 字符串，移除多余的分隔符和空格
 * @param {string} str
 * @returns {string}
 */
function cleanSEOString(str) {
	return str
		.replace(/\s*-\s*$/g, "") // 移除末尾的 " - "
		.replace(/\s*,\s*$/g, "") // 移除末尾的 ", "
		.replace(/,\s*,/g, ",") // 移除连续的逗号
		.replace(/\s+/g, " ") // 合并多个空格
		.trim()
}

/**
 * 获取 favicon 的 MIME 类型
 * @param {string} faviconUrl
 * @returns {string}
 */
function getFaviconMimeType(faviconUrl) {
	const ext = faviconUrl.split(".").pop()?.toLowerCase() || ""
	return MIME_TYPES[ext] || "image/x-icon"
}

/**
 * 构建 meta 标签
 * ⚠️ 安全注意：所有动态内容必须进行 HTML 转义，防止 XSS 攻击
 * @param {Object} options
 * @returns {string}
 */
function buildMetaTags(options) {
	const { title, keywords, description, ogUrl } = options

	// 对所有动态内容进行转义，防止 XSS 攻击
	const safeTitle = escapeHtml(title)
	const safeKeywords = escapeHtml(keywords)
	const safeDescription = escapeHtml(description)
	const safeOgUrl = escapeUrl(ogUrl)

	return `<!-- Open Graph / Facebook -->
<meta property="og:type" content="website">
<meta property="og:url" content="${safeOgUrl}">
<meta property="og:title" content="${safeTitle}">
<meta property="og:description" content="${safeDescription}">
<meta property="og:site_name" content="${safeTitle}">
<!-- Twitter -->
<meta property="twitter:card" content="${safeTitle}">
<meta property="twitter:url" content="${safeOgUrl}">
<meta property="twitter:title" content="${safeTitle}">
<meta property="twitter:description" content="${safeDescription}">
<!-- WeChat Share Optimization -->
<meta name="description" content="${safeDescription}">
<meta name="keywords" content="${safeKeywords}">
<meta name="author" content="${safeTitle}">`
}

/**
 * 获取平台信息（带 fallback）
 * @param {Object} platformInfo
 * @param {string} locale
 * @returns {Object}
 */
function getPlatformInfo(platformInfo, locale) {
	const isZhCN = locale === "zhCN"
	const fallback = isZhCN ? DEFAULT_PLATFORM_INFO.zh_CN : DEFAULT_PLATFORM_INFO.en_US

	return {
		title: isZhCN
			? platformInfo?.title_i18n?.zh_CN || fallback.title
			: platformInfo?.title_i18n?.en_US || fallback.title,
		keywords: isZhCN
			? platformInfo?.keywords_i18n?.zh_CN || fallback.keywords
			: platformInfo?.keywords_i18n?.en_US || fallback.keywords,
		description: isZhCN
			? platformInfo?.description_i18n?.zh_CN || fallback.description
			: platformInfo?.description_i18n?.en_US || fallback.description,
		favicon: platformInfo?.favicon,
		minimal_logo: platformInfo?.minimal_logo,
	}
}

/**
 * 获取图片的 MIME 类型
 * @param {string} imageUrl
 * @returns {string}
 */
function getImageMimeType(imageUrl) {
	const ext = imageUrl.split(".").pop()?.toLowerCase() || ""
	return MIME_TYPES[ext] || "image/png"
}

/**
 * 构建预加载链接
 * ⚠️ 安全注意：URL 必须进行转义，防止 XSS 攻击
 * @param {string} minimalLogo
 * @returns {string}
 */
function buildPreloadLink(minimalLogo) {
	if (!minimalLogo) return ""
	const mimeType = getImageMimeType(minimalLogo)
	const safeMinimalLogo = escapeUrl(minimalLogo)
	return `<link rel="preload" as="image" href="${safeMinimalLogo}" type="${mimeType}" fetchpriority="high" />`
}

/**
 * 处理 HTML 内容：替换 title, meta, favicon, 添加预加载链接
 * ⚠️ 安全注意：所有动态内容必须进行 HTML 转义，防止 XSS 攻击
 * @param {string} htmlTemplate
 * @param {Object} options
 * @returns {string}
 */
function processHtmlContent(htmlTemplate, options) {
	const { favicon, title, keywords, description, ogUrl, minimal_logo } = options

	let html = htmlTemplate

	// 1. 替换 favicon（如果有）
	if (favicon) {
		const mimeType = getFaviconMimeType(favicon)
		const safeFavicon = escapeUrl(favicon)
		html = html.replace(
			/<link\s+rel="icon"[^>]*>/i,
			`<link rel="icon" type="${mimeType}" href="${safeFavicon}" />`,
		)
	}

	// 2. 添加 minimal_logo 预加载链接（优化 LCP）
	// buildPreloadLink 内部已经进行了转义
	if (minimal_logo) {
		const preloadLink = buildPreloadLink(minimal_logo)
		// 在 viewport meta 标签之后插入预加载链接，确保浏览器尽早发现并加载
		// 匹配 viewport meta 标签（支持单行和多行格式）
		html = html.replace(/(<meta\s+name="viewport"[\s\S]*?\/>)/i, (match) => {
			// 在 viewport 标签后添加预加载链接
			return `${match}\n\t\t${preloadLink}`
		})
	}

	// 3. 构建 meta 标签（内部已经进行了转义）
	const metaTags = buildMetaTags({ title, keywords, description, ogUrl })

	// 4. 一次性替换所有内容（性能优化）
	// ⚠️ title 需要转义，因为它会插入到 <title> 标签中
	const safeTitle = escapeHtml(title)
	html = html
		.replace(/<title>.*?<\/title>/i, `<title>${safeTitle}</title>`)
		.replace("<!-- Meta -->", metaTags)

	return html
}

module.exports = {
	MIME_TYPES,
	DEFAULT_PLATFORM_INFO,
	escapeHtml,
	escapeUrl,
	cleanSEOString,
	getFaviconMimeType,
	getImageMimeType,
	buildPreloadLink,
	buildMetaTags,
	getPlatformInfo,
	processHtmlContent,
}
