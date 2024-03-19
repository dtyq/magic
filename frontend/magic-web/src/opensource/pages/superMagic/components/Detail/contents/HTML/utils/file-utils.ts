/**
 * 文件处理工具函数
 */

/**
 * 将文件转换为 base64 字符串
 * @param file - 要转换的 File 对象
 * @returns Promise<string> - base64 数据 URL
 */
export function fileToBase64(file: File): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader()
		reader.onload = () => resolve(reader.result as string)
		reader.onerror = () => reject(new Error("文件读取失败"))
		reader.readAsDataURL(file)
	})
}

/**
 * 解析上传路径：区分相对路径和绝对路径
 * @param path - 要解析的路径
 * @param relativeFilePath - 当前 HTML 文件的相对路径（用于计算相对路径的基准）
 * @returns 解析后的路径（去掉开头的 "/"）
 */
export function resolveUploadPath(path: string, relativeFilePath?: string): string {
	// 规范化路径：去掉开头的 "./" 或 "."
	let normalizedPath = path.trim()
	let isRelative = false

	// 处理 "./" 开头的情况（明确标记为相对路径）
	if (normalizedPath.startsWith("./")) {
		normalizedPath = normalizedPath.slice(2)
		isRelative = true
	} else if (normalizedPath === ".") {
		normalizedPath = ""
		isRelative = true
	} else if (normalizedPath.startsWith("../")) {
		isRelative = true
	}

	// 绝对路径：以 "/" 开头（如 "/新建文件夹/xxx"）
	if (path.startsWith("/")) {
		// 去掉开头的 "/"，然后规范化
		const absolutePath = normalizedPath || path.slice(1)
		return normalizePath(absolutePath)
	}

	// 如果已经明确是相对路径，或者路径不包含 "/"（单个文件名），则按相对路径处理
	if (isRelative || !normalizedPath.includes("/")) {
		// 相对路径：相对于当前 HTML 文件所在目录
		if (!relativeFilePath || relativeFilePath === "/") {
			// 如果当前文件在根目录，直接返回规范化后的路径
			return normalizePath(normalizedPath) || path
		}

		// 计算当前 HTML 文件所在目录
		// relative_file_path 格式如 "/folder/subfolder/index.html"
		// 需要去掉文件名，得到目录路径
		let htmlDir = relativeFilePath
		if (htmlDir.startsWith("/")) {
			htmlDir = htmlDir.slice(1)
		}

		// 找到最后一个 "/"，去掉文件名部分
		const lastSlashIndex = htmlDir.lastIndexOf("/")
		if (lastSlashIndex >= 0) {
			htmlDir = htmlDir.substring(0, lastSlashIndex + 1)
		} else {
			htmlDir = ""
		}

		// 拼接相对路径
		const resolved = htmlDir + normalizedPath

		// 规范化路径：去掉多余的 "/" 和 "./"
		return normalizePath(resolved)
	}

	// 绝对路径：不以 "/" 开头但包含 "/" 且第一个部分不包含文件扩展名（如 "新建文件夹/xx"）
	// 判断逻辑：如果路径包含 "/"，且第一个部分（第一个 "/" 之前）不包含 "."，则视为绝对路径
	if (normalizedPath.includes("/")) {
		const firstPart = normalizedPath.split("/")[0]
		// 如果第一部分不包含 "."（没有文件扩展名），视为绝对路径
		if (firstPart && !firstPart.includes(".")) {
			return normalizePath(normalizedPath)
		}
	}

	// 默认按相对路径处理
	if (!relativeFilePath || relativeFilePath === "/") {
		return normalizePath(normalizedPath) || path
	}

	let htmlDir = relativeFilePath
	if (htmlDir.startsWith("/")) {
		htmlDir = htmlDir.slice(1)
	}

	const lastSlashIndex = htmlDir.lastIndexOf("/")
	if (lastSlashIndex >= 0) {
		htmlDir = htmlDir.substring(0, lastSlashIndex + 1)
	} else {
		htmlDir = ""
	}

	const resolved = htmlDir + normalizedPath
	return normalizePath(resolved)
}

/**
 * 规范化路径：去掉多余的 "/"、"./" 和 "."
 * @param path - 要规范化的路径
 * @returns 规范化后的路径
 */
function normalizePath(path: string): string {
	if (!path) return ""

	// 分割路径
	const parts = path.split("/").filter((part) => part && part !== ".")

	// 处理 ".." 的情况（向上级目录）
	const result: string[] = []
	for (const part of parts) {
		if (part === "..") {
			if (result.length > 0) {
				result.pop()
			}
		} else {
			result.push(part)
		}
	}

	return result.join("/")
}

/**
 * 清理路径：去掉开头的 "/"，规范化路径
 * @param path - 要清理的路径
 * @returns 清理后的路径（目录路径，不包含文件名）
 */
export function cleanPath(path: string): string {
	if (path === "/" || !path) {
		return ""
	}

	let cleaned = path
	if (cleaned.startsWith("/")) {
		cleaned = cleaned.slice(1)
	}

	// 规范化路径
	cleaned = normalizePath(cleaned)

	// 如果路径以文件名结尾（包含文件扩展名），去掉文件名部分
	// 判断最后一个部分是否包含文件扩展名
	const parts = cleaned.split("/")
	if (parts.length > 0) {
		const lastPart = parts[parts.length - 1]
		// 如果最后一部分包含 "." 且不是以 "." 开头（排除隐藏文件），视为文件名
		if (lastPart.includes(".") && !lastPart.startsWith(".")) {
			parts.pop()
			cleaned = parts.join("/")
		}
	}

	return cleaned
}
