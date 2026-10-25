import MagicFileIcon from "@/components/base/MagicFileIcon"
import { isMicroAppDisplayType } from "@/constants/microApp"
import { Globe2 } from "lucide-react"
import { getAttachmentType } from "@/pages/superMagic/components/MessageList/components/MessageAttachment/utils"
import { CustomFolderMagicIcon } from "@/pages/superMagic/components/TopicFilesButton/components/CustomFolderMagicIcon"
import { SlidesTemplateFolderIcon } from "@/pages/superMagic/components/TopicFilesButton/components/SlidesTemplateFolderIcon"

export interface MentionResourceDisplayConfig {
	type?: string
	[key: string]: unknown
}

interface MentionPanelResourceIconProps {
	displayConfig?: MentionResourceDisplayConfig
	childrenItems?: unknown[]
	typeFallback?: string
	isDirectoryLike?: boolean
	size: number
}

/**
 * Centralizes display-config icon handling for mention files and directories.
 * Special resource types must be resolved here so new Tab/mention entry paths
 * cannot silently fall back to an unsupported MagicFileIcon type.
 */
export function MentionPanelResourceIcon({
	displayConfig,
	childrenItems,
	typeFallback,
	isDirectoryLike = false,
	size,
}: MentionPanelResourceIconProps) {
	const displayType = displayConfig?.type
	if (!displayType) return null

	if (displayType === "slide-template") {
		return <SlidesTemplateFolderIcon size={size} />
	}

	if (displayType === "website") {
		return <Globe2 size={size} />
	}

	if (displayType === "custom" || (isMicroAppDisplayType(displayType) && isDirectoryLike)) {
		return (
			<CustomFolderMagicIcon
				displayConfig={displayConfig}
				childrenItems={childrenItems}
				typeFallback={typeFallback || displayType}
				size={size}
			/>
		)
	}

	return (
		<MagicFileIcon
			type={
				getAttachmentType({ display_config: displayConfig }) || typeFallback || displayType
			}
			size={size}
		/>
	)
}
