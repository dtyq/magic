/**
 * 文本处理工具模块
 * 处理富文本、HTML等格式转换
 */

// Import xmldom for Worker environment
import { DOMParser as XMLDOMParser } from "@xmldom/xmldom"

/**
 * 获取兼容的 DOMParser 实例
 * 在 Worker 环境中使用 xmldom，在浏览器环境中使用原生 DOMParser
 */
export function getDOMParser(): DOMParser {
	// 检查是否在 Worker 环境中
	if (typeof self !== "undefined" && typeof window === "undefined") {
		// Worker 环境，使用 xmldom
		return new XMLDOMParser() as unknown as DOMParser
	}

	// 浏览器环境，使用原生 DOMParser
	if (typeof DOMParser !== "undefined") {
		return new DOMParser()
	}

	// 回退到 xmldom（测试环境等）
	return new XMLDOMParser() as unknown as DOMParser
}

/**
 * xmldom-compatible querySelector implementation
 * @param element The element to search within
 * @param selector The tag name to search for
 * @returns The first matching element or null
 */
function querySelector(element: Element | Document, selector: string): Element | null {
	const elements = element.getElementsByTagName(selector)
	return elements.length > 0 ? elements[0] : null
}

/**
 * xmldom-compatible querySelectorAll implementation
 * @param element The element to search within
 * @param selector The tag name to search for
 * @returns Array of matching elements
 */
function querySelectorAll(element: Element | Document, selector: string): Element[] {
	const elements = element.getElementsByTagName(selector)
	return Array.from(elements)
}

/**
 * Node type constants compatible with both browser and xmldom environments
 */
const NodeType = {
	ELEMENT_NODE: 1,
	TEXT_NODE: 3,
	COMMENT_NODE: 8,
	DOCUMENT_NODE: 9,
} as const

/**
 * 将HTML内容转换为Univer富文本格式
 * @param htmlContent HTML内容字符串
 * @returns 富文本格式数据
 */
export function convertHtmlToRichText(htmlContent: string): any {
	if (!htmlContent) return null

	// 清理和准备HTML内容
	const cleanedHtml = htmlContent.replace(/&nbsp;/g, " ")

	const parser = getDOMParser()

	try {
		// 创建一个临时的容器来解析HTML
		const htmlDoc = parser.parseFromString(
			`<div>${cleanedHtml}</div>`,
			"text/html" in parser ? "text/html" : "text/xml",
		)

		// Use xmldom-compatible method to get container
		const divElements = htmlDoc.getElementsByTagName("div")
		const container = divElements.length > 0 ? divElements[0] : htmlDoc.documentElement

		let text = ""
		const textRuns: Array<{
			style: Record<string, any>
			startIndex: number
			endIndex: number
		}> = []

		const processNode = (node: any): void => {
			if (node.nodeType === NodeType.TEXT_NODE) {
				const textNode = node as any
				if (textNode.textContent) {
					text += textNode.textContent
				}
			} else if (node.nodeType === NodeType.ELEMENT_NODE) {
				const element = node as any
				const startIndex = text.length

				// 处理子节点
				for (const child of Array.from(element.childNodes)) {
					processNode(child)
				}

				const endIndex = text.length

				// 构建样式对象
				const style: Record<string, any> = {}

				// 处理标签样式
				switch (element.tagName?.toLowerCase()) {
					case "b":
					case "strong":
						style.bl = 1 // 粗体
						break
					case "i":
					case "em":
						style.it = 1 // 斜体
						break
					case "u":
						style.ul = { s: 1 } // 下划线
						break
					case "s":
					case "strike":
					case "del":
						style.st = { s: 1 } // 删除线
						break
				}

				// 处理内联样式
				const styleAttr = element.getAttribute("style")
				if (styleAttr) {
					const styles = styleAttr.split(";")
					for (const styleItem of styles) {
						const [property, value] = styleItem.split(":").map((s: string) => s.trim())
						if (!property || !value) continue

						switch (property) {
							case "font-weight":
								if (value === "bold" || parseInt(value) >= 600) {
									style.bl = 1
								}
								break
							case "font-style":
								if (value === "italic") {
									style.it = 1
								}
								break
							case "text-decoration":
								if (value.includes("underline")) {
									style.ul = { s: 1 }
								}
								if (value.includes("line-through")) {
									style.st = { s: 1 }
								}
								break
							case "color":
								style.cl = { rgb: value }
								break
							case "font-size":
								const fontSize = parseInt(value)
								if (fontSize) {
									style.fs = fontSize
								}
								break
							case "font-family":
								style.ff = value.replace(/['"]/g, "")
								break
						}
					}
				}

				// 只有当有样式且有内容时才添加textRun
				if (Object.keys(style).length > 0 && startIndex < endIndex) {
					textRuns.push({
						style,
						startIndex,
						endIndex,
					})
				}
			}
		}

		if (container) {
			processNode(container)
		}

		return {
			text,
			textRuns,
		}
	} catch (error) {
		return null
	}
}

/**
 * 处理Excel富文本XML，转换为Univer格式的富文本数据
 * @param richTextXml Excel富文本XML字符串
 * @returns Univer格式的IDocumentData数据，用于放入cellObject的p属性
 */
export function processExcelRichText(richTextXml: string): any {
	if (!richTextXml || typeof richTextXml !== "string") return null

	try {
		// 解析XML - 使用兼容的 DOMParser
		const parser = getDOMParser()
		const xmlDoc = parser.parseFromString(`<root>${richTextXml}</root>`, "text/xml")

		// 检查解析错误
		const parseError = querySelector(xmlDoc, "parsererror")
		if (parseError) {
			return null
		}

		const textRuns: Array<{
			ts: Record<string, any>
			st: number
			ed: number
		}> = []

		let fullText = ""
		let currentIndex = 0

		// 处理每个 r (rich text run) 元素
		const richTextRuns = querySelectorAll(xmlDoc, "r")

		for (const run of richTextRuns) {
			// 获取文本内容
			const textElement = querySelector(run, "t")
			const text = textElement?.textContent || ""

			if (text) {
				const startIndex = currentIndex
				const endIndex = currentIndex + text.length

				// 获取格式信息
				const rPr = querySelector(run, "rPr")
				const style: Record<string, any> = {}

				if (rPr) {
					// 粗体
					if (querySelector(rPr, "b")) {
						style.bl = 1
					}

					// 斜体
					if (querySelector(rPr, "i")) {
						style.it = 1
					}

					// 下划线
					const underline = querySelector(rPr, "u")
					if (underline) {
						style.ul = { s: 1 }
					}

					// 字体大小
					const fontSize = querySelector(rPr, "sz")
					if (fontSize) {
						const size = fontSize.getAttribute("val")
						if (size) {
							style.fs = parseInt(size)
						}
					}

					// 字体颜色
					const color = querySelector(rPr, "color")
					if (color) {
						const rgb = color.getAttribute("rgb")
						if (rgb) {
							style.cl = { rgb: `#${rgb.substring(2)}` } // 移除前两位透明度
						}
					}

					// 字体名称
					const fontName = querySelector(rPr, "rFont")
					if (fontName) {
						const name = fontName.getAttribute("val")
						if (name) {
							style.ff = name
						}
					}
				}

				fullText += text.replace(/\n/g, "\r")
				currentIndex = endIndex

				// 添加文本运行
				if (Object.keys(style).length > 0) {
					textRuns.push({
						ts: style,
						st: startIndex,
						ed: endIndex,
					})
				}
			}
		}

		// 如果没有任何富文本运行，尝试获取纯文本
		if (textRuns.length === 0) {
			const allText = xmlDoc.textContent || ""
			if (allText.trim()) {
				fullText = allText.trim()
			}
		}

		if (!fullText) return null

		// 构建符合Univer标准的数据结构
		// dataStream 的格式为：文本内容 + \r\n
		const dataStream = fullText + "\r\n"
		const result = {
			body: {
				dataStream: dataStream,
				textRuns: textRuns.map((run) => ({
					...run,
					ts: run.ts,
				})),
				paragraphs: [
					{
						startIndex: 0,
					},
				],
				sectionBreaks: [
					{
						startIndex: dataStream.length, // 应该是 dataStream 的总长度
					},
				],
			},
		}

		return result
	} catch (error) {
		return null
	}
}

/**
 * 从HTML内容中提取纯文本
 * @param htmlContent HTML内容
 * @returns 纯文本内容
 */
export function extractTextFromHtml(htmlContent: string): string {
	if (!htmlContent) return ""

	try {
		const parser = getDOMParser()
		const doc = parser.parseFromString(
			htmlContent,
			"text/html" in parser ? "text/html" : "text/xml",
		)
		return doc.body?.textContent || doc.textContent || ""
	} catch (error) {
		// 如果解析失败，使用正则表达式移除HTML标签
		return htmlContent.replace(/<[^>]*>/g, "")
	}
}

/**
 * 将纯文本转换为简单的Univer文档格式
 * @param text 纯文本内容
 * @returns Univer文档数据
 */
export function createSimpleDocument(text: string): any {
	if (!text) return null

	const dataStream = text + "\r\n"
	return {
		body: {
			dataStream: dataStream,
			textRuns: [],
			paragraphs: [
				{
					startIndex: 0,
				},
			],
			sectionBreaks: [
				{
					startIndex: dataStream.length,
				},
			],
		},
	}
}
