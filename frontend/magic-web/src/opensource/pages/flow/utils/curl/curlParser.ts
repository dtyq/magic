/**
 * curl 解析相关函数
 */

interface ParsedCurl {
	method: string
	url: string
	domain: string
	path: string
	headers: Record<string, string>
	queryParams: Record<string, string>
	pathParams: string[]
	body: any
	bodyType: string
}

export function parseCurlCommand(curlCommand: string): ParsedCurl {
	// 预处理 curl 命令：移除行尾反斜杠并合并行
	curlCommand = curlCommand.replace(/\\\s*\n/g, " ")

	// 默认值
	const result: ParsedCurl = {
		method: "GET",
		url: "",
		domain: "",
		path: "",
		headers: {},
		queryParams: {},
		pathParams: [],
		body: {},
		bodyType: "none",
	}

	// 提取 URL - 改进正则表达式以处理带引号和不带引号的URL
	const urlMatch = curlCommand.match(
		/curl\s+(?:--location|-L)?\s*(?:--request|-X)?\s*[A-Z]*\s*['"]([^'"]+)['"]|curl\s+(?:--location|-L)?\s*(?:--request|-X)?\s*[A-Z]*\s*([^\s'"]+)/,
	)
	if (urlMatch) {
		result.url = urlMatch[1] || urlMatch[2] || ""
		try {
			// 处理URL
			const urlObj = new URL(result.url)
			result.domain = urlObj.origin
			result.path = urlObj.pathname

			// 提取查询参数
			const searchParams = urlObj.searchParams
			searchParams.forEach((value, key) => {
				result.queryParams[key] = value
			})
		} catch (e) {
			console.error("Invalid URL in curl command", e)
			// 尝试手动解析URL
			const urlParts = result.url.split("/")
			if (urlParts.length >= 3) {
				// 提取域名部分
				const protocolAndDomain = urlParts.slice(0, 3).join("/")
				result.domain = protocolAndDomain
				// 提取路径部分
				result.path = `/${urlParts.slice(3).join("/")}`
			}
		}
	}

	// 提取请求方法 - 支持 --request/-X 格式，并处理引号包围的方法名和多种空格情况
	const methodMatch = curlCommand.match(/(?:--request|-X)\s+['"]?\s*([A-Z]+)\s*['"]?/i)
	if (methodMatch && methodMatch[1]) {
		result.method = methodMatch[1].toUpperCase()
	}

	// 检查是否存在请求体数据（--data-raw、--data或-d），如果存在且没有明确指定请求方法，则默认为POST
	const hasDataParam = /(?:--data-raw|-d|--data)\s+['"]/.test(curlCommand)
	if (hasDataParam && result.method === "GET") {
		result.method = "POST"
	}

	// 提取请求头 - 兼容 -H 和 --header 两种格式
	const headerRegex = /(?:--header|-H)\s+['"]([^:;]+)(?::|\s*;\s*)([^'"]*)['"]/g
	const headerMatches = Array.from(curlCommand.matchAll(headerRegex))
	for (const match of headerMatches) {
		if (match[1]) {
			const headerName = match[1].trim()
			const headerValue = match[2] ? match[2].trim() : ""
			// 只添加有效的请求头（有名称的）
			if (headerName) {
				result.headers[headerName] = headerValue
			}
		}
	}

	// 提取请求体 - 支持多种格式，兼容短格式和长格式
	const dataRawMatch = curlCommand.match(/--data-raw\s+['"]((.|[\r\n])*?)['"](?:\s|$)/s)
	const dataMatch = curlCommand.match(/(?:--data|-d)\s+['"]((.|[\r\n])*?)['"](?:\s|$)/s)
	const formMatch = curlCommand.match(/(?:--data-urlencode|-d)\s+['"]((.|[\r\n])*?)['"](?:\s|$)/s)

	let bodyContent = ""
	if (dataRawMatch) bodyContent = dataRawMatch[1]
	else if (dataMatch) bodyContent = dataMatch[1]
	else if (formMatch) bodyContent = formMatch[1]

	console.log("Extracted body content:", bodyContent)

	if (bodyContent) {
		// 检查内容类型
		const contentTypeHeader = Object.entries(result.headers).find(
			([key]) => key.toLowerCase() === "content-type",
		)

		if (contentTypeHeader) {
			const contentType = contentTypeHeader[1].toLowerCase()
			if (contentType.includes("application/json")) {
				result.bodyType = "json"
				try {
					// 尝试直接解析 JSON
					result.body = JSON.parse(bodyContent)
				} catch (e) {
					console.error("Failed to parse JSON body, trying to clean it first", e)
					try {
						// 清理JSON字符串：移除转义字符和额外的换行符
						const cleanedBody = bodyContent
							.replace(/\\n/g, " ")
							.replace(/\\"/g, '"')
							.replace(/\\\\/g, "\\")
							.replace(/\n/g, " ")
							.trim()

						console.log("Cleaned body:", cleanedBody)
						result.body = JSON.parse(cleanedBody)
					} catch (e2) {
						console.error("Failed to parse cleaned JSON body", e2)

						// 最后尝试：提取JSON部分
						try {
							const jsonRegex = /{[\s\S]*}/s
							const jsonMatch = bodyContent.match(jsonRegex)
							if (jsonMatch) {
								console.log("Extracted JSON part:", jsonMatch[0])
								result.body = JSON.parse(jsonMatch[0])
							} else {
								result.body = bodyContent
							}
						} catch (e3) {
							console.error("All JSON parsing attempts failed", e3)
							result.body = bodyContent
						}
					}
				}
			} else if (contentType.includes("application/x-www-form-urlencoded")) {
				result.bodyType = "x-www-form-urlencoded"
				// 解析表单数据
				const formData: Record<string, string> = {}
				bodyContent.split("&").forEach((pair) => {
					const [key, value] = pair.split("=")
					if (key) formData[key] = value || ""
				})
				result.body = formData
			} else if (contentType.includes("multipart/form-data")) {
				result.bodyType = "form-data"
				// 解析多部分表单数据
				const formData: Record<string, string> = {}
				bodyContent.split("&").forEach((pair) => {
					const [key, value] = pair.split("=")
					if (key) formData[key] = value || ""
				})
				result.body = formData
			}
		} else {
			// 没有Content-Type头，尝试推断类型
			if (bodyContent.trim().startsWith("{") && bodyContent.trim().endsWith("}")) {
				result.bodyType = "json"
				try {
					// 尝试直接解析JSON
					result.body = JSON.parse(bodyContent)
				} catch (e) {
					console.error(
						"Failed to parse JSON body without content-type, trying to clean it",
						e,
					)
					try {
						// 清理JSON字符串
						const cleanedBody = bodyContent
							.replace(/\\n/g, " ")
							.replace(/\\"/g, '"')
							.replace(/\\\\/g, "\\")
							.replace(/\n/g, " ")
							.trim()

						console.log("Cleaned body without content-type:", cleanedBody)
						result.body = JSON.parse(cleanedBody)
					} catch (e2) {
						console.error("Failed to parse cleaned JSON body without content-type", e2)

						// 最后尝试：提取JSON部分
						try {
							const jsonRegex = /{[\s\S]*}/s
							const jsonMatch = bodyContent.match(jsonRegex)
							if (jsonMatch) {
								console.log(
									"Extracted JSON part without content-type:",
									jsonMatch[0],
								)
								result.body = JSON.parse(jsonMatch[0])
							} else {
								// 如果是表单格式，则解析为表单
								if (bodyContent.includes("&") && bodyContent.includes("=")) {
									result.bodyType = "x-www-form-urlencoded"
									const formData: Record<string, string> = {}
									bodyContent.split("&").forEach((pair) => {
										const [key, value] = pair.split("=")
										if (key) formData[key] = value || ""
									})
									result.body = formData
								} else {
									result.body = bodyContent
								}
							}
						} catch (e3) {
							console.error(
								"All JSON parsing attempts failed without content-type",
								e3,
							)
							result.body = bodyContent
						}
					}
				}
			} else if (bodyContent.includes("&") && bodyContent.includes("=")) {
				result.bodyType = "x-www-form-urlencoded"
				const formData: Record<string, string> = {}
				bodyContent.split("&").forEach((pair) => {
					const [key, value] = pair.split("=")
					if (key) formData[key] = value || ""
				})
				result.body = formData
			} else {
				// 默认为纯文本
				result.bodyType = "json"
				result.body = bodyContent
			}
		}
	}

	// 如果有请求体但没有设置类型，默认为JSON
	if (Object.keys(result.body).length > 0 && result.bodyType === "none") {
		result.bodyType = "json"
	}

	console.log("Parsed curl result:", JSON.stringify(result, null, 2))
	return result
}
