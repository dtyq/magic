/**
 * 文件名校验工具
 * 根据Web端文件命名限制进行校验
 */
import type { TFunction } from "i18next"

// 文件名长度限制
const MAX_FILENAME_LENGTH = 255

// 不允许的字符：Windows和Web常见的禁用字符
const INVALID_CHARS = /[\\/:*?"<>|]/

// 控制字符 (ASCII 0-31)
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\x00-\x1f]/

// Windows系统保留名称
const RESERVED_NAMES = [
	"CON",
	"PRN",
	"AUX",
	"NUL",
	"COM1",
	"COM2",
	"COM3",
	"COM4",
	"COM5",
	"COM6",
	"COM7",
	"COM8",
	"COM9",
	"LPT1",
	"LPT2",
	"LPT3",
	"LPT4",
	"LPT5",
	"LPT6",
	"LPT7",
	"LPT8",
	"LPT9",
]

export interface FilenameValidationResult {
	isValid: boolean
	errorMessage?: string
}

export interface FilenameValidationOptions {
	t?: TFunction
	allowDotStart?: boolean
}

/**
 * 校验文件名是否符合规范
 * @param filename 文件名
 * @param isFolder 是否为文件夹（默认false）
 * @param options 选项配置
 * @returns 校验结果
 */
export function validateFilename(
	filename: string,
	isFolder = false,
	options: FilenameValidationOptions = {},
): FilenameValidationResult {
	const { t } = options
	const getTypeText = () =>
		isFolder
			? t?.("filenameValidator.type.folder") || "文件夹"
			: t?.("filenameValidator.type.file") || "文件"

	// 检查是否为空（最基本的检查）
	if (!filename) {
		return {
			isValid: false,
			errorMessage: isFolder
				? t?.("filenameValidator.error.folderEmpty") || "文件夹名称不能为空"
				: t?.("filenameValidator.error.fileEmpty") || "文件名不能为空",
		}
	}

	// 检查是否全是空格、点号或特殊字符（优先于trim空检查）
	if (/^[\s.]+$/.test(filename)) {
		return {
			isValid: false,
			errorMessage:
				t?.("filenameValidator.error.onlySpacesAndDots", { type: getTypeText() }) ||
				`${getTypeText()}名称不能只包含空格或点号`,
		}
	}

	// 检查trim后是否为空
	if (filename.trim() === "") {
		return {
			isValid: false,
			errorMessage: isFolder
				? t?.("filenameValidator.error.folderEmpty") || "文件夹名称不能为空"
				: t?.("filenameValidator.error.fileEmpty") || "文件名不能为空",
		}
	}

	// 检查是否以点号或空格结尾（trim前检查）
	if (filename.endsWith(".") || filename.endsWith(" ")) {
		return {
			isValid: false,
			errorMessage:
				t?.("filenameValidator.error.endsWithDotOrSpace", { type: getTypeText() }) ||
				`${getTypeText()}名称不能以点号或空格结尾`,
		}
	}

	// 去除首尾空格进行后续检查
	const trimmedName = filename.trim()

	// 检查长度
	if (trimmedName.length > MAX_FILENAME_LENGTH) {
		return {
			isValid: false,
			errorMessage:
				t?.("filenameValidator.error.tooLong", {
					type: getTypeText(),
					maxLength: MAX_FILENAME_LENGTH,
				}) || `${getTypeText()}名称长度不能超过${MAX_FILENAME_LENGTH}个字符`,
		}
	}

	// 允许点号开头的文件（如 .env, .gitignore 等）
	// 已移除此限制

	// 检查是否包含无效字符
	if (INVALID_CHARS.test(trimmedName)) {
		return {
			isValid: false,
			errorMessage:
				t?.("filenameValidator.error.invalidCharacters", { type: getTypeText() }) ||
				`${getTypeText()}名称不能包含以下字符：\\ / : * ? " < > |`,
		}
	}

	// 检查是否包含控制字符
	if (CONTROL_CHARS.test(trimmedName)) {
		return {
			isValid: false,
			errorMessage:
				t?.("filenameValidator.error.controlCharacters", { type: getTypeText() }) ||
				`${getTypeText()}名称不能包含控制字符`,
		}
	}

	// 检查是否为系统保留名称（对于文件，需要去除扩展名再检查）
	let nameToCheck = trimmedName
	if (!isFolder) {
		const lastDotIndex = trimmedName.lastIndexOf(".")
		if (lastDotIndex > 0) {
			nameToCheck = trimmedName.substring(0, lastDotIndex)
		}
	}

	if (RESERVED_NAMES.includes(nameToCheck.toUpperCase())) {
		return {
			isValid: false,
			errorMessage:
				t?.("filenameValidator.error.reservedName", { name: nameToCheck }) ||
				`"${nameToCheck}" 是系统保留名称，不能使用`,
		}
	}

	return {
		isValid: true,
	}
}

/**
 * 检查文件名是否有效（简化版本）
 * @param filename 文件名
 * @param isFolder 是否为文件夹
 * @param options 选项配置
 * @returns 是否有效
 */
export function isValidFilename(
	filename: string,
	isFolder = false,
	options: FilenameValidationOptions = {},
): boolean {
	return validateFilename(filename, isFolder, options).isValid
}
