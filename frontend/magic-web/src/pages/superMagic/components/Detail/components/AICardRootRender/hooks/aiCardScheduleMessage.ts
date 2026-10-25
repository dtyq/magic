import type { JSONContent } from "@/infrastructure/editors/tiptap/react"

/** Extract plain text from the stored prompt value (JSON string of JSONContent) */
export function getPromptPlainText(prompt: string): string {
	if (!prompt) return ""
	try {
		const json = JSON.parse(prompt) as JSONContent
		return textFromJSONContent(json).trim()
	} catch {
		return prompt.trim()
	}
}

/**
 * Build the full message JSONContent that triggers the ai-card-generator skill.
 * Preserves @mention nodes from the user's prompt.
 */
export function buildScheduleMessageJSONContent(
	promptRaw: string,
	taskName: string,
	template: string,
	customTemplatePrompt?: string,
): JSONContent {
	const prefixLines = [
		`请更新 AI 卡片「${taskName}」。`,
		``,
		`━━━ 卡片模板 ━━━`,
		template === "custom"
			? `使用自定义模板。${customTemplatePrompt ? `自定义需求: ${customTemplatePrompt}` : "优先使用卡片目录中的 template/index.html；兼容旧版 template.html。"}`
			: `使用预设模板: ${template}，参考 templates/${template}/index.html 及同目录 styles.css、scripts.js 的结构和样式。`,
		``,
		`━━━ 执行步骤 ━━━`,
		`1. 读取卡片目录下的 magic.project.js 获取配置和上下文信息`,
		`2. 读取模板目录（优先 template/，兼容 template.html）理解布局结构和数据区域标记`,
		`3. 按照下方"分析指令"获取和分析最新数据`,
		`4. 归档：将当前 latest/ 下所有文件复制到 history/YYYY-MM-DD_HH-mm/；兼容模式下才将 latest.html 复制为 history/YYYY-MM-DD_HH-mm.html`,
		`5. 复制模板：将 template/ 下所有文件复制到 latest/（覆盖），作为本次生成基础；兼容模式下使用 template.html 生成 latest.html`,
		`6. 仅修改 latest/index.html 中的数据区域，填入最新数据；不要遗漏同目录 styles.css、scripts.js 等资源文件`,
		`7. 更新 magic.project.js 的 last_generated 和 generation_count`,
		``,
		`━━━ 分析指令 ━━━`,
	]
	const prefixContent = buildPlainTextJSONContent(prefixLines.join("\n"))

	let promptContent: JSONContent[] | undefined
	try {
		const parsed = JSON.parse(promptRaw)
		if (parsed?.type === "doc" && parsed.content) {
			promptContent = parsed.content
		}
	} catch {
		// Legacy plain text
	}

	if (promptContent) {
		return {
			type: "doc",
			content: [...(prefixContent.content || []), ...promptContent],
		}
	}

	const plainText = getPromptPlainText(promptRaw)
	const promptParagraph = { type: "paragraph", content: [{ type: "text", text: plainText }] }
	return {
		type: "doc",
		content: [...(prefixContent.content || []), promptParagraph],
	}
}

function buildPlainTextJSONContent(text: string): JSONContent {
	const paragraphs = text
		.split(/\n{2,}/)
		.filter((paragraph) => paragraph.trim())
		.map((paragraph) => ({
			type: "paragraph",
			content: [{ type: "text", text: paragraph }],
		}))

	if (paragraphs.length === 0) return { type: "doc", content: [] }

	return { type: "doc", content: paragraphs }
}

function textFromJSONContent(node: JSONContent | undefined): string {
	if (!node) return ""
	if (node.type === "text") return node.text || ""
	const attrsText = textFromAttrs(node.attrs)
	if (attrsText) return attrsText
	if (!Array.isArray(node.content)) return ""

	const separator = node.type === "doc" ? "\n" : ""
	return node.content.map(textFromJSONContent).filter(Boolean).join(separator)
}

function textFromAttrs(attrs: JSONContent["attrs"]): string | undefined {
	if (!attrs) return undefined
	for (const key of ["label", "text", "name", "file_name"]) {
		const value = attrs[key]
		if (typeof value === "string" && value.trim()) return value
	}
	return undefined
}
