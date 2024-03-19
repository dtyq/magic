import type { TFunction } from "i18next"

export const validatorHost = (value: string, t: TFunction) => {
	if (!value) {
		return Promise.resolve()
	}

	// 验证 IPv4 地址
	const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/
	if (ipv4Regex.test(value)) {
		const parts = value.split(".")
		const isValid = parts.every((part) => {
			const num = parseInt(part, 10)
			return num >= 0 && num <= 255
		})
		if (isValid) {
			return Promise.resolve()
		}
	}

	// 验证 IPv6 地址（支持基本格式）
	// 支持格式：2001:0db8:85a3:0000:0000:8a2e:0370:7334, ::1, ::, 2001::1 等
	const ipv6BasicPattern = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$|^::1$|^::$|^::/
	if (ipv6BasicPattern.test(value)) {
		// 基本格式检查：确保不是无效的格式
		const colonCount = (value.match(/:/g) || []).length
		if (colonCount <= 7) {
			return Promise.resolve()
		}
	}

	// 验证域名或主机名
	// 允许：字母、数字、连字符、点号
	// 不能以点号或连字符开头或结尾
	// 每个标签长度不超过63个字符
	const hostnameRegex =
		/^([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)*[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$|^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/
	if (hostnameRegex.test(value)) {
		// 检查总长度不超过253个字符
		if (value.length <= 253) {
			return Promise.resolve()
		}
	}

	// localhost 特殊处理
	if (value.toLowerCase() === "localhost") {
		return Promise.resolve()
	}

	return Promise.reject(new Error(t("pleaseInputValidServer")))
}
