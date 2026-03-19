interface SensitiveDataConfig {
	/** 脱敏规则 */
	patterns?: Array<{
		/** 匹配模式 */
		pattern: RegExp
		/** 自定义替换函数，不提供则使用默认mask方法 */
		replacement?: string | ((match: string, ...args: any[]) => string)
	}>
	/** 需要脱敏的 key */
	keys?: string[]
	/** 脱敏后的替换字符 */
	replacement: string
	/** 保留前几位 */
	preserveStart?: number
	/** 保留后几位 */
	preserveEnd?: number
	/** 脱敏字符 */
	maskChar?: string
	/** 是否使用固定替换 */
	useFixedReplacement?: boolean
}

/** 邮箱脱敏规则 */
const EmailParser = {
	pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/, // Email pattern
}

/** URL脱敏规则 */
const URLParser = {
	pattern: /([?&])([^=&]+)=([^&]*)/g,
	replacement: (match: string, prefix: string, key: string, value: string) => {
		if (
			SensitiveMasker.config.keys?.some((sensitiveKey) =>
				key.toLowerCase().includes(sensitiveKey.toLowerCase()),
			)
		) {
			return `${prefix}${key}=${SensitiveMasker.mask(value)}`
		}
		return match
	},
}

/** API密钥脱敏规则 */
const APIParser = {
	pattern: /(\bapi[_-]?key=)([^&\s]+)/gi,
	replacement: (match: string) => {
		const parts = match.split("=")
		if (parts.length === 2) {
			return `${parts[0]}=${SensitiveMasker.mask(parts[1])}`
		}
		return match
	},
}

/** JWT脱敏规则 */
const JWTParser = {
	pattern: /(\bbearer\s+)([A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*)/gi,
	replacement: (match: string) => {
		const parts = match.split(/\s+/, 2)
		if (parts.length === 2) {
			return `${parts[0]} ${SensitiveMasker.mask(parts[1])}`
		}
		return match
	},
}

/** Token脱敏规则 */
const TokenParser = {
	pattern: /^[A-Za-z0-9\-_=]+\.[A-Za-z0-9\-_=]+\.[A-Za-z0-9\-_=]+$/,
	replacement: (match: string) => {
		const preserveStart = 10
		const preserveEnd = 10
		if (match.length <= preserveStart + preserveEnd) {
			return match
		}
		const start = match.substring(0, preserveStart)
		const end = match.substring(match.length - preserveEnd)
		const maskedLength = match.length - preserveStart - preserveEnd
		const middle = "*".repeat(Math.min(maskedLength, 8)) // 限制脱敏字符的数量

		return `${start}${middle}${end}`
	},
}

/** 身份证脱敏规则 */
const IDCardParser = {
	pattern: /(\b[1-9]\d{5}(18|19|20)\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\d{3}[\dXx])/g,
}

/**
 * @description 敏感数据脱敏
 */
export class SensitiveMasker {
	static config: SensitiveDataConfig = {
		patterns: [EmailParser, APIParser, JWTParser, IDCardParser, URLParser, TokenParser],
		keys: [
			"password",
			"token",
			"secret",
			"auth",
			"account",
			"address",
			"street",
			"phone",
			"email",
			"credit_card",
			"authorization",
			"teamshare_token",
			"login_token",
			"key",
			"api_key",
			"apikey",
		],
		replacement: "[REDACTED]",
		preserveStart: 4,
		preserveEnd: 4,
		maskChar: "*",
		useFixedReplacement: false,
	}

	/**
	 * @description 敏感数据脱敏
	 * @param value 需要脱敏的值
	 * @returns 脱敏后的值
	 */
	static mask(value: string): string {
		if (!value || typeof value !== "string") {
			return SensitiveMasker.config.replacement
		}

		// 使用固定替换，如果指定
		if (SensitiveMasker.config.useFixedReplacement) {
			return SensitiveMasker.config.replacement
		}

		const preserveStart = SensitiveMasker.config.preserveStart || 0
		const preserveEnd = SensitiveMasker.config.preserveEnd || 0
		const maskChar = SensitiveMasker.config.maskChar || "*"

		// 如果字符串太短，无法正确脱敏，则使用全替换
		if (value.length <= preserveStart + preserveEnd) {
			return maskChar.repeat(value.length)
		}

		const start = value.substring(0, preserveStart)
		const end = value.substring(value.length - preserveEnd)
		const maskedLength = value.length - preserveStart - preserveEnd
		const middle = maskChar.repeat(Math.min(maskedLength, 8)) // 限制脱敏字符的数量

		return `${start}${middle}${end}`
	}

	/**
	 * @description 脱敏数据
	 * @param data 需要脱敏的数据
	 * @returns 脱敏后的数据
	 */
	static sanitize(data: any): any {
		if (data === null || data === undefined) {
			return data
		}

		if (typeof data === "function") {
			return "[FUNCTION]"
		}

		if (typeof data === "string") {
			const sanitized = SensitiveMasker.parsePattern(data)

			return SensitiveMasker.safeStringify(sanitized)
		}

		if (typeof data === "object") {
			if (Array.isArray(data)) {
				return data.map((item) => SensitiveMasker.sanitize(item))
			}

			// 创建一个副本，避免修改原始对象
			const sanitized: Record<string, any> = {}

			for (const [key, value] of Object.entries(data)) {
				// 检查是否需要脱敏
				if (
					SensitiveMasker.config.keys?.some((sensitiveKey) =>
						key.toLowerCase().includes(sensitiveKey.toLowerCase()),
					)
				) {
					sanitized[key] =
						typeof value === "string"
							? SensitiveMasker.mask(value)
							: SensitiveMasker.sanitize(value)
				} else {
					// 递归脱敏嵌套对象
					sanitized[key] = SensitiveMasker.sanitize(value)
				}
			}

			return sanitized
		}

		// 返回原始值
		return data
	}

	/**
	 * @description 解析脱敏规则
	 * @param value 需要解析的值
	 * @returns 解析后的值
	 */
	private static parsePattern(value: string) {
		let sanitized = value
		try {
			SensitiveMasker.config.patterns?.forEach((patternObj) => {
				const { pattern, replacement } = patternObj
				if (pattern.test(sanitized)) {
					sanitized = sanitized.replace(pattern, (match, ...args) => {
						try {
							// 如果提供了自定义替换函数，使用它
							if (typeof replacement === "function") {
								return replacement(match, ...args)
							}
							// 如果提供了固定替换字符串，使用它
							if (typeof replacement === "string") {
								return replacement
							}
							// 否则使用默认的mask方法
							return SensitiveMasker.mask(match)
						} catch (error: any) {
							console.error(error)
							return match
						}
					})
				}
			})
		} catch (error) {
			console.error("Regular parsing exception", error)
		}
		return sanitized
	}

	/**
	 * @description 获取用于 JSON.stringify 的 replacer 函数
	 * 直接用于 JSON.stringify 的第二个参数
	 * @example JSON.stringify(data, SensitiveMasker.getJSONReplacer())
	 * @returns JSON.stringify 的 replacer 函数
	 */
	private static getJSONReplacer(): (key: string, value: any) => any {
		return function (key: string, value: any) {
			// 如果是敏感键
			if (
				SensitiveMasker.config.keys?.some((sensitiveKey) =>
					key.toLowerCase().includes(sensitiveKey.toLowerCase()),
				)
			) {
				// 对字符串值进行脱敏处理
				return typeof value === "string" ? SensitiveMasker.mask(value) : "[MASKED OBJECT]"
			}

			// 如果是字符串值，检查是否匹配敏感模式
			if (typeof value === "string") {
				return SensitiveMasker.parsePattern(value)
			}

			// 返回原始值进行进一步处理
			return value
		}
	}

	/**
	 * @description 安全地将对象转换为 JSON 字符串，同时进行数据脱敏
	 * @param data 需要脱敏的字符串
	 * @param space 缩进空格数
	 * @returns 脱敏后的 JSON 字符串
	 */
	private static safeStringify(data: string, space?: number): string {
		try {
			return JSON.stringify(JSON.parse(data), SensitiveMasker.getJSONReplacer(), space)
		} catch (error) {
			return data
		}
	}
}
