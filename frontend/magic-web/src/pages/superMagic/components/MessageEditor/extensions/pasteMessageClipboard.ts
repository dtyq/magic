import { restoreWechatChatContent } from "./wechat-chat-history/transform"
import type { Editor, JSONContent } from "@/infrastructure/editors/tiptap/core"
import { DOMParser as ProseMirrorDOMParser } from "prosemirror-model"
import magicToast from "@/components/base/MagicToaster/utils"
import i18n from "i18next"
import type {
	MentionListItem,
	TiptapMentionAttributes,
} from "@/components/business/MentionPanel/tiptap-plugin/types"
import {
	getMentionDisplayName,
	getMentionUniqueId,
} from "@/components/business/MentionPanel/tiptap-plugin/types"
import type {
	DataService,
	DirectoryMentionData,
	ProjectFileMentionData,
} from "@/components/business/MentionPanel/types"
import { MentionItemType } from "@/components/business/MentionPanel/types"
import {
	createDirectoryMentionData,
	createProjectFileMentionData,
} from "@/components/business/MentionPanel/utils/projectReferenceMention"
import {
	findAttachmentByPath,
	normalizeWorkspacePathForComparison,
} from "@/pages/superMagic/utils/markdownFileReference"
import type { AttachmentItem } from "@/pages/superMagic/components/TopicFilesButton/hooks"
import { extractClipboardMetadata, type MagicClipboardMetadata } from "@/utils/clipboard-helpers"
import { runActiveEditor } from "@/utils/tiptapEditorLifecycle"
import { transformInspectorContent } from "./inspector-detail"
import { prepareCopiedMentionAttrs } from "../utils/mention"
import {
	normalizeFileReferenceContent,
	normalizeFileReferenceMention,
} from "@/components/business/MentionPanel/utils/fileReferenceMention"
import { getFileReferenceIdentityKey } from "@/pages/superMagic/services/userFileReferenceResolver"
import { collectMentionItemsFromContent } from "../services/uploadMentionService"
import { getHtmlScreenshotStorageId } from "../services/HtmlScreenshotTargetStore"
import { INSPECTOR_DETAIL_TYPE } from "./inspector-detail/const"
import {
	pasteMarkdownFileLinks,
	replaceWorkspaceLinksInRichText,
	resolveUserLinksInRichText,
	type MarkdownFilePasteOptions,
} from "./pasteMarkdownFileLinks"

export interface PasteMessageClipboardOptions extends MarkdownFilePasteOptions {
	dataService?: DataService | null
}

function findAttachmentByUniqueFileName(
	attachments: AttachmentItem[],
	fileName: string,
): AttachmentItem | undefined {
	const normalizedName = fileName.trim().toLowerCase()
	if (!normalizedName) return undefined

	const matches: AttachmentItem[] = []
	const visit = (items: AttachmentItem[]) => {
		for (const item of items) {
			if (item.children?.length) visit(item.children)
			const candidateName = String(item.file_name || item.filename || item.name || "")
				.trim()
				.toLowerCase()
			if (candidateName === normalizedName && item.file_id) {
				matches.push(item)
			}
		}
	}
	visit(attachments)
	const unique = Array.from(new Set(matches))
	return unique.length === 1 ? unique[0] : undefined
}

function createWorkspaceMention(
	attachments: AttachmentItem[],
	path: string,
): TiptapMentionAttributes | null {
	const file = findAttachmentByPath(attachments, path)
	if (!file?.file_id) return null

	if (file.is_directory || file.type === "directory") {
		return {
			type: MentionItemType.FOLDER,
			data: createDirectoryMentionData(file),
		}
	}

	return {
		type: MentionItemType.PROJECT_FILE,
		data: createProjectFileMentionData(file),
	}
}

/** Canvas 元数据可能只有画布内路径；只在当前编辑器的附件中保留既有恢复规则。 */
function findCanvasAttachmentByPath(
	attachments: AttachmentItem[],
	path: string,
): AttachmentItem | undefined {
	const normalizedSearchPath = normalizeWorkspacePathForComparison(path)
	if (!normalizedSearchPath) return undefined
	const suffixMatches: AttachmentItem[] = []
	const searchBaseName = normalizedSearchPath.split("/").pop() || ""

	const visit = (items: AttachmentItem[]): AttachmentItem | undefined => {
		for (const item of items) {
			if (item.children) {
				const foundInChildren = visit(item.children)
				if (foundInChildren) return foundInChildren
			}
			const candidates = [item.relative_file_path, item.path].filter(
				(value): value is string => Boolean(value),
			)
			for (const candidate of candidates) {
				const normalizedItemPath = normalizeWorkspacePathForComparison(candidate)
				if (!normalizedItemPath) continue
				if (normalizedItemPath === normalizedSearchPath) return item
				if (normalizedItemPath.endsWith(`/${normalizedSearchPath}`)) {
					suffixMatches.push(item)
					break
				}
			}
		}
		return undefined
	}

	const exact = visit(attachments)
	if (exact) return exact

	// Canvas mentions often carry canvas-relative paths (`images/x.png`) while
	// workspace attachments are prefixed (`画布名/images/x.png`). Accept a unique suffix hit.
	const uniqueSuffixMatches = Array.from(new Set(suffixMatches))
	if (uniqueSuffixMatches.length === 1) return uniqueSuffixMatches[0]
	if (uniqueSuffixMatches.length > 1 && searchBaseName) {
		const byBaseName = uniqueSuffixMatches.filter((item) => {
			const name = String(item.file_name || item.filename || item.name || "")
				.trim()
				.toLowerCase()
			return name === searchBaseName.toLowerCase()
		})
		if (byBaseName.length === 1) return byBaseName[0]
	}
	return undefined
}

function resolvePathOnlyWorkspaceMention(
	attrs: TiptapMentionAttributes,
	attachments: AttachmentItem[],
): TiptapMentionAttributes | null {
	if (attrs.type !== MentionItemType.PROJECT_FILE && attrs.type !== MentionItemType.UPLOAD_FILE) {
		return null
	}

	const data = attrs.data as Record<string, unknown> | undefined
	if (!data || data.source_project_id) return null

	const path = String(data.file_path || data.relative_file_path || "").trim()
	const fileName = String(data.file_name || data.filename || "").trim()
	if (path) {
		const byPath = createWorkspaceMention(attachments, path)
		if (byPath) return byPath
	}
	const file =
		(path ? findCanvasAttachmentByPath(attachments, path) : undefined) ??
		(fileName ? findAttachmentByUniqueFileName(attachments, fileName) : undefined)
	if (!file?.file_id) return null
	if (file.is_directory || file.type === "directory") {
		return { type: MentionItemType.FOLDER, data: createDirectoryMentionData(file) }
	}
	return { type: MentionItemType.PROJECT_FILE, data: createProjectFileMentionData(file) }
}

function deduplicateMentions(items: TiptapMentionAttributes[]): TiptapMentionAttributes[] {
	const uniqueIds = new Set<string>()

	return items.filter((item) => {
		const uniqueId = getMentionUniqueId(item)
		if (uniqueIds.has(uniqueId)) return false

		uniqueIds.add(uniqueId)
		return true
	})
}

function prepareMentionAttrs(
	attrs: TiptapMentionAttributes,
	metadata: MagicClipboardMetadata,
	dataService?: DataService | null,
	attachments: AttachmentItem[] = [],
	currentProjectId?: string,
): TiptapMentionAttributes | null {
	const prepared = prepareCopiedMentionAttrs(attrs, metadata.sourceProjectId, dataService)
	if (prepared) return prepared

	const workspaceMention = resolvePathOnlyWorkspaceMention(attrs, attachments)
	if (workspaceMention) {
		return workspaceMention
	}

	const passthroughStructuredMention =
		attrs.type === MentionItemType.PROJECT_FILE ||
		attrs.type === MentionItemType.UPLOAD_FILE ||
		attrs.type === MentionItemType.FOLDER

	if (passthroughStructuredMention) {
		if (attrs.type === MentionItemType.PROJECT_FILE) {
			const fileData = (attrs.data || {}) as ProjectFileMentionData
			const sourceProjectId =
				fileData.source_project_id || fileData.project_id || currentProjectId
			if (sourceProjectId) {
				const structuredSourceFileId =
					fileData.source_file_id &&
					fileData.source_file_id !== fileData.file_path &&
					fileData.source_file_id !== fileData.relative_file_path
						? fileData.source_file_id
						: undefined
				return {
					...attrs,
					data: {
						...fileData,
						source_project_id: sourceProjectId,
						...(structuredSourceFileId
							? { source_file_id: structuredSourceFileId }
							: {}),
					},
				}
			}
		}
		if (attrs.type === MentionItemType.FOLDER) {
			const folderData = (attrs.data || {}) as DirectoryMentionData
			const sourceProjectId =
				folderData.source_project_id || folderData.project_id || currentProjectId
			if (sourceProjectId) {
				return {
					...attrs,
					data: {
						...folderData,
						source_project_id: sourceProjectId,
						source_directory_id:
							folderData.source_directory_id || folderData.directory_id,
					},
				}
			}
		}
		return attrs
	}

	return null
}

function prepareMentionItems(
	mentions: unknown[],
	metadata: MagicClipboardMetadata,
	dataService?: DataService | null,
	attachments: AttachmentItem[] = [],
	currentProjectId?: string,
): TiptapMentionAttributes[] {
	return (mentions as MentionListItem[])
		.map((mention) =>
			prepareMentionAttrs(
				mention.attrs,
				metadata,
				dataService,
				attachments,
				currentProjectId,
			),
		)
		.filter((mention): mention is TiptapMentionAttributes => Boolean(mention))
}

function prepareRichTextContent(
	content: JSONContent,
	metadata: MagicClipboardMetadata,
	dataService?: DataService | null,
	attachments: AttachmentItem[] = [],
	currentProjectId?: string,
): JSONContent {
	if (!content) return content

	let transformedContent = content

	if (content.type === "mention" && content.attrs) {
		const attrs = prepareMentionAttrs(
			content.attrs as TiptapMentionAttributes,
			metadata,
			dataService,
			attachments,
			currentProjectId,
		)
		if (!attrs) {
			const data = content.attrs.data as Record<string, unknown> | undefined
			const fallbackName = String(
				data?.file_name ||
					data?.filename ||
					data?.directory_name ||
					getMentionDisplayName(content.attrs as TiptapMentionAttributes) ||
					"文件",
			).trim()
			return { type: "text", text: `@${fallbackName}` }
		}

		transformedContent = {
			...content,
			attrs,
		}
	}

	if (content.type === INSPECTOR_DETAIL_TYPE && content.attrs) {
		const attrs = { ...content.attrs }
		for (const key of ["fileMention", "screenshotMention"] as const) {
			if (attrs[key]) {
				attrs[key] = prepareMentionAttrs(
					attrs[key] as TiptapMentionAttributes,
					metadata,
					dataService,
					attachments,
					currentProjectId,
				)
			}
		}
		transformedContent = { ...content, attrs }
	}

	if (content.content && Array.isArray(content.content)) {
		const transformedChildren = content.content
			.map((child) =>
				prepareRichTextContent(child, metadata, dataService, attachments, currentProjectId),
			)
			.filter((child) => Object.keys(child).length > 0)

		if (transformedChildren.some((child, index) => child !== content.content?.[index])) {
			transformedContent = {
				...transformedContent,
				content: transformedChildren,
			}
		}
	}

	return transformedContent
}

function pasteFromMagicMetadata(
	editor: Editor,
	metadata: MagicClipboardMetadata,
	attachments: AttachmentItem[],
	options: PasteMessageClipboardOptions,
	selection?: { from: number; to: number },
): boolean {
	const mentions = Array.isArray(metadata.mentions) ? metadata.mentions : null
	const mentionItems = mentions
		? prepareMentionItems(
				mentions,
				metadata,
				options.dataService ?? null,
				attachments,
				options.getCurrentProjectId?.(),
			)
		: []
	const syncMentions = (additionalMentions: TiptapMentionAttributes[] = []) => {
		const contentMentionIds = new Set(additionalMentions.map(getMentionUniqueId))
		const allMentions = deduplicateMentions([
			// 预览截图可随节点复制，但不能仅凭剪贴板元数据进入上传队列。
			...mentionItems.filter(
				(item) =>
					!getHtmlScreenshotStorageId(item) ||
					contentMentionIds.has(getMentionUniqueId(item)),
			),
			...additionalMentions,
		])
		if (allMentions.length > 0) options.onMentionsInsert?.(allMentions)
	}

	if (metadata.richText) {
		try {
			const content = prepareRichTextContent(
				JSON.parse(metadata.richText),
				metadata,
				options.dataService ?? null,
				attachments,
				options.getCurrentProjectId?.(),
			)
			const converted = replaceWorkspaceLinksInRichText(content, attachments)
			const editorContent = restoreWechatChatContent(
				transformInspectorContent(converted.content),
			)
			return (
				runActiveEditor(
					editor,
					(active) => {
						const inserted = selection
							? active.commands.insertContentAt(selection, editorContent)
							: active.commands.insertContent(editorContent)
						if (!inserted) return false
						syncMentions(
							collectMentionItemsFromContent(editorContent).map((item) => item.attrs),
						)
						return true
					},
					false,
				) ?? false
			)
		} catch {
			syncMentions()
		}
	} else {
		syncMentions()
	}

	return false
}

function readFileLinkMetadata(editor: Editor, html: string): MagicClipboardMetadata | null {
	if (!html.includes("data-magic-node-attrs")) return null
	const container = document.createElement("div")
	container.innerHTML = html
	const links = container.querySelectorAll<HTMLElement>(
		'a[data-magic-node-type="mention"][data-magic-node-attrs]',
	)
	if (!links.length) return null
	for (const link of links) {
		if (link.closest("code, pre")) continue
		const span = document.createElement("span")
		span.textContent = link.textContent
		try {
			const attrs: unknown = JSON.parse(link.dataset.magicNodeAttrs || "null")
			if (
				attrs &&
				typeof attrs === "object" &&
				"type" in attrs &&
				"data" in attrs &&
				typeof attrs.type === "string"
			) {
				span.className = "magic-mention"
				span.dataset.type = attrs.type
				span.dataset.data = JSON.stringify(attrs.data)
			}
		} catch {
			// 损坏的身份只保留文字，不能将其退回当前用户的同名路径查询。
		}
		link.replaceWith(span)
	}
	return {
		richText: JSON.stringify(
			ProseMirrorDOMParser.fromSchema(editor.schema).parse(container).toJSON(),
		),
	}
}

/**
 * SuperMagic paste contract:
 * 1. Structured magic metadata → insert mentions
 * 2. Otherwise portable HTML / markdown rematch against workspace attachments
 * Never leave a magic-marked clipboard to the browser's text/plain default.
 */
export function pasteMessageClipboard(
	editor: Editor,
	clipboardData: DataTransfer,
	options: PasteMessageClipboardOptions,
): boolean {
	// 显式注入的空列表也属于当前作用域，不能改用另一个项目的全局列表。
	const attachments = options.getWorkspaceFilesList?.() ?? []

	const metadata =
		extractClipboardMetadata(clipboardData) ??
		readFileLinkMetadata(editor, clipboardData.getData("text/html"))
	if (!metadata) {
		return pasteMarkdownFileLinks(editor, clipboardData, options)
	}

	const initialDoc = editor.state.doc
	const selection = { from: editor.state.selection.from, to: editor.state.selection.to }
	const projectId = options.getCurrentProjectId?.()
	const identity = getFileReferenceIdentityKey()
	const fallback = clipboardData.getData("text/plain")
	void (async () => {
		try {
			let unavailableReference = false
			const [richText, mentions] = await Promise.all([
				metadata.richText
					? normalizeFileReferenceContent(JSON.parse(metadata.richText) as JSONContent, {
							onUnavailable: () => {
								unavailableReference = true
							},
						})
							.then((content) => resolveUserLinksInRichText(content, attachments))
							.then((content) => JSON.stringify(content))
					: undefined,
				Promise.all(
					((metadata.mentions ?? []) as MentionListItem[]).map(async (item) => {
						const attrs = await normalizeFileReferenceMention(item.attrs)
						if (!attrs) unavailableReference = true
						return attrs ? { ...item, attrs } : null
					}),
				).then((items) => items.filter((item) => item !== null)),
			])
			if (
				identity !== getFileReferenceIdentityKey() ||
				projectId !== options.getCurrentProjectId?.()
			)
				return
			if (unavailableReference)
				magicToast.error(i18n.t("super:common.fileNotFoundOrLoadFailed"))
			runActiveEditor(editor, (active) => {
				if (!initialDoc.eq(active.state.doc)) {
					active.commands.insertContent({ type: "text", text: fallback })
					return
				}
				if (
					!pasteFromMagicMetadata(
						active,
						{ ...metadata, richText, mentions },
						attachments,
						options,
						selection,
					)
				)
					active.commands.insertContentAt(selection, { type: "text", text: fallback })
			})
		} catch (error) {
			console.warn("File references in clipboard could not be resolved", error)
			if (
				identity !== getFileReferenceIdentityKey() ||
				projectId !== options.getCurrentProjectId?.()
			)
				return
			runActiveEditor(editor, (active) => {
				if (initialDoc.eq(active.state.doc))
					active.commands.insertContentAt(selection, { type: "text", text: fallback })
				else active.commands.insertContent({ type: "text", text: fallback })
			})
		}
	})()
	return true
}
