import {
	defaultPreprocessRules,
	INLINE_MATH_REGEX,
	BLOCK_MATH_REGEX,
	ABBREVIATION_DEF_REGEX,
	TASK_LIST_REGEX,
} from "./defaultPreprocessRules"
import { PreprocessRule } from "./types"

class PreprocessService {
	rules: Map<string, PreprocessRule> = new Map()

	constructor(initialRules?: PreprocessRule[]) {
		defaultPreprocessRules.forEach((rule) => this.registerRule(rule.regex, rule))

		if (initialRules && initialRules.length > 0) {
			initialRules.forEach((rule) => this.registerRule(rule.regex, rule))
		}
	}

	/**
	 * 获取所有规则
	 * @returns
	 */
	getAllRules() {
		return Array.from(this.rules.values())
	}

	/**
	 * 注册规则
	 * @param key
	 * @param rule
	 */
	registerRule(key: RegExp, rule: PreprocessRule) {
		this.rules.set(key.toString(), rule)
	}

	/**
	 * 注销规则
	 * @param key
	 */
	unregisterRule(key: RegExp) {
		this.rules.delete(key.toString())
	}

	/**
	 * 获取内联 LaTeX 规则
	 * @returns
	 */
	getInlineLatexRule(): PreprocessRule {
		return {
			regex: INLINE_MATH_REGEX,
			replace: (_, formulaContent) =>
				`<MagicLatexInline math="${this.encodeForAttribute(formulaContent)}" />`,
		}
	}

	/**
	 * 获取块级 LaTeX 规则
	 * @returns
	 */
	getBlockLatexRule(): PreprocessRule {
		return {
			regex: BLOCK_MATH_REGEX,
			replace: (_, formulaContent) =>
				`<MagicLatexBlock math="${this.encodeForAttribute(formulaContent.trim())}" />`,
		}
	}

	/**
	 * 编码LaTeX内容为HTML属性安全格式
	 * @param content
	 * @returns
	 */
	private encodeForAttribute(content: string): string {
		return content
			.replace(/&/g, "&amp;")
			.replace(/"/g, "&quot;")
			.replace(/'/g, "&#39;")
			.replace(/</g, "&lt;")
			.replace(/>/g, "&gt;")
	}

	/**
	 * 检查位置是否在引用块内
	 * @param markdown
	 * @param start
	 * @param end
	 * @returns
	 */
	private isInsideBlockquote(markdown: string, start: number, end: number): boolean {
		// 获取从内容开始到当前位置的文本
		const beforeText = markdown.substring(0, start)
		const lines = beforeText.split("\n")

		// 从当前位置往前查找，看是否在引用块内
		let inBlockquote = false
		for (let i = lines.length - 1; i >= 0; i--) {
			const line = lines[i]
			// 如果遇到引用标记开始的行
			if (line.trim().startsWith(">")) {
				inBlockquote = true
				break
			}
			// 如果遇到非空行且不是引用行，则说明不在引用内
			if (line.trim() && !line.trim().startsWith(">")) {
				break
			}
		}

		if (!inBlockquote) return false

		// 检查从开始到结束位置是否都在引用内
		const textToCheck = markdown.substring(start, end)
		const allLines = markdown.substring(0, end).split("\n")
		const startLineIndex = beforeText.split("\n").length - 1

		// 检查涉及的所有行是否都在引用块内
		for (let i = startLineIndex; i < allLines.length; i++) {
			const line = allLines[i]
			if (line.trim() && !line.trim().startsWith(">") && !line.includes("```")) {
				// 如果有非引用行且不是代码块边界，则不在完整的引用块内
				return false
			}
		}

		return true
	}

	/**
	 * 分割 Markdown 块级代码块和图片
	 * @param markdown
	 * @returns
	 */
	splitBlockCode(markdown: string): string[] {
		const blocks: string[] = []
		if (!markdown || markdown.trim() === "") {
			return blocks
		}

		// 匹配 ```任何语言标识(包括带连字符的)\n...``` 形式的代码块
		const codeBlockRegex = /```([a-zA-Z0-9_-]*)\s*\n([\s\S]*?)```/g

		// 匹配 ![.*?]\(.*?\) 形式的图片
		const imgRegex = /!\[.*?\]\((.*?)\)/g

		// 收集所有需要分割的特殊块（代码块和图片）
		const specialBlocks: Array<{
			start: number
			end: number
			content: string
			type: "code" | "image"
		}> = []

		// 收集所有代码块
		let match
		while ((match = codeBlockRegex.exec(markdown)) !== null) {
			const language = match[1]
			const code = match[2]
			const blockStart = match.index
			const blockEnd = match.index + match[0].length

			// 检查代码块是否在引用内，如果在引用内则不分割
			if (!this.isInsideBlockquote(markdown, blockStart, blockEnd)) {
				specialBlocks.push({
					start: blockStart,
					end: blockEnd,
					content: `\`\`\`${language}\n${code}\`\`\``,
					type: "code",
				})
			}
		}

		// 重置正则表达式的 lastIndex
		codeBlockRegex.lastIndex = 0

		// 收集所有图片，但排除在代码块内的图片
		while ((match = imgRegex.exec(markdown)) !== null) {
			const imageStart = match.index
			const imageEnd = match.index + match[0].length

			// 检查图片是否在任何代码块内
			const isInsideCodeBlock = specialBlocks.some(
				(block) =>
					block.type === "code" && imageStart >= block.start && imageEnd <= block.end,
			)

			// 检查图片是否在引用内
			const isInsideQuote = this.isInsideBlockquote(markdown, imageStart, imageEnd)

			// 只有不在代码块内且不在引用内的图片才会被添加
			if (!isInsideCodeBlock && !isInsideQuote) {
				specialBlocks.push({
					start: imageStart,
					end: imageEnd,
					content: match[0],
					type: "image",
				})
			}
		}

		// 重置正则表达式的 lastIndex
		imgRegex.lastIndex = 0

		// 按位置排序
		specialBlocks.sort((a, b) => a.start - b.start)

		// 分割文本
		let lastIndex = 0
		for (const block of specialBlocks) {
			// 添加特殊块之前的内容
			const beforeContent = markdown.substring(lastIndex, block.start)
			if (beforeContent.trim()) {
				blocks.push(beforeContent.trim())
			}

			// 添加特殊块（代码块或图片）
			blocks.push(block.content)

			lastIndex = block.end
		}

		// 添加最后一个特殊块后的内容
		const remainingText = markdown.substring(lastIndex)
		if (remainingText.trim()) {
			blocks.push(remainingText.trim())
		}

		// 如果没有匹配到任何特殊块，则返回原始内容
		if (blocks.length === 0 && markdown.trim()) {
			blocks.push(markdown.trim())
		}

		return blocks
	}

	/**
	 * 处理缩写定义和替换
	 * @param markdown
	 * @returns
	 */
	processAbbreviations(markdown: string): string {
		// 第一阶段：收集所有缩写定义
		const abbreviations = new Map<string, string>()
		const matches = markdown.matchAll(ABBREVIATION_DEF_REGEX)

		for (const match of matches) {
			const [, abbr, definition] = match
			abbreviations.set(abbr, definition)
		}

		// 移除缩写定义行，同时清理多余的空行
		let processedMarkdown = markdown.replace(ABBREVIATION_DEF_REGEX, "")

		// 清理连续的空行，将多个连续的空行合并为最多两个空行
		processedMarkdown = processedMarkdown.replace(/\n{3,}/g, "\n\n")

		// 第二阶段：替换文本中的缩写
		for (const [abbr, definition] of abbreviations) {
			// 匹配完整单词的缩写，避免部分匹配
			const abbrRegex = new RegExp(
				`\\b${abbr.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`,
				"g",
			)
			processedMarkdown = processedMarkdown.replace(
				abbrRegex,
				`<abbr title="${definition}">${abbr}</abbr>`,
			)
		}

		return processedMarkdown
	}

	/**
	 * 处理参考链接定义和替换
	 * @param markdown
	 * @returns
	 */
	processReferenceLinks(markdown: string): string {
		// 第一阶段：收集所有参考链接定义
		const referenceLinks = new Map<string, { url: string; title?: string }>()
		const REFERENCE_LINK_DEF_REGEX = /^\s*\[([^\]]+)\]:\s*([^\s]+)(?:\s+"([^"]*)")?\s*$/gm
		const matches = markdown.matchAll(REFERENCE_LINK_DEF_REGEX)

		for (const match of matches) {
			const [, id, url, title] = match
			referenceLinks.set(id.toLowerCase(), { url, title })
		}

		// 移除参考链接定义行
		let processedMarkdown = markdown.replace(REFERENCE_LINK_DEF_REGEX, "")

		// 第二阶段：替换文本中的参考链接使用
		// 匹配 [text][id] 或 [text] 格式
		const REFERENCE_LINK_USE_REGEX = /\[([^\]]+)\](?:\[([^\]]*)\])?/g

		processedMarkdown = processedMarkdown.replace(
			REFERENCE_LINK_USE_REGEX,
			(match, text, id) => {
				// 如果没有指定id，使用text作为id
				const linkId = (id !== undefined ? id : text).toLowerCase()
				const linkInfo = referenceLinks.get(linkId)

				if (linkInfo) {
					const titleAttr = linkInfo.title ? ` title="${linkInfo.title}"` : ""
					return `<a href="${linkInfo.url}"${titleAttr} target="_blank" rel="noopener noreferrer">${text}</a>`
				}

				// 如果找不到对应的链接定义，保持原样
				return match
			},
		)

		return processedMarkdown
	}

	/**
	 * 修复段落开头的HTML标签问题
	 * 当行开头（或换行后紧跟）出现内联HTML标签时，添加零宽度空格确保段落完整性
	 * 注意：不处理块级元素如 MagicLatexBlock, div, hr 等
	 * @param markdown
	 * @returns
	 */
	private fixParagraphInlineHtmlTags(markdown: string): string {
		// 覆盖常见的内联HTML标签：abbr, sup, span, a, kbd, cite, q, s, u, mark, small, strong, em, sub
		// 以及Magic开头的内联组件标签（但排除块级组件）
		return markdown.replace(
			/(\n|^)(\s*)(<(?:abbr|sup|span|a|kbd|cite|q|s|u|mark|small|strong|em|sub|MagicLatexInline|MagicCitation)\b[^>]*>)/g,
			"$1$2\u200B$3",
		)
	}

	/**
	 * 保护代码块内容，避免被预处理规则影响
	 * @param markdown
	 * @returns { processedMarkdown: string, codeBlockMap: Map<string, string> }
	 */
	private protectCodeBlocks(markdown: string): {
		processedMarkdown: string
		codeBlockMap: Map<string, string>
	} {
		const codeBlockMap = new Map<string, string>()
		let counter = 0

		// 匹配所有代码块（包括语言标识符）
		const codeBlockRegex = /```[\s\S]*?```/g

		const processedMarkdown = markdown.replace(codeBlockRegex, (match) => {
			const placeholder = `__CODE_BLOCK_PLACEHOLDER_${counter}__`
			codeBlockMap.set(placeholder, match)
			counter++
			return placeholder
		})

		return { processedMarkdown, codeBlockMap }
	}

	/**
	 * 恢复被保护的代码块内容
	 * @param markdown
	 * @param codeBlockMap
	 * @returns
	 */
	private restoreCodeBlocks(markdown: string, codeBlockMap: Map<string, string>): string {
		let result = markdown

		for (const [placeholder, originalContent] of codeBlockMap) {
			result = result.replace(placeholder, originalContent)
		}

		return result
	}

	/**
	 * 预处理 markdown
	 * @param markdown
	 * @returns
	 */
	preprocess(markdown: string, options?: { enableLatex?: boolean }): string[] {
		// 首先保护代码块内容
		const { processedMarkdown: protectedMarkdown, codeBlockMap } =
			this.protectCodeBlocks(markdown)

		// 处理缩写
		let processedMarkdown = this.processAbbreviations(protectedMarkdown)

		// 处理参考链接
		processedMarkdown = this.processReferenceLinks(processedMarkdown)

		// 处理多级任务列表（在其他规则之前）
		processedMarkdown = this.processNestedTaskLists(processedMarkdown)

		const rules = this.getAllRules()

		// 移除原有的单一任务列表处理规则，因为我们已经用新方法处理了
		const filteredRules = rules.filter(
			(rule) => rule.regex.toString() !== TASK_LIST_REGEX.toString(),
		)

		// 在表格处理之前，先保护表格中的美元符号（如果启用 LaTeX）
		let tableProtectionMap = new Map<string, string>()
		if (options?.enableLatex) {
			const { markdown: protectedTableMarkdown, protectionMap } =
				this.protectTableDollarSigns(processedMarkdown)
			processedMarkdown = protectedTableMarkdown
			tableProtectionMap = protectionMap
		}

		if (options?.enableLatex) {
			// 块级公式必须在行内公式之前处理
			filteredRules.unshift(this.getBlockLatexRule())
			filteredRules.push(this.getInlineLatexRule())
		}

		for (const rule of filteredRules) {
			processedMarkdown = processedMarkdown.replace(rule.regex, rule.replace)
		}

		// 恢复表格中的美元符号（如果之前保护过）
		if (tableProtectionMap.size > 0) {
			processedMarkdown = this.restoreTableDollarSigns(processedMarkdown, tableProtectionMap)
		}

		// 最后修复所有可能的段落开头HTML标签问题
		processedMarkdown = this.fixParagraphInlineHtmlTags(processedMarkdown)

		// 恢复代码块内容
		const finalMarkdown = this.restoreCodeBlocks(processedMarkdown, codeBlockMap)

		// 分割 Markdown 块级代码块
		return this.splitBlockCode(finalMarkdown)
	}

	/**
	 * 处理多级任务列表，生成正确的嵌套HTML结构
	 * @param markdown
	 * @returns
	 */
	processNestedTaskLists(markdown: string): string {
		const lines = markdown.split("\n")
		const taskLines: Array<{
			line: string
			originalIndex: number
			indent: number
			checked: string
			content: string
			level: number
		}> = []

		// 收集所有任务列表行
		lines.forEach((line, index) => {
			const match = line.match(/^(\s*)-\s+\[(x| )\]\s+(.+)$/)
			if (match) {
				const [, indent, checked, content] = match
				const level = Math.floor(indent.length / 2)
				taskLines.push({
					line,
					originalIndex: index,
					indent: indent.length,
					checked,
					content,
					level,
				})
			}
		})

		if (taskLines.length === 0) {
			return markdown
		}

		// 构建嵌套HTML结构
		const buildNestedHTML = (tasks: typeof taskLines, startLevel: number = 0): string => {
			const result: string[] = []
			let i = 0

			while (i < tasks.length) {
				const task = tasks[i]

				if (task.level < startLevel) {
					break
				}

				if (task.level > startLevel) {
					// 跳过更高级别的任务，它们会在递归中处理
					i++
					continue
				}

				// 当前级别的任务
				const checkbox = `<input type="checkbox" ${
					task.checked === "x" ? "checked" : ""
				} readonly />`

				// 查找子任务
				const childTasks: typeof taskLines = []
				let j = i + 1
				while (j < tasks.length && tasks[j].level > task.level) {
					childTasks.push(tasks[j])
					j++
				}

				// 构建任务HTML结构
				let taskHTML = `<li class="task-list-item">${checkbox}`

				// 如果有子任务，将文本内容包装在span中，并添加子任务列表
				if (childTasks.length > 0) {
					taskHTML += `<span>${task.content}</span>`
					const childHTML = buildNestedHTML(childTasks, task.level + 1)
					if (childHTML) {
						taskHTML += `<ul class="task-list-nested">${childHTML}</ul>`
					}
				} else {
					// 没有子任务时，直接添加文本内容
					taskHTML += task.content
				}

				taskHTML += "</li>"
				result.push(taskHTML)

				// 跳过已处理的子任务
				i = j
			}

			return result.join("")
		}

		// 生成完整的HTML
		const nestedHTML = `<ul class="task-list-container">${buildNestedHTML(taskLines)}</ul>`

		// 替换原始的任务列表
		const processedMarkdown = markdown
		const taskLineIndices = taskLines.map((t) => t.originalIndex).sort((a, b) => b - a)

		// 找到连续的任务列表块并替换
		const taskBlocks: Array<{ start: number; end: number }> = []
		let currentBlock: { start: number; end: number } | null = null

		taskLines.forEach((task) => {
			if (!currentBlock) {
				currentBlock = { start: task.originalIndex, end: task.originalIndex }
			} else if (
				task.originalIndex === currentBlock.end + 1 ||
				(task.originalIndex > currentBlock.end &&
					lines
						.slice(currentBlock.end + 1, task.originalIndex)
						.every((line) => line.trim() === ""))
			) {
				currentBlock.end = task.originalIndex
			} else {
				taskBlocks.push(currentBlock)
				currentBlock = { start: task.originalIndex, end: task.originalIndex }
			}
		})

		if (currentBlock) {
			taskBlocks.push(currentBlock)
		}

		// 按倒序替换，避免索引问题
		taskBlocks.reverse().forEach((block) => {
			const blockTasks = taskLines.filter(
				(t) => t.originalIndex >= block.start && t.originalIndex <= block.end,
			)
			const blockHTML = `<ul class="task-list-container">${buildNestedHTML(blockTasks)}</ul>`

			const beforeLines = lines.slice(0, block.start)
			const afterLines = lines.slice(block.end + 1)

			lines.splice(0, lines.length, ...beforeLines, blockHTML, ...afterLines)
		})

		return lines.join("\n")
	}

	/**
	 * 保护表格中的美元符号，避免被 LaTeX 处理器误解析
	 * @param markdown
	 * @returns
	 */
	private protectTableDollarSigns(markdown: string): {
		markdown: string
		protectionMap: Map<string, string>
	} {
		const protectionMap = new Map<string, string>()
		let protectedMarkdown = markdown

		// 找到所有表格块
		const tableMatches = markdown.matchAll(
			/^\s*(\|[^\n]*\|)\s*\n\s*(\|[\s\-:|\s]*\|)\s*\n((?:\s*\|[^\n]*\|\s*(?:\n|$))*)/gm,
		)

		for (const match of tableMatches) {
			const fullTable = match[0]
			let protectedTable = fullTable

			// 在这个表格中保护所有美元符号
			const dollarMatches = fullTable.matchAll(/\$/g)
			let offset = 0

			for (const dollarMatch of dollarMatches) {
				const placeholder = `__TABLE_DOLLAR_${protectionMap.size}__`
				protectionMap.set(placeholder, "$")

				const index = dollarMatch.index! + offset
				protectedTable =
					protectedTable.slice(0, index) + placeholder + protectedTable.slice(index + 1)
				offset += placeholder.length - 1
			}

			protectedMarkdown = protectedMarkdown.replace(fullTable, protectedTable)
		}

		return { markdown: protectedMarkdown, protectionMap }
	}

	/**
	 * 恢复表格中被保护的美元符号
	 * @param markdown
	 * @param protectionMap
	 * @returns
	 */
	private restoreTableDollarSigns(markdown: string, protectionMap: Map<string, string>): string {
		let restoredMarkdown = markdown

		for (const [placeholder, original] of protectionMap) {
			restoredMarkdown = restoredMarkdown.replace(new RegExp(placeholder, "g"), original)
		}

		return restoredMarkdown
	}
}

export default new PreprocessService()
