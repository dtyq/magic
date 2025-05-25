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
	 * 获取 URL 的各个部分
	 */
	static parse = (url: string) => {
		try {
			const urlObj = new URL(url)
			return {
				protocol: urlObj.protocol,
				host: urlObj.host,
				pathname: urlObj.pathname,
				search: urlObj.search,
				hash: urlObj.hash,
				isValid: true,
			}
		} catch {
			return {
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
	}
	
	/**
	 * @description request body parsing
	 * @param response
	 */
	static async responseParse(response: Response) {
		const contentType = response.headers.get("Content-Type") || ""
		
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
