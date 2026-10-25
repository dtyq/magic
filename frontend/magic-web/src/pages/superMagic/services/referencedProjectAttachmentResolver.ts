import type { AttachmentItem } from "@/pages/superMagic/components/TopicFilesButton/hooks"
import {
	normalizeWorkspacePathForComparison,
	type MarkdownFileTarget,
} from "@/pages/superMagic/utils/filePathMention"
import { loadProjectAttachments } from "./projectAttachmentsLoader"

export type ReferencedProjectFileTarget = Extract<
	MarkdownFileTarget,
	{ scope: "referenced-project" }
>

export interface ReferencedProjectAttachment extends AttachmentItem {
	project_id: string
	relative_file_path: string
}

type AttachmentPathIndex = ReadonlyMap<string, AttachmentItem | null>

const attachmentIndexPromises = new Map<string, Promise<AttachmentPathIndex>>()

function buildAttachmentPathIndex(attachments: AttachmentItem[]): AttachmentPathIndex {
	const index = new Map<string, AttachmentItem | null>()

	for (const attachment of attachments) {
		const normalizedPath = normalizeWorkspacePathForComparison(
			attachment.relative_file_path || attachment.path || "",
		)
		if (!normalizedPath) continue

		if (!index.has(normalizedPath)) {
			index.set(normalizedPath, attachment)
			continue
		}

		const existing = index.get(normalizedPath)
		if (!existing) continue
		if (String(existing.file_id || "") !== String(attachment.file_id || "")) {
			index.set(normalizedPath, null)
		}
	}

	return index
}

function loadAttachmentPathIndex(projectId: string): Promise<AttachmentPathIndex> {
	const cachedPromise = attachmentIndexPromises.get(projectId)
	if (cachedPromise) return cachedPromise

	const request = loadProjectAttachments({
		projectId,
		includeHidden: true,
		enableErrorMessagePrompt: false,
	})
		.then((result) => buildAttachmentPathIndex(result.list))
		.catch((error: unknown) => {
			// 失败请求不进入长期缓存，下一次渲染或粘贴仍可重新加载。
			attachmentIndexPromises.delete(projectId)
			throw error
		})

	attachmentIndexPromises.set(projectId, request)
	return request
}

function warnResolutionFailure(
	target: ReferencedProjectFileTarget,
	reason: "load-error" | "not-found" | "ambiguous" | "directory",
	error?: unknown,
): void {
	console.warn("Referenced project file could not be resolved", {
		projectId: target.projectId,
		relativePath: target.relativePath,
		reason,
		...(error instanceof Error ? { error: error.message } : {}),
	})
}

export async function resolveReferencedProjectAttachment(
	target: ReferencedProjectFileTarget,
): Promise<ReferencedProjectAttachment | null> {
	const normalizedPath = normalizeWorkspacePathForComparison(target.relativePath)
	if (!normalizedPath) {
		warnResolutionFailure(target, "not-found")
		return null
	}

	try {
		const index = await loadAttachmentPathIndex(target.projectId)
		const attachment = index.get(normalizedPath)
		if (attachment === null) {
			warnResolutionFailure(target, "ambiguous")
			return null
		}
		if (!attachment) {
			warnResolutionFailure(target, "not-found")
			return null
		}
		if (attachment.is_directory || attachment.type === "directory") {
			warnResolutionFailure(target, "directory")
			return null
		}

		return {
			...attachment,
			project_id: target.projectId,
			relative_file_path: normalizedPath,
			file_path: normalizedPath,
		}
	} catch (error) {
		warnResolutionFailure(target, "load-error", error)
		return null
	}
}
