import type { JSONContent } from "@tiptap/react"

/** 项目 MentionExtension 使用的 PROJECT_FILE 类型标识 */
const PROJECT_FILE_TYPE = "project_file"

/** 可匹配的 @ 项，用于 string 转 JSON 时判断是否渲染为节点 */
export interface MatchableMentionItem {
	name: string
	path?: string
	/** 是否禁用（达到参考图数量限制时，未选中的文件会被禁用） */
	disabled?: boolean
}

interface ProjectFileData {
	file_id?: string
	file_name?: string
	file_path?: string
	file_extension?: string
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
			parts.push(`@${(node.attrs.data as ProjectFileData).file_name}`)
			return
		}
		if (node.type === "text" && node.text) {
			parts.push(node.text)
			return
		}
		for (const child of node.content ?? []) {
			traverse(child)
		}
	}

	traverse(doc)
	return parts.join("")
}

/**
 * 按 matchableItems 精确匹配 @mention，避免贪婪正则 [^\s@]+ 在中英文混排时误匹配
 * 当 @ 后紧跟 matchableItem.name 时匹配，不要求其后有空格（中文无空格）
 */
function findMentionAt(
	value: string,
	atIndex: number,
	matchableItems: MatchableMentionItem[],
): { matchedItem: MatchableMentionItem; endIndex: number } | null {
	const afterAt = value.slice(atIndex + 1)
	if (!afterAt) return null
	const namesByLength = [...matchableItems].sort((a, b) => b.name.length - a.name.length)
	for (const item of namesByLength) {
		if (item.disabled) continue
		const name = item.name
		const afterAtLower = afterAt.toLowerCase()
		const nameLower = name.toLowerCase()
		if (afterAtLower.startsWith(nameLower)) {
			return { matchedItem: item, endIndex: atIndex + 1 + name.length }
		}
	}
	return null
}

/**
 * 将 string 转为 TipTap JSON 内容
 * @xxx 仅当 xxx 在 matchableItems 中时渲染为 mention 节点
 * 使用 matchableItems 驱动匹配，避免 [^\s@]+ 贪婪匹配中文无空格场景
 */
export function getContentFromString(
	value: string,
	matchableItems: MatchableMentionItem[],
): JSONContent {
	if (!value.trim()) {
		return { type: "doc", content: [{ type: "paragraph" }] }
	}

	const content: JSONContent[] = []
	let i = 0
	while (i < value.length) {
		const atIndex = value.indexOf("@", i)
		if (atIndex === -1) {
			content.push({ type: "text", text: value.slice(i) })
			break
		}
		if (atIndex > i) {
			content.push({ type: "text", text: value.slice(i, atIndex) })
		}
		const match = findMentionAt(value, atIndex, matchableItems)
		if (match) {
			const { matchedItem, endIndex } = match
			const fileName = matchedItem.name
			const path = matchedItem.path
			content.push({
				type: "mention",
				attrs: {
					type: PROJECT_FILE_TYPE,
					data: {
						file_id: path ?? fileName,
						file_name: fileName,
						file_path: path ?? "",
						file_extension: fileName.includes(".")
							? (fileName.split(".").pop() ?? "")
							: "",
					},
				},
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
	const name = fileName ?? path.split("/").pop() ?? ""
	if (!name) return prompt
	const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

	return prompt
		.replace(new RegExp(`@${escaped}`, "gi"), "")
		.replace(/\s+/g, " ")
		.trim()
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
	let i = 0
	while (i < value.length) {
		const atIndex = value.indexOf("@", i)
		if (atIndex === -1) break
		const match = findMentionAt(value, atIndex, matchableItems)
		if (match?.matchedItem.path) {
			paths.add(match.matchedItem.path)
		}
		i = atIndex + 1
	}
	return Array.from(paths)
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
