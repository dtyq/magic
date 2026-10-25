import valueParser from "postcss-value-parser"

/**
 * Extract complete URL values from a CSS image value.
 *
 * CSS image values may contain quoted parentheses, escaped characters, data URLs,
 * multiple background layers, and nested functions such as image-set(). Parsing
 * those values with a regular expression can silently truncate a valid URL, so
 * this helper operates on the parsed CSS value tree instead.
 */
export function extractCssImageUrls(value: string): string[] {
	if (!value.trim()) return []

	const urls: string[] = []
	let invalidUrlFunction = false
	const parsedValue = valueParser(value)

	parsedValue.walk((node) => {
		if (node.type !== "function" || node.value.toLowerCase() !== "url") return

		if (node.unclosed || !hasValidUrlBoundary(value, node.sourceEndIndex)) {
			invalidUrlFunction = true
			return false
		}

		const contentNodes = node.nodes.filter(
			(child) => child.type !== "space" && child.type !== "comment",
		)
		if (contentNodes.length !== 1) {
			invalidUrlFunction = true
			return false
		}

		const content = contentNodes[0]
		if (
			(content.type !== "string" && content.type !== "word") ||
			("unclosed" in content && content.unclosed) ||
			(content.type === "word" && !isValidUnquotedCssUrl(content.value))
		) {
			invalidUrlFunction = true
			return false
		}

		const url = decodeCssEscapes(content.value)
		if (!url) {
			invalidUrlFunction = true
			return false
		}

		urls.push(url)
		return false
	})

	// A malformed url() makes the CSS image value invalid. Do not return other
	// candidates or a truncated prefix that could cause an unrelated request.
	return invalidUrlFunction ? [] : urls
}

/**
 * postcss-value-parser reports where a function ends. A valid CSS image URL is
 * followed by the end of the value or a token boundary. This additionally
 * rejects malformed unquoted values such as url(image(2).png), which would
 * otherwise look like the partial URL "image(2" to a generic value parser.
 */
function hasValidUrlBoundary(value: string, sourceEndIndex: number): boolean {
	const next = value[sourceEndIndex]
	return next === undefined || /[\s,)/;]/.test(next)
}

/** Validate the CSS url-token grammar while allowing escaped whitespace and parentheses. */
function isValidUnquotedCssUrl(value: string): boolean {
	for (let index = 0; index < value.length; index += 1) {
		const character = value[index]
		if (character !== "\\") {
			if (
				isCssWhitespace(character) ||
				character === '"' ||
				character === "'" ||
				character === "("
			) {
				return false
			}
			continue
		}

		if (index + 1 >= value.length) return false
		const next = value[index + 1]
		if (next === "\n" || next === "\r" || next === "\f") return false

		if (isHexDigit(next)) {
			let cursor = index + 1
			let digits = 0
			while (cursor < value.length && digits < 6 && isHexDigit(value[cursor])) {
				cursor += 1
				digits += 1
			}
			if (cursor < value.length && isCssWhitespace(value[cursor])) {
				if (value[cursor] === "\r" && value[cursor + 1] === "\n") cursor += 2
				else cursor += 1
			}
			index = cursor - 1
			continue
		}

		index += 1
	}

	return value.length > 0
}

/** Decode CSS escape sequences without URL-decoding percent escapes. */
function decodeCssEscapes(value: string): string {
	let decoded = ""

	for (let index = 0; index < value.length; index += 1) {
		const character = value[index]
		if (character !== "\\") {
			decoded += character
			continue
		}

		if (index + 1 >= value.length) return ""

		const next = value[index + 1]
		if (next === "\n" || next === "\f") {
			index += 1
			continue
		}
		if (next === "\r") {
			index += value[index + 2] === "\n" ? 2 : 1
			continue
		}

		if (isHexDigit(next)) {
			let hex = ""
			let cursor = index + 1
			while (cursor < value.length && hex.length < 6 && isHexDigit(value[cursor])) {
				hex += value[cursor]
				cursor += 1
			}

			const codePoint = Number.parseInt(hex, 16)
			decoded += isValidCssCodePoint(codePoint) ? String.fromCodePoint(codePoint) : "\uFFFD"

			if (cursor < value.length && isCssWhitespace(value[cursor])) {
				if (value[cursor] === "\r" && value[cursor + 1] === "\n") cursor += 2
				else cursor += 1
			}
			index = cursor - 1
			continue
		}

		decoded += next
		index += 1
	}

	return decoded
}

function isHexDigit(value: string): boolean {
	return /^[0-9a-f]$/i.test(value)
}

function isCssWhitespace(value: string): boolean {
	return value === " " || value === "\t" || value === "\n" || value === "\r" || value === "\f"
}

function isValidCssCodePoint(value: number): boolean {
	return value !== 0 && value <= 0x10ffff && !(value >= 0xd800 && value <= 0xdfff)
}
