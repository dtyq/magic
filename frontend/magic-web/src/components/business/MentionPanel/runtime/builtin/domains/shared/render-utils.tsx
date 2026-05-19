import TSIcon, { IconParkIconElement } from "@/components/base/TSIcon"
import MagicFileIcon from "@/components/base/MagicFileIcon"
import MagicAvatar from "@/components/base/MagicAvatar"
import FoldIcon from "@/pages/superMagic/assets/svg/file-folder.svg"
import { getAttachmentType } from "@/pages/superMagic/components/MessageList/components/MessageAttachment/utils"
import { CustomFolderMagicIcon } from "@/pages/superMagic/components/TopicFilesButton/components/CustomFolderMagicIcon"
import { cn } from "@/lib/utils"
import { ICON_MAPPINGS } from "../../../../constants"
import type { DirectoryMentionData, MentionItem, ProjectFileMentionData } from "../../../../types"
import type {
	MentionItemRendererContext,
	MentionItemRendererPlatform,
} from "../../../../renderers/types"
import { MentionPanelFileImageIcon } from "../file-preview/MentionPanelFileImageIcon"
import projectFilesStore from "@/stores/projectFiles"

export function getRendererIconSize(platform: MentionItemRendererPlatform) {
	return platform === "desktop" ? 16 : 20
}

export function getDesktopIconClassName(type: string): string {
	if (type === "mcp") {
		return "bg-gradient-to-r from-[#2e2f38] to-[#1c1d23] rounded-[3px] text-white"
	}
	if (type === "agent") {
		return "bg-gradient-to-br from-[#3f8fff] to-[#ef2fdf] rounded-[3px] text-white"
	}
	return ""
}

export function renderMentionAvatarIcon(params: {
	icon?: MentionItem["icon"]
	platform: MentionItemRendererPlatform
	fallback: JSX.Element
}) {
	const { icon, platform, fallback } = params
	if (typeof icon !== "string" || !icon) return fallback

	return <MagicAvatar src={icon} size={getRendererIconSize(platform)} />
}

export function renderMentionFolderIcon(context: MentionItemRendererContext) {
	const { item, platform } = context
	if (item.icon !== "file-folder") return null

	const size = getRendererIconSize(platform)

	// Normalize path for comparison (remove leading slash)
	const normalizePath = (path: string) => {
		return path.startsWith("/") ? path.slice(1) : path
	}

	// Get directory metadata from item.data or find from store
	const directoryData = item.data as DirectoryMentionData | undefined
	let directoryDisplayConfig = directoryData?.directory_metadata
	let childrenItems = item.children as unknown[]

	// If metadata not available, try to find from store
	if (!directoryDisplayConfig && directoryData) {
		const folderNode = projectFilesStore.workspaceFilesList.find((f) => {
			if (f.type !== "directory") return false

			if (directoryData.directory_id) {
				return f.file_id === directoryData.directory_id
			}
			if (directoryData.directory_path) {
				return (
					normalizePath(f.relative_file_path || "") ===
					normalizePath(directoryData.directory_path)
				)
			}
			return false
		})

		if (folderNode) {
			directoryDisplayConfig = folderNode.display_config
			childrenItems = (folderNode.children as unknown[]) || []
		}
	}

	if (directoryDisplayConfig?.type === "custom") {
		return (
			<CustomFolderMagicIcon
				displayConfig={directoryDisplayConfig}
				childrenItems={childrenItems}
				size={size}
				typeFallback="folder"
			/>
		)
	}

	if (directoryDisplayConfig?.type) {
		return (
			<MagicFileIcon
				type={getAttachmentType({ display_config: directoryDisplayConfig }) || ""}
				size={size}
			/>
		)
	}

	if (platform === "desktop") {
		return <img src={FoldIcon} alt="file-folder" className="h-4 w-4" />
	}

	return <img src={FoldIcon} alt="file-folder" style={{ width: size, height: size }} />
}

export function renderMentionFileIcon(context: MentionItemRendererContext) {
	const { item } = context
	if (typeof item.icon !== "string") return null

	return <MentionPanelFileImageIcon context={context} />
}

export function renderMentionMappedIcon(context: MentionItemRendererContext) {
	const { item, platform } = context
	const { icon, type } = item
	if (typeof icon !== "string") return null

	const iconName = icon.startsWith("ts") ? icon : ICON_MAPPINGS[icon]
	if (platform === "desktop") {
		return (
			<div
				className={cn(
					"flex h-4 w-4 shrink-0 items-center justify-center text-xs",
					getDesktopIconClassName(type),
				)}
			>
				<TSIcon type={iconName as IconParkIconElement["name"]} size="16" />
			</div>
		)
	}

	return (
		<div className={type === "mcp" ? "mcp-icon" : type === "agent" ? "agent-icon" : ""}>
			<TSIcon type={iconName as IconParkIconElement["name"]} size="20" radius={8} />
		</div>
	)
}
