import { resolvePromptOptimizationOutputLanguage } from "../../../../editors/prompt-optimization/promptOptimizationUserPrompt"

type TextContentOptimizationOutputLanguage = "zh" | "en"

interface BuildTextContentOptimizationPromptOptions {
	currentText: string
	hostUiLocale?: string
}

export function buildTextContentOptimizationPrompt(
	options: BuildTextContentOptimizationPromptOptions,
): string {
	const currentText = options.currentText.trim() || "用户当前未填写"
	const outputLanguage = resolvePromptOptimizationOutputLanguage({
		currentPrompt: currentText,
		hostUiLocale: options.hostUiLocale,
	})

	return [
		"# 任务",
		"优化画布文本元素中的展示文案，使其更清晰、自然、有表现力，并可直接替换原文本。",
		"",
		"# 当前文本",
		"```text",
		currentText,
		"```",
		"",
		buildLineStructureInstruction(currentText),
		"",
		buildOutputLanguageInstruction(outputLanguage),
		"",
		buildOptimizationInstruction(),
		"",
		buildOutputInstruction(currentText),
	]
		.filter(Boolean)
		.join("\n")
}

function buildOutputLanguageInstruction(language: TextContentOptimizationOutputLanguage): string {
	const fallbackLanguageText = language === "zh" ? "中文" : "英文"
	return [
		"# 输出语言",
		`如果当前文本有明确语言，最终文本必须跟随当前文本语言；如果当前文本为空或语言不明显，最终文本必须使用${fallbackLanguageText}。`,
	].join("\n")
}

function buildOptimizationInstruction(): string {
	return [
		"# 优化要求",
		"保留原始含义、数字、品牌、专有名词、时间、价格、链接和明确限制。",
		"让文案更适合画布展示，表达简洁、有节奏，不要扩写成说明文。",
		"如果原文是标题、按钮、标语或短句，保持短文本形态。",
		"优先保留原有换行结构和段落节奏，不要无故把多行文本合并成一行。",
		"不要添加原文没有的信息。",
	].join("\n")
}

function buildOutputInstruction(currentText: string): string {
	const lines = currentText.replace(/\r\n?/g, "\n").split("\n")
	return [
		"# 输出",
		"只输出优化后的文本正文。不要输出解释、标题、Markdown、JSON、多套方案或前后缀说明。",
		lines.length > 1 ? "如果当前文本是多行，最终输出正文也应直接以多行文本形式返回。" : "",
	]
		.filter(Boolean)
		.join("\n")
}

function buildLineStructureInstruction(currentText: string): string {
	const lines = currentText.replace(/\r\n?/g, "\n").split("\n")
	if (lines.length <= 1) return ""

	return [
		"# 换行结构",
		"原文本包含多行，默认也应返回多行文本。",
		"请按原有行序逐行优化对应内容，优先保留原来的换行位置和段落节奏。",
		'行与行之间必须直接使用真实换行分隔，不要用空格、逗号、顿号或字面量 "\\\\n" 替代换行。',
		"只有在原换行明显影响表达自然度时，才可以少量调整换行。",
		"",
		"## 原始行内容",
		...lines.map((line, index) => `${index + 1}. ${line || "（空行）"}`),
	].join("\n")
}
