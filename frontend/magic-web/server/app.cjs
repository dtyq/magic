const express = require("express")
const configureRoutes = require("./routes")
const i18n = require("i18n")

i18n.configure({
	locales: ["enUS", "zhCN"], // 支持的语言列表
	defaultLocale: "enUS", // 默认语言（当无法匹配时使用）
	directory: __dirname + "/locales", // 语言包存放目录
	autoReload: true, // 开发时自动重新加载语言包（避免重启服务）
	queryParameter: "lang", // 允许通过 URL 参数切换语言（如 ?lang=zh-CN）
	cookie: "lang", // 可选：通过 cookie 存储用户语言偏好
	objectNotation: true, // 启用对象点号访问，支持嵌套 JSON 结构（如 site.title）
})

const app = express()

app.use(i18n.init) // 会在 req 上添加 __() 方法用于翻译

// Disable default x-powered-by response header only in production environment
if (process.env.NODE_ENV === "production") {
	app.disable("x-powered-by")
}

configureRoutes(app)

const PORT = 8080
app.listen(PORT, "0.0.0.0", (err) => {
	if (err) {
		console.log(err)
		return
	}
	console.log(`访问链接 http://localhost:${PORT} --服务已启动`)
})
