import type { FileReference } from "@/apis/modules/superMagic"
import type { JSONContent } from "@/infrastructure/editors/tiptap/core"
import { INSPECTOR_DETAIL_TYPE } from "@/pages/superMagic/components/MessageEditor/extensions/inspector-detail/const"
import type { TiptapMentionAttributes } from "../tiptap-plugin/types"
import {
	MentionItemType,
	type ProjectFileMentionData,
	type UserFileReferenceMention,
} from "../types"
import { resolveFileReference } from "@/pages/superMagic/services/userFileReferenceResolver"
import {
	getFileDisplayPath,
	isValidProjectReferenceId,
} from "@/pages/superMagic/utils/markdownFileReference"
import {
	createDirectoryMentionData,
	createProjectFileMentionData,
	resolveFolderWorkspaceEntryFromProjectFile,
} from "./projectReferenceMention"

export type FileReferenceSource = Parameters<typeof createProjectFileMentionData>[0] & {
	file_reference?: FileReference
	space_type?: FileReference["space_type"]
}

type ProjectFolderLookup = Parameters<typeof resolveFolderWorkspaceEntryFromProjectFile>[1]

export function createUserFileMention(
	reference: Extract<FileReference, { space_type: "user" }>,
): UserFileReferenceMention {
	const path = getFileDisplayPath({ file_reference: reference })
	if (reference.is_directory) {
		return {
			type: MentionItemType.USER_DIRECTORY,
			data: {
				directory_id: reference.file_id,
				directory_name: reference.file_name,
				directory_path: path.endsWith("/") ? path : path + "/",
			},
		}
	}
	return {
		type: MentionItemType.USER_FILE,
		data: {
			file_id: reference.file_id,
			file_name: reference.file_name,
			file_extension: reference.file_extension,
			file_path: path,
		},
	}
}

/** 空间决定引用身份，项目内的 PPT、画布与自定义入口仍交给原有规则。 */
export async function createFileReferenceMention(
	file: FileReferenceSource,
	options?: ProjectFolderLookup,
	signal?: AbortSignal,
): Promise<TiptapMentionAttributes | null> {
	const id = String(file.file_id ?? "")
	let reference = file.file_reference?.file_id === id ? file.file_reference : undefined
	// 项目 ID 不能代替文件路径；缺路径时按真实文件 ID 读取，不能生成只有名称的引用。
	if (
		!reference &&
		(file.space_type === "user" ||
			!isValidProjectReferenceId(file.project_id) ||
			!file.relative_file_path)
	) {
		if (!isValidProjectReferenceId(id)) return null
		const result = await resolveFileReference({ file_id: id }, signal)
		if (result.status !== "resolved") return null
		reference = result.reference
	}
	if (reference?.space_type === "user") return createUserFileMention(reference)

	const projectFile = reference
		? { ...file, ...reference, relative_file_path: reference.space_relative_path }
		: file
	const folder = options ? resolveFolderWorkspaceEntryFromProjectFile(projectFile, options) : null
	if (
		folder ||
		projectFile.is_directory ||
		projectFile.type === "directory" ||
		projectFile.relative_file_path?.endsWith("/") ||
		projectFile.display_config?.type === "design"
	) {
		return {
			type: MentionItemType.FOLDER,
			data: {
				...createDirectoryMentionData(folder ?? projectFile),
				...(projectFile.project_id ? { project_id: projectFile.project_id } : {}),
			},
		}
	}
	return { type: MentionItemType.PROJECT_FILE, data: createProjectFileMentionData(projectFile) }
}

export function needsFileReferenceNormalization(attrs: TiptapMentionAttributes): boolean {
	if (
		attrs.type === MentionItemType.USER_FILE ||
		attrs.type === MentionItemType.USER_DIRECTORY ||
		attrs.type === MentionItemType.MEMORY_FILE ||
		attrs.type === MentionItemType.MEMORY_DIRECTORY
	)
		return true
	if (attrs.type !== MentionItemType.PROJECT_FILE && attrs.type !== MentionItemType.FOLDER)
		return false
	const data = attrs.data as { project_id?: string; source_project_id?: string } | undefined
	return (
		data?.project_id === "0" ||
		data?.source_project_id === "0" ||
		(attrs.type === MentionItemType.PROJECT_FILE &&
			!(attrs.data as ProjectFileMentionData | undefined)?.file_path)
	)
}

/** 历史富引用以原始 ID 复核，禁止改用当前用户的同名路径。 */
export async function normalizeFileReferenceMention(
	attrs: TiptapMentionAttributes,
	signal?: AbortSignal,
): Promise<TiptapMentionAttributes | null> {
	if (!needsFileReferenceNormalization(attrs)) return attrs
	if (attrs.type === MentionItemType.PROJECT_FILE) {
		const data = attrs.data as ProjectFileMentionData
		// 仅补同一项目引用已有的路径；个人空间旧引用仍须按原 ID 复核身份。
		if (
			data.project_id !== "0" &&
			data.source_project_id !== "0" &&
			!data.file_path &&
			data.relative_file_path
		) {
			return { ...attrs, data: { ...data, file_path: data.relative_file_path } }
		}
	}
	const data = attrs.data as { file_id?: string; directory_id?: string } | undefined
	const id = data?.file_id || data?.directory_id
	if (!isValidProjectReferenceId(id)) return null
	const result = await resolveFileReference({ file_id: id }, signal)
	if (result.status !== "resolved") return null
	const normalized = await createFileReferenceMention(
		{
			...result.reference,
			file_reference: result.reference,
		},
		undefined,
		signal,
	)
	// 补缺路径不丢掉跨项目复制的来源及待处理属性；空间转换沿用原有规范化结果。
	return attrs.type === MentionItemType.PROJECT_FILE &&
		(attrs.data as ProjectFileMentionData).project_id !== "0" &&
		(attrs.data as ProjectFileMentionData).source_project_id !== "0" &&
		normalized?.type === MentionItemType.PROJECT_FILE
		? { ...attrs, ...normalized, data: { ...attrs.data, ...normalized.data } }
		: normalized
}

/** 只遍历当前消息文档；失败时保留文字，发送前可要求中止。 */
export async function normalizeFileReferenceContent(
	content: JSONContent,
	options: { strict?: boolean; signal?: AbortSignal; onUnavailable?: () => void } = {},
): Promise<JSONContent> {
	let result = content
	if (content.type === "mention" && content.attrs) {
		const original = content.attrs as TiptapMentionAttributes
		const attrs = await normalizeFileReferenceMention(original, options.signal)
		if (!attrs) {
			if (options.strict) throw new Error("File reference is unavailable")
			options.onUnavailable?.()
			const data = original.data as Record<string, unknown> | undefined
			return {
				type: "text",
				text: String(
					data?.file_path ||
						data?.directory_path ||
						data?.file_name ||
						data?.directory_name ||
						"",
				),
			}
		}
		if (attrs !== original) result = { ...content, attrs }
	}
	if (content.type === INSPECTOR_DETAIL_TYPE && content.attrs) {
		const attrs = { ...content.attrs }
		for (const key of ["fileMention", "screenshotMention"] as const) {
			if (!attrs[key]) continue
			attrs[key] = await normalizeFileReferenceMention(
				attrs[key] as TiptapMentionAttributes,
				options.signal,
			)
			if (!attrs[key] && options.strict) throw new Error("File reference is unavailable")
			if (!attrs[key]) options.onUnavailable?.()
		}
		result = { ...result, attrs }
	}
	if (content.content) {
		const children = await Promise.all(
			content.content.map((child) => normalizeFileReferenceContent(child, options)),
		)
		if (children.some((child, index) => child !== content.content?.[index]))
			result = { ...result, content: children }
	}
	return result
}
