import { flattenAttachments } from "../../../contents/HTML/utils"
import {
	AttachmentSource,
	type AttachmentItem,
} from "@/pages/superMagic/components/TopicFilesButton/hooks/types"
import type { SelfMediaAttachmentNode } from "../types"
import { type AttachmentNode, findDirectoryByRelativePath, findNodeById } from "./selfMediaHelpers"

function getFileExtension(fileName?: string): string | undefined {
	if (!fileName) return undefined
	const lastDotIndex = fileName.lastIndexOf(".")
	if (lastDotIndex <= 0 || lastDotIndex === fileName.length - 1) {
		return undefined
	}

	return fileName.slice(lastDotIndex + 1)
}

export function resolveSelfMediaAttachmentItem(
	attachmentList?: SelfMediaAttachmentNode[],
	fileId?: string,
): AttachmentItem | null {
	if (!attachmentList?.length || !fileId) return null

	const matchedFile = flattenAttachments(attachmentList).find(
		(item) => !item?.is_directory && item?.file_id === fileId,
	)

	if (!matchedFile) return null

	return {
		...matchedFile,
		file_id: matchedFile.file_id,
		file_name: matchedFile.file_name,
		filename: matchedFile.file_name,
		display_filename: matchedFile.file_name,
		relative_file_path: matchedFile.relative_file_path,
		file_extension: getFileExtension(matchedFile.file_name),
		source: AttachmentSource.PROJECT_DIRECTORY,
	}
}

/**
 * Resolves the on-disk post directory (folder) from any card file in that post
 * and returns an AttachmentItem suitable for a folder @mention.
 */
function resolvePostDirectoryPathFromCardFile(
	allFileLeaves: AttachmentNode[],
	cardFilePath: string,
): string | null {
	const normalized = cardFilePath.replace(/\\/g, "/")
	const parts = normalized.split("/").filter(Boolean)
	if (!parts.length) return null
	const dirSegs = parts.slice(0, -1)
	for (let j = dirSegs.length; j >= 0; j--) {
		const prefix = j === 0 ? "" : `${dirSegs.slice(0, j).join("/")}/`
		const postJson = `${prefix}post.json`
		const hasPostJson = allFileLeaves.some(
			(n) => !n.is_directory && n.relative_file_path === postJson,
		)
		if (hasPostJson) {
			if (j === 0) return "/"
			return `${dirSegs.slice(0, j).join("/")}/`
		}
	}
	const cardsIdx = normalized.indexOf("/cards/")
	if (cardsIdx !== -1) {
		return `${normalized.slice(0, cardsIdx)}/`
	}
	return null
}

export function resolveSelfMediaPostDirectoryAttachmentItem(
	attachmentList: SelfMediaAttachmentNode[] | undefined,
	anyCardFileId: string | undefined,
): AttachmentItem | null {
	if (!attachmentList?.length || !anyCardFileId) return null
	const cardNode = findNodeById(attachmentList as AttachmentNode[], anyCardFileId)
	if (!cardNode || cardNode.is_directory) return null
	const cardPath = cardNode.relative_file_path
	if (!cardPath) return null
	const flat = flattenAttachments(attachmentList) as AttachmentNode[]
	const postDirPath = resolvePostDirectoryPathFromCardFile(flat, cardPath)
	if (!postDirPath) return null
	const dirNode = findDirectoryByRelativePath(attachmentList as AttachmentNode[], postDirPath)
	if (!dirNode?.file_id) return null
	return {
		...dirNode,
		file_id: dirNode.file_id,
		file_name: dirNode.file_name,
		filename: dirNode.file_name,
		display_filename: dirNode.file_name,
		relative_file_path: dirNode.relative_file_path,
		is_directory: true,
		source: AttachmentSource.PROJECT_DIRECTORY,
	} as AttachmentItem
}
