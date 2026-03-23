const { logger } = require("../../logger.cjs")
const fs = require("node:fs")
const path = require("node:path")
const { rootPath, CDNUrl, behaviorAnalysis } = require("../../config")
const { userBehaviorAnalysisParser } = require("../../helper")

const hasLoginPopupTemplate = fs.existsSync(
	path.join(rootPath, "../dist/login-popup-callback.html"),
)

/** @type {Map<string, string>} key → 已注入 CDN 的 HTML 字符串 */
const templateCache = new Map()

/**
 * @description 构建 CDN script 标签字符串，初始化 HTML 模板(在 Pod 启动时立即加载（配置路由之前）)
 * 在html模版生成后根据环境变量注入 CDN资源和用户行为分析代码（每次环境变量配置会重启pod所以能够持久化在内存中）
 * @param {object} options
 * @param {boolean} options.includeRegisterSW 是否注入 registerSW（仅主应用需要）
 * @returns {string}
 */
function buildCdnScriptTags({ includeRegisterSW = true } = {}) {
	let tags = CDNUrl
		? `<script src="${CDNUrl}/react/18.3.1/react.production.min.js" crossorigin="anonymous"></script>
	<script src="${CDNUrl}/react-dom/18.3.1/react-dom.production.min.js" crossorigin="anonymous"></script>
	<script src="${CDNUrl}/lodash/4.17.21/lodash.min.js" crossorigin="anonymous"></script>`
		: `<script src="https://cdn.jsdelivr.net/npm/react@18.3.1/umd/react.production.min.js" crossorigin="anonymous"></script>
<script src="https://cdn.jsdelivr.net/npm/react-dom@18.3.1/umd/react-dom.production.min.js" crossorigin="anonymous"></script>
<script src="https://cdn.jsdelivr.net/npm/lodash@4.17.21/lodash.min.js" crossorigin="anonymous"></script>
	`

	if (Array.isArray(behaviorAnalysis)) {
		behaviorAnalysis.forEach((o) => {
			const scripts = userBehaviorAnalysisParser(o)
			if (scripts) tags += scripts
		})
	}

	if (includeRegisterSW) {
		tags += `\n\t<script id="vite-plugin-pwa:register-sw" src="/registerSW.js"></script>`
	}

	return tags
}

/**
 * @description 读取 HTML 文件，将 `<!-- CDN Resources -->` 替换为运行时 CDN script 标签，
 * 并将结果缓存到 templateCache。
 *
 * @param {string} htmlPath  - dist 产物的绝对路径
 * @param {object} options
 * @param {string}  options.key            - templateCache 的存储键（建议用文件名，如 "index" / "login-popup-callback"）
 * @param {boolean} [options.includeRegisterSW=true]  - 是否注入 SW 注册脚本
 * @param {boolean} [options.critical=true]           - true 时加载失败会让进程退出（主应用），false 时仅记录错误
 * @returns {Promise<void>}
 */
async function initHtmlTemplate(htmlPath, { key, includeRegisterSW = true, critical = true } = {}) {
	const startTime = Date.now()
	try {
		let html = await fs.promises.readFile(htmlPath, "utf-8")
		html = html.replace("<!-- CDN Resources -->", buildCdnScriptTags({ includeRegisterSW }))
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
 * @description 同步获取已初始化的 HTML 模板
 * @param {string} key - 与 initHtmlTemplate 中 options.key 对应
 * @returns {string}
 */
function getHtmlTemplate(key = "index") {
	const html = templateCache.get(key)
	if (!html) throw new Error(`HTML template "${key}" not initialized`)
	return html
}

// ===== 模块加载时立即初始化（K8s Pod 启动时预编译） =====
initHtmlTemplate(path.join(rootPath, "../dist/index.html"), {
	key: "index",
	includeRegisterSW: true,
	critical: true,
})

if (hasLoginPopupTemplate) {
	initHtmlTemplate(path.join(rootPath, "../dist/login-popup-callback.html"), {
		key: "login-popup-callback",
		includeRegisterSW: false,
		critical: false, // popup 模板加载失败不影响主应用启动
	})
}

module.exports = {
	initHtmlTemplate,
	getHtmlTemplate,
}
