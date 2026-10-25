import {
	resolvePromptOptimizationOutputLanguage,
	type PromptOptimizationOutputLanguage,
} from "../../../../editors/prompt-optimization/promptOptimizationUserPrompt"

interface BuildImagePromptExtractionPromptOptions {
	hostUiLocale?: string
	fileName?: string
	hasCrop?: boolean
}

export function buildImagePromptExtractionPrompt(
	options: BuildImagePromptExtractionPromptOptions = {},
): string {
	const outputLanguage = resolvePromptOptimizationOutputLanguage({
		currentPrompt: "",
		hostUiLocale: options.hostUiLocale,
	})

	return [
		"# 任务",
		"分析参考图 1 的可见画面，提炼一段可直接用于图片生成或图片编辑的提示词。",
		"",
		"# 参考图",
		buildReferenceInstruction(options),
		"",
		buildOutputLanguageInstruction(outputLanguage),
		"",
		"# 提炼要求",
		"描述画面中真实可见的主体、场景、背景、构图、光线、色彩、材质、风格和镜头视角。",
		"保留重要文字、品牌、标识、图案、颜色、人物姿态、商品特征和空间关系。",
		"只基于参考图内容提炼，不要虚构参考图中不存在的主体、品牌、道具、文字、复杂剧情或额外背景。",
		"用具体视觉语言表达，避免空泛形容词；提示词应适合后续作为生图输入。",
		"",
		"# 输出",
		"最终只输出一段提示词正文。不要输出解释、标题、Markdown、JSON、列表、多套方案或前后缀说明。",
	]
		.filter(Boolean)
		.join("\n")
}

function buildReferenceInstruction(options: BuildImagePromptExtractionPromptOptions): string {
	const fileName = options.fileName?.trim()
	const fileNameText = fileName ? `文件名：${fileName}。` : ""
	const cropText = options.hasCrop
		? "参考图已按画布裁剪区域提交，优先基于裁剪后的可见内容提炼。"
		: "参考图为当前画布图片。"
	return `已提供 1 张图片作为视觉输入。${fileNameText}${cropText}`
}

function buildOutputLanguageInstruction(language: PromptOptimizationOutputLanguage): string {
	const languageText = language === "zh" ? "中文" : "英文"
	return ["# 输出语言", `最终提示词必须使用${languageText}。`].join("\n")
}
