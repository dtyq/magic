// 通过文件扩展名获取文件类型
import { clipboard } from "@/utils/clipboard-helpers"
import { IMAGE_EXTENSIONS } from "@/constants/file"
import { isInApp } from "@/pages/superMagicMobile/utils/mobile"
import { DetailType } from "../components/Detail/types"
import { isDingTalk } from "@/layouts/middlewares/withThirdPartyAuth/Strategy/DingTalkStrategy"
import { openLightModal } from "@/utils/openLightModal"
import FileDownloadModal from "@/components/business/FileDownloadModal"

export const getFileType = (file_extension: string) => {
	if (!file_extension) return "notSupport"

	const ext = file_extension.toLowerCase()

	// 图片文件
	if (IMAGE_EXTENSIONS.includes(ext)) {
		return "image"
	}

	// 视频文件
	if (["mp4", "webm", "mov", "mkv", "avi", "m4v"].includes(ext)) {
		return "video"
	}

	// 音频文件
	if (["mp3", "wav", "ogg", "m4a", "aac", "flac"].includes(ext)) {
		return "audio"
	}

	// Excel文件
	if (["xlsx", "xls", "csv"].includes(ext)) {
		return "excel"
	}

	if (["docx"].includes(ext)) {
		return DetailType.Docx
	}

	// PowerPoint文件
	if (["pptx", "ppt"].includes(ext)) {
		return "powerpoint"
	}

	// PDF文件
	if (ext === "pdf") {
		return "pdf"
	}

	// HTML文件
	if (ext === "html") {
		return "html"
	}

	// Markdown或文本文件
	if (ext === "md") {
		return "md"
	}

	if (ext === "log" || ext === "txt") {
		return "text"
	}

	// 代码文件
	if (
		[
			"js",
			"jsx",
			"ts",
			"tsx",
			"css",
			"scss",
			"json",
			"py",
			"java",
			"c",
			"cpp",
			"cs",
			"go",
			"rb",
			"php",
			"swift",
			"kt",
			"rs",
			"sh",
			"sass",
			"less",
			"styl",
			"sql",
			"html",
			"htm",
			"vue",
			"svelte",
			"dart",
			"r",
			"scala",
			"clj",
			"cljs",
			"ex",
			"exs",
			"erl",
			"hrl",
			"pl",
			"pm",
			"lua",
			"vim",
			"bat",
			"cmd",
			"ps1",
			"m",
			"mm",
			"h",
			"hpp",
			"yaml",
			"yml",
			"toml",
			"ini",
			"cfg",
			"xml",
			"coffee",
			"elm",
			"fs",
			"fsx",
			"vb",
			"asm",
			"makefile",
			"mk",
			"dockerfile",
		].includes(ext)
	) {
		return "code"
	}

	return "notSupport"
}

// 通过文件名称获取语言类型
export const getLanguage = (fileName: string): string => {
	const extension = fileName?.split(".")?.pop()?.toLowerCase() || ""

	const extensionMap: Record<string, string> = {
		js: "javascript",
		jsx: "jsx",
		ts: "typescript",
		tsx: "tsx",
		py: "python",
		java: "java",
		c: "c",
		cpp: "cpp",
		cs: "csharp",
		go: "go",
		rb: "ruby",
		php: "php",
		html: "html",
		css: "css",
		scss: "scss",
		json: "json",
		md: "markdown",
		sql: "sql",
		sh: "bash",
		bat: "batch",
		yaml: "yaml",
		yml: "yaml",
		xml: "xml",
		swift: "swift",
		kt: "kotlin",
		rs: "rust",
		dart: "dart",
	}

	return extensionMap[extension] || "text"
}

// 使用 a 标签下载文件的辅助函数
/**
 * 检查是否在企业微信或微信环境中
 */
const isWechat = (): boolean => {
	const ua = navigator.userAgent.toLowerCase()
	return /wxwork/i.test(ua) || /micromessenger/i.test(ua)
}

/**
 * 检查 URL 是否为 PDF 文件
 * 通过解析 URL 路径名来准确判断文件扩展名，自动排除查询参数和哈希的影响
 */
const isPdfUrl = (url: string): boolean => {
	try {
		const urlObj = new URL(url)
		// 使用 pathname 避免查询参数和哈希的干扰
		const pathname = urlObj.pathname.toLowerCase()
		return pathname.endsWith(".pdf")
	} catch {
		// 如果不是有效的完整 URL（可能是相对路径），手动移除查询参数和哈希
		const urlWithoutParams = url.split("?")[0].split("#")[0].toLowerCase()
		return urlWithoutParams.endsWith(".pdf")
	}
}

/**
 * 从 URL 中提取文件名
 * @param url - 文件 URL
 * @returns 提取的文件名，如果无法提取则返回 undefined
 */
const getFilenameFromUrl = (url: string): string | undefined => {
	try {
		const urlObj = new URL(decodeURIComponent(url))
		// 使用 pathname 避免查询参数的干扰
		const pathname = urlObj.pathname
		// 获取路径中的最后一部分作为文件名
		const segments = pathname.split("/")
		let filename = segments[segments.length - 1]

		// 如果提取到的文件名有效（非空且包含文件扩展名）
		if (filename && filename.includes(".")) {
			// 尝试解码 URL 编码的文件名（例如：%E4%B8%AD%E6%96%87 -> 中文）
			try {
				filename = decodeURIComponent(filename)
			} catch {
				// 如果解码失败，使用原始文件名
			}
			return filename
		}
	} catch {
		// 如果不是有效的完整 URL，尝试手动解析
		const urlWithoutParams = url.split("?")[0].split("#")[0]
		const segments = urlWithoutParams.split("/")
		let filename = segments[segments.length - 1]

		if (filename && filename.includes(".")) {
			// 尝试解码 URL 编码的文件名
			try {
				filename = decodeURIComponent(filename)
			} catch {
				// 如果解码失败，使用原始文件名
			}
			return filename
		}
	}
	return undefined
}

/**
 * 创建下载链接并触发下载
 * @param href - 文件 URL 或 Blob URL
 * @param filename - 下载的文件名
 * @param target - 可选的 target 属性（如 _blank）
 */
const triggerDownload = (href: string, filename?: string, target?: string) => {
	const link = document.createElement("a")
	link.href = href
	link.download = filename || ""
	if (target) {
		link.target = target
	}
	link.rel = "noopener noreferrer"
	document.body.appendChild(link)
	link.click()
	document.body.removeChild(link)
}

const downloadFn = (url: string, filename?: string, target?: string) => {
	// APP 环境、钉钉环境、微信/企业微信环境直接打开新窗口
	if (isInApp() || isDingTalk() || isWechat()) {
		window.open(url, "_blank")
		return
	}

	triggerDownload(url, filename, target)
}

export const downloadFileWithAnchor = async (url: string, filename?: string, target?: string) => {
	// 如果没有传递文件名,尝试从 URL 中提取
	const finalFilename = filename || getFilenameFromUrl(url)

	// 打开下载提示弹窗（使用轻量级 modal，避免双重渲染）
	openLightModal(FileDownloadModal, {
		open: true,
		fileName: finalFilename || "file",
		downloadUrl: url,
		onDownload: () => {
			downloadFn(url, finalFilename, target)
		},
		onCopyLink: () => {
			clipboard.writeText(url)
		},
	})

	downloadFn(url, finalFilename, target)
}

/**
 * 获取文件扩展名（兼容Windows和Mac系统）
 * 安全地从文件名中提取扩展名，处理多种边缘情况
 * @param filename - 文件名
 * @returns 文件扩展名（小写），如果没有扩展名或扩展名不符合规则则返回空字符串
 */
export function getFileExtension(filename: string): string {
	if (!filename || typeof filename !== "string") {
		return ""
	}

	// 处理路径分隔符差异（Windows使用\，Mac/Linux使用/）
	const normalizedFilename = filename.replace(/\\/g, "/")
	const baseName = normalizedFilename.split("/").pop() || ""

	// 如果是隐藏文件（以.开头，但没有其他.），不视为扩展名
	if (/^\.[\w-]+$/.test(baseName)) {
		return ""
	}

	// 获取最后一个.之后的部分
	const parts = baseName.split(".")

	// 如果没有.或只有一个.且在开头（隐藏文件），则没有扩展名
	if (parts.length <= 1 || (parts.length === 2 && parts[0] === "")) {
		return ""
	}

	const extension = parts.pop()?.toLowerCase() || ""

	// 只允许字母数字扩展名
	if (!/^[a-z0-9]+$/.test(extension)) {
		return ""
	}

	return extension
}

/**
 * 获取MIME类型对应的文件扩展名（用于更精确的文件类型匹配）
 * @param ext - 文件扩展名
 * @returns 兼容的文件扩展名数组
 */
export function getMimeTypeExtensions(ext: string): string[] {
	const mimeMap: Record<string, string[]> = {
		// 文档类型
		pdf: ["pdf"],
		doc: ["doc", "docx"],
		docx: ["doc", "docx"],
		xls: ["xls", "xlsx"],
		xlsx: ["xls", "xlsx"],
		ppt: ["ppt", "pptx"],
		pptx: ["ppt", "pptx"],
		// 图片类型
		jpg: ["jpg", "jpeg"],
		jpeg: ["jpg", "jpeg"],
		png: ["png"],
		gif: ["gif"],
		webp: ["webp"],
		svg: ["svg"],
		bmp: ["bmp"],
		ico: ["ico"],
		// 文本类型
		txt: ["txt"],
		md: ["md", "markdown"],
		markdown: ["md", "markdown"],
		// 代码类型
		js: ["js"],
		ts: ["ts"],
		jsx: ["jsx"],
		tsx: ["tsx"],
		html: ["html", "htm"],
		htm: ["html", "htm"],
		css: ["css"],
		scss: ["scss", "sass"],
		sass: ["scss", "sass"],
		less: ["less"],
		json: ["json"],
		xml: ["xml"],
		yaml: ["yaml", "yml"],
		yml: ["yaml", "yml"],
		// 压缩文件
		zip: ["zip"],
		rar: ["rar"],
		"7z": ["7z"],
		tar: ["tar"],
		gz: ["gz"],
		// 音频文件
		mp3: ["mp3"],
		wav: ["wav"],
		ogg: ["ogg"],
		m4a: ["m4a"],
		aac: ["aac"],
		flac: ["flac"],
		// 视频文件
		mp4: ["mp4"],
		webm: ["webm"],
		mov: ["mov"],
		mkv: ["mkv"],
		avi: ["avi"],
		m4v: ["m4v"],
	}
	return mimeMap[ext] || [ext]
}

/**
 * 检查文件类型是否匹配（兼容不同系统和相关文件类型）
 * @param originalExt - 原文件扩展名
 * @param newExt - 新文件扩展名
 * @returns 是否匹配
 */
export function isFileTypeMatching(originalExt: string, newExt: string): boolean {
	if (!originalExt || !newExt) return false

	// 获取兼容的文件扩展名列表
	const originalCompatibleExts = getMimeTypeExtensions(originalExt.toLowerCase())
	const newCompatibleExts = getMimeTypeExtensions(newExt.toLowerCase())

	// 检查是否有交集（兼容相关文件类型）
	return originalCompatibleExts.some((ext) => newCompatibleExts.includes(ext))
}
