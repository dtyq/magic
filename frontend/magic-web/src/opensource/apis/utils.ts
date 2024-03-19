export class UrlUtils {
	/**
	 * 判断 URL 是否包含 host
	 * @param url - 需要判断的 URL 字符串
	 */
	static hasHost(url: string) {
		try {
			return !!new URL(url).host
		} catch {
			return url.startsWith("//")
		}
	}

	/**
	 * 安全地拼接 URL
	 * @param origin - 基础URL
	 * @param pathname - 路径
	 * @returns 拼接后的URL
	 */
	static join(origin: string, pathname: string): string {
		// 处理绝对URL的情况
		if (pathname.startsWith("http://") || pathname.startsWith("https://")) {
			return pathname
		}

		if (pathname.startsWith("//")) {
			return pathname
		}

		// 处理无效URL的情况
		try {
			const originUrl = new URL(origin)
			const originPathname = originUrl.pathname

			// 规范化路径，去除多余的斜杠
			const normalizedPathname = originPathname.endsWith("/")
				? originPathname.slice(0, -1)
				: originPathname

			const normalizedPath = pathname.startsWith("/") ? pathname : `/${pathname}`

			const url = new URL(normalizedPathname + normalizedPath, originUrl.origin)

			return url.toString()
		} catch (e) {
			// 简单处理无效URL的情况
			return origin + (origin.endsWith("/") ? "" : "/") + pathname.replace(/^\.\/|^\/+/, "")
		}
	}

	/**
	 * @description 替换 URL 中的主机名
	 * @param uri pathname、query、hash 皆可
	 * @param hostname 新的主机名
	 */
	static replaceHostname(uri: string, hostname: string) {
		const baseUri = "https://a.com"
		const url = new URL(uri, baseUri)

		const replaceHost = url.hostname === baseUri ? baseUri : url.hostname
		return url.toString().replace(replaceHost, hostname)
	}

	/**
	 * 获取 URL 的各个部分
	 */
	static parse = (url: string) => {
		try {
			const urlObj = new URL(url)
			return {
				protocol: urlObj.protocol,
				origin: urlObj.origin,
				host: urlObj.host,
				pathname: urlObj.pathname,
				search: urlObj.search,
				hash: urlObj.hash,
				isValid: true,
			}
		} catch {
			return {
				origin: "",
				protocol: "",
				host: "",
				pathname: url,
				search: "",
				hash: "",
				isValid: false,
			}
		}
	}

	/**
	 * 将WebSocket连接地址转换为Socket.io连接地址
	 * @param url WebSocket连接地址
	 * @returns Socket.io连接地址
	 */
	static transformToSocketIoUrl(url: string) {
		return `${url}/socket.io/?EIO=3&transport=websocket&timestamp=${Date.now()}`
		// 一个无效的 ws 地址，用于调试重连机制
		// return `wss://192.0.2.1/test`
	}

	/**
	 * @description request body parsing
	 * @param response
	 */
	static async responseParse(response: Response) {
		const contentType = (response.headers.get("Content-Type") || "").toLowerCase()

		if (contentType.includes("application/json")) {
			return { data: await response.json(), type: "json" }
		}
		if (contentType.includes("text/")) {
			return { data: await response.text(), type: "text" }
		}
		if (contentType.includes("image/")) {
			return { data: await response.blob(), type: "blob" }
		}

		return { data: await response.arrayBuffer(), type: "buffer" }
	}
}

export class StringUtils {
	static generateSessionFingerprint() {
		const keys = [
			navigator.userAgent,
			navigator.hardwareConcurrency,
			screen.width,
			Intl.DateTimeFormat().resolvedOptions().timeZone,
		]
		const data = new TextEncoder().encode(keys.join("|"))
		let hash = 0
		for (let i = 0; i < data.length; i++) {
			hash = (hash << 5) + hash + data[i]
		}
		return Math.abs(hash).toString(16).slice(0, 8)
	}

	static createRequestId() {
		// 第一部分：时间熵源（8字符）
		const timePart = Math.floor(performance.timeOrigin + performance.now())
			.toString(36)
			.slice(-8)
			.padStart(8, "0")

		// 第二部分：密码学随机（16字符）
		const randomBuffer = window.crypto.getRandomValues(new Uint8Array(6))
		const randomPart = Array.from(randomBuffer, (byte) =>
			byte.toString(16).padStart(2, "0"),
		).join("")

		// 第三部分：会话上下文指纹（8字符）
		const contextPart = StringUtils.generateSessionFingerprint()

		return `${timePart}${randomPart}${contextPart}`.toUpperCase()
	}
}
