import { SuperMagicApi } from "@/apis"
import type { JSONContent } from "@/infrastructure/editors/tiptap/core"
import {
	MentionItemType,
	type DirectoryMentionData,
	type ProjectFileMentionData,
	type UploadFileMentionData,
} from "@/components/business/MentionPanel/types"
import type { TiptapMentionAttributes } from "@/components/business/MentionPanel/tiptap-plugin/types"
import type { FileInfo } from "@/pages/superMagic/pages/Workspace/types"
import type { AttachmentItem } from "@/pages/superMagic/components/TopicFilesButton/hooks"
import { INSPECTOR_DETAIL_TYPE } from "@/pages/superMagic/components/MessageEditor/extensions/inspector-detail/const"
import { normalizeWorkspacePathForComparison } from "@/pages/superMagic/utils/filePathMention"
import { getMentionClipboardRepresentation, resolveMentionForClipboard } from "./mentionClipboard"

interface ResolvedClipboardFiles {
	content: JSONContent
	mentions: TiptapMentionAttributes[]
}

/** 只补本次复制缺少的路径，不修改消息、文件树或附件上传状态。 */
export async function resolveClipboardFilePaths(
	content: JSONContent,
	mentions: TiptapMentionAttributes[],
	workspaceFiles: ReadonlyArray<AttachmentItem>,
	currentProjectId?: string,
): Promise<ResolvedClipboardFiles> {
	const requests = new Map<string, Promise<FileInfo | null>>()

	async function resolveMention(
		attrs: TiptapMentionAttributes,
	): Promise<TiptapMentionAttributes> {
		if (
			attrs.type !== MentionItemType.PROJECT_FILE &&
			attrs.type !== MentionItemType.UPLOAD_FILE &&
			attrs.type !== MentionItemType.FOLDER
		) {
			return attrs
		}
		const data = attrs.data as
			| ProjectFileMentionData
			| UploadFileMentionData
			| DirectoryMentionData
		// 本地元素截图不是服务器文件；也不查询尚未完成的上传。
		if (attrs.pending || ("storage_id" in data && data.storage_id)) return attrs
		if ("is_html_screenshot" in data && data.is_html_screenshot) return attrs
		if ("upload_status" in data && data.upload_status && data.upload_status !== "done") {
			return attrs
		}
		const resolvedAttrs = resolveMentionForClipboard(attrs, workspaceFiles, currentProjectId)
		const uploadWithoutPath =
			attrs.type === MentionItemType.UPLOAD_FILE &&
			resolvedAttrs.type === MentionItemType.UPLOAD_FILE &&
			!(data as UploadFileMentionData).relative_file_path
		if (
			!uploadWithoutPath &&
			getMentionClipboardRepresentation(resolvedAttrs, [], currentProjectId)
		) {
			return resolvedAttrs
		}

		const fileId = String(
			attrs.type === MentionItemType.FOLDER
				? (data as DirectoryMentionData).directory_id || ""
				: (data as ProjectFileMentionData | UploadFileMentionData).file_id || "",
		)
		// 文件接口接收整数 ID，客户端临时上传 ID 不能用于查询。
		if (!/^\d+$/.test(fileId)) return attrs
		let request = requests.get(fileId)
		if (!request) {
			request = SuperMagicApi.getFileInfo(
				{ file_id: fileId },
				{ enableErrorMessagePrompt: false },
			).catch((error: unknown) => {
				console.warn("[clipboard] Failed to resolve file path", { fileId, error })
				return null
			})
			requests.set(fileId, request)
		}
		const file = await request
		const path = normalizeWorkspacePathForComparison(file?.relative_file_path || "")
		if (!path) {
			return attrs
		}
		return {
			...attrs,
			data: {
				...data,
				...(attrs.type === MentionItemType.FOLDER
					? { directory_path: path }
					: {
							relative_file_path: path,
							file_path: path,
						}),
			},
		}
	}

	async function resolveNode(node: JSONContent): Promise<JSONContent> {
		let attrs = node.attrs
		if (node.type === "mention" && attrs) {
			attrs = await resolveMention(attrs as TiptapMentionAttributes)
		} else if (node.type === INSPECTOR_DETAIL_TYPE && attrs?.fileMention) {
			attrs = {
				...attrs,
				fileMention: await resolveMention(attrs.fileMention as TiptapMentionAttributes),
			}
		}
		return {
			...node,
			...(attrs ? { attrs } : {}),
			...(node.content ? { content: await Promise.all(node.content.map(resolveNode)) } : {}),
		}
	}

	const [resolvedContent, resolvedMentions] = await Promise.all([
		resolveNode(content),
		Promise.all(mentions.map(resolveMention)),
	])
	return { content: resolvedContent, mentions: resolvedMentions }
}
