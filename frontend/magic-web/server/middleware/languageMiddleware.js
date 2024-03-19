// Language middleware
const languageMiddleware = (req, res, next) => {
	let clientLanguage = req.headers["language"]
	
	if (!clientLanguage) {
		const acceptLanguage = req.headers["accept-language"] || "en-US,en;q=0.9"

		const languages = acceptLanguage
			.split(",")
			.map((lang) => {
				const [code, q = 1] = lang.trim().split(";q=")
				return { code: code.toLowerCase(), weight: parseFloat(q) }
			})
			.sort((a, b) => b.weight - a.weight) // 按权重从高到低排序

		clientLanguage = languages?.[0]?.code || "enUS"
	}

	// 确定语言并设置 i18n locale
	const locale = clientLanguage.toUpperCase().indexOf("ZH") === 0 ? "zhCN" : "enUS"
	req.language = locale

	// 设置 i18n 的 locale，这样 req.__() 才能正确工作
	req.setLocale(locale)

	next()
}

module.exports = languageMiddleware
