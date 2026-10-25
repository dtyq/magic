import type { JSONContent } from "@/infrastructure/editors/tiptap/react"
import type {
	DirectoryMentionData,
	ProjectFileMentionData,
} from "@/components/business/MentionPanel/types"
import { getFolderMentionData } from "@/components/business/MentionPanel/utils/directoryMention"
import i18n from "i18next"
import type {
	ArticleDetail,
	SelfMediaInitGlobalSettings,
	OutlineNode,
	MaterialItem,
	ReferenceFileValue,
} from "../components/SelfMediaInitPanel/types"
import {
	ALL_PLATFORMS,
	STYLE_PRESETS,
	VISUAL_PRESETS,
	collectArticleMaterials,
} from "../components/SelfMediaInitPanel/types"
export {
	buildDefaultArticleFolderName,
	resolveArticleFolderName,
} from "./selfMediaArticleFolderName"

function getPlatformLabel(value: string): string {
	const info = ALL_PLATFORMS.find((p) => p.value === value)
	return info ? i18n.t(info.labelKey, { ns: "super" }) : value
}

function getStyleLabel(value: string): string {
	const info = STYLE_PRESETS.find((p) => p.value === value)
	return info ? i18n.t(info.labelKey, { ns: "super" }) : value
}

function getVisualPresetDescription(value: string): string {
	const info = VISUAL_PRESETS.find((p) => p.value === value)
	return info ? i18n.t(info.descriptionKey, { ns: "super" }) : value
}

function fileExtensionFromName(name: string): string {
	const dot = name.lastIndexOf(".")
	return dot !== -1 ? name.slice(dot + 1) : ""
}

function isImageLikeMaterial(material: MaterialItem): boolean {
	const fileType = material.file?.type || ""
	const extension = fileExtensionFromName(material.file?.name || "").toLowerCase()
	return (
		fileType.startsWith("image/") ||
		["png", "jpg", "jpeg", "webp", "gif", "bmp", "svg", "avif", "heic", "heif"].includes(
			extension,
		)
	)
}

function stripVisualDescriptionTags(text: string): string {
	return text.replace(/\[视觉描述\][\s\S]*?\[\/视觉描述\]/g, "").trim()
}

function normalizePath(path: string): string {
	return path.replace(/^\/+/, "").replace(/\/+$/, "")
}

function lastPathSegment(path: string): string {
	const normalized = normalizePath(path)
	if (!normalized) return ""
	const parts = normalized.split("/")
	return parts[parts.length - 1] || normalized
}

// ─── TipTap primitive builders ────────────────────────────────────────────────

/** Split text on `\n` and produce text / hardBreak inline nodes. */
function inlineNodes(text: string): JSONContent[] {
	const lines = text.split("\n")
	const result: JSONContent[] = []
	lines.forEach((line, i) => {
		if (i > 0) result.push({ type: "hardBreak" })
		if (line) result.push({ type: "text", text: line })
	})
	return result
}

function para(text: string, withSuggestion = false): JSONContent {
	return {
		type: "paragraph",
		...(withSuggestion ? { attrs: { suggestion: "" } } : {}),
		content: inlineNodes(text),
	}
}

function paraNodes(nodes: JSONContent[]): JSONContent {
	return { type: "paragraph", content: nodes }
}

function spacer(): JSONContent {
	return { type: "paragraph", content: [] }
}

function pushSection(docContent: JSONContent[], title: string, paragraphs: JSONContent[]): void {
	if (paragraphs.length === 0) return
	if (docContent.length > 0) docContent.push(spacer())
	docContent.push(para(`【${title}】`), ...paragraphs)
}

// ─── Mention builders ─────────────────────────────────────────────────────────

/** Build a project_file mention node. */
export function buildFileReferenceMention(file: ProjectFileMentionData): JSONContent {
	return {
		type: "mention",
		attrs: {
			id: null,
			label: null,
			mentionSuggestionChar: "@",
			type: "project_file",
			data: {
				file_id: file.file_id,
				file_name: file.file_name,
				file_path: file.file_path,
				file_extension: file.file_extension,
			},
		},
	}
}

export function buildDirectoryReferenceMention(directory: DirectoryMentionData): JSONContent {
	return {
		type: "mention",
		attrs: {
			id: null,
			label: null,
			mentionSuggestionChar: "@",
			type: "project_directory",
			data: directory,
		},
	}
}

export function buildMentionsFromMaterialFiles(
	files: ProjectFileMentionData[],
): Array<{ type: "project_file"; data: ProjectFileMentionData }> {
	return files.map((file) => ({
		type: "project_file" as const,
		data: file,
	}))
}

// ─── Material helpers ─────────────────────────────────────────────────────────

function resolveMaterialFilePath(material: MaterialItem, materialDir?: string): string {
	if (material.uploadedPath) return material.uploadedPath
	if (materialDir) return `${materialDir}/${material.file.name}`
	return material.file.name
}

function materialToMentionData(
	material: MaterialItem,
	materialDir?: string,
): ProjectFileMentionData | null {
	const filePath = resolveMaterialFilePath(material, materialDir)
	if (!filePath) return null
	return {
		file_id: "",
		file_name: material.file.name,
		file_path: filePath,
		file_extension: fileExtensionFromName(material.file.name),
	}
}

/**
 * One paragraph per material: `N. @mention —— description`
 */
function materialMentionParagraph(
	index: number,
	material: MaterialItem,
	materialDir?: string,
): JSONContent {
	const mentionData = materialToMentionData(material, materialDir)
	const nodes: JSONContent[] = [{ type: "text", text: `参考文件 ${index}：` }]
	nodes.push(
		mentionData
			? buildFileReferenceMention(mentionData)
			: { type: "text", text: material.file.name },
	)
	if (material.description) {
		nodes.push({ type: "text", text: ` —— ${material.description}` })
	}
	return paraNodes(nodes)
}

function appendInlineMaterialMentions(
	nodes: JSONContent[],
	materials: MaterialItem[] | undefined,
	materialDir?: string,
): void {
	if (!materials?.length) return
	nodes.push({ type: "text", text: " 参考附件：" })
	materials.forEach((material, index) => {
		if (index > 0) nodes.push({ type: "text", text: "、" })
		const mentionData = materialToMentionData(material, materialDir)
		nodes.push(
			mentionData
				? buildFileReferenceMention(mentionData)
				: { type: "text", text: material.file.name },
		)
		if (material.description) {
			nodes.push({ type: "text", text: `（${material.description}）` })
		}
	})
}

/**
 * Build [title paragraph, intro paragraph, ...mention paragraphs] for a material list.
 * Returns [] when materials is empty.
 */
function materialSection(
	intro: string,
	materials: MaterialItem[],
	materialDir?: string,
): JSONContent[] {
	if (materials.length === 0) return []
	return [
		para(intro),
		...materials.map((m, i) => materialMentionParagraph(i + 1, m, materialDir)),
	]
}

// ─── Reference file helpers ───────────────────────────────────────────────────

function referenceFileToMentionData(f: ReferenceFileValue): ProjectFileMentionData | null {
	if (!f.file_path) return null
	return {
		file_id: f.file_id || "",
		file_name: f.name,
		file_path: f.file_path,
		file_extension: fileExtensionFromName(f.name),
	}
}

/**
 * One paragraph per visual reference file: `@mention` or plain filename.
 */
function visualRefFileParagraphs(refFiles: ReferenceFileValue[]): JSONContent[] {
	return refFiles.map((f) => {
		const mentionData = referenceFileToMentionData(f)
		return paraNodes([
			{ type: "text", text: "视觉参考文件：" },
			...(mentionData
				? [buildFileReferenceMention(mentionData)]
				: [{ type: "text", text: f.name }]),
		])
	})
}

// ─── Outline ─────────────────────────────────────────────────────────────────

function formatOutlinePrefix(path: number[]): string {
	if (path.length === 1) return `${path[0]}、`
	return `${path.join(".")}、`
}

function buildOutlineParagraphs(
	nodes: OutlineNode[],
	materialDir?: string,
	parentPath: number[] = [],
): JSONContent[] {
	return nodes.flatMap((node, index) => {
		const path = [...parentPath, index + 1]
		const prefix = formatOutlinePrefix(path)
		const paragraphNodes: JSONContent[] = [
			{
				type: "text",
				text: `${"  ".repeat(Math.max(0, path.length - 1))}${prefix} ${node.text}`,
			},
		]
		appendInlineMaterialMentions(paragraphNodes, node.materials, materialDir)
		return [
			paraNodes(paragraphNodes),
			...buildOutlineParagraphs(node.children || [], materialDir, path),
		]
	})
}

// ─── Unique mention collection ────────────────────────────────────────────────

/** Extract project_file mentions from a JSONContent document */
function extractMentionsFromJson(json?: JSONContent): ProjectFileMentionData[] {
	if (!json) return []
	const mentions: ProjectFileMentionData[] = []
	const walk = (node: JSONContent) => {
		if (node.type === "mention" && node.attrs?.type === "project_file" && node.attrs?.data) {
			const d = node.attrs.data
			if (d.file_path) {
				mentions.push({
					file_id: d.file_id || "",
					file_name: d.file_name || "",
					file_path: d.file_path,
					file_extension: d.file_extension || "",
				})
			}
		}
		if (node.content) node.content.forEach(walk)
	}
	walk(json)
	return mentions
}

function collectUniqueFileMentions(
	materials: MaterialItem[],
	visualRefFiles: ReferenceFileValue[],
	materialDir?: string,
	visualDescriptionJson?: JSONContent,
): ProjectFileMentionData[] {
	const seen = new Set<string>()
	const mentions: ProjectFileMentionData[] = []

	const push = (m: ProjectFileMentionData | null) => {
		if (!m || seen.has(m.file_path)) return
		seen.add(m.file_path)
		mentions.push(m)
	}

	for (const mat of materials) push(materialToMentionData(mat, materialDir))
	for (const ref of visualRefFiles) push(referenceFileToMentionData(ref))
	for (const m of extractMentionsFromJson(visualDescriptionJson)) push(m)

	return mentions
}

interface TargetDirectoryInput {
	directoryId?: string
	directoryPath?: string
	directoryName?: string
}

function buildTargetDirectoryMention(
	targetDirectory?: TargetDirectoryInput,
): DirectoryMentionData | undefined {
	const directoryPath = normalizePath(targetDirectory?.directoryPath || "")
	if (!directoryPath) return undefined
	return getFolderMentionData({
		directoryId: targetDirectory?.directoryId,
		directoryName: targetDirectory?.directoryName || lastPathSegment(directoryPath),
		directoryPath,
		directoryMetadata: { type: "self-media" },
	})
}

// ─── Main export ──────────────────────────────────────────────────────────────

export interface ArticlePromptResult {
	/** Full TipTap JSONContent document to send as the message content */
	content: JSONContent
	/** All project_file mentions referenced in the content */
	fileMentions: ProjectFileMentionData[]
	/** Target self-media project directory mentioned in the content */
	targetDirectoryMention?: DirectoryMentionData
}

/**
 * Build a complete TipTap JSONContent document for a single article prompt.
 *
 * All file references (materials, visual reference files) use proper
 * project_file mention nodes — never plain text filenames or [@file_path:…].
 */
export function buildArticlePromptContent(
	global: SelfMediaInitGlobalSettings,
	article: ArticleDetail,
	materialDir?: string,
	targetDirectory?: TargetDirectoryInput,
): ArticlePromptResult {
	const platform = getPlatformLabel(article.platform)
	const style = getStyleLabel(article.style)
	const allMaterials = collectArticleMaterials(article)
	const visualRefFiles = article.visualReferenceFiles || []
	const notesWithoutVisualDescription = stripVisualDescriptionTags(article.notes)
	const fileMentions = collectUniqueFileMentions(
		allMaterials,
		visualRefFiles,
		materialDir,
		article.visualDescriptionJson,
	)
	const targetDirectoryMention = buildTargetDirectoryMention(targetDirectory)

	const docContent: JSONContent[] = []

	docContent.push(
		para("你是一个专业的自媒体内容创作助手。请根据以下信息完成本次内容创作。", true),
	)

	if (targetDirectoryMention) {
		pushSection(docContent, "创建位置", [
			paraNodes([
				{ type: "text", text: "本次内容请创建在 " },
				buildDirectoryReferenceMention(targetDirectoryMention),
				{ type: "text", text: " 中。" },
			]),
		])
	}

	pushSection(docContent, "项目索引规则", [
		para(
			"项目入口列表已经准备好，本次只补齐这篇内容自己的文件。不要重复维护项目入口列表，避免影响同批次的其他文章。",
		),
	])

	pushSection(docContent, "品牌信息", [
		para(
			`账号名称：${global.author}\n品牌定位：${global.brandPosition}${global.targetAudience ? `\n目标受众：${global.targetAudience}` : ""}\n目标平台：${platform}`,
		),
	])

	pushSection(docContent, "文章要求", [
		para(
			`标题：${article.title}\n内容风格：${style}${article.cardCount > 0 ? `\n卡片数量：${article.cardCount} 张` : ""}`,
		),
	])

	pushSection(docContent, "图片处理", [
		para("图片处理请遵循项目自媒体创作规范；没有明确素材时，优先保证内容真实可信。"),
	])

	if (allMaterials.some(isImageLikeMaterial)) {
		pushSection(docContent, "图片附件处理规则", [
			para(
				"如果文章或大纲节点的附件是截图、图表、产品图、界面图或其他与内容相关的图片，请先使用 visual_understanding 理解图片内容，并判断它最适合服务哪个大纲节点。",
			),
			para(
				"不要直接把截图原图当作最终卡片图。需要进入卡片展示时，请基于该附件使用 generate_images 的 reference_images 进行二次创作，保留原图关键信息，同时补充重点区域高亮、放大框、箭头、标注、对比框或局部强调等效果。",
			),
			para(
				"大纲节点上的图片附件优先服务该节点；只有当图片信息明显适用于全文时，才扩展到其他卡片或文章区域。",
			),
		])
	}

	if (article.visualPreset && article.visualPreset !== "none") {
		if (article.visualPreset === "custom") {
			// Prefer rich JSON content (which may contain @mention file references)
			if (article.visualDescriptionJson?.content?.length) {
				const visualParagraphs: JSONContent[] = [
					para(
						`预设标识：custom\n适用平台：${platform}\n请根据以下视觉描述生成自定义视觉预设（CSS + JS），并用于卡片制作。`,
					),
					...article.visualDescriptionJson.content,
				]
				pushSection(docContent, "视觉要求", visualParagraphs)
			} else {
				// Fallback: extract from [视觉描述] tags in notes
				const customMatch = article.notes.match(/\[视觉描述\](.*?)\[\/视觉描述\]/)
				const customDesc = customMatch?.[1] || "用户自定义风格"
				const visualParagraphs: JSONContent[] = [
					para(
						`预设标识：custom:${customDesc}\n适用平台：${platform}\n请根据以上描述生成自定义视觉预设（CSS + JS），并用于卡片制作。`,
					),
				]
				if (visualRefFiles.length > 0) {
					visualParagraphs.push(
						para("请结合以下视觉参考文件理解风格要求："),
						...visualRefFileParagraphs(visualRefFiles),
					)
				}
				pushSection(docContent, "视觉要求", visualParagraphs)
			}
		} else {
			pushSection(docContent, "视觉要求", [
				para(
					`预设标识：${article.visualPreset}\n适用平台：${platform}\n预设说明：${getVisualPresetDescription(article.visualPreset)}\n请以该视觉预设作为卡片视觉基础。`,
				),
			])
		}
	}

	if (article.outline.length > 0) {
		pushSection(docContent, "文章大纲", [
			para("请严格按照以下层级大纲组织内容，并优先结合每个节点后面引用的附件。"),
			...buildOutlineParagraphs(article.outline, materialDir),
		])
	}

	if (notesWithoutVisualDescription) {
		pushSection(docContent, "补充说明", [para(notesWithoutVisualDescription)])
	}

	pushSection(
		docContent,
		"参考素材",
		materialSection(
			"以下参考资料已上传，请在生成内容时结合使用。",
			article.materials,
			materialDir,
		),
	)

	return {
		content: { type: "doc", content: docContent },
		fileMentions,
		targetDirectoryMention,
	}
}

/** @deprecated Use buildArticlePromptContent */
export function buildArticlePromptPayload(
	global: SelfMediaInitGlobalSettings,
	article: ArticleDetail,
	materialDir?: string,
): ArticlePromptResult {
	return buildArticlePromptContent(global, article, materialDir)
}
