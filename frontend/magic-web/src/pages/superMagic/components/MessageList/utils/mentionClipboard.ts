import {
	restoreWechatChatContent,
	serializeWechatChatContent,
} from "@/pages/superMagic/components/MessageEditor/extensions/wechat-chat-history/transform"
import { WECHAT_CHAT_HISTORY } from "@/pages/superMagic/components/MessageEditor/extensions/wechat-chat-history/types"
import { encodeSelectionText } from "@/pages/superMagic/components/MessageEditor/extensions/inspector-detail/serialization"
import type { JSONContent } from "@/infrastructure/editors/tiptap/core"
import {
	MentionItemType,
	type DirectoryMentionData,
	type ProjectFileMentionData,
	type UploadFileMentionData,
} from "@/components/business/MentionPanel/types"
import {
	getMentionDisplayName,
	getMentionUniqueId,
	type TiptapMentionAttributes,
} from "@/components/business/MentionPanel/tiptap-plugin/types"
import {
	createCanonicalWorkspaceHref,
	createReferencedProjectHref,
	createUserFileHref,
	isValidProjectReferenceId,
	escapeHtmlText,
	escapeMarkdownLinkLabel,
	normalizeWorkspacePathForComparison,
} from "@/pages/superMagic/utils/filePathMention"
import { INSPECTOR_DETAIL_TYPE } from "@/pages/superMagic/components/MessageEditor/extensions/inspector-detail/const"
import {
	serializeInspectorContent,
	transformInspectorContent,
} from "@/pages/superMagic/components/MessageEditor/extensions/inspector-detail/transform"
import type { AttachmentItem } from "@/pages/superMagic/components/TopicFilesButton/hooks"

function getWorkspaceResourceId(attrs: TiptapMentionAttributes): string | undefined {
	if (attrs.type === MentionItemType.FOLDER) {
		return (attrs.data as DirectoryMentionData).directory_id
	}
	if (attrs.type === MentionItemType.PROJECT_FILE || attrs.type === MentionItemType.UPLOAD_FILE) {
		return (attrs.data as ProjectFileMentionData | UploadFileMentionData).file_id
	}
	return undefined
}

function getWorkspaceResourcePath(attrs: TiptapMentionAttributes): string {
	if (attrs.type === MentionItemType.FOLDER) {
		return (
			normalizeWorkspacePathForComparison(
				(attrs.data as DirectoryMentionData).directory_path || "",
			) || ""
		)
	}
	if (attrs.type === MentionItemType.PROJECT_FILE || attrs.type === MentionItemType.UPLOAD_FILE) {
		const data = attrs.data as ProjectFileMentionData | UploadFileMentionData
		return (
			normalizeWorkspacePathForComparison(data.relative_file_path || "") ||
			data.file_path ||
			""
		)
	}
	return ""
}

function findWorkspaceResource(
	attrs: TiptapMentionAttributes,
	workspaceFiles: ReadonlyArray<AttachmentItem>,
): AttachmentItem | undefined {
	const resourceId = getWorkspaceResourceId(attrs)
	if (!resourceId) return undefined

	return workspaceFiles.find(
		(item) => item.file_id !== undefined && String(item.file_id) === String(resourceId),
	)
}

function isPendingUpload(attrs: TiptapMentionAttributes): boolean {
	if (attrs.type !== MentionItemType.UPLOAD_FILE) return false

	const status = (attrs.data as UploadFileMentionData).upload_status
	return status === "init" || status === "uploading" || status === "error"
}

function isWorkspaceFileMention(attrs: TiptapMentionAttributes): boolean {
	return (
		attrs.type === MentionItemType.USER_FILE ||
		attrs.type === MentionItemType.USER_DIRECTORY ||
		attrs.type === MentionItemType.MEMORY_FILE ||
		attrs.type === MentionItemType.MEMORY_DIRECTORY ||
		attrs.type === MentionItemType.FOLDER ||
		attrs.type === MentionItemType.PROJECT_FILE ||
		attrs.type === MentionItemType.UPLOAD_FILE
	)
}

function getReferencedProjectId(
	attrs: TiptapMentionAttributes,
	currentProjectId?: string,
): string | null {
	if (attrs.type !== MentionItemType.PROJECT_FILE) return null

	const data = attrs.data as ProjectFileMentionData
	const sourceProjectId = String(data.source_project_id || data.project_id || "").trim()
	if (!isValidProjectReferenceId(sourceProjectId)) return null
	if (currentProjectId && sourceProjectId === String(currentProjectId)) return null
	if (!currentProjectId && !data.source_project_id) return null
	return sourceProjectId
}

/**
 * 历史 Mention 未持久化路径时，从当前工作区文件列表补全路径。
 * 消息渲染也使用这份列表解析文件信息和图标。
 */
export function resolveMentionForClipboard(
	attrs: TiptapMentionAttributes,
	workspaceFiles: ReadonlyArray<AttachmentItem> = [],
	currentProjectId?: string,
): TiptapMentionAttributes {
	if (
		attrs.type !== MentionItemType.FOLDER &&
		attrs.type !== MentionItemType.PROJECT_FILE &&
		attrs.type !== MentionItemType.UPLOAD_FILE
	) {
		return attrs
	}

	const referencedProjectId = getReferencedProjectId(attrs, currentProjectId)
	const workspaceResource = referencedProjectId
		? undefined
		: findWorkspaceResource(attrs, workspaceFiles)
	// 文件接口中的前导 / 表示项目根，不是沙盒绝对路径。
	const workspacePath = normalizeWorkspacePathForComparison(
		workspaceResource?.relative_file_path || workspaceResource?.path || "",
	)
	const mentionPath =
		attrs.type === MentionItemType.PROJECT_FILE && referencedProjectId
			? (attrs.data as ProjectFileMentionData).file_path ||
				(attrs.data as ProjectFileMentionData).relative_file_path ||
				""
			: getWorkspaceResourcePath(attrs)
	const path = workspacePath || mentionPath
	if (!path) return attrs

	if (attrs.type === MentionItemType.FOLDER) {
		const data = attrs.data as DirectoryMentionData
		if (data.directory_path === path) return attrs
		return {
			...attrs,
			data: { ...data, directory_path: path } as TiptapMentionAttributes["data"],
		}
	}

	const data = attrs.data as ProjectFileMentionData | UploadFileMentionData
	if (attrs.type === MentionItemType.UPLOAD_FILE) {
		const uploadData = data as UploadFileMentionData
		// 画布附件保留对象存储身份，不能因工作区存在同 ID 就改成项目引用。
		if (uploadData.is_canvas_clipboard) return attrs
		if (!workspaceResource || isPendingUpload(attrs) || workspaceResource.is_directory) {
			return {
				...attrs,
				data: {
					...uploadData,
					relative_file_path: path,
					file_path: path,
				} as TiptapMentionAttributes["data"],
			}
		}

		return {
			type: MentionItemType.PROJECT_FILE,
			data: {
				file_id: uploadData.file_id,
				file_name:
					uploadData.file_name ||
					workspaceResource?.file_name ||
					workspaceResource?.name ||
					"",
				file_path: path,
				relative_file_path: path,
				file_extension:
					uploadData.file_extension || workspaceResource?.file_extension || "",
				file_size: uploadData.file_size ?? workspaceResource?.file_size,
				project_id: workspaceResource?.project_id,
				is_hidden: uploadData.is_hidden ?? workspaceResource?.is_hidden,
			},
		}
	}

	if (data.relative_file_path === path && data.file_path === path) return attrs
	return {
		...attrs,
		data: {
			...data,
			relative_file_path: path,
			file_path: path,
		} as TiptapMentionAttributes["data"],
	}
}

/** 递归补全复制内容中的 Mention，确保内部剪贴板元数据也能恢复文件引用。 */
export function resolveClipboardContent(
	content: JSONContent,
	workspaceFiles: ReadonlyArray<AttachmentItem> = [],
	currentProjectId?: string,
): JSONContent {
	if (!content) return content

	let resolvedContent = content
	if (content.type === "mention" && content.attrs) {
		const attrs = content.attrs as TiptapMentionAttributes
		const resolvedAttrs = resolveMentionForClipboard(attrs, workspaceFiles, currentProjectId)
		if (resolvedAttrs !== attrs) {
			resolvedContent = { ...resolvedContent, attrs: resolvedAttrs }
		}
	}

	if (content.type === INSPECTOR_DETAIL_TYPE && content.attrs) {
		for (const key of ["fileMention", "screenshotMention"] as const) {
			const attrs = content.attrs[key] as TiptapMentionAttributes | undefined
			if (!attrs) continue
			const resolvedAttrs = resolveMentionForClipboard(
				attrs,
				workspaceFiles,
				currentProjectId,
			)
			if (resolvedAttrs !== attrs) {
				resolvedContent = {
					...resolvedContent,
					attrs: { ...resolvedContent.attrs, [key]: resolvedAttrs },
				}
			}
		}
	}

	if (Array.isArray(content.content)) {
		const resolvedChildren = content.content.map((child) =>
			resolveClipboardContent(child, workspaceFiles, currentProjectId),
		)
		if (resolvedChildren.some((child, index) => child !== content.content?.[index])) {
			resolvedContent = { ...resolvedContent, content: resolvedChildren }
		}
	}

	return resolvedContent
}

export interface MentionClipboardRepresentation {
	plainText: string
	htmlContent: string
}

export function getMentionClipboardRepresentation(
	attrs: TiptapMentionAttributes,
	workspaceFiles: ReadonlyArray<AttachmentItem> = [],
	currentProjectId?: string,
): MentionClipboardRepresentation | null {
	if (attrs.pending === true || (attrs.data as Record<string, unknown>)?.pending === true) {
		return null
	}
	const resolvedAttrs = resolveMentionForClipboard(attrs, workspaceFiles, currentProjectId)
	if (
		resolvedAttrs.type === MentionItemType.PROJECT_FILE ||
		resolvedAttrs.type === MentionItemType.FOLDER
	) {
		const data = resolvedAttrs.data as ProjectFileMentionData | DirectoryMentionData
		if (data.project_id === "0" || data.source_project_id === "0") return null
	}
	let path = ""
	let label = ""
	let referencedProjectId: string | null = null
	const userDirectory =
		resolvedAttrs.type === MentionItemType.USER_DIRECTORY ||
		resolvedAttrs.type === MentionItemType.MEMORY_DIRECTORY
	const userFile =
		resolvedAttrs.type === MentionItemType.USER_FILE ||
		resolvedAttrs.type === MentionItemType.MEMORY_FILE

	if (userDirectory) {
		const data = resolvedAttrs.data as { directory_path: string; directory_name: string }
		path = data.directory_path
		label = data.directory_name
	} else if (userFile) {
		const data = resolvedAttrs.data as { file_path: string; file_name: string }
		path = data.file_path
		label = data.file_name
	} else if (resolvedAttrs.type === MentionItemType.FOLDER) {
		const data = resolvedAttrs.data as DirectoryMentionData
		path = data.directory_path
		label = data.directory_name?.trim() || ""
	} else if (
		resolvedAttrs.type === MentionItemType.PROJECT_FILE ||
		resolvedAttrs.type === MentionItemType.UPLOAD_FILE
	) {
		const data = resolvedAttrs.data as ProjectFileMentionData | UploadFileMentionData
		path = data.relative_file_path || data.file_path || ""
		label = data.file_name?.trim() || ""
		referencedProjectId = getReferencedProjectId(resolvedAttrs, currentProjectId)
	} else {
		return null
	}

	const href =
		userFile || userDirectory
			? path.startsWith("~/")
				? createUserFileHref(path, userDirectory)
				: null
			: referencedProjectId
				? createReferencedProjectHref(referencedProjectId, path)
				: createCanonicalWorkspaceHref(path)
	if (!href || !label) return null
	const markdownDestination = href.includes(" ") ? `<${href}>` : href

	return {
		plainText: `[${escapeMarkdownLinkLabel(label)}](${markdownDestination})`,
		htmlContent: `<a href="${escapeHtmlText(href)}">${escapeHtmlText(label)}</a>`,
	}
}

function collectMentionIds(content: JSONContent, ids: Set<string>): void {
	if (content.type === "mention" && content.attrs) {
		ids.add(getMentionUniqueId(content.attrs as TiptapMentionAttributes))
	}

	if (content.type === INSPECTOR_DETAIL_TYPE && content.attrs) {
		for (const key of ["fileMention", "screenshotMention"] as const) {
			if (content.attrs[key])
				ids.add(getMentionUniqueId(content.attrs[key] as TiptapMentionAttributes))
		}
	}

	content.content?.forEach((child) => collectMentionIds(child, ids))
}

/** Add external attachment mentions to a copied document when they are rendered outside its JSON. */
export function prependPortableMentions(
	content: JSONContent,
	mentionAttrs: TiptapMentionAttributes[],
	workspaceFiles: ReadonlyArray<AttachmentItem> = [],
	currentProjectId?: string,
): JSONContent {
	const resolvedContent = resolveClipboardContent(content, workspaceFiles, currentProjectId)
	const existingIds = new Set<string>()
	collectMentionIds(resolvedContent, existingIds)

	const missingMentions = mentionAttrs
		.map((attrs) => resolveMentionForClipboard(attrs, workspaceFiles, currentProjectId))
		.filter(isWorkspaceFileMention)
		.filter((attrs) => {
			const id = getMentionUniqueId(attrs)
			if (existingIds.has(id)) return false

			existingIds.add(id)
			return true
		})
	if (missingMentions.length === 0) return resolvedContent

	return {
		...resolvedContent,
		content: [
			{
				type: "paragraph",
				content: missingMentions.map((attrs) => ({ type: "mention", attrs })),
			},
			...(resolvedContent.content || []),
		],
	}
}

export function getClipboardPlainText(
	content: JSONContent,
	workspaceFiles: ReadonlyArray<AttachmentItem> = [],
	currentProjectId?: string,
): string {
	function serialize(node: JSONContent, inSelection = false): string {
		if (node.type === "text") return node.text || ""

		if (node.type === "mention" && node.attrs) {
			const attrs = node.attrs as TiptapMentionAttributes
			if (
				attrs.pending === true ||
				(attrs.data as Record<string, unknown>)?.pending === true
			) {
				return ""
			}
			const portable = getMentionClipboardRepresentation(
				attrs,
				workspaceFiles,
				currentProjectId,
			)
			const displayName = getMentionDisplayName(attrs)
			const suffix = attrs.type === MentionItemType.FOLDER ? "/" : ""
			const fallback = isWorkspaceFileMention(attrs)
				? `${displayName}${suffix}`
				: `@${displayName}${suffix}`
			return inSelection
				? encodeSelectionText(portable?.plainText || fallback)
				: ` ${portable?.plainText || fallback} `
		}

		if (node.type === "super-placeholder") {
			const props = node.attrs?.props as Record<string, unknown> | undefined
			return String(props?.value || props?.defaultValue || props?.placeholder || "")
		}

		if (node.type === WECHAT_CHAT_HISTORY) {
			return (
				serializeWechatChatContent({ type: "doc", content: [node] })
					.content?.map((child) => serialize(child, inSelection))
					.join("") ?? ""
			)
		}

		if (node.type === INSPECTOR_DETAIL_TYPE) {
			return (
				serializeInspectorContent({ type: "doc", content: [node] })
					.content?.map((child) => serialize(child, true))
					.join("") ?? ""
			)
		}

		if (node.type === "hardBreak" || node.type === "hard_break") return "\n"

		const childText = node.content?.map((child) => serialize(child, inSelection)).join("") || ""
		return node.type === "paragraph" ? `${childText}\n` : childText
	}

	return serialize(restoreWechatChatContent(transformInspectorContent(content))).replace(
		/\n$/,
		"",
	)
}

export function getClipboardHtml(
	htmlContent: string,
	workspaceFiles: ReadonlyArray<AttachmentItem> = [],
	currentProjectId?: string,
): string {
	const container = document.createElement("div")
	container.innerHTML = htmlContent
	// HTML 的元素卡片占位文案不能替代详情；外部编辑器也应获得文件链接与完整描述。
	container
		.querySelectorAll<HTMLElement>(`[data-type="${INSPECTOR_DETAIL_TYPE}"]`)
		.forEach((element) => {
			const attrs: Record<string, unknown> = {}
			for (const [key, value] of Object.entries(element.dataset)) {
				if (key === "type") continue
				if (
					key === "fileMention" ||
					key === "screenshotMention" ||
					key === "markdownSource"
				) {
					try {
						attrs[key] = JSON.parse(value || "null")
					} catch {
						attrs[key] = null
					}
				} else if (key === "selectorMatchCount" || key === "styleCount") {
					attrs[key] = Number(value)
				} else {
					attrs[key] = value
				}
			}
			const details = serializeInspectorContent({
				type: "doc",
				content: [{ type: INSPECTOR_DETAIL_TYPE, attrs }],
			})
			const replacement = document.createElement("span")
			details.content?.forEach((node) => {
				if (node.type === "mention" && node.attrs) {
					const mention = node.attrs as TiptapMentionAttributes
					const portable = getMentionClipboardRepresentation(
						mention,
						workspaceFiles,
						currentProjectId,
					)
					if (portable) replacement.insertAdjacentHTML("beforeend", portable.htmlContent)
					else replacement.append(document.createTextNode(getMentionDisplayName(mention)))
				} else if (node.text) replacement.append(document.createTextNode(node.text))
			})
			element.replaceWith(replacement)
		})

	container.querySelectorAll<HTMLElement>("span.magic-mention").forEach((element) => {
		const type = element.dataset.type
		const data = element.dataset.data
		if (!type || !data) return

		try {
			const attrs: TiptapMentionAttributes = {
				type: type as TiptapMentionAttributes["type"],
				data: JSON.parse(data) as TiptapMentionAttributes["data"],
			}
			if ((attrs.data as Record<string, unknown>)?.pending === true) {
				element.remove()
				return
			}
			const portable = getMentionClipboardRepresentation(
				attrs,
				workspaceFiles,
				currentProjectId,
			)
			if (!portable) {
				if (isWorkspaceFileMention(attrs)) {
					element.replaceWith(document.createTextNode(getMentionDisplayName(attrs)))
				}
				return
			}

			const replacement = document.createElement("span")
			replacement.innerHTML = portable.htmlContent
			const link = replacement.firstElementChild
			if (!link) return
			element.replaceWith(document.createTextNode(" "), link, document.createTextNode(" "))
		} catch {
			// 无法还原 attrs 时保留原 mention HTML，内部剪贴板元数据仍可继续使用。
		}
	})

	return container.innerHTML
}

export type {
	MessageClipboardMetadata,
	MessageClipboardMentionItem,
	MessageClipboardPayload,
} from "@/utils/messageClipboardSerializer"
