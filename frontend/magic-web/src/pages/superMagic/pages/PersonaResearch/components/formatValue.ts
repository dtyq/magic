interface FormatOptions {
	/** Names object keys and values, e.g. age → 年龄, male → 男; unknown text passes through. */
	labelOf?: (text: string) => string
	/** Between a key and its value: "：" in Chinese, ": " in English. */
	keySeparator?: string
}

/**
 * Renders agent-written JSON values as short readable text.
 * Example: { age: 52, city: "西安" } → "age: 52 · city: 西安"; ["a", "b"] → "a、b".
 */
export function formatResearchValue(value: unknown, options: FormatOptions = {}): string {
	const { labelOf = (text: string) => text, keySeparator = ": " } = options
	if (value === null || value === undefined) return ""
	if (typeof value === "string") return labelOf(value)
	if (typeof value === "number" || typeof value === "boolean") return String(value)
	if (Array.isArray(value))
		return value
			.map((item) => formatResearchValue(item, options))
			.filter(Boolean)
			.join("、")
	if (typeof value === "object") {
		return Object.entries(value as Record<string, unknown>)
			.map(([key, item]) => {
				const text = formatResearchValue(item, options)
				return text ? `${labelOf(key)}${keySeparator}${text}` : ""
			})
			.filter(Boolean)
			.join(" · ")
	}
	return ""
}
