export type PromptOptimizationTarget = "image" | "video"
export type PromptOptimizationReferenceKind = "image" | "video" | "audio"
export type PromptOptimizationOutputLanguage = "zh" | "en"

export interface PromptOptimizationReferenceContext {
	kind: PromptOptimizationReferenceKind
	placeholder?: string
	label?: string
	fileName?: string
	isVisualInput?: boolean
	visualReferenceIndex?: number
	role?: string
}

interface BuildPromptOptimizationUserPromptOptions {
	target: PromptOptimizationTarget
	currentPrompt: string
	outputLanguage?: PromptOptimizationOutputLanguage
	referenceImageCount?: number
	frameImageCount?: number
	referenceVideoCount?: number
	referenceAudioCount?: number
	references?: PromptOptimizationReferenceContext[]
}

export function buildPromptOptimizationUserPrompt(
	options: BuildPromptOptimizationUserPromptOptions,
): string {
	const currentInput = options.currentPrompt.trim() || "用户当前未填写"
	const outputLanguage = options.outputLanguage ?? "zh"
	return [
		buildTaskInstruction(options.target),
		buildCurrentInputSection(currentInput),
		buildOutputLanguageInstruction(outputLanguage),
		buildReferenceSection(currentInput, options),
		buildOptimizationInstruction(options.target),
		buildOutputInstruction(),
	]
		.filter(Boolean)
		.join("\n\n")
}

export function resolvePromptOptimizationOutputLanguage(options: {
	currentPrompt: string
	hostUiLocale?: string
}): PromptOptimizationOutputLanguage {
	return (
		detectPromptLanguage(options.currentPrompt) ??
		resolveHostUiLocaleLanguage(options.hostUiLocale)
	)
}

function detectPromptLanguage(prompt: string): PromptOptimizationOutputLanguage | undefined {
	const normalizedPrompt = prompt
		.replace(/\[[^\]]+\d+\]/g, " ")
		.replace(/@[^\s]+/g, " ")
		.trim()
	if (!normalizedPrompt) return undefined

	if (/[\u3400-\u9fff\uf900-\ufaff]/.test(normalizedPrompt)) {
		return "zh"
	}

	const latinCharCount = (normalizedPrompt.match(/[A-Za-z]/g) ?? []).length
	return latinCharCount >= 3 ? "en" : undefined
}

function resolveHostUiLocaleLanguage(
	hostUiLocale: string | undefined,
): PromptOptimizationOutputLanguage {
	const normalizedLocale = hostUiLocale?.toLowerCase().replace(/_/g, "-") ?? ""
	return normalizedLocale.startsWith("zh") ? "zh" : "en"
}

function buildOutputLanguageInstruction(language: PromptOptimizationOutputLanguage): string {
	const fallbackLanguageText = language === "zh" ? "中文" : "英文"
	return [
		"# 输出语言",
		`如果当前输入有明确语言，最终提示词必须跟随当前输入语言；如果当前输入为空或语言不明显，最终提示词必须使用${fallbackLanguageText}。不要把素材占位符或文件名当作判断语言的依据。`,
	].join("\n")
}

function buildTaskInstruction(target: PromptOptimizationTarget): string {
	const targetText =
		target === "video"
			? "优化一段用于视频生成或视频编辑的提示词，使其更具体、可执行、少歧义。"
			: "优化一段用于图片生成或图片编辑的提示词，使其更具体、可执行、少歧义。"
	return ["# 任务", targetText].join("\n")
}

function buildCurrentInputSection(currentInput: string): string {
	return ["# 当前输入", "```text", currentInput, "```"].join("\n")
}

function buildReferenceSection(
	currentInput: string,
	options: BuildPromptOptimizationUserPromptOptions,
): string {
	const availableReferences = options.references ?? []
	const usedPlaceholderReferences = availableReferences.filter(
		(reference) => reference.placeholder && currentInput.includes(reference.placeholder),
	)
	const referenceInstructions = availableReferences.map((reference) =>
		buildReferenceInstruction(reference, currentInput),
	)
	const referenceSummary = buildReferenceSummary(options)
	if (
		usedPlaceholderReferences.length === 0 &&
		referenceInstructions.length === 0 &&
		!referenceSummary
	)
		return ""

	const lines: string[] = []
	if (usedPlaceholderReferences.length > 0) {
		const placeholders = usedPlaceholderReferences
			.map((reference) => reference.placeholder)
			.filter(Boolean)
			.join("、")
		lines.push(
			[
				"# 引用规则",
				`当前输入中已出现的素材占位符必须原样保留：${placeholders}。不要改写、删除、翻译这些占位符，也不要把它们替换成文件名或自然语言描述。`,
			].join("\n"),
		)
	} else if (referenceInstructions.length > 0) {
		lines.push(
			[
				"# 引用规则",
				"当前输入没有素材占位符，返回结果也不要出现任何 [图片1]、[视频1]、[音频1] 形式的占位符。",
			].join("\n"),
		)
	}
	if (referenceSummary) {
		lines.push(referenceSummary)
	}
	if (referenceInstructions.length > 0) {
		lines.push(
			"不要新增当前输入没有出现的占位符。参考素材只作为优化上下文；如果当前输入没有明确引用某个占位符，不要在返回结果中强行加入该占位符。",
		)
		lines.push(["# 参考素材", ...referenceInstructions].join("\n"))
	}
	// 生成模型会直接看参考图；提示词复述外观时，看错或说重的细节会压过参考图本身，
	// 所以只让优化结果说明每张图的角色。不带方括号的“图片1”不会触发编辑器的占位符绑定。
	const hasVisualImageReference = availableReferences.some(
		(reference) => reference.kind === "image" && reference.isVisualInput,
	)
	if (hasVisualImageReference) {
		lines.push(
			[
				"# 参考图写法",
				"写清每张参考图负责什么、保持到什么程度，不要复述参考图里已有的外观（肤色、胡子、眼镜、服装细节等）；完整描述参考图提供不了的新场景、动作、镜头、光线和要改动的内容。",
				"指代参考图时：当前输入已有占位符就用占位符；没有占位符时按顺序写“图片1、图片2”（英文写 Image 1、Image 2），不要加方括号。",
				"需要强调时可以强调：用户提到的特征、正在修改的部分、容易丢失的小细节（logo、痣、包装文字），或需要区分多个主体时，指向参考图里的位置来写，不要重新描述它的样子。",
			].join("\n"),
		)
	}
	return lines.join("\n\n")
}

function buildReferenceSummary(options: BuildPromptOptimizationUserPromptOptions): string {
	const parts: string[] = []
	const imageCount = options.referenceImageCount ?? 0
	if (imageCount > 0) {
		const frameCount = options.frameImageCount ?? 0
		const frameText = frameCount > 0 ? `，其中 ${frameCount} 张为视频帧参考` : ""
		parts.push(`已提供 ${imageCount} 张图片内容作为视觉参考${frameText}`)
	}
	const nonVisualParts: string[] = []
	if ((options.referenceVideoCount ?? 0) > 0) {
		nonVisualParts.push(`${options.referenceVideoCount} 个视频文件`)
	}
	if ((options.referenceAudioCount ?? 0) > 0) {
		nonVisualParts.push(`${options.referenceAudioCount} 个音频文件`)
	}
	if (nonVisualParts.length > 0) {
		parts.push(`${nonVisualParts.join("、")}仅提供文件名作为上下文，不能推断具体画面或声音内容`)
	}
	return parts.length > 0 ? ["# 参考资源概况", `${parts.join("；")}。`].join("\n") : ""
}

function buildReferenceInstruction(
	reference: PromptOptimizationReferenceContext,
	currentInput: string,
): string {
	const fileName = reference.fileName?.trim()
	const fileNameText = fileName ? `文件名：${fileName}` : "未提供文件名"
	const visualReferenceText = reference.visualReferenceIndex
		? `，对应第 ${reference.visualReferenceIndex} 张参考图内容`
		: ""
	const roleText = reference.role ? `，用途：${reference.role}` : ""
	const usedPlaceholder =
		reference.placeholder && currentInput.includes(reference.placeholder)
			? reference.placeholder
			: ""
	const prefix = usedPlaceholder || reference.label || getReferenceKindLabel(reference.kind)
	if (reference.kind === "image") {
		return `${prefix}：${fileNameText}${visualReferenceText}${roleText}${
			reference.isVisualInput
				? "，用于判断它在画面中负责什么（如人物形象、服装、产品外形、构图、配色、光线或风格）"
				: "，只作为文件占位符"
		}。`
	}
	if (reference.kind === "video") {
		return `${prefix}：${fileNameText}${roleText}。当前只提供文件名作为上下文，不提供视频内容${
			usedPlaceholder
				? `；返回提示词中必须原样保留 ${usedPlaceholder}`
				: "；不要描述、总结或假设其画面内容"
		}。`
	}
	return `${prefix}：${fileNameText}${roleText}。当前只提供文件名作为上下文，不提供音频内容${
		usedPlaceholder
			? `；返回提示词中必须原样保留 ${usedPlaceholder}`
			: "；不要描述、总结或假设其声音内容"
	}。`
}

function getReferenceKindLabel(kind: PromptOptimizationReferenceKind): string {
	if (kind === "image") return "图片参考"
	if (kind === "video") return "视频文件引用"
	return "音频文件引用"
}

function buildOptimizationInstruction(target: PromptOptimizationTarget): string {
	const sharedRules = [
		"保留用户原始意图、主体、风格、用途、明确限制、文字、品牌、颜色和构图要求。",
		"用具体视觉语言替代空泛形容词，例如说明光线、材质、构图、留白、镜头或色彩关系。",
		"不要添加无关道具、无关人物、无关品牌、复杂剧情或随机设定。",
		"正向描述优先；只有为避免常见错误时才加入负面约束。",
	]
	const targetRule =
		target === "video"
			? "补充真正服务视频生成的视觉信息：主体动作、场景变化、镜头运动、构图、光线、色彩、材质、节奏和画面连续性。"
			: "补充真正服务图片生成的视觉信息：主体状态（参考图已提供的外观交给参考图）、场景、背景、构图、光线方向与软硬、色彩关系、材质质感、镜头或画幅。"
	return ["# 优化要求", ...sharedRules, targetRule].join("\n")
}

function buildOutputInstruction(): string {
	return [
		"# 输出",
		"最终只输出一段可直接用于生成的提示词正文。不要输出解释、标题、Markdown、JSON、列表、多套方案或前后缀说明。",
	].join("\n")
}
