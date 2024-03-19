const { getHtmlTemplate } = require("./getHtmlTemplate")
const { logger } = require("../../logger.cjs")
const getGlobalPlatformInfo = require("../../apis/getGlobalPlatformInfo")
const { getPlatformInfo, processHtmlContent } = require("./html-utils")

/**
 * @description 默认 SEO 处理
 * @param {Request} req
 * @param {Response} res
 * @param {NextFunction} next
 * @returns {Promise<void>}
 */
const seoMiddleware = async (req, res, next) => {
	let htmlTemplate
	try {
		htmlTemplate = getHtmlTemplate()
	} catch (error) {
		logger.error("nodeServer", "Failed to read index.html:", error)
		return next(error)
	}

	try {
		// 获取全局平台信息
		const platformInfoRaw = await getGlobalPlatformInfo()
		const locale = req.getLocale()

		// 提取平台信息（带 fallback）
		const platformInfo = getPlatformInfo(platformInfoRaw, locale)

		// 构建完整 URL
		const ogUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`

		// 处理 HTML（一次性替换）
		const htmlContent = processHtmlContent(htmlTemplate, {
			favicon: platformInfo.favicon,
			minimal_logo: platformInfo.minimal_logo,
			title: platformInfo.title,
			keywords: platformInfo.keywords,
			description: platformInfo.description,
			ogUrl,
		})

		// 设置响应头并返回
		res.setHeader("Content-Type", "text/html; charset=utf-8")
		res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate")
		res.setHeader("Pragma", "no-cache")
		res.setHeader("Expires", "0")
		return res.send(htmlContent)
	} catch (error) {
		logger.error("nodeServer", "defaultSEOMiddleware", "Failed to process SEO HTML:", error)

		// 构建完整 URL
		const ogUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`

		// 处理 HTML（一次性替换）
		const htmlContent = processHtmlContent(htmlTemplate, {
			favicon: "",
			minimal_logo: null,
			title: "",
			keywords: "",
			description: "",
			ogUrl,
		})

		// 设置响应头并返回
		res.setHeader("Content-Type", "text/html; charset=utf-8")
		res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate")
		res.setHeader("Pragma", "no-cache")
		res.setHeader("Expires", "0")
		return res.send(htmlContent)
	}
}

module.exports = seoMiddleware
