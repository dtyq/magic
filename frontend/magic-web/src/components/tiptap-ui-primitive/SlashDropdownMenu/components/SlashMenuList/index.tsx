import { memo, forwardRef } from "react"
import { createStyles } from "antd-style"
import { useTranslation } from "react-i18next"
import { SlashMenuListProps, SuggestionItem } from "../../types"
import { SlashMenuItem, SlashMenuGroupHeader } from "../SlashMenuItem"
import { groupItemsForRender, calculateItemIndices } from "../../utils"
import { useMenuListNavigation } from "../../hooks/useMenuListNavigation"

/**
 * Styles for SlashMenuList component
 */
const useStyles = createStyles(({ css }) => {
	return {
		menuList: css`
			max-height: 296px;
			overflow-y: auto;
			overflow-x: hidden;
			padding: 4px 6px 6px;

			/* Custom scrollbar for webkit browsers */
			&::-webkit-scrollbar {
				width: 4px;
			}

			&::-webkit-scrollbar-track {
				background: transparent;
			}

			&::-webkit-scrollbar-thumb {
				background-color: #d1d5db;
				border-radius: 2px;

				&:hover {
					background-color: #9ca3af;
				}
			}

			/* Firefox scrollbar */
			scrollbar-width: thin;
			scrollbar-color: #d1d5db transparent;
		`,

		emptyState: css`
			padding: 16px 12px;
			text-align: center;
			color: #6b7280;
			font-size: 14px;
		`,

		menuGroup: css`
			&:not(:first-child) {
				border-top: 1px solid #f3f4f6;
				margin-top: 6px;
				padding-top: 6px;
			}
		`,

		loadingState: css`
			padding: 16px 12px;
			text-align: center;
			color: #6b7280;
			font-size: 14px;
			display: flex;
			align-items: center;
			justify-content: center;
			gap: 8px;
		`,
	}
})

/**
 * Menu list component that displays slash menu items
 */
export const SlashMenuList = memo(
	forwardRef<HTMLDivElement, SlashMenuListProps>(
		(
			{ items = [], selectedIndex = 0, onItemClick, showGroups = true, className, ...props },
			ref,
		) => {
			const { styles, cx } = useStyles()
			const { t } = useTranslation("tiptap")
			const { listRef, getItemRef } = useMenuListNavigation(selectedIndex)

			// Handle item click
			const handleItemClick = (item: SuggestionItem, itemIndex: number) => {
				onItemClick?.(item, itemIndex)
			}

			// Combine refs helper function
			const combineRefs = (el: HTMLDivElement | null) => {
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				;(listRef as any).current = el
				if (typeof ref === "function") {
					ref(el)
				} else if (ref && "current" in ref) {
					// eslint-disable-next-line @typescript-eslint/no-explicit-any
					;(ref as any).current = el
				}
			}

			// If no items, show empty state
			if (items.length === 0) {
				return (
					<div ref={combineRefs} className={cx(styles.menuList, className)} {...props}>
						<div className={styles.emptyState}>
							{t("editor.slashMenu.emptyPlaceholder")}
						</div>
					</div>
				)
			}

			// Group items for rendering
			const renderItems = groupItemsForRender(items, showGroups)

			// Calculate actual item indices (excluding group headers)
			const itemIndices = calculateItemIndices(renderItems)

			return (
				<div
					ref={combineRefs}
					className={cx(styles.menuList, className)}
					role="listbox"
					{...props}
				>
					{renderItems.map((renderItem, index) => {
						if (renderItem.type === "group") {
							return (
								<SlashMenuGroupHeader
									key={renderItem.key}
									title={renderItem.data as string}
								/>
							)
						}

						const item = renderItem.data as SuggestionItem
						const itemIndex = itemIndices[index]
						const isSelected = itemIndex === selectedIndex

						return (
							<SlashMenuItem
								key={renderItem.key}
								ref={getItemRef(isSelected)}
								item={item}
								isSelected={isSelected}
								onClick={() => handleItemClick(item, itemIndex)}
							/>
						)
					})}
				</div>
			)
		},
	),
)

SlashMenuList.displayName = "SlashMenuList"

/**
 * Loading state component
 */
export const SlashMenuListLoading = memo(() => {
	const { styles } = useStyles()
	const { t } = useTranslation("tiptap")

	return (
		<div className={styles.loadingState}>
			<div>{t("editor.slashMenu.searchPlaceholder")}</div>
		</div>
	)
})

SlashMenuListLoading.displayName = "SlashMenuListLoading"

export default SlashMenuList
