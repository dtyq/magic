// 通过文件扩展名获取文件类型
import { IMAGE_EXTENSIONS } from "@/const/file"

export const getFileType = (file_extension: string) => {
	if (!file_extension) return ""

	const ext = file_extension.toLowerCase()

	// 图片文件
	if (IMAGE_EXTENSIONS.includes(ext)) {
		return "image"
	}

	// Excel文件
	if (["xlsx", "xls", "csv"].includes(ext)) {
		return "excel"
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
	if (ext === "md" || ext === "txt") {
		return "md"
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
		].includes(ext)
	) {
		return "code"
	}

	return ""
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
