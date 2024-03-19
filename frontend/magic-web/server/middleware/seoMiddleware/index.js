const defaultSEOHandler = require("./defaultSEOHandler")
const SEOHandler = require("./SEOHandler")

module.exports = {
	defaultSEOMiddleware: defaultSEOHandler, // 默认 SEO 处理
	generateSeoRoutes: SEOHandler, // SEO 路由处理
}
