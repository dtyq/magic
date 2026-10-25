const { designStylePreviewMiddleware } = require("../middleware/designStylePreviewMiddleware")
const languageMiddleware = require("../middleware/languageMiddleware")
const throttleMiddleware = require("../middleware/throttleMiddleware")
const { logReportBody } = require("../middleware/logReportBody.cjs")
const serviceWorkerMiddleware = require("../middleware/serviceWorkerMiddleware")
const staticResourceMiddleware = require("../middleware/staticResourceMiddleware")
const { setStaticAssetCacheHeaders } = require("../middleware/staticAssetCacheHeaders")
const sourceMapAccessMiddleware = require("../middleware/sourceMapAccessMiddleware")
const { defaultSEOMiddleware, generateSeoRoutes } = require("../middleware/seoMiddleware")
const { getHtmlTemplate } = require("../middleware/seoMiddleware/getHtmlTemplate")
const k8sOnlyMiddleware = require("../middleware/k8sOnlyMiddleware")
const { logger } = require("../logger.cjs")
const ConfigRoutes = require("./config.route")
const LogsRoutes = require("./logs.route")
const MicroAppInstallRoutes = require("./micro-app-install.route")
const history = require("connect-history-api-fallback")
const express = require("express")
const fs = require("node:fs")
const path = require("node:path")
const cors = require("cors")
const { rootPath } = require("../config")
const noIndexMiddleware = require("../middleware/noIndexMiddleware")
const {
	getHtmlSandboxAllowedOrigins,
	isHtmlSandboxRuntimeRequest,
	setHtmlSandboxRuntimeCorsHeaders,
} = require("../utils/htmlSandboxRuntimeCors.cjs")

const hasLoginPopupTemplate = fs.existsSync(
	path.join(rootPath, "../dist/login-popup-callback.html"),
)

const configRoutes = new ConfigRoutes()
const logsRoutes = new LogsRoutes()
const microAppInstallRoutes = new MicroAppInstallRoutes()

const configureRoutes = (app) => {
	/**
	 * ======================== 前置中间件初始化 ========================
	 */
	// This server is an application/share surface, not an SEO surface.
	// Set the directive before every route so it also covers CORS responses,
	// static assets, and errors.
	app.use(noIndexMiddleware)
	// Check preview access before CORS and static handling, including conditional requests.
	app.use(designStylePreviewMiddleware)
	// CORS 开启
	app.use(cors())
	const htmlSandboxAllowedOrigins = getHtmlSandboxAllowedOrigins()
	app.use((req, res, next) => {
		if (isHtmlSandboxRuntimeRequest(req.path)) {
			setHtmlSandboxRuntimeCorsHeaders(res, req.headers.origin, htmlSandboxAllowedOrigins)
		}
		next()
	})

	/**
	 * ======================== 基础 API 路由 ========================
	 */
	app.get("/config.js", configRoutes.getConfigJs)
	app.get("/config.json", configRoutes.getConfig)
	app.get("/healthz", k8sOnlyMiddleware, configRoutes.liveness)
	app.get("/readyz", k8sOnlyMiddleware, configRoutes.readiness)
	app.get("/startupz", k8sOnlyMiddleware, configRoutes.startup)
	app.get("/heartbeat", configRoutes.heartbeat)
	// JSON 解析中间件只用于需要的路由
	app.post("/log-report", throttleMiddleware, logReportBody, logsRoutes.report.bind(logsRoutes))
	app.get("/sw.js", serviceWorkerMiddleware)
	app.get(
		"/micro-app/:appId/manifest.webmanifest",
		microAppInstallRoutes.manifest.bind(microAppInstallRoutes),
	)
	app.get("/micro-app/:appId/icon", microAppInstallRoutes.icon.bind(microAppInstallRoutes))

	/**
	 * ======================== 静态资源缓存配置 ========================
	 */
	// Source maps remain inside the image for offline symbolication and must never be served publicly.
	app.use(sourceMapAccessMiddleware)
	// CDN资源防盗链
	app.use("/packages", staticResourceMiddleware)
	// 静态资源缓存配置
	app.use(
		express.static(path.join(rootPath, "../dist"), {
			index: false, // 禁止 express.static 处理 index.html，让后续中间件处理
			setHeaders: setStaticAssetCacheHeaders,
		}),
	)

	/**
	 * ======================== 动态路由（需要语言等处理） ========================
	 */
	// 语言中间件 - 必须在 i18n.init 之后
	app.use(languageMiddleware)
	// SEO 路由处理
	generateSeoRoutes(app)

	/**
	 * ======================== 独立子页路由（必须在 SPA Fallback 之前） ========================
	 * 这些路由拥有独立的 HTML 入口，不走主应用的 index.html，
	 * 必须在 connect-history-api-fallback 之前注册，否则会被无差别 fallback 到 index.html。
	 */
	if (hasLoginPopupTemplate) {
		app.get("/login-popup-callback", (req, res) => {
			res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate")
			res.setHeader("Pragma", "no-cache")
			res.setHeader("Expires", "0")
			res.setHeader("Content-Type", "text/html; charset=utf-8")
			res.send(getHtmlTemplate("login-popup-callback", req.get("user-agent")))
		})
	}

	/**
	 * ======================== SPA Fallback ========================
	 * */
	// web 入口文件配置
	app.use(
		history({
			index: "/index.html",
		}),
	)
	// html 重写模版直接返回
	app.get("/index.html", defaultSEOMiddleware)

	/**
	 * ======================== Error Handling Middleware ========================
	 */
	// Final fallback error middleware
	app.use((req, res) => {
		res.setHeader("Content-Type", "text/html")
		res.status(404)
		res.send("")
	})
	// 5xx
	app.use((err, req, res, next) => {
		logger.error("nodeServer", {
			url: req.url, // Current accessing URL
			message: err?.message, // Error message
			memoryUsage: process.memoryUsage(), // Memory usage
			cpuUsage: process.cpuUsage(), // CPU usage
			stack: err?.stack, // Error stack (pid, time and other info handled by plugin)
		})

		res.setHeader("Content-Type", "text/html")
		res.status(500)
		res.send("")
	})
}

module.exports = configureRoutes
