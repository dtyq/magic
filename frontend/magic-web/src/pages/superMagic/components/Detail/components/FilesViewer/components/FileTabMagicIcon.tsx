import MagicFileIcon from "@/components/base/MagicFileIcon"
import { FileResourceIcon } from "@/pages/superMagic/components/TopicFilesButton/components/FileResourceIcon"
import { getFilePresentationIndex } from "@/pages/superMagic/components/TopicFilesButton/utils/file-presentation"
import { useFilePresentation } from "@/pages/superMagic/components/TopicFilesButton/hooks/useFilePresentation"
import type { FileHelpContext } from "@/pages/superMagic/components/TopicFilesButton/utils/magic-system-folder"
import type { AttachmentItem } from "@/pages/superMagic/components/TopicFilesButton/hooks/types"
import { memo } from "react"
import type { FileItem, TabItem } from "../types"
import { AppWindow, Globe2, PanelsTopLeft, Trash2 } from "lucide-react"
import { isWebsiteTab } from "../utils/websiteTabs"

interface FileTabMagicIconProps {
	tab: TabItem
	attachments?: FileItem[]
	context?: FileHelpContext
	isPlayback: boolean
	size: number
	className?: string
}

/** 标签栏图标：custom display_config（含合并到入口文件的）优先 icon 远程图 */
export const FileTabMagicIcon = memo(function FileTabMagicIcon({
	tab,
	attachments,
	context,
	isPlayback,
	size,
	className,
}: FileTabMagicIconProps) {
	const presentation = useFilePresentation(tab.fileData as unknown as AttachmentItem, {
		context,
		index: attachments
			? getFilePresentationIndex(attachments as unknown as AttachmentItem[])
			: undefined,
	})
	if (isPlayback) return <MagicFileIcon type="replay" size={size} className={className} />
	if (tab.type === "file_manager") {
		const Icon =
			tab.fileManager?.spaceType === "project" && tab.fileManager.area === "recycle"
				? Trash2
				: PanelsTopLeft
		return <Icon size={size} className={className} />
	}
	if (isWebsiteTab(tab)) return <Globe2 size={size} className={className} />
	if (tab.type === "micro_app")
		return <AppWindow size={size} className={className} data-testid="micro-app-tab-icon" />
	return <FileResourceIcon presentation={presentation} size={size} className={className} />
})
