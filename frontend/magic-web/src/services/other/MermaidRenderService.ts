import { initMermaidDb } from "@/database/mermaid"
import type { MermaidDb } from "@/database/mermaid/types"
import { RenderResult } from "mermaid"

const MERMAID_ERROR_SVG = "<g></g></svg>"

class MermaidRenderService {
	cacheSvg: Map<string, { data: string; svg: string; png: string }> = new Map()
	db: MermaidDb

	constructor() {
		this.db = initMermaidDb()
		this.db.mermaid.toArray().then((res) => {
			this.cacheSvg = res.reduce((acc, cur) => {
				acc.set(cur.data, cur)
				return acc
			}, new Map<string, { data: string; svg: string; png: string }>())
		})
	}

	/**
	 * 判断svg是否生成失败
	 * @param svg svg
	 * @returns 是否生成失败
	 */
	isErrorSvg(svg: string) {
		return svg.includes(MERMAID_ERROR_SVG)
	}

	/**
	 * 缓存svg
	 * @param chart 图表
	 * @param svg svg
	 */
	cache(chart: string, svg: RenderResult) {
		// 如果缓存中存在且svg相同，则不缓存
		if (this.cacheSvg.get(chart) && this.cacheSvg.get(chart)?.svg === svg.svg) {
			return this.cacheSvg.get(chart)
		}

		// 匹配到<g></g>标签，则认为没有渲染成功
		if (this.isErrorSvg(svg.svg)) {
			return undefined
		}

		const result = {
			data: chart,
			svg: svg.svg,
			diagramType: svg.diagramType,
			png: "",
		}

		this.cacheSvg.set(chart, result)

		this.db.mermaid.put(result).catch((err) => {
			console.error("缓存失败", err)
		})

		return result
	}

	/**
	 * 获取缓存
	 * @param chart 图表
	 * @returns 缓存
	 */
	async getCache(chart: string): Promise<{ data: string; svg: string; png: string } | undefined> {
		if (this.cacheSvg.get(chart)) {
			return this.cacheSvg.get(chart)
		}
		const res = await this.db.mermaid.where("data").equals(chart).first()
		if (res) {
			this.cacheSvg.set(chart, res)
			return res
		}
		return undefined
	}

	/**
	 * Fix mermaid data
	 * @description Fix mermaid data by converting Chinese punctuation to English, handling syntax errors, and normalizing structure
	 * @param data input data
	 * @returns fixed data
	 */
	fix(data: string | undefined): string {
		if (!data) return ""

		// Step 1: Clean up invalid escape sequences and trailing backslashes
		let result = this.cleanupEscapeSequences(data)

		// Step 2: Fix multiline classDef and class definitions
		result = this.fixClassDefinitions(result)

		// Step 3: Fix reserved keyword usage in classDef and class statements
		result = this.fixReservedKeywords(result)

		// Step 4: Fix problematic quotes in node labels
		result = this.fixQuotesInNodeLabels(result)

		// Step 5: Apply existing Chinese punctuation conversion logic
		result = this.convertChinesePunctuation(result)

		// Step 6: Normalize whitespace
		result = this.normalizeWhitespace(result)

		return result
	}

	/**
	 * Clean up invalid escape sequences and trailing backslashes
	 * @param data input data
	 * @returns cleaned data
	 */
	private cleanupEscapeSequences(data: string): string {
		// Remove trailing backslashes at the end of lines
		return data
			.split("\n")
			.map((line) => line.replace(/\\+$/, ""))
			.join("\n")
	}

	/**
	 * Fix multiline classDef and class definitions
	 * @param data input data
	 * @returns fixed data
	 */
	private fixClassDefinitions(data: string): string {
		const lines = data.split("\n")
		const fixedLines: string[] = []
		let i = 0

		while (i < lines.length) {
			const line = lines[i]
			const trimmedLine = line.trim()

			// Handle classDef definitions that might span multiple lines
			if (trimmedLine.startsWith("classDef ") && !this.isCompleteClassDef(trimmedLine)) {
				let completeClassDef = trimmedLine
				let j = i + 1

				// Look for the continuation of the classDef definition
				while (j < lines.length) {
					const nextLine = lines[j].trim()
					if (nextLine === "") {
						j++
						continue
					}

					// If next line looks like a style property, append it
					if (
						this.isStyleProperty(nextLine) ||
						nextLine.includes(":") ||
						nextLine.includes("#")
					) {
						completeClassDef += " " + nextLine
						j++
					} else {
						break
					}
				}

				// Preserve the original indentation from the first line
				const originalIndent = line.match(/^\s*/)?.[0] || ""
				fixedLines.push(originalIndent + completeClassDef)
				i = j
			} else {
				fixedLines.push(line)
				i++
			}
		}

		return fixedLines.join("\n")
	}

	/**
	 * Fix problematic quotes in node labels
	 * @param data input data
	 * @returns fixed data
	 */
	private fixQuotesInNodeLabels(data: string): string {
		// Replace all double quotes with single quotes inside node labels
		// This regex matches content inside square brackets [...]
		return data.replace(/\[([^\]]*)\]/g, (match, content) => {
			// Replace all double quotes with single quotes within the node label
			const fixedContent = content.replace(/"/g, "'")
			return `[${fixedContent}]`
		})
	}

	/**
	 * Fix reserved keyword usage in classDef and class statements
	 * @param data input data
	 * @returns fixed data
	 */
	private fixReservedKeywords(data: string): string {
		const reservedKeywords = [
			"end",
			"start",
			"graph",
			"subgraph",
			"flowchart",
			"class",
			"click",
			"style",
			"fill",
			"stroke",
			"color",
			"default",
			"linkStyle",
			"classDef",
			"direction",
			"TB",
			"TD",
			"BT",
			"RL",
			"LR",
			"node",
			"edge",
			"loop",
			"alt",
			"opt",
			"par",
			"note",
			"over",
			"participant",
			"actor",
			"activate",
			"deactivate",
			"destroy",
			"create",
			"state",
			"choice",
			"fork",
			"join",
			"concurrent",
		]

		const lines = data.split("\n")
		const fixedLines: string[] = []
		const keywordMapping = new Map<string, string>()

		// First pass: Find and replace classDef statements with reserved keywords
		for (let i = 0; i < lines.length; i++) {
			let line = lines[i]

			// Handle multiple classDef statements on the same line (after fixClassDefinitions)
			const classDefMatches = line.match(/classDef\s+(\w+)\s+/g)
			if (classDefMatches) {
				for (const match of classDefMatches) {
					const classDefMatch = match.match(/classDef\s+(\w+)\s+/)
					if (classDefMatch) {
						const className = classDefMatch[1]
						if (reservedKeywords.includes(className.toLowerCase())) {
							const newClassName = `${className}Style`
							keywordMapping.set(className, newClassName)
							line = line.replace(
								new RegExp(`classDef\\s+${className}\\s+`, "g"),
								`classDef ${newClassName} `,
							)
						}
					}
				}
			}

			fixedLines.push(line)
		}

		// Second pass: Handle class statements that reference reserved keywords
		for (let i = 0; i < fixedLines.length; i++) {
			let line = fixedLines[i]
			const trimmedLine = line.trim()

			// Check class statements
			if (trimmedLine.startsWith("class ")) {
				const classMatch = trimmedLine.match(/^class\s+([^;]+);?$/)
				if (classMatch) {
					const classContent = classMatch[1]
					let updatedContent = classContent

					// Check for reserved keywords in class statements
					for (const keyword of reservedKeywords) {
						const regex = new RegExp(`\\b${keyword}\\b`, "g")
						if (regex.test(classContent)) {
							const newClassName = `${keyword}Style`
							keywordMapping.set(keyword, newClassName)
							updatedContent = updatedContent.replace(
								new RegExp(`\\b${keyword}\\b`, "g"),
								newClassName,
							)
						}
					}

					line = line.replace(classContent, updatedContent)
				}
			}

			fixedLines[i] = line
		}

		return fixedLines.join("\n")
	}

	/**
	 * Check if a classDef definition is complete (has style properties)
	 * @param line the line to check
	 * @returns true if complete
	 */
	private isCompleteClassDef(line: string): boolean {
		return line.includes("fill:") || line.includes("stroke:") || line.includes("color:")
	}

	/**
	 * Check if a line contains style properties
	 * @param line the line to check
	 * @returns true if it's a style property
	 */
	private isStyleProperty(line: string): boolean {
		const styleKeywords = [
			"fill:",
			"stroke:",
			"color:",
			"stroke-width:",
			"font-size:",
			"font-weight:",
		]
		return styleKeywords.some((keyword) => line.includes(keyword))
	}

	/**
	 * Convert Chinese punctuation to English (existing logic)
	 * @param data input data
	 * @returns converted data
	 */
	private convertChinesePunctuation(data: string): string {
		// Define Chinese to English punctuation mapping
		const punctuationMap: Record<string, string> = {
			"，": ", ",
			"。": ".",
			"：": ": ",
			"；": "; ",
			"！": "! ",
			"？": "? ",
			"、": " ",
			"（": " (",
			"）": ") ",
			"\u201c": "'",
			"\u201d": "'",
			"【": " [",
			"】": "] ",
			"°": "度",
			"¥": "元",
			"~": "~",
			"-": "-",
		}

		// Split text by brackets, preserving the brackets and their content
		const parts: string[] = []
		let currentPos = 0
		let bracketStart = data.indexOf("[", currentPos)

		while (bracketStart !== -1) {
			// Add text before bracket
			if (bracketStart > currentPos) {
				parts.push(data.substring(currentPos, bracketStart))
			}

			// Find matching closing bracket
			const bracketEnd = data.indexOf("]", bracketStart)
			if (bracketEnd !== -1) {
				// Add bracket content (including brackets) without modification
				parts.push(data.substring(bracketStart, bracketEnd + 1))
				currentPos = bracketEnd + 1
			} else {
				// No matching closing bracket found, treat as regular text
				parts.push(data.substring(bracketStart))
				break
			}

			bracketStart = data.indexOf("[", currentPos)
		}

		// Add remaining text after last bracket
		if (currentPos < data.length) {
			parts.push(data.substring(currentPos))
		}

		// Process each part - only modify parts that are not inside brackets
		const processedParts = parts.map((part) => {
			// Check if this part is inside brackets (starts with '[' and ends with ']')
			if (part.startsWith("[") && part.endsWith("]")) {
				return part // Keep bracket content unchanged
			}

			// Apply punctuation replacement to non-bracket content
			let result = part
			for (const [chinese, english] of Object.entries(punctuationMap)) {
				result = result.replace(new RegExp(chinese, "g"), english)
			}
			return result
		})

		return processedParts.join("")
	}

	/**
	 * Normalize whitespace and clean up the result
	 * @param data input data
	 * @returns normalized data
	 */
	private normalizeWhitespace(data: string): string {
		return data
			.split("\n")
			.filter((line) => line.trim().length > 0)
			.join("\n")
	}
}

export default new MermaidRenderService()
