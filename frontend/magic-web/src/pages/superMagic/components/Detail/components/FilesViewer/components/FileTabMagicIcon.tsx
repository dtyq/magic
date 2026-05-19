import MagicFileIcon from "@/components/base/MagicFileIcon"
import { CustomFolderMagicIcon } from "@/pages/superMagic/components/TopicFilesButton/components/CustomFolderMagicIcon"
import { findFileInTree } from "@/pages/superMagic/components/TopicFilesButton/hooks/fileSelectionUtils"
import {
	getChildrenForCustomMetadataIconPath,
	getFileTreeIconType,
} from "@/pages/superMagic/components/MessageList/components/MessageAttachment/utils"
import { memo, useMemo } from "react"
import type { FileItem, TabItem } from "../types"

interface FileTabMagicIconProps {
	tab: TabItem
	attachments?: FileItem[]
	isPlayback: boolean
	size: number
	className?: string
}

/** 标签栏图标：custom display_config（含合并到入口文件的）优先 icon 远程图 */
export const FileTabMagicIcon = memo(function FileTabMagicIcon({
	tab,
	attachments,
	isPlayback,
	size,
	className,
}: FileTabMagicIconProps) {
	const fd = tab.fileData

	const findNode = useMemo(
		() => (id: string) =>
			attachments?.length
				? (findFileInTree(attachments as unknown as Record<string, unknown>[], id) as {
						children?: unknown[]
						is_directory?: boolean
					} | null)
				: null,
		[attachments],
	)

	const iconPathChildren = useMemo(
		() => getChildrenForCustomMetadataIconPath(fd, findNode),
		[fd, findNode],
	)

	const typeFallback = getFileTreeIconType(fd) || fd.file_extension || ""

	if (isPlayback) {
		return <MagicFileIcon type="replay" size={size} className={className} />
	}

	if (fd.display_config?.type === "custom") {
		return (
			<CustomFolderMagicIcon
				displayConfig={fd.display_config}
				childrenItems={iconPathChildren}
				typeFallback="custom"
				size={size}
				className={className}
			/>
		)
	}

	return <MagicFileIcon type={typeFallback} size={size} className={className} />
})
