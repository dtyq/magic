import type { IDocumentData } from "@univerjs/core"
import { renderAsync } from "docx-preview"

/**
 * 创建默认的 Univer 文档数据
 */
export function createDefaultDocData(docId: string = "doc1"): IDocumentData {
	return {
		id: docId,
		body: {
			dataStream: "\r\n",
			textRuns: [],
			paragraphs: [
				{
					startIndex: 0,
				},
			],
			sectionBreaks: [
				{
					startIndex: 2,
				},
			],
		},
		documentStyle: {
			pageSize: {
				width: 595,
				height: 842,
			},
			marginTop: 72,
			marginBottom: 72,
			marginRight: 90,
			marginLeft: 90,
		},
	}
}

/**
 * 转换纯文本为 Univer 文档数据
 */
export function transformTextToDocData(text: string, docId: string = "doc1"): IDocumentData {
	if (!text || text.trim().length === 0) {
		return createDefaultDocData(docId)
	}
	console.log("[transformTextToDocData] docId:", docId)
	// 统一换行符
	const normalizedText = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n")
	const paragraphs = normalizedText.split("\n")

	let dataStream = ""
	const paragraphsData: Array<{ startIndex: number; paragraphStyle?: any }> = []
	let currentIndex = 0

	paragraphs.forEach((para, index) => {
		dataStream += para
		currentIndex += para.length

		// paragraphs[i].startIndex 指向 \r 的位置
		paragraphsData.push({
			startIndex: currentIndex,
		})

		// 中间段落用 \r，最后一段用 \r\n
		if (index < paragraphs.length - 1) {
			dataStream += "\r"
			currentIndex += 1
		} else {
			dataStream += "\r\n"
			currentIndex += 2
		}
	})

	return {
		id: docId,
		body: {
			dataStream,
			textRuns: [],
			paragraphs: paragraphsData,
			sectionBreaks: [
				{
					startIndex: currentIndex,
				},
			],
		},
		documentStyle: {
			pageSize: {
				width: 595,
				height: 842,
			},
			marginTop: 72,
			marginBottom: 72,
			marginRight: 90,
			marginLeft: 90,
		},
	}
}

/**
 * 从 File 对象转换为 Univer 文档数据
 */
export async function transformFileToDocData(file: File): Promise<Partial<IDocumentData>> {
	const fileName = file.name.replace(/\.(docx?|txt)$/i, "")

	// 支持纯文本文件
	if (file.name.toLowerCase().endsWith(".txt")) {
		const text = await file.text()
		return transformTextToDocData(text, `doc_${Date.now()}`)
	}

	// 支持 .docx 文件（使用 mammoth）
	if (file.name.toLowerCase().endsWith(".docx")) {
		return await transformDocxToDocData(file)
	}

	// 其他文件类型返回提示
	return transformTextToDocData(
		`暂不支持 ${file.name} 文件类型\n\n请使用 .txt 或 .docx 文件`,
		`doc_${Date.now()}`,
	)
}

/**
 * 使用 docx-preview 将 .docx 转换为 Univer 文档数据
 * docx-preview 能够保留完整的样式信息（颜色、字体大小、背景等）
 */
async function transformDocxToDocData(file: File): Promise<IDocumentData> {
	try {
		console.log("🚀 [Import Docx] 开始解析 .docx 文件:", file.name)
		console.log("✨ [Import Docx] 使用 docx-preview 保留完整样式")

		// 创建临时容器用于渲染
		const container = document.createElement("div")
		container.style.display = "none"
		document.body.appendChild(container)

		try {
			// 使用 docx-preview 渲染 DOCX 文件
			await renderAsync(file, container, undefined, {
				className: "docx-preview-container",
				inWrapper: true,
				ignoreWidth: false,
				ignoreHeight: false,
				ignoreFonts: false,
				breakPages: true,
				debug: false,
				experimental: false,
				trimXmlDeclaration: true,
			})

			console.log("✅ [Import Docx] 成功渲染 DOCX")

			// 获取渲染后的 HTML
			const html = container.innerHTML
			console.log("📄 [Import Docx] HTML 长度:", html.length)
			console.log("📄 [Import Docx] HTML 预览:", html.substring(0, 500))

			// hack: univer底层有bug，先兼容着
			const docId = `doc_hack`
			const docData = convertHtmlToDocData(html, docId)

			console.log("✅ [Import Docx] 成功转换为 Univer 格式，ID:", docId)
			return docData
		} finally {
			// 清理临时容器
			document.body.removeChild(container)
		}
	} catch (error) {
		console.error("❌ [Import Docx] 转换失败:", error)
		// 失败时返回错误提示
		return transformTextToDocData(
			`导入 .docx 文件失败\n\n错误信息: ${
				error instanceof Error ? error.message : "未知错误"
			}`,
			`doc_${Date.now()}`,
		)
	}
}

/**
 * 将 HTML 转换为 Univer 文档数据
 */
function convertHtmlToDocData(html: string, docId: string): IDocumentData {
	console.log("🔄 [convertHtmlToDocData] 开始转换 HTML")
	console.log("[convertHtmlToDocData] HTML*****", html)
	// 创建临时 DOM 解析器
	const parser = new DOMParser()
	const doc = parser.parseFromString(html, "text/html")

	let dataStream = ""
	const textRuns: any[] = []
	const paragraphsData: Array<{ startIndex: number; paragraphStyle?: any }> = []
	let currentIndex = 0

	// 处理节点并构建 Univer 数据结构
	const processNode = (node: Node, style: any = {}) => {
		if (node.nodeType === Node.TEXT_NODE) {
			const text = node.textContent || ""
			if (text) {
				// 如果有样式，添加 textRun
				if (Object.keys(style).length > 0) {
					textRuns.push({
						st: currentIndex,
						ed: currentIndex + text.length,
						ts: style,
					})
				}
				dataStream += text
				currentIndex += text.length
			}
		} else if (node.nodeType === Node.ELEMENT_NODE) {
			const element = node as Element
			const tagName = element.tagName.toLowerCase()

			// 处理段落级别的标签
			if (["p", "h1", "h2", "h3", "h4", "h5", "h6", "li"].includes(tagName)) {
				// 确定段落样式（标题级别）
				const paragraphStyle: any = {}
				if (tagName === "h1") paragraphStyle.namedStyleType = 2 // Heading 1
				if (tagName === "h2") paragraphStyle.namedStyleType = 3 // Heading 2
				if (tagName === "h3") paragraphStyle.namedStyleType = 4 // Heading 3
				if (tagName === "h4") paragraphStyle.namedStyleType = 5 // Heading 4
				if (tagName === "h5") paragraphStyle.namedStyleType = 6 // Heading 5
				if (tagName === "h6") paragraphStyle.namedStyleType = 7 // Heading 6

				// 继承父级样式，并从段落元素本身提取样式
				const paragraphTextStyle = { ...style }
				if (element instanceof HTMLElement && element.style) {
					const inlineStyle = element.style

					// 字体颜色
					if (inlineStyle.color) {
						const color = rgbToHex(inlineStyle.color)
						if (color) paragraphTextStyle.cl = { rgb: color }
					}

					// 背景颜色
					const bgColor = inlineStyle.backgroundColor || inlineStyle.background
					if (bgColor && bgColor !== "transparent") {
						const bg = rgbToHex(bgColor)
						if (bg) paragraphTextStyle.bg = { rgb: bg }
					}

					// 字体大小
					if (inlineStyle.fontSize) {
						const fontSize = parseFloat(inlineStyle.fontSize)
						if (!isNaN(fontSize)) {
							const fsInPx = inlineStyle.fontSize.includes("pt")
								? Math.round(fontSize * 1.33)
								: Math.round(fontSize)
							paragraphTextStyle.fs = fsInPx
						}
					}
				}

				// 处理子节点，传递段落的样式
				element.childNodes.forEach((child) => processNode(child, paragraphTextStyle))

				// 段落结束：先添加段落标记（指向 \r 位置），再添加 \r
				paragraphsData.push({
					startIndex: currentIndex, // \r 的位置
					...(Object.keys(paragraphStyle).length > 0 && { paragraphStyle }),
				})
				dataStream += "\r"
				currentIndex += 1
			}
			// 处理内联样式标签
			else if (["strong", "b", "em", "i", "u", "s", "sup", "sub", "span"].includes(tagName)) {
				const childStyle = { ...style }

				// 粗体
				if (tagName === "strong" || tagName === "b") {
					childStyle.bl = 1
				}
				// 斜体
				if (tagName === "em" || tagName === "i") {
					childStyle.it = 1
				}
				// 下划线
				if (tagName === "u") {
					childStyle.ul = { s: 1 }
				}
				// 删除线
				if (tagName === "s" || tagName === "strike" || tagName === "del") {
					childStyle.st = { s: 1 }
				}
				// 上标
				if (tagName === "sup") {
					childStyle.va = 3 // Univer 使用 3 表示上标
				}
				// 下标
				if (tagName === "sub") {
					childStyle.va = 2
				}

				// 处理所有元素的内联样式（颜色、背景色、字体大小等）
				if (element instanceof HTMLElement && element.style) {
					const inlineStyle = element.style

					// 字体颜色
					if (inlineStyle.color) {
						const color = rgbToHex(inlineStyle.color)
						if (color) {
							childStyle.cl = { rgb: color }
							console.log(`🎨 [导入] 发现字体颜色: ${color}`)
						}
					}

					// 背景颜色 - 检查多个属性
					const bgColor = inlineStyle.backgroundColor || inlineStyle.background
					if (bgColor && bgColor !== "transparent") {
						const bg = rgbToHex(bgColor)
						if (bg) {
							childStyle.bg = { rgb: bg }
							console.log(`🎨 [导入] 发现背景颜色: ${bg}`)
						}
					}

					// 字体大小
					if (inlineStyle.fontSize) {
						const fontSize = parseFloat(inlineStyle.fontSize)
						if (!isNaN(fontSize)) {
							// 如果是 pt 单位，转换为 px（1pt ≈ 1.33px）
							const fsInPx = inlineStyle.fontSize.includes("pt")
								? Math.round(fontSize * 1.33)
								: Math.round(fontSize)
							childStyle.fs = fsInPx
							console.log(`🎨 [导入] 发现字体大小: ${fsInPx}px`)
						}
					}

					// 字体粗细
					if (
						inlineStyle.fontWeight &&
						(inlineStyle.fontWeight === "bold" ||
							parseInt(inlineStyle.fontWeight) >= 700)
					) {
						childStyle.bl = 1
					}

					// 字体样式（斜体）
					if (inlineStyle.fontStyle === "italic") {
						childStyle.it = 1
					}

					// 文本装饰
					if (inlineStyle.textDecoration) {
						if (inlineStyle.textDecoration.includes("underline")) {
							childStyle.ul = { s: 1 }
						}
						if (inlineStyle.textDecoration.includes("line-through")) {
							childStyle.st = { s: 1 }
						}
					}
				}

				element.childNodes.forEach((child) => processNode(child, childStyle))
			}
			// 处理换行标签
			else if (tagName === "br") {
				paragraphsData.push({ startIndex: currentIndex })
				dataStream += "\r"
				currentIndex += 1
			}
			// docx-preview 容器标签（section, article, div 等）- 直接处理子节点，不创建段落
			else if (
				["section", "article", "div", "body", "main", "header", "footer"].includes(tagName)
			) {
				element.childNodes.forEach((child) => processNode(child, style))
			}
			// 其他标签递归处理
			else {
				element.childNodes.forEach((child) => processNode(child, style))
			}
		}
	}

	// 从 body 开始处理
	const body = doc.body
	if (body) {
		body.childNodes.forEach((node) => processNode(node))
	}

	// 确保有至少一个段落
	if (paragraphsData.length === 0) {
		paragraphsData.push({ startIndex: currentIndex })
		dataStream += "\r"
		currentIndex += 1
	}

	// 确保最后以 \r\n 结尾（而不是单独的 \r）
	if (dataStream.endsWith("\r") && !dataStream.endsWith("\r\n")) {
		// 最后一个 \r 改成 \r\n
		dataStream = dataStream.slice(0, -1) + "\r\n"
		currentIndex += 1
	} else if (!dataStream.endsWith("\r\n")) {
		dataStream += "\r\n"
		currentIndex += 2
	}

	console.log("📊 [convertHtmlToDocData] 转换统计:", {
		textLength: dataStream.length,
		paragraphsCount: paragraphsData.length,
		textRunsCount: textRuns.length,
	})

	return {
		id: docId,
		body: {
			dataStream,
			textRuns,
			paragraphs: paragraphsData,
			sectionBreaks: [
				{
					startIndex: currentIndex,
				},
			],
			customRanges: [],
			customDecorations: [],
			customBlocks: [],
		},
		documentStyle: {
			pageSize: {
				width: 595,
				height: 842,
			},
			marginTop: 72,
			marginBottom: 72,
			marginRight: 90,
			marginLeft: 90,
		},
	}
}

/**
 * 将 RGB 颜色字符串转换为十六进制
 */
function rgbToHex(rgb: string): string | null {
	const match = rgb.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/)
	if (match) {
		const r = parseInt(match[1]).toString(16).padStart(2, "0")
		const g = parseInt(match[2]).toString(16).padStart(2, "0")
		const b = parseInt(match[3]).toString(16).padStart(2, "0")
		return `#${r}${g}${b}`
	}
	return null
}

/**
 * 将 JSON 对象转换为 Univer 文档数据
 */
export function transformJsonToDocData(json: Partial<IDocumentData>): IDocumentData {
	console.log("[transformJsonToDocData] 输入数据:", json)

	if (json.body && json.body.dataStream) {
		// 确保有完整的必需字段
		const docData: IDocumentData = {
			id: json.id || `doc_${Date.now()}`,
			body: {
				dataStream: json.body.dataStream,
				textRuns: json.body.textRuns || [],
				paragraphs: json.body.paragraphs || [{ startIndex: 0 }],
				sectionBreaks: json.body.sectionBreaks || [
					{ startIndex: json.body.dataStream.length },
				],
				customRanges: json.body.customRanges || [],
				customDecorations: json.body.customDecorations || [],
				customBlocks: json.body.customBlocks || [],
			},
			documentStyle: json.documentStyle || {
				pageSize: { width: 595, height: 842 },
				marginTop: 72,
				marginBottom: 72,
				marginRight: 90,
				marginLeft: 90,
			},
		}
		console.log("[transformJsonToDocData] 规范化后的数据，ID:", docData.id)
		return docData
	}

	console.log("[transformJsonToDocData] 数据不完整，使用默认数据，ID:", json.id || "doc1")
	return createDefaultDocData(json.id || `doc_${Date.now()}`)
}
