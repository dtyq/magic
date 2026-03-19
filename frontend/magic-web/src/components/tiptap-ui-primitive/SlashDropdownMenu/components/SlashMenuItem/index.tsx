import { memo, forwardRef } from "react"
import { createStyles } from "antd-style"
import { useTranslation } from "react-i18next"
import { SlashMenuItemProps, DEFAULT_GROUPS } from "../../types"

/**
 * Styles for SlashMenuItem component
 */
const useStyles = createStyles(({ css, token }) => {
	return {
		menuItem: css`
			display: flex;
			align-items: center;
			padding: 6px 12px;
			margin: 0;
			border-radius: 8px;
			cursor: pointer;
			transition: all 120ms ease-out;
			font-size: 14px;
			line-height: 20px;
			min-height: 32px;

			&:hover {
				background-color: #f3f4f6;
			}

			&.selected {
				background-color: ${token.magicColorUsages.primaryLight.default};
				color: ${token.magicColorUsages.text[0]};
				font-weight: 500;

				.item-subtext {
					color: ${token.magicColorUsages.text[0]};
					opacity: 0.8;
				}
			}

			&:active {
				transform: scale(0.99);
			}
		`,

		itemIcon: css`
			display: flex;
			align-items: center;
			justify-content: center;
			width: 16px;
			height: 16px;
			margin-right: 10px;
			flex-shrink: 0;
			color: #6b7280;
			font-size: 16px;

			.selected & {
				color: ${token.magicColorUsages.text[0]};
			}
		`,

		itemContent: css`
			flex: 1;
			min-width: 0;
		`,

		itemTitle: css`
			font-weight: 400;
			color: ${token.magicColorUsages.text[0]};
			line-height: 20px;

			.selected & {
				color: ${token.magicColorUsages.text[0]};
				font-weight: 500;
			}
		`,

		itemSubtext: css`
			font-size: 12px;
			color: #6b7280;
			line-height: 16px;
			margin-top: 1px;

			.selected & {
				color: ${token.magicColorUsages.text[0]};
				opacity: 0.8;
			}
		`,

		itemBadge: css`
			margin-left: 8px;
			flex-shrink: 0;
			display: flex;
			align-items: center;
			justify-content: center;
			color: #9ca3af;

			.selected & {
				color: ${token.magicColorUsages.text[0]};
				opacity: 0.8;
			}
		`,

		// Hide keyboard navigation indicator to match design
		keyboardIndicator: css`
			display: none;
		`,
	}
})

/**
 * Individual menu item component for slash dropdown
 */
export const SlashMenuItem = memo(
	forwardRef<HTMLDivElement, SlashMenuItemProps>(
		({ item, isSelected, onClick, className, showSubtext = false, ...props }, ref) => {
			const { styles, cx } = useStyles()

			const handleClick = () => {
				onClick?.()
			}

			const handleKeyDown = (event: React.KeyboardEvent) => {
				if (event.key === "Enter" || event.key === " ") {
					event.preventDefault()
					event.stopPropagation()
					onClick?.()
				}
			}

			return (
				<div
					ref={ref}
					className={cx(
						styles.menuItem,
						{
							selected: isSelected,
						},
						className,
					)}
					onClick={handleClick}
					onKeyDown={handleKeyDown}
					role="option"
					aria-selected={isSelected}
					aria-label={`${item.title}: ${item.subtext || ""}`}
					tabIndex={isSelected ? 0 : -1}
					{...props}
				>
					{/* Icon */}
					{item.icon && <div className={styles.itemIcon}>{item.icon}</div>}

					{/* Content */}
					<div className={styles.itemContent}>
						<div className={styles.itemTitle}>{item.title}</div>
						{showSubtext && item.subtext && (
							<div className={cx(styles.itemSubtext, "item-subtext")}>
								{item.subtext}
							</div>
						)}
					</div>

					{/* Badge */}
					{item.badge && <div className={styles.itemBadge}>{item.badge}</div>}

					{/* Keyboard shortcut indicator - could be used for common items */}
					{isSelected && <div className={styles.keyboardIndicator}>↵</div>}
				</div>
			)
		},
	),
)

SlashMenuItem.displayName = "SlashMenuItem"

const useGroupHeaderStyles = createStyles(({ css }) => ({
	groupHeader: css`
		font-size: 12px;
		font-weight: 500;
		color: #6b7280;
		text-transform: none;
		letter-spacing: 0;
		padding: 6px 12px 4px;
		margin-top: 6px;

		&:first-child {
			margin-top: 2px;
		}
	`,
}))

/**
 * Group header component
 */
export const SlashMenuGroupHeader = memo(({ title }: { title: string }) => {
	const { styles } = useGroupHeaderStyles()
	const { t } = useTranslation("tiptap")

	// Map default group names to translated versions
	const getGroupTitle = (groupTitle: string) => {
		const groupMap: Record<string, string> = {
			[DEFAULT_GROUPS.FORMATTING]: t("editor.slashMenu.groups.formatting"),
			[DEFAULT_GROUPS.LISTS]: t("editor.slashMenu.groups.list"),
			[DEFAULT_GROUPS.BLOCKS]: t("editor.slashMenu.groups.formatting"),
			[DEFAULT_GROUPS.MEDIA]: t("editor.slashMenu.groups.media"),
			Other: t("editor.slashMenu.groups.other"),
		}
		return groupMap[groupTitle] || groupTitle
	}

	return <div className={styles.groupHeader}>{getGroupTitle(title)}</div>
})

SlashMenuGroupHeader.displayName = "SlashMenuGroupHeader"

export default SlashMenuItem
