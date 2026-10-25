import { useState } from "react"
import { FileResourceIcon } from "@/pages/superMagic/components/TopicFilesButton/components/FileResourceIcon"
import { resolveFilePresentation } from "@/pages/superMagic/components/TopicFilesButton/utils/file-presentation"
import TSIcon, { IconParkIconElement } from "@/components/base/TSIcon"
import MagicAvatar from "@/components/base/MagicAvatar"
import { cn } from "@/utils/cn"
import { DEFAULT_CUSTOM_MENTION_ICON, ICON_MAPPINGS } from "../../../../constants"
import type { DirectoryMentionData, MentionItem } from "../../../../types"
import type {
	MentionItemRendererContext,
	MentionItemRendererPlatform,
} from "../../../../renderers/types"
import { MentionPanelFileImageIcon } from "../file-preview/MentionPanelFileImageIcon"

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

/**
 * Render folder icon for MentionItem.
 * Custom mention items and custom groups will be delegated to renderCustomMentionIcon.
 */
export function renderMentionFolderIcon(context: MentionItemRendererContext) {
	const { item, platform } = context
	if (item.iconUrl || item.metadata?.customMention || item.metadata?.customMentionGroup) {
		return renderCustomMentionIcon(context)
	}
	if (typeof item.icon !== "string") return item.icon ?? null
	if (item.icon !== "file-folder") return null

	const size = getRendererIconSize(platform)

	const data = item.data as DirectoryMentionData | undefined
	const presentation = resolveFilePresentation(
		{
			...data,
			file_id: data?.directory_id,
			file_name: data?.directory_name ?? item.name,
			relative_file_path: data?.directory_path,
			is_directory: true,
			display_config: data?.directory_metadata ?? item.displayConfig,
		},
		context.filePresentationOptions,
	)
	return <FileResourceIcon presentation={presentation} size={size} />
}

/**
 * Render file icon for MentionItem.
 * Custom mention items and custom groups will be delegated to renderCustomMentionIcon.
 */
export function renderMentionFileIcon(context: MentionItemRendererContext) {
	const { item } = context
	if (item.iconUrl || item.metadata?.customMention || item.metadata?.customMentionGroup) {
		return renderCustomMentionIcon(context)
	}
	if (typeof item.icon !== "string") return item.icon ?? null

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

/**
 * Component that renders host-provided custom mention icons.
 * If an iconUrl is present, renders an <img> element with referrerPolicy="no-referrer".
 * If image fails to load or no iconUrl is provided, gracefully falls back to the TSIcon token,
 * or ultimately to the DEFAULT_CUSTOM_MENTION_ICON (ts-doc-file).
 */
export function CustomMentionIcon({
	icon,
	iconUrl,
	platform,
}: {
	icon?: string
	iconUrl?: string
	platform: MentionItemRendererPlatform
}) {
	const [imageFailed, setImageFailed] = useState(false)
	const size = getRendererIconSize(platform)

	if (iconUrl && !imageFailed) {
		return (
			<div
				className="flex shrink-0 items-center justify-center overflow-hidden"
				style={{ width: size, height: size }}
			>
				<img
					src={iconUrl}
					alt=""
					referrerPolicy="no-referrer"
					className="h-full w-full object-contain"
					onError={() => setImageFailed(true)}
				/>
			</div>
		)
	}

	const fallbackToken = icon || DEFAULT_CUSTOM_MENTION_ICON
	const iconName = fallbackToken.startsWith("ts")
		? fallbackToken
		: ICON_MAPPINGS[fallbackToken] || DEFAULT_CUSTOM_MENTION_ICON

	if (platform === "desktop") {
		return (
			<div className="flex h-4 w-4 shrink-0 items-center justify-center text-xs">
				<TSIcon type={iconName as IconParkIconElement["name"]} size="16" />
			</div>
		)
	}

	return (
		<div className="flex shrink-0 items-center justify-center">
			<TSIcon type={iconName as IconParkIconElement["name"]} size="20" />
		</div>
	)
}

/**
 * Entry point for rendering custom Mention items and custom groups icons in the panel.
 */
export function renderCustomMentionIcon(context: MentionItemRendererContext) {
	const { item, platform } = context
	const icon = typeof item.icon === "string" ? item.icon : undefined
	const iconUrl = item.iconUrl || (item.metadata?.iconUrl as string | undefined)

	return <CustomMentionIcon icon={icon} iconUrl={iconUrl} platform={platform} />
}
