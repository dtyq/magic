import { memo } from "react"
import TSIcon, { IconParkIconElement } from "@/components/base/TSIcon"
import { MenuItemProps, MentionItemType, DirectoryMentionData } from "../../types"
import { ICON_MAPPINGS } from "../../constants"
import BotIcon from "../icons/BotIcon"
import MagicAvatar from "@/components/base/MagicAvatar"
import PlugIcon from "../icons/PlugIcon"
import MagicFileIcon from "@/components/base/MagicFileIcon"
import SkillIcon from "../icons/SkillIcon"
import ToolIcon from "../icons/ToolIcon"
import MagicIcon from "@/components/base/MagicIcon"
import { IconX } from "@tabler/icons-react"
import { getItemTypeDescription, getSkillMentionSourceLabel } from "../../utils/getValue"
import SmartTooltip from "@/components/other/SmartTooltip"
import FoldIcon from "@/pages/superMagic/assets/svg/file-folder.svg"
import { getAttachmentType } from "@/pages/superMagic/components/MessageList/components/MessageAttachment/utils"
import FlexBox from "@/components/base/FlexBox"
import { Button } from "@/components/shadcn-ui/button"
import { ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import useGeistFont from "@/styles/fonts/geist"

/**
 * Get icon style classes based on item type
 */
function getIconClassName(type: string): string {
	if (type === "mcp") {
		return "bg-gradient-to-r from-[#2e2f38] to-[#1c1d23] rounded-[3px] text-white"
	}
	if (type === "agent") {
		return "bg-gradient-to-br from-[#3f8fff] to-[#ef2fdf] rounded-[3px] text-white"
	}
	return ""
}

/**
 * MenuItem - Menu item component
 *
 * @param props - Menu item properties
 * @returns JSX.Element
 */
const MenuItem = memo((props: MenuItemProps) => {
	const {
		item,
		selected = false,
		onClick,
		onDelete,
		className,
		style,
		isSearch,
		t,
		...restProps
	} = props

	// Load Geist font
	useGeistFont()

	// Render icon
	const renderIcon = () => {
		const { icon, data, type } = item

		if (
			type === MentionItemType.DIVIDER ||
			type === MentionItemType.TABS ||
			type === MentionItemType.HISTORIES
		) {
			return null
		}

		if (type === MentionItemType.TITLE) {
			return icon
		}

		if (type === MentionItemType.AGENT) {
			if (typeof icon === "string") {
				return <MagicAvatar src={icon} size={16} />
			}

			return icon ?? <BotIcon />
		}

		if (type === MentionItemType.MCP) {
			if (typeof icon === "string") {
				return <MagicAvatar src={icon} size={16} />
			}

			return icon ?? <PlugIcon />
		}

		if (type === MentionItemType.TOOL) {
			if (typeof icon === "string") {
				return <MagicAvatar src={icon} size={16} />
			}

			return icon ?? <ToolIcon />
		}

		if (type === MentionItemType.SKILL) {
			if (typeof icon === "string") {
				return <MagicAvatar src={icon} size={16} />
			}

			return icon ?? <SkillIcon />
		}

		if (
			(type === MentionItemType.PROJECT_FILE || type === MentionItemType.UPLOAD_FILE) &&
			icon &&
			typeof icon === "string"
		) {
			if (icon && typeof icon === "string") {
				return <MagicFileIcon type={icon} size={16} />
			}

			return <TSIcon type="ts-attachment" size="16" />
		}

		if (icon === "file-folder") {
			const directoryMetadata = (data as DirectoryMentionData)?.directory_metadata
			if (directoryMetadata?.type) {
				return <MagicFileIcon type={getAttachmentType(directoryMetadata) || ""} size={16} />
			}

			return <img src={FoldIcon} alt="file-folder" className="h-4 w-4" />
		}

		if (typeof icon === "string") {
			// Use TSIcon component with icon name mapping
			const iconName = icon.startsWith("ts") ? icon : ICON_MAPPINGS[icon]
			const iconClassName = cn(
				"flex h-4 w-4 shrink-0 items-center justify-center text-xs",
				getIconClassName(type),
			)

			return (
				<div className={iconClassName}>
					<TSIcon type={iconName as IconParkIconElement["name"]} size="16" />
				</div>
			)
		}

		// React node icon
		return (
			<div className="flex h-4 w-4 shrink-0 items-center justify-center text-xs">{icon}</div>
		)
	}

	// Render delete button for history items
	const renderDeleteButton = () => {
		if (item.tags?.includes("history") && onDelete) {
			return (
				<div
					className="deleteButton flex h-4 w-4 shrink-0 cursor-pointer items-center justify-center rounded text-xs text-secondary-foreground opacity-0 transition-all duration-200 hover:bg-accent hover:text-foreground"
					onClick={(e) => {
						e.preventDefault()
						e.stopPropagation()
						onDelete(item)
					}}
					role="button"
					aria-label={`删除历史记录: ${item.name}`}
					tabIndex={-1}
				>
					<MagicIcon component={IconX} size={12} />
				</div>
			)
		}
		return null
	}

	// Render right arrow for navigable items
	const renderRightArrow = () => {
		if (
			!item.tags?.includes("history") &&
			(item.hasChildren || item.type === MentionItemType.FOLDER)
		) {
			return (
				<Button variant="ghost" size="icon" className="size-4" data-right-arrow>
					<ChevronRight />
				</Button>
			)
		}
		return null
	}

	// Handle click event
	const handleClick = (event?: React.MouseEvent) => {
		// Prevent click if item is unselectable
		if (item.unSelectable) {
			event?.preventDefault()
			event?.stopPropagation()
			return
		}
		// Prevent focus change on mouse click to avoid potential double triggers
		event?.preventDefault()
		onClick?.(event)
	}

	// Handle keyboard events
	const handleKeyDown = (event: React.KeyboardEvent) => {
		// Prevent keyboard selection if item is unselectable
		if (item.unSelectable) {
			return
		}
		if (event.key === "Enter" || event.key === " ") {
			event.preventDefault()
			event.stopPropagation() // Prevent global keyboard navigation from handling this event
			onClick?.()
		}
	}

	if (item.type === MentionItemType.TITLE) {
		return (
			<FlexBox
				className="overflow-hidden p-1.5 font-['Geist'] text-[10px] font-normal leading-[13px] text-foreground"
				align="center"
				gap={4}
			>
				{renderIcon()}
				{item.name}
			</FlexBox>
		)
	}

	if (item.type === MentionItemType.DIVIDER) {
		return <div className="m-1.5 h-px bg-border" />
	}

	const itemClassName = cn(
		"mb-0.5 flex min-h-8 cursor-pointer items-center gap-1 rounded-sm p-1.5 transition-all duration-150",
		"hover:bg-primary/10 hover:[&_.deleteButton]:opacity-100",
		selected && "bg-accent [&_.deleteButton]:opacity-100",
		className,
	)
	const skillSourceLabel = getSkillMentionSourceLabel(item, t)
	const shouldRenderTypeDescription =
		!!skillSourceLabel ||
		isSearch ||
		item.tags?.includes("history") ||
		item.tags?.includes("tab")
	const typeDescription = skillSourceLabel || getItemTypeDescription(item, t)

	return (
		<div
			className={itemClassName}
			style={{
				...style,
				...(item.unSelectable
					? {
							opacity: 0.5,
							cursor: "not-allowed",
							pointerEvents: "none" as const,
						}
					: {}),
			}}
			onClick={handleClick}
			onKeyDown={handleKeyDown}
			role="option"
			aria-selected={selected}
			aria-disabled={item.unSelectable}
			aria-label={`${t.ariaLabels.menuItem}: ${item.name}`}
			tabIndex={selected && !item.unSelectable ? 0 : -1}
			data-testid="mention-panel-menu-item"
			{...restProps}
		>
			<div className="flex min-w-0 flex-1 items-center gap-1">
				{renderIcon()}
				<div className="inline-flex min-w-0 max-w-full flex-1 flex-col">
					<SmartTooltip className="overflow-hidden text-ellipsis whitespace-nowrap break-words text-xs leading-4 text-foreground">
						{item.name}
					</SmartTooltip>
				</div>
			</div>

			{shouldRenderTypeDescription && (
				<div
					className="relative max-w-[50%] overflow-hidden whitespace-nowrap font-['Geist'] text-[10px] font-normal leading-[13px] text-muted-foreground"
					style={{ direction: "rtl", textOverflow: "ellipsis" }}
					data-testid={skillSourceLabel ? "mention-panel-skill-source" : undefined}
				>
					<span style={{ direction: "ltr", unicodeBidi: "bidi-override" }}>
						{typeDescription}
					</span>
				</div>
			)}
			{renderDeleteButton()}
			{renderRightArrow()}
		</div>
	)
})

MenuItem.displayName = "MenuItem"

export default MenuItem
