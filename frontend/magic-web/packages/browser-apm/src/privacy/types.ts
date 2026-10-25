export interface MaskingRule {
	pattern: RegExp
	/** Receives the native String.replace capture arguments after the matched text. */
	replacement?: string | ((match: string, ...args: unknown[]) => string)
}

export interface SensitiveDataConfig {
	patterns?: MaskingRule[]
	/** Keys are matched case-insensitively by substring. */
	keys?: string[]
	replacement: string
	preserveStart?: number
	preserveEnd?: number
	maskChar?: string
	useFixedReplacement?: boolean
}

/** Default rules receive masking operations without importing the sanitizer implementation. */
export interface MaskingOperations {
	mask: (value: string) => string
	isSensitiveKey: (key: string) => boolean
}
