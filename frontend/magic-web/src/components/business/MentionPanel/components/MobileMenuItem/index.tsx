import { memo, useCallback } from "react"
import TSIcon, { IconParkIconElement } from "@/components/base/TSIcon"
import MagicFileIcon from "@/components/base/MagicFileIcon"
import BotIcon from "../icons/BotIcon"
import PlugIcon from "../icons/PlugIcon"
import SkillIcon from "../icons/SkillIcon"
import FoldIcon from "@/pages/superMagic/assets/svg/file-folder.svg"

// Types
import type { DirectoryMentionData, MenuItemProps } from "../../types"
import { MentionItemType } from "../../types"

// Styles
import { useMobileStyles, getMobileItemIconStyle } from "../../mobileStyles"

// Constants
import { ICON_MAPPINGS } from "../../constants"
import ToolIcon from "../icons/ToolIcon"
import { getItemTypeDescription, getSkillMentionSourceLabel } from "../../utils/getValue"
import MagicIcon from "@/components/base/MagicIcon"
import { IconX } from "@tabler/icons-react"
import { getAttachmentType } from "@/pages/superMagic/components/MessageList/components/MessageAttachment/utils"
import { memoize } from "lodash-es"
import FlexBox from "@/components/base/FlexBox"

/**
 * Get icon style class based on item type
 * Local version to avoid dependency on deprecated styles.ts
 */
const getItemIconStyle = (type: string) => {
	switch (type) {
		case "mcp":
			return "mcp-icon"
		case "agent":
			return "agent-icon"
		default:
			return ""
	}
}

const calcFolderRelativePath = memoize((path?: string) => {
	if (!path) return path
	// such as: /xxx/xx/
	const paths = path.split("/").slice(0, -2)
	let newPath = paths.join("/") + "/"
	newPath = newPath.startsWith("/") ? newPath.slice(1) : newPath
	return newPath
})

const calcFileRelativePath = memoize((path?: string) => {
	if (!path) return path
	// such as: /xxx/xxx/xxx
	const paths = path.split("/").slice(0, -1)
	let newPath = paths.join("/") + "/"
	newPath = newPath.startsWith("/") ? newPath.slice(1) : newPath
	return newPath
})

/**
 * MobileMenuItem - Mobile menu item component
 *
 * @param props - Menu item properties
 * @returns JSX.Element
 */
const MobileMenuItem = memo((props: MenuItemProps) => {
	const {
		item,
		selected = false,
		onClick,
		onDelete,
		className,
		style,
		t,
		isSearch,
		...restProps
	} = props

	const { styles, cx } = useMobileStyles()

	// Render icon (consistent with PC version)
	const renderIcon = useCallback(() => {
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
			return icon && typeof icon === "string" ? (
				<img src={icon} style={{ width: 20, height: 20, borderRadius: 8 }} alt="agent" />
			) : (
				<BotIcon size={20} />
			)
		}

		if (type === MentionItemType.MCP) {
			return icon && typeof icon === "string" ? (
				<img src={icon} style={{ width: 20, height: 20, borderRadius: 8 }} alt="mcp" />
			) : (
				<PlugIcon size={20} />
			)
		}

		if (type === MentionItemType.SKILL) {
			return icon && typeof icon === "string" ? (
				<img src={icon} style={{ width: 20, height: 20, borderRadius: 8 }} alt="skill" />
			) : (
				<SkillIcon size={20} />
			)
		}

		if (
			[MentionItemType.PROJECT_FILE, MentionItemType.UPLOAD_FILE].includes(type) &&
			icon &&
			typeof icon === "string"
		) {
			return <MagicFileIcon type={icon} size={20} />
		}

		if (type === MentionItemType.TOOL) {
			return icon && typeof icon === "string" ? (
				<img src={icon} style={{ width: 20, height: 20, borderRadius: 8 }} alt="tool" />
			) : (
				icon || <ToolIcon size={20} />
			)
		}

		if (icon === "file-folder") {
			const directoryMetadata = (data as DirectoryMentionData)?.directory_metadata
			if (directoryMetadata?.type) {
				return <MagicFileIcon type={getAttachmentType(directoryMetadata) || ""} size={16} />
			}
			return <img src={FoldIcon} alt="file-folder" style={{ width: 16, height: 16 }} />
		}

		if (typeof icon === "string") {
			// Use TSIcon component with icon name mapping
			const iconName = icon.startsWith("ts") ? icon : ICON_MAPPINGS[icon]
			const iconClassName = getItemIconStyle(type)

			return (
				<div className={iconClassName}>
					<TSIcon type={iconName as IconParkIconElement["name"]} size="20" radius={8} />
				</div>
			)
		}

		// React node icon
		return icon
	}, [item])

	// Render delete button for history items
	const renderDeleteButton = () => {
		if (item.tags?.includes("history") && onDelete) {
			return (
				<div
					className={cx(styles.deleteButton, "deleteButton")}
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

	const renderDescription = () => {
		if (!item.description) return null
		switch (item.type) {
			case MentionItemType.FOLDER:
				return (
					<div className={styles.menuItemDescription}>
						{calcFolderRelativePath(item.description)}
					</div>
				)
			case MentionItemType.PROJECT_FILE:
				return (
					<div className={styles.menuItemDescription}>
						{calcFileRelativePath(item.description) ||
							t.selectPathItemDescription.rootDirectory}
					</div>
				)
			default:
				return <div className={styles.menuItemDescription}>{item.description}</div>
		}
	}

	// Handle click event
	const handleClick = useCallback(
		(e: React.MouseEvent) => {
			// Prevent event bubbling to avoid triggering mask click
			e.stopPropagation()
			onClick?.(e)
		},
		[onClick],
	)

	// Render right arrow for navigable items
	const renderRightArrow = useCallback(() => {
		const hasRightArrow =
			!item.tags?.includes("history") && (item.hasChildren || item.children?.length)

		if (hasRightArrow) {
			return (
				<div className={styles.rightArrow} role="button" onClick={handleClick}>
					<TSIcon type="ts-arrow-right" data-right-arrow size="24" />
				</div>
			)
		}
		return null
	}, [handleClick, item.children?.length, item.hasChildren, item.tags, styles.rightArrow])

	if (item.type === MentionItemType.TITLE) {
		return (
			<FlexBox className={styles.title} align="center" gap={4}>
				{renderIcon()}
				{item.name}
			</FlexBox>
		)
	}

	if (item.type === MentionItemType.DIVIDER) {
		return <div className={styles.divider} />
	}

	const iconStyle = getMobileItemIconStyle(item.type)
	const skillSourceLabel = getSkillMentionSourceLabel(item, t)
	const shouldRenderTypeDescription =
		!!skillSourceLabel ||
		isSearch ||
		item.tags?.includes("history") ||
		item.tags?.includes("tab")
	const typeDescription = skillSourceLabel || getItemTypeDescription(item, t)

	return (
		<div
			key={item.id}
			className={cx(styles.menuItem, selected && "selected", className)}
			style={style}
			onClick={handleClick}
			role="option"
			aria-selected={selected}
			tabIndex={selected ? 0 : -1}
			data-testid="mention-panel-menu-item"
			{...restProps}
		>
			{/* Icon */}
			<div className={cx(styles.menuItemIcon, iconStyle)}>{renderIcon()}</div>

			{/* Content */}
			<div className={styles.menuItemContent}>
				<div className={styles.menuItemTitle}>{item.name}</div>
				{renderDescription()}
			</div>
			{shouldRenderTypeDescription && (
				<div
					className={styles.typeDescription}
					data-testid={skillSourceLabel ? "mention-panel-skill-source" : undefined}
				>
					<span className={styles.typeDescriptionContent}>{typeDescription}</span>
				</div>
			)}
			{/* Delete button */}
			{renderDeleteButton()}
			{/* Right arrow for folders */}
			{renderRightArrow()}
		</div>
	)
})

MobileMenuItem.displayName = "MobileMenuItem"

export default MobileMenuItem
