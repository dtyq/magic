import type { JSONContent } from "@/infrastructure/editors/tiptap/react"
import type { StoredMentionPathBinding } from "../../../../public/magic-types"
import { CANVAS_REFERENCE_MENTION_ITEM_TYPE } from "../reference-assets/canvasReferenceMention.constants"
import { isStructuredFileId } from "../reference-assets/createReferenceResourcePanelItem"
import { getCanvasResourceFileName } from "../../../../runtime/shared/path/canvasResourcePath"
import type { ReferenceResourceAssetType } from "../reference-assets/reference-resource.types"

/** 项目 MentionExtension 使用的 PROJECT_FILE 类型标识 */
const PROJECT_FILE_TYPE = CANVAS_REFERENCE_MENTION_ITEM_TYPE.projectFile
export const MENTION_CARET_GUARD_TEXT = "\u200b"

export type MatchableMentionSource = "element-reference" | "project-tree"

/** 可匹配的 @ 项，用于 string 转 JSON 时判断是否渲染为节点 */
export interface MatchableMentionItem {
	name: string
	path?: string
	/** 路径无法表达媒体类型时（如 asset://），由资源来源显式提供。 */
	assetType?: ReferenceResourceAssetType
	/** 是否禁用（达到参考图数量限制时，未选中的文件会被禁用） */
	disabled?: boolean
	/**
	 * element-reference: 当前元素已绑定的参考文件，是 string rematch 的首选。
	 * project-tree: 工作区其它文件；同名但 identity 不同时应作为独立候选。
	 */
	source?: MatchableMentionSource
}

/**
 * 跨编辑器生命周期恢复 mention 时使用的结构化绑定。
 *
 * 同名文件不能仅靠 fileName 区分，因此恢复时按文档中的 mention 出现顺序
 * 保存并重建真实路径与宿主身份。该数据只属于编辑器/session 恢复，不参与后端请求格式。
 */
export type MentionPathBinding = StoredMentionPathBinding

interface ProjectFileData {
	file_id?: string
	file_name?: string
	file_path?: string
	file_extension?: string
	media_type?: "image" | "video" | "audio"
	project_id?: string
	source_project_id?: string
	source_file_id?: string
}

export function areMentionPathBindingsEqual(
	left: MentionPathBinding[],
	right: MentionPathBinding[],
): boolean {
	if (left.length !== right.length) return false
	return left.every(
		(binding, index) =>
			binding.fileName === right[index]?.fileName &&
			binding.path === right[index]?.path &&
			binding.fileId === right[index]?.fileId &&
			binding.sourceFileId === right[index]?.sourceFileId &&
			binding.sourceProjectId === right[index]?.sourceProjectId &&
			binding.projectId === right[index]?.projectId,
	)
}

function isPendingMentionData(data: unknown): boolean {
	return Boolean(
		data && typeof data === "object" && (data as { pending?: boolean }).pending === true,
	)
}

/**
 * 从 TipTap JSON 内容提取纯文本（含 @文件名）
 * 仅支持 mention type=project_file（MentionPanel）
 */
export function getStringFromContent(doc: JSONContent | null | undefined): string {
	if (!doc) return ""
	const parts: string[] = []

	function traverse(node: JSONContent) {
		if (
			node.type === "mention" &&
			node.attrs?.type === PROJECT_FILE_TYPE &&
			(node.attrs?.data as ProjectFileData)?.file_name
		) {
			if (node.attrs?.pending === true || isPendingMentionData(node.attrs?.data)) return
			parts.push(`@${(node.attrs.data as ProjectFileData).file_name}`)
			return
		}
		if (node.type === "text" && node.text) {
			parts.push(node.text.replaceAll(MENTION_CARET_GUARD_TEXT, ""))
			return
		}
		if (node.type === "hardBreak" || node.type === "hard_break") {
			parts.push("\n")
			return
		}
		for (const child of node.content ?? []) {
			traverse(child)
		}
	}

	// 原生多行粘贴会生成多个 paragraph；草稿只保存字符串，必须保留块边界，
	// 否则重新进入编辑器时各段文本会粘连到同一行。
	const blocks = doc.type === "doc" ? (doc.content ?? []) : [doc]
	blocks.forEach((block, index) => {
		if (index > 0) parts.push("\n")
		traverse(block)
	})
	return parts.join("")
}

/**
 * 按 matchableItems 精确匹配 @mention，避免贪婪正则 [^\s@]+ 在中英文混排时误匹配
 * 当 @ 后紧跟 matchableItem.name 时匹配，不要求其后有空格（中文无空格）
 */
function findMentionAt(
	value: string,
	atIndex: number,
	matcher: MentionMatcher,
): { matchedItem: MatchableMentionItem; endIndex: number } | null {
	const afterAt = value.slice(atIndex + 1)
	if (!afterAt) return null
	const afterAtLower = afterAt.toLowerCase()
	for (const name of matcher.namesByLength) {
		const nameLower = name.toLowerCase()
		if (afterAtLower.startsWith(nameLower)) {
			const candidates = matcher.itemsByName.get(nameLower)
			if (!candidates || candidates.length === 0) {
				continue
			}
			const hitCount = matcher.hitCountByName.get(nameLower) ?? 0
			const matchedItem = candidates[Math.min(hitCount, candidates.length - 1)]
			matcher.hitCountByName.set(nameLower, hitCount + 1)
			return { matchedItem, endIndex: atIndex + 1 + name.length }
		}
	}
	return null
}

interface MentionMatcher {
	namesByLength: string[]
	itemsByName: Map<string, MatchableMentionItem[]>
	hitCountByName: Map<string, number>
}

function createMentionMatcher(matchableItems: MatchableMentionItem[]): MentionMatcher {
	const itemsByName = new Map<string, MatchableMentionItem[]>()
	for (const item of matchableItems) {
		if (item.disabled) continue
		const nameKey = item.name.toLowerCase()
		const list = itemsByName.get(nameKey)
		if (list) {
			list.push(item)
		} else {
			itemsByName.set(nameKey, [item])
		}
	}

	const namesByLength = Array.from(itemsByName.values())
		.map((items) => items[0]?.name)
		.filter((name): name is string => Boolean(name))
		.sort((a, b) => b.length - a.length)

	return {
		namesByLength,
		itemsByName,
		hitCountByName: new Map<string, number>(),
	}
}

/**
 * 将 string 转为 TipTap JSON 内容
 * @xxx 仅当 xxx 在 matchableItems 中时渲染为 mention 节点
 * 使用 matchableItems 驱动匹配，避免 [^\s@]+ 贪婪匹配中文无空格场景
 */
export function getContentFromString(
	value: string,
	matchableItems: MatchableMentionItem[],
	mentionBindings: MentionPathBinding[] = [],
): JSONContent {
	if (!value.trim()) {
		return { type: "doc", content: [{ type: "paragraph" }] }
	}

	const content: JSONContent[] = []
	const pushTextWithLineBreaks = (text: string) => {
		if (!text) return
		const normalized = text.replace(/\r\n?/g, "\n")
		const lines = normalized.split("\n")
		lines.forEach((line, index) => {
			if (line) {
				content.push({ type: "text", text: line })
			}
			if (index < lines.length - 1) {
				content.push({ type: "hardBreak" })
			}
		})
	}
	const matcher = createMentionMatcher(matchableItems)
	let mentionOccurrenceIndex = 0
	let i = 0
	while (i < value.length) {
		const atIndex = value.indexOf("@", i)
		if (atIndex === -1) {
			pushTextWithLineBreaks(value.slice(i))
			break
		}
		if (atIndex > i) {
			pushTextWithLineBreaks(value.slice(i, atIndex))
		}
		const match = findMentionAt(value, atIndex, matcher)
		if (match) {
			const { endIndex } = match
			const binding = mentionBindings[mentionOccurrenceIndex]
			const matchedItem =
				binding && binding.fileName.toLowerCase() === match.matchedItem.name.toLowerCase()
					? {
							...match.matchedItem,
							name: binding.fileName,
							path: binding.path,
						}
					: match.matchedItem
			mentionOccurrenceIndex += 1
			const fileName = matchedItem.name
			const path = matchedItem.path
			const bindingMatches =
				binding && binding.fileName.toLowerCase() === fileName.toLowerCase()
			content.push({
				type: "mention",
				attrs: {
					type: PROJECT_FILE_TYPE,
					data: {
						file_id: (bindingMatches && binding.fileId) || path || fileName,
						file_name: fileName,
						file_path: path ?? "",
						file_extension: fileName.includes(".")
							? (fileName.split(".").pop() ?? "")
							: "",
						...(matchedItem.assetType ? { media_type: matchedItem.assetType } : {}),
						...(bindingMatches && binding.projectId
							? { project_id: binding.projectId }
							: {}),
						...(bindingMatches && binding.sourceProjectId
							? { source_project_id: binding.sourceProjectId }
							: {}),
						...(bindingMatches && binding.sourceFileId
							? { source_file_id: binding.sourceFileId }
							: {}),
					},
				},
			})
			content.push({
				type: "text",
				text: MENTION_CARET_GUARD_TEXT,
			})
			i = endIndex
		} else {
			content.push({ type: "text", text: "@" })
			i = atIndex + 1
		}
	}

	return {
		type: "doc",
		content: [{ type: "paragraph", content: content.length ? content : undefined }],
	}
}

/**
 * 从 prompt 字符串中移除指定 path 对应的 @ 提及
 */
export function removeMentionFromString(prompt: string, path: string, fileName?: string): string {
	const name = fileName ?? getCanvasResourceFileName(path)
	if (!name) return prompt
	const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

	// 仅移除一次，避免同名不同路径的 mention 被批量误删。
	return prompt
		.replace(new RegExp(`@${escaped}`, "i"), "")
		.replace(/\s+/g, " ")
		.trim()
}

/** 判断 prompt 中是否已出现对应文件名的 @ 提及（与 appendMentionToString 去重规则一致） */
export function promptContainsMentionForFile(prompt: string, fileName?: string): boolean {
	const name = fileName ?? ""
	if (!name) return false
	const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
	return new RegExp(`@${escaped}`, "i").test(prompt)
}

/**
 * 向 prompt 追加指定文件的 @ 提及。
 * 注意：同名不同路径在文本层无法区分，不能按文件名去重。
 */
export function appendMentionToString(prompt: string, path: string, fileName?: string): string {
	const name = fileName ?? getCanvasResourceFileName(path)
	if (!name) return prompt
	if (!prompt.trim()) return `@${name}`
	return `${prompt.trim()} @${name}`
}

/**
 * 从 value 中提取能匹配 matchableItems 的 @ 提及的 path 列表
 * 复用 findMentionAt 逻辑，与 getContentFromString 一致
 */
export function getMatchablePathsFromValue(
	value: string,
	matchableItems: MatchableMentionItem[],
): string[] {
	if (!value || matchableItems.length === 0) return []
	const paths = new Set<string>()
	const matcher = createMentionMatcher(matchableItems)
	let i = 0
	while (i < value.length) {
		const atIndex = value.indexOf("@", i)
		if (atIndex === -1) break
		const match = findMentionAt(value, atIndex, matcher)
		if (match?.matchedItem.path) {
			paths.add(match.matchedItem.path)
		}
		i = atIndex + 1
	}
	return Array.from(paths)
}

/**
 * 从 value 中提取所有能匹配到的 mention 名称（保留重复出现次数）。
 *
 * 这里不能复用 getMatchablePathsFromValue：同名文件会按候选顺序解析为不同路径，
 * 但对于判断“文本中的 mention 是否已经渲染成节点”，只需要比较名称和出现次数。
 */
export function getMatchableMentionNamesFromValue(
	value: string,
	matchableItems: MatchableMentionItem[],
): string[] {
	if (!value || matchableItems.length === 0) return []

	const names: string[] = []
	const matcher = createMentionMatcher(matchableItems)
	let i = 0
	while (i < value.length) {
		const atIndex = value.indexOf("@", i)
		if (atIndex === -1) break
		const match = findMentionAt(value, atIndex, matcher)
		if (match) {
			names.push(match.matchedItem.name)
			i = match.endIndex
		} else {
			i = atIndex + 1
		}
	}
	return names
}

/** 从 TipTap JSON 内容提取所有已渲染的项目文件 mention 名称（保留重复出现次数）。 */
export function getMentionNamesFromContent(doc: JSONContent | null | undefined): string[] {
	if (!doc) return []
	const names: string[] = []

	function traverse(node: JSONContent) {
		if (
			node.type === "mention" &&
			node.attrs?.type === PROJECT_FILE_TYPE &&
			(node.attrs?.data as ProjectFileData)?.file_name
		) {
			if (node.attrs?.pending === true || isPendingMentionData(node.attrs?.data)) return
			names.push((node.attrs.data as ProjectFileData).file_name as string)
			return
		}
		for (const child of node.content ?? []) {
			traverse(child)
		}
	}

	traverse(doc)
	return names
}

/** 从 TipTap JSON 内容提取 mention 的有序路径绑定（保留重复出现次数与结构化身份）。 */
export function getMentionPathBindingsFromContent(
	doc: JSONContent | null | undefined,
): MentionPathBinding[] {
	if (!doc) return []
	const bindings: MentionPathBinding[] = []

	function traverse(node: JSONContent) {
		if (node.type === "mention" && node.attrs?.type === PROJECT_FILE_TYPE) {
			const data = node.attrs.data as ProjectFileData | undefined
			if (
				node.attrs.pending !== true &&
				!isPendingMentionData(data) &&
				data?.file_name &&
				data.file_path
			) {
				bindings.push({
					fileName: data.file_name,
					path: data.file_path,
					...(isStructuredFileId(data.file_id, data.file_path)
						? { fileId: data.file_id }
						: {}),
					...(data.source_file_id ? { sourceFileId: data.source_file_id } : {}),
					...(data.source_project_id ? { sourceProjectId: data.source_project_id } : {}),
					...(data.project_id ? { projectId: data.project_id } : {}),
				})
			}
			return
		}
		for (const child of node.content ?? []) {
			traverse(child)
		}
	}

	traverse(doc)
	return bindings
}

/**
 * 从 TipTap JSON 内容提取所有 @ 提及的路径列表（去重）
 * 仅支持 mention type=project_file（MentionPanel）
 */
export function getMentionPathsFromContent(doc: JSONContent | null | undefined): string[] {
	if (!doc) return []
	const paths = new Set<string>()

	function traverse(node: JSONContent) {
		if (
			node.type === "mention" &&
			node.attrs?.type === PROJECT_FILE_TYPE &&
			(node.attrs?.data as ProjectFileData)?.file_path
		) {
			if (node.attrs?.pending === true || isPendingMentionData(node.attrs?.data)) return
			const filePath = (node.attrs.data as ProjectFileData).file_path
			if (filePath) {
				paths.add(filePath)
			}
			return
		}
		for (const child of node.content ?? []) {
			traverse(child)
		}
	}

	traverse(doc)
	return Array.from(paths)
}
