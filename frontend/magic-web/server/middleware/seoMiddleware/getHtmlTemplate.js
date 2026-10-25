const { logger } = require("../../logger.cjs")
const fs = require("node:fs")
const path = require("node:path")
const { rootPath, CDNUrl, behaviorAnalysis, getSafeEnvVars } = require("../../config")
const { userBehaviorAnalysisParser } = require("../../helper")

const hasLoginPopupTemplate = fs.existsSync(
	path.join(rootPath, "../dist/login-popup-callback.html"),
)

/** @type {Map<string, string>} key → 已注入 CDN 的 HTML 字符串 */
const templateCache = new Map()

/**
 * Detect whether the client browser lacks complete native Import Map support
 * and requires es-module-shims fallback in shim mode.
 * - Chromium (Chrome/Edge/Electron): < 105 has relative dynamic import issues with import maps
 * - Safari (WebKit): < 16.4 lacks native import map support
 * - Firefox (Gecko): < 108 lacks native import map support
 *
 * @param {string} [userAgent]
 * @returns {boolean}
 */
function shouldShimImportMap(userAgent) {
	if (!userAgent || typeof userAgent !== "string") return false

	// Chrome / Chromium / Edge / Electron / Opera
	const chromeMatch = userAgent.match(/(?:Chrome|CriOS|HeadlessChrome)\/(\d+)/i)
	if (chromeMatch) {
		const version = parseInt(chromeMatch[1], 10)
		return version < 105
	}

	// Safari / Mobile Safari (Check Version/XX.X before Safari)
	const safariMatch = userAgent.match(/Version\/(\d+(?:\.\d+)?).*Safari/i)
	if (safariMatch) {
		const version = parseFloat(safariMatch[1])
		return version < 16.4
	}

	// Firefox
	const firefoxMatch = userAgent.match(/Firefox\/(\d+)/i)
	if (firefoxMatch) {
		const version = parseInt(firefoxMatch[1], 10)
		return version < 108
	}

	return false
}

/**
 * Transform HTML string to enable es-module-shims in Shim Mode for legacy browsers:
 * 1. Convert <script type="importmap">...</script> to <script type="importmap-shim">...</script>
 * 2. Inject es-module-shims script tag AFTER the import map (so that large import maps are fully parsed in the DOM first)
 * 3. Convert <script type="module" ...> to <script type="module-shim" ...>
 * 4. Convert <link rel="modulepreload" ...> to <link rel="modulepreload-shim" ...>
 *
 * @param {string} html
 * @returns {string}
 */
function transformHtmlForShimMode(html) {
	if (typeof html !== "string") return html

	const esModuleShimsTag = `<script async src="${CDNUrl}/es-module-shims/2.8.4/es-module-shims.min.js" crossorigin="anonymous"></script>\n`

	let transformed = html

	// Convert <script type="importmap">...</script> to <script type="importmap-shim">...</script>
	// and inject es-module-shims script AFTER the closing </script> of the import map
	// to ensure the entire JSON DOM node is fully constructed before the polyfill runs.
	let hasImportMap = false
	transformed = transformed.replace(
		/<script\b([^>]*)\btype=["']importmap["']([\s\S]*?)<\/script>/gi,
		(match, p1, p2) => {
			hasImportMap = true
			return `<script${p1}type="importmap-shim"${p2}</script>\n${esModuleShimsTag}`
		},
	)

	if (!hasImportMap) {
		transformed = transformed.replace("</head>", `${esModuleShimsTag}</head>`)
	}

	// Convert type="module" to type="module-shim"
	transformed = transformed.replace(
		/<script\b([^>]*)\btype=["']module["']/gi,
		'<script$1type="module-shim"',
	)

	// Convert rel="modulepreload" to rel="modulepreload-shim"
	transformed = transformed.replace(
		/<link\b([^>]*)\brel=["']modulepreload["']/gi,
		'<link$1rel="modulepreload-shim"',
	)

	return transformed
}

/**
 * @description 构建 CDN script 标签字符串，初始化 HTML 模板(在 Pod 启动时立即加载（配置路由之前）)
 * 在html模版生成后根据环境变量注入 CDN资源和用户行为分析代码（每次环境变量配置会重启pod所以能够持久化在内存中）
 * @param {object} options
 * @returns {string}
 */
function buildCdnScriptTags() {
	let tags = CDNUrl
		? `<script defer src="${CDNUrl}/react/18.3.1/react.production.min.js" crossorigin="anonymous"></script>
	<script defer src="${CDNUrl}/react-dom/18.3.1/react-dom.production.min.js" crossorigin="anonymous"></script>
	<script defer src="${CDNUrl}/lodash/4.17.21/lodash.min.js" crossorigin="anonymous"></script>`
		: `<script defer src="https://cdn.jsdelivr.net/npm/react@18.3.1/umd/react.production.min.js" crossorigin="anonymous"></script>
<script defer src="https://cdn.jsdelivr.net/npm/react-dom@18.3.1/umd/react-dom.production.min.js" crossorigin="anonymous"></script>
<script defer src="https://cdn.jsdelivr.net/npm/lodash@4.17.21/lodash.min.js" crossorigin="anonymous"></script>
	`

	if (Array.isArray(behaviorAnalysis)) {
		behaviorAnalysis.forEach((o) => {
			const scripts = userBehaviorAnalysisParser(o)
			if (scripts) tags += scripts
		})
	}

	return tags
}

/**
 * @description 读取 HTML 文件，将 `<!-- CDN Resources -->` 替换为运行时 CDN script 标签，
 * 并将结果缓存 to templateCache。
 *
 * @param {string} htmlPath  - dist 产物的绝对路径
 * @param {object} options
 * @param {string}  options.key            - templateCache 的存储键（建议用文件名，如 "index" / "login-popup-callback"）
 * @param {boolean} [options.critical=true]           - true 时加载失败会让进程退出（主应用），false 时仅记录错误
 * @returns {Promise<void>}
 */
async function initHtmlTemplate(htmlPath, { key, critical = true } = {}) {
	const startTime = Date.now()
	try {
		let html = await fs.promises.readFile(htmlPath, "utf-8")
		html = html.replace("<!-- CDN Resources -->", buildCdnScriptTags())

		// 内联 window.CONFIG 避免首屏 config.js 额外往返耗时
		const safeEnvVars = getSafeEnvVars()
		const configInlineScript = `<script id="magic-inlined-config">window.CONFIG = ${JSON.stringify(safeEnvVars)}</script>`
		html = html.replace(/<script\b[^>]*src=["']\/config\.js["'][^>]*><\/script>/, configInlineScript)

		templateCache.set(key, html)
		logger.info(
			"nodeServer",
			"initHtmlTemplate",
			`[${key}] HTML template loaded in ${Date.now() - startTime}ms`,
		)
	} catch (error) {
		logger.error(
			"nodeServer",
			"initHtmlTemplate",
			`[${key}] Failed to load HTML template:`,
			error,
		)
		if (critical) {
			logger.error("nodeServer", "initHtmlTemplate", `[${key}] Critical failure, exiting...`)
			process.exit(1)
		}
	}
}

/**
 * @description 同步获取已初始化的 HTML 模板，并根据客户端 User-Agent 进行按需兼容转换
 * @param {string} [key="index"] - 与 initHtmlTemplate 中 options.key 对应
 * @param {string} [userAgent=""] - 请求的 User-Agent 字符串
 * @returns {string}
 */
function getHtmlTemplate(key = "index", userAgent = "") {
	const html = templateCache.get(key)
	if (!html) throw new Error(`HTML template "${key}" not initialized`)
	if (shouldShimImportMap(userAgent)) {
		return transformHtmlForShimMode(html)
	}
	return html
}

// ===== 模块加载时立即初始化（K8s Pod 启动时预编译） =====
initHtmlTemplate(path.join(rootPath, "../dist/index.html"), {
	key: "index",
	critical: true,
})

if (hasLoginPopupTemplate) {
	initHtmlTemplate(path.join(rootPath, "../dist/login-popup-callback.html"), {
		key: "login-popup-callback",
		critical: false, // popup 模板加载失败不影响主应用启动
	})
}

module.exports = {
	initHtmlTemplate,
	getHtmlTemplate,
	shouldShimImportMap,
	transformHtmlForShimMode,
}
