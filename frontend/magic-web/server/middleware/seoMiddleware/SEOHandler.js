const { getHtmlTemplate } = require("./getHtmlTemplate")
const { logger } = require("../../logger.cjs")
const getGlobalPlatformInfo = require("../../apis/getGlobalPlatformInfo")
const SEORoutes = require("../../routes/seo.route")
const { getAdminSeoRoutes, getAdminSeoRoutesWithClusterCode } = require("../../routes/admin.route")
const { cleanSEOString, getPlatformInfo, processHtmlContent } = require("./html-utils")

const seoRoutes = new SEORoutes()

/**
 * @description SEO 路由处理
 * @param {ExpressApplication} app
 * @returns {void}
 */
const routes = [
	// 分享话题
	["/share/topic/:topicId", seoRoutes.shareTopic],
	["/share/files/:resourceId", seoRoutes.shareResource],
	["/share/:topicId", seoRoutes.shareTopic],
	["/share/:topicId/file/:fileId", seoRoutes.shareTopic],
	// 登录
	["/login", seoRoutes.login],
	// 协作项目 - 话题
	["/:clusterCode/super/collaboration/:projectId/:topicId", seoRoutes.collaborationTopic],
	// 协作项目
	["/:clusterCode/super/collaboration/:projectId", seoRoutes.collaborationProject],
	// 个人项目 - 话题
	["/:clusterCode/super/:projectId/:topicId", seoRoutes.personalTopic],
	// 个人项目
	["/:clusterCode/super/:projectId", seoRoutes.personalProject],
	// 审批
	["/:clusterCode/approval", seoRoutes.approval],
	// 云文档
	["/:clusterCode/docx/:fileId", seoRoutes.docx],
	// 多维表格(视图) - Express 5.x 不支持可选参数，需要拆分为多个路由
	["/:clusterCode/base/:fileId/:sheetId/:viewId", seoRoutes.pivotTable],
	["/:clusterCode/base/:fileId/:sheetId", seoRoutes.pivotTable],
	["/:clusterCode/base/:fileId", seoRoutes.pivotTable],
	// 多维表格 - 共享表单
	["/:clusterCode/form/submit/:fileId/:viewId", seoRoutes.sharedForm],
	// WPS文档
	["/:clusterCode/office/:fileId", seoRoutes.file],
	// 白板
	["/:clusterCode/whiteboard/:fileId", seoRoutes.file],
	// 文件
	["/:clusterCode/file/:fileId", seoRoutes.file],
	// 云盘 - 个人云盘
	["/:clusterCode/drive/me", seoRoutes.drivePersonal],
	// 云盘 - 我创建的
	["/:clusterCode/drive/mine", seoRoutes.driveMine],
	// 云盘 - 常用
	["/:clusterCode/drive/recent", seoRoutes.driveRecent],
	// 云盘 - 企业云盘
	["/:clusterCode/drive/shared", seoRoutes.driveShared],
	// 云盘 - 文件夹
	["/:clusterCode/drive/folder/:folderId/:spaceId", seoRoutes.folder],
	// 知识库 - 目录管理（微前端天书分享链接，不走 file 接口避免 getFileInfo 报错导致 og 空）
	["/:clusterCode/knowledge/directory/:fileId", seoRoutes.knowledgeDirectory],
	// 知识库 - 预览
	["/:clusterCode/knowledge/preview/:knowledgeId/:fileId", seoRoutes.file],
	// 管理后台（静态 title，与 src/routes/modules/admin、各模块 routes 对应）
	...getAdminSeoRoutes(),
	// 管理后台（带 clusterCode 前缀，/:clusterCode/admin/*）
	...getAdminSeoRoutesWithClusterCode(),
]

module.exports = (app) => {
	routes.forEach(([routePath, routeHandler]) => {
		app.get(routePath, async (req, res, next) => {
			let htmlTemplate
			try {
				htmlTemplate = getHtmlTemplate()
			} catch (error) {
				logger.error("nodeServer", "SEOHandler", "Failed to read index.html:", error)
				return next(error)
			}

			try {
				const baseUrl = `${req.protocol}://${req.get("host")}`

				// 获取全局平台信息
				const platformInfoRaw = await getGlobalPlatformInfo()
				const locale = req.getLocale()

				// 提取平台信息（带 fallback）
				const platformInfo = getPlatformInfo(platformInfoRaw, locale)

				// 获取页面特定的 SEO 信息（useDefaultPlatformTitle 为 true 时用产品名而非工作区名）
				const seoData = await routeHandler(req, res, next)
				const { title, keywords, description, useDefaultPlatformTitle } = seoData
				const platformTitle = useDefaultPlatformTitle
					? getPlatformInfo({}, locale).title
					: platformInfo.title

				// 清理并合成最终的 SEO 信息
				const ogTitle = cleanSEOString(
					req.__("site.title", {
						title: title || "",
						platformTitle,
					}),
				)
				const ogKeywords = cleanSEOString(
					req.__("site.keywords", {
						keywords: keywords || "",
						platformKeywords: platformInfo.keywords,
					}),
				)
				const ogDescription = cleanSEOString(
					req.__("site.description", {
						description: description || "",
						platformDescription: platformInfo.description,
					}),
				)

				const ogUrl = `${baseUrl}${req.originalUrl}`

				// 处理 HTML（一次性替换）
				const htmlContent = processHtmlContent(htmlTemplate, {
					favicon: platformInfo.favicon,
					minimal_logo: platformInfo.minimal_logo,
					title: ogTitle,
					keywords: ogKeywords,
					description: ogDescription,
					ogUrl,
				})

				// 设置响应头并返回
				res.setHeader("Content-Type", "text/html; charset=utf-8")
				res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate")
				res.setHeader("Pragma", "no-cache")
				res.setHeader("Expires", "0")
				return res.send(htmlContent)
			} catch (error) {
				logger.error("nodeServer", "SEOHandler", "Failed to process SEO HTML:", error)
				// 错误时降级：返回基础 HTML

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
		})
	})
}
