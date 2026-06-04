export type MagicProjectConfig = Record<string, unknown>

const MAX_PARSE_DEPTH = 100

class MagicProjectLiteralParser {
	private index: number

	constructor(
		private readonly source: string,
		startIndex = 0,
	) {
		this.index = startIndex
	}

	parseConfig(): { value: MagicProjectConfig; endIndex: number } {
		const value = this.parseValue(0)
		if (!isRecord(value)) {
			throw new Error("magic.project.js config must be an object literal")
		}
		return { value, endIndex: this.index }
	}

	private parseValue(depth: number): unknown {
		if (depth > MAX_PARSE_DEPTH) {
			throw new Error("magic.project.js config nesting is too deep")
		}

		this.skipIgnored()
		const char = this.source[this.index]

		if (char === "{") return this.parseObject(depth + 1)
		if (char === "[") return this.parseArray(depth + 1)
		if (char === '"' || char === "'") return this.parseString()
		if (char === "-" || isDigit(char)) return this.parseNumber()
		if (this.consumeKeyword("true")) return true
		if (this.consumeKeyword("false")) return false
		if (this.consumeKeyword("null")) return null

		throw new Error("Unsupported magic.project.js config value")
	}

	private parseObject(depth: number): MagicProjectConfig {
		const object: MagicProjectConfig = {}
		this.expect("{")
		this.skipIgnored()

		if (this.peek() === "}") {
			this.index += 1
			return object
		}

		while (this.index < this.source.length) {
			const key = this.parseObjectKey()
			this.skipIgnored()
			this.expect(":")
			object[key] = this.parseValue(depth)
			this.skipIgnored()

			const next = this.peek()
			if (next === ",") {
				this.index += 1
				this.skipIgnored()
				if (this.peek() === "}") {
					this.index += 1
					return object
				}
				continue
			}
			if (next === "}") {
				this.index += 1
				return object
			}

			throw new Error("Invalid object literal in magic.project.js config")
		}

		throw new Error("Unterminated object literal in magic.project.js config")
	}

	private parseArray(depth: number): unknown[] {
		const array: unknown[] = []
		this.expect("[")
		this.skipIgnored()

		if (this.peek() === "]") {
			this.index += 1
			return array
		}

		while (this.index < this.source.length) {
			array.push(this.parseValue(depth))
			this.skipIgnored()

			const next = this.peek()
			if (next === ",") {
				this.index += 1
				this.skipIgnored()
				if (this.peek() === "]") {
					this.index += 1
					return array
				}
				continue
			}
			if (next === "]") {
				this.index += 1
				return array
			}

			throw new Error("Invalid array literal in magic.project.js config")
		}

		throw new Error("Unterminated array literal in magic.project.js config")
	}

	private parseObjectKey(): string {
		this.skipIgnored()
		const char = this.peek()

		if (char === '"' || char === "'") return this.parseString()
		if (char === "-" || isDigit(char)) return String(this.parseNumber())

		return this.parseIdentifier()
	}

	private parseString(): string {
		const quote = this.peek()
		if (quote !== '"' && quote !== "'") {
			throw new Error("Expected string literal in magic.project.js config")
		}

		this.index += 1
		let value = ""

		while (this.index < this.source.length) {
			const char = this.source[this.index]
			this.index += 1

			if (char === quote) return value

			if (char !== "\\") {
				value += char
				continue
			}

			if (this.index >= this.source.length) {
				throw new Error("Unterminated escape sequence in magic.project.js config")
			}

			const escaped = this.source[this.index]
			this.index += 1
			switch (escaped) {
				case "b":
					value += "\b"
					break
				case "f":
					value += "\f"
					break
				case "n":
					value += "\n"
					break
				case "r":
					value += "\r"
					break
				case "t":
					value += "\t"
					break
				case "v":
					value += "\v"
					break
				case "0":
					value += "\0"
					break
				case "u":
					value += this.parseUnicodeEscape()
					break
				default:
					value += escaped
					break
			}
		}

		throw new Error("Unterminated string literal in magic.project.js config")
	}

	private parseUnicodeEscape(): string {
		const hex = this.source.slice(this.index, this.index + 4)
		if (!/^[0-9a-fA-F]{4}$/.test(hex)) {
			throw new Error("Invalid unicode escape in magic.project.js config")
		}
		this.index += 4
		return String.fromCharCode(Number.parseInt(hex, 16))
	}

	private parseNumber(): number {
		const match = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/.exec(
			this.source.slice(this.index),
		)
		if (!match) {
			throw new Error("Invalid number literal in magic.project.js config")
		}

		this.index += match[0].length
		return Number(match[0])
	}

	private parseIdentifier(): string {
		const match = /^[A-Za-z_$][\w$]*/.exec(this.source.slice(this.index))
		if (!match) {
			throw new Error("Expected object key in magic.project.js config")
		}

		this.index += match[0].length
		return match[0]
	}

	private consumeKeyword(keyword: "true" | "false" | "null"): boolean {
		if (!this.source.startsWith(keyword, this.index)) return false

		const nextChar = this.source[this.index + keyword.length]
		if (nextChar && /[\w$]/.test(nextChar)) return false

		this.index += keyword.length
		return true
	}

	private skipIgnored(): void {
		while (this.index < this.source.length) {
			const char = this.source[this.index]
			const next = this.source[this.index + 1]

			if (/\s/.test(char)) {
				this.index += 1
				continue
			}
			if (char === "/" && next === "/") {
				this.index += 2
				while (this.index < this.source.length && !/[\r\n]/.test(this.source[this.index])) {
					this.index += 1
				}
				continue
			}
			if (char === "/" && next === "*") {
				const endIndex = this.source.indexOf("*/", this.index + 2)
				if (endIndex === -1) {
					throw new Error("Unterminated comment in magic.project.js config")
				}
				this.index = endIndex + 2
				continue
			}

			return
		}
	}

	private expect(expected: string): void {
		this.skipIgnored()
		if (this.source[this.index] !== expected) {
			throw new Error(`Expected "${expected}" in magic.project.js config`)
		}
		this.index += 1
	}

	private peek(): string | undefined {
		return this.source[this.index]
	}
}

export function parseMagicProjectConfigContent(content: string): MagicProjectConfig | null {
	if (!content) return null

	try {
		const source = content.trim()
		if (!source) return null

		if (source.startsWith("{")) {
			const parser = new MagicProjectLiteralParser(source)
			const { value, endIndex } = parser.parseConfig()
			if (source.slice(endIndex).trim()) return null
			return value
		}

		const assignmentValueIndex = findConfigAssignmentValueIndex(content)
		if (assignmentValueIndex === -1) return null

		const parser = new MagicProjectLiteralParser(content, assignmentValueIndex)
		const { value } = parser.parseConfig()
		return value
	} catch {
		return null
	}
}

function findConfigAssignmentValueIndex(content: string): number {
	let index = 0

	while (index < content.length) {
		const char = content[index]
		const next = content[index + 1]

		if (char === '"' || char === "'") {
			index = skipString(content, index)
			continue
		}
		if (char === "/" && next === "/") {
			index = skipLineComment(content, index)
			continue
		}
		if (char === "/" && next === "*") {
			index = skipBlockComment(content, index)
			continue
		}

		const valueIndex = readWindowMagicProjectConfigAssignment(content, index)
		if (valueIndex !== -1) return valueIndex

		index += 1
	}

	return -1
}

function readWindowMagicProjectConfigAssignment(content: string, index: number): number {
	if (!startsWithIdentifier(content, index, "window")) return -1

	let cursor = index + "window".length
	cursor = skipWhitespaceAndComments(content, cursor)
	if (content[cursor] !== ".") return -1

	cursor += 1
	cursor = skipWhitespaceAndComments(content, cursor)
	if (!startsWithIdentifier(content, cursor, "magicProjectConfig")) return -1

	cursor += "magicProjectConfig".length
	cursor = skipWhitespaceAndComments(content, cursor)
	if (content[cursor] !== "=") return -1

	return cursor + 1
}

function startsWithIdentifier(content: string, index: number, identifier: string): boolean {
	if (!content.startsWith(identifier, index)) return false

	const before = content[index - 1]
	const after = content[index + identifier.length]
	return !isIdentifierChar(before) && !isIdentifierChar(after)
}

function skipWhitespaceAndComments(content: string, index: number): number {
	let cursor = index

	while (cursor < content.length) {
		const char = content[cursor]
		const next = content[cursor + 1]

		if (/\s/.test(char)) {
			cursor += 1
			continue
		}
		if (char === "/" && next === "/") {
			cursor = skipLineComment(content, cursor)
			continue
		}
		if (char === "/" && next === "*") {
			cursor = skipBlockComment(content, cursor)
			continue
		}

		return cursor
	}

	return cursor
}

function skipString(content: string, index: number): number {
	const quote = content[index]
	let cursor = index + 1

	while (cursor < content.length) {
		const char = content[cursor]
		if (char === "\\") {
			cursor += 2
			continue
		}
		cursor += 1
		if (char === quote) return cursor
	}

	return cursor
}

function skipLineComment(content: string, index: number): number {
	let cursor = index + 2
	while (cursor < content.length && !/[\r\n]/.test(content[cursor])) {
		cursor += 1
	}
	return cursor
}

function skipBlockComment(content: string, index: number): number {
	const endIndex = content.indexOf("*/", index + 2)
	return endIndex === -1 ? content.length : endIndex + 2
}

function isDigit(value: string | undefined): boolean {
	return !!value && value >= "0" && value <= "9"
}

function isIdentifierChar(value: string | undefined): boolean {
	return !!value && /[\w$]/.test(value)
}

function isRecord(value: unknown): value is MagicProjectConfig {
	return !!value && typeof value === "object" && !Array.isArray(value)
}
