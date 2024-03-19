/**
 * 按顶层逗号分割字符串（忽略括号内的逗号）
 *
 * 适用于 CSS 渐变参数、多值 background-image、多重 box-shadow 等场景，
 * 这些值中的 rgb()/rgba() 等函数内部也包含逗号，不应被分割。
 */
export function splitByTopLevelComma(value: string): string[] {
	const parts: string[] = []
	let current = ""
	let depth = 0

	for (const char of value) {
		if (char === "(") depth++
		if (char === ")") depth--

		if (char === "," && depth === 0) {
			parts.push(current.trim())
			current = ""
		} else {
			current += char
		}
	}

	if (current.trim()) {
		parts.push(current.trim())
	}

	return parts
}
