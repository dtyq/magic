import {
	MentionItemType,
	type DirectoryMentionData,
	type ProjectFileMentionData,
} from "../../../../types"
import type { MentionItemRenderer } from "../../../../renderers/types"
import { renderMentionFileIcon, renderMentionFolderIcon } from "../shared/render-utils"

function getFolderRelativePath(path?: string) {
	if (!path) return path

	const paths = path.split("/").slice(0, -2)
	const nextPath = paths.join("/")
	return nextPath || ""
}

function getFileRelativePath(path?: string) {
	if (!path) return path

	const paths = path.split("/").slice(0, -1)
	const nextPath = paths.join("/")
	return nextPath || ""
}

/** 与 CanvasDesignMentionDataService 约定：在 DSL 相对路径前拼接设计根目录显示名 */
const MENTION_FILE_SUBTITLE_PARENT_PREFIX_KEY = "mentionFileSubtitleParentPrefix"

function readSubtitleParentPrefix(item: {
	metadata?: Record<string, unknown>
}): string | undefined {
	const v = item.metadata?.[MENTION_FILE_SUBTITLE_PARENT_PREFIX_KEY]
	return typeof v === "string" && v.trim() ? v.trim() : undefined
}

/** 将「父路径」前加设计根前缀；父路径为空或为根目录文案时只显示前缀 */
function withSubtitleParentPrefix(
	prefix: string | undefined,
	parentPath: string,
	rootDirectoryLabel: string,
): string {
	if (!prefix) return parentPath
	if (!parentPath || parentPath === rootDirectoryLabel) {
		return prefix
	}
	return `${prefix}/${parentPath}`
}

export const workspaceFilesRendererEntries: Array<[string, MentionItemRenderer]> = [
	[
		MentionItemType.FOLDER,
		{
			renderIcon: renderMentionFolderIcon,
			renderDescription: ({ item, platform }) => {
				if (platform !== "mobile" || !item.description) return null
				return getFolderRelativePath(item.description)
			},
			getTypeDescription: ({ item, isSearch, t }) => {
				if (isSearch && item.description) return item.description
				const rootLabel = t.selectPathItemDescription.rootDirectory
				const directoryPath = (item.data as DirectoryMentionData | undefined)
					?.directory_path
				const directoryName = (item.data as DirectoryMentionData | undefined)
					?.directory_name
				let directoryResult = directoryPath?.replace(directoryName || "", "") || ""
				if (directoryResult.endsWith("/")) {
					directoryResult = directoryResult.slice(0, -1) || rootLabel
				}
				const parent = directoryResult || rootLabel
				return withSubtitleParentPrefix(
					isSearch ? readSubtitleParentPrefix(item) : undefined,
					parent,
					rootLabel,
				)
			},
		},
	],
	[
		MentionItemType.PROJECT_FILE,
		{
			renderIcon: renderMentionFileIcon,
			renderDescription: ({ item, platform, t }) => {
				if (platform !== "mobile" || !item.description) return null
				const relativePath = getFileRelativePath(item.description)

				return (
					relativePath ||
					item.description ||
					t.selectPathItemDescription.rootDirectory ||
					""
				)
			},
			getTypeDescription: ({ item, isSearch, t }) => {
				if (isSearch && item.description) return item.description
				const rootLabel = t.selectPathItemDescription.rootDirectory
				const filePath = (item.data as ProjectFileMentionData | undefined)?.file_path || ""
				const fileName = (item.data as ProjectFileMentionData | undefined)?.file_name || ""
				let result = filePath.replace(fileName, "")
				if (result.endsWith("/")) {
					result = result.slice(0, -1) || rootLabel
				}
				const parent = result || rootLabel
				return withSubtitleParentPrefix(
					isSearch ? readSubtitleParentPrefix(item) : undefined,
					parent,
					rootLabel,
				)
			},
		},
	],
]
