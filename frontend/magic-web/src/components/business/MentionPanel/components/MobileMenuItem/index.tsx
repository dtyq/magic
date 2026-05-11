import { memo, useCallback } from "react"
import { Check } from "lucide-react"
import TSIcon from "@/components/base/TSIcon"
import MagicIcon from "@/components/base/MagicIcon"
import { IconX } from "@tabler/icons-react"
import FlexBox from "@/components/base/FlexBox"
import { useMobileStyles, getMobileItemIconStyle } from "../../mobileStyles"
import type { MenuItemProps } from "../../types"
import { MentionItemType } from "../../types"
import { useMentionItemRenderContextValue, useMentionItemRenderer } from "../../renderers/context"
import {
	getMentionItemSkillSourceLabel,
	shouldRenderMentionItemTypeDescription,
} from "../../renderers/shared/helpers"

const MobileMenuItem = memo(function MobileMenuItem(props: MenuItemProps) {
	const {
		item,
		selected = false,
		onClick,
		onDelete,
		className,
		style,
		t,
		isSearch,
		showCheckbox,
		checkboxChecked,
		rootPendingBadgeCount,
		...restProps
	} = props

	const { styles, cx } = useMobileStyles()
	const renderer = useMentionItemRenderer(item.type)
	const filePreviewById = useMentionItemRenderContextValue()
	const rendererContext = {
		item,
		t,
		isSearch,
		platform: "mobile" as const,
		filePreviewById,
	}
	const hasRightArrow =
		!item.tags?.includes("history") && Boolean(item.hasChildren || item.children?.length)

	const handleRowClick = useCallback(
		(event: React.MouseEvent) => {
			if ((event.target as HTMLElement).closest("[data-right-arrow]")) return
			event.stopPropagation()
			onClick?.(event)
		},
		[onClick],
	)

	const handleArrowClick = useCallback(
		(event: React.MouseEvent) => {
			event.preventDefault()
			event.stopPropagation()
			onClick?.(event)
		},
		[onClick],
	)

	const renderDeleteButton = () => {
		if (!item.tags?.includes("history") || !onDelete) return null

		return (
			<div
				className={cx(styles.deleteButton, "deleteButton")}
				onClick={(event) => {
					event.preventDefault()
					event.stopPropagation()
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

	const renderRightArrow = useCallback(() => {
		if (!hasRightArrow) return null

		const showRootBadge = rootPendingBadgeCount !== undefined && rootPendingBadgeCount > 0

		return (
			<div className="flex shrink-0 items-center gap-1.5">
				{showRootBadge ? (
					<span
						className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-primary px-1 text-[11px] font-semibold tabular-nums leading-none text-primary-foreground"
						aria-label={`${rootPendingBadgeCount}`}
					>
						{rootPendingBadgeCount > 99 ? "99+" : rootPendingBadgeCount}
					</span>
				) : null}
				<div className={styles.rightArrow} role="button" onClick={handleArrowClick}>
					<TSIcon type="ts-arrow-right" data-right-arrow size="24" />
				</div>
			</div>
		)
	}, [handleArrowClick, hasRightArrow, rootPendingBadgeCount, styles.rightArrow])

	if (item.type === MentionItemType.TITLE) {
		return (
			<FlexBox className={styles.title} align="center" gap={4}>
				{renderer.renderIcon?.(rendererContext)}
				{item.name}
			</FlexBox>
		)
	}

	if (item.type === MentionItemType.DIVIDER) return <div className={styles.divider} />

	const iconStyle = getMobileItemIconStyle(item.type)
	const typeDescription = renderer.getTypeDescription?.(rendererContext) ?? null
	const shouldRenderTypeDescription = shouldRenderMentionItemTypeDescription(rendererContext)
	const skillSourceLabel = getMentionItemSkillSourceLabel(rendererContext)

	const renderCheckbox = () => {
		if (hasRightArrow) return null
		if (!showCheckbox) return null
		return (
			<span
				className={cx(
					"flex h-4 w-4 shrink-0 items-center justify-center rounded border border-border bg-card shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)] transition-colors",
					checkboxChecked && "border-primary bg-primary",
				)}
				aria-hidden
			>
				{checkboxChecked ? (
					<Check className="h-2.5 w-2.5 text-primary-foreground" strokeWidth={3} />
				) : null}
			</span>
		)
	}

	return (
		<div
			key={item.id}
			className={cx(styles.menuItem, selected && "selected", className)}
			style={style}
			onClick={handleRowClick}
			role="option"
			aria-selected={selected}
			tabIndex={selected ? 0 : -1}
			data-testid="mention-panel-menu-item"
			{...restProps}
		>
			{renderCheckbox()}
			<div className={cx(styles.menuItemIcon, iconStyle)}>
				{renderer.renderIcon?.(rendererContext)}
			</div>

			<div className={styles.menuItemContent}>
				<div className={styles.menuItemTitle}>{item.name}</div>
				{/* {description ? (
					<div className={styles.menuItemDescription}>{description}</div>
				) : null} */}
			</div>
			{shouldRenderTypeDescription && (
				<div
					className={styles.typeDescription}
					data-testid={skillSourceLabel ? "mention-panel-skill-source" : undefined}
				>
					<span className={styles.typeDescriptionContent}>{typeDescription}</span>
				</div>
			)}
			{renderDeleteButton()}
			{renderRightArrow()}
		</div>
	)
})

MobileMenuItem.displayName = "MobileMenuItem"

export default MobileMenuItem
