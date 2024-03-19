import { nanoid } from "nanoid"
import type { FileData } from "../types"

export function genFileData(file: File): FileData {
	return {
		id: nanoid(),
		name: file.name,
		file,
		status: "init",
		progress: 0,
	}
}

/**
 * 处理字符串中的转义字符，确保保持用户输入的原始形式
 * 例如，将"\n"作为分隔符时，通过JSON后会变成"\\n"，此函数将其还原为"\n"
 * @param {string} str - 需要处理的字符串
 * @returns {string} 处理后的字符串
 */
export function processEscapeChars(str: string): string {
	if (!str) return str

	// 处理常见的转义字符
	return str.replace(/\\\\n/g, "\\n").replace(/\\\\t/g, "\\t").replace(/\\\\r/g, "\\r")
}

/**
 * 处理配置对象中所有分隔符字段的转义字符
 * @param {object} config - 配置对象，包含normal和parent_child等子对象
 * @returns {object} 处理后的配置对象
 */
export function processConfigSeparators(config: any): any {
	const { normal, parent_child } = config

	// 复制对象，避免直接修改原对象
	const processedNormal = { ...normal }
	const processedParentChild = { ...parent_child }

	// 处理normal中的分隔符
	if (processedNormal?.segment_rule?.separator) {
		processedNormal.segment_rule.separator = processEscapeChars(
			processedNormal.segment_rule.separator,
		)
	}

	// 处理parent_child中的分隔符
	if (processedParentChild?.parent_segment_rule?.separator) {
		processedParentChild.parent_segment_rule.separator = processEscapeChars(
			processedParentChild.parent_segment_rule.separator,
		)
	}

	if (processedParentChild?.child_segment_rule?.separator) {
		processedParentChild.child_segment_rule.separator = processEscapeChars(
			processedParentChild.child_segment_rule.separator,
		)
	}

	return {
		...config,
		normal: processedNormal,
		parent_child: processedParentChild,
	}
}

/**
 * 获取文档名称的扩展名
 * 安全地从文件名中提取扩展名，处理多种边缘情况
 * @param {string} fileName - 文件名
 * @returns {string} 文件扩展名（小写），如果没有扩展名或扩展名不符合规则则返回空字符串
 */
export function getFileExtension(fileName: string): string {
	if (!fileName || typeof fileName !== "string") {
		return ""
	}

	// 处理路径分隔符，获取实际文件名
	const baseName = fileName.split(/[/\\]/).pop() || ""

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
