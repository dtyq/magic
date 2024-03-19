import { useEffect, useImperativeHandle, forwardRef, useMemo, useRef } from "react"
import { createStyles } from "antd-style"
import { createPortal } from "react-dom"
import type { SuggestionKeyDownProps } from "@tiptap/suggestion"
import type { Editor, Range } from "@tiptap/react"

import type { SuggestionItem, SlashMenuConfig } from "../../types"
import { useSlashDropdownMenu } from "../../hooks/useSlashDropdownMenu"
import { useDropdownKeyboard } from "../../hooks/useDropdownKeyboard"
import { calculateDropdownPosition } from "../../utils"
import { SlashMenuList } from "../SlashMenuList"
import { useControllableValue } from "ahooks"

/**
 * Props for SlashDropdownRenderer
 */
export interface SlashDropdownRendererProps {
	/** Tiptap editor instance */
	editor: Editor
	/** Current search query */
	query?: string
	/** Text range for replacement */
	range: Range
	/** Decoration node element */
	decorationNode: Element | null
	/** Configuration for slash menu */
	config?: SlashMenuConfig
	/** Callback when item is selected */
	onSelect?: (item: SuggestionItem) => void
	/** Callback when menu should exit */
	onExit?: () => void
	/** Whether the dropdown is open */
	open: boolean
	/** Callback when the dropdown is opened or closed */
	onOpenChange: (open: boolean) => void
}

/**
 * Ref interface for SlashDropdownRenderer
 */
export interface SlashDropdownRendererRef {
	/** Handle keyboard events */
	onKeyDown: (props: SuggestionKeyDownProps) => boolean
}

/**
 * Styles for the dropdown renderer
 */
const useStyles = createStyles(({ token, css }) => ({
	portal: css`
		position: fixed;
		/* Use base z-index variable, all tiptap UI components share the same base */
		z-index: var(--tt-z-index-base, 9999);
		pointer-events: none;
	`,

	dropdown: css`
		background: #ffffff;
		border: 1px solid #e5e7eb;
		border-radius: 12px;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
		min-width: 240px;
		max-width: 280px;
		overflow: hidden;
		pointer-events: auto;

		/* Animation for smooth appearance */
		animation: dropdownFadeIn 150ms cubic-bezier(0.4, 0, 0.2, 1);

		@keyframes dropdownFadeIn {
			from {
				opacity: 0;
				transform: translateY(-4px) scale(0.98);
			}
			to {
				opacity: 1;
				transform: translateY(0) scale(1);
			}
		}
	`,

	header: css`
		padding: 8px 12px 6px;
		font-size: 13px;
		color: #6b7280;
		font-weight: 500;
		line-height: 18px;
	`,

	footer: css`
		display: none; /* Hide footer to match the design */
	`,

	keyboardHint: css`
		display: flex;
		align-items: center;
		gap: 4px;

		.key {
			background: ${token.colorFillTertiary};
			border-radius: 3px;
			padding: 2px 4px;
			font-family: monospace;
			font-size: 10px;
		}
	`,
}))

/**
 * Main renderer component for slash dropdown
 */
const SlashDropdownRenderer = forwardRef<SlashDropdownRendererRef, SlashDropdownRendererProps>(
	(props, ref) => {
		const { editor, query, decorationNode, config = {}, onSelect, onExit } = props
		const { styles } = useStyles()
		const [isVisible, setIsVisible] = useControllableValue<boolean>(props, {
			defaultValue: true,
			valuePropName: "open",
			trigger: "onOpenChange",
		})

		// Ref for dropdown element to detect outside clicks
		const dropdownRef = useRef<HTMLDivElement>(null)

		// Get slash menu items using our hook
		const { getSlashMenuItems, filterItems } = useSlashDropdownMenu(config)

		// Get filtered items based on query
		const filteredItems = useMemo(() => {
			const allItems = getSlashMenuItems(editor)
			return filterItems(allItems, query)
		}, [editor, query, getSlashMenuItems, filterItems])

		// Handle dropdown keyboard navigation
		const { selectedIndex, setSelectedIndex, handleSelectItem, handleKeyDown, resetSelection } =
			useDropdownKeyboard(filteredItems, onSelect, onExit)

		// Calculate dropdown position
		const position = calculateDropdownPosition(decorationNode)

		// Handle item selection with visibility control
		const handleItemSelect = (item: SuggestionItem) => {
			setIsVisible(false)
			handleSelectItem(item)
		}

		// Reset selected index when items change
		useEffect(() => {
			resetSelection()
		}, [filteredItems, resetSelection])

		// Handle click outside to close dropdown
		useEffect(() => {
			if (!isVisible) return

			function handleClickOutside(event: MouseEvent) {
				const target = event.target as Node

				// Check if click is outside the dropdown
				const isOutsideDropdown =
					dropdownRef.current && !dropdownRef.current.contains(target)

				// Check if click is outside the decoration node (trigger element)
				const isOutsideDecoration = decorationNode && !decorationNode.contains(target)

				if (isOutsideDropdown && isOutsideDecoration) {
					setIsVisible(false)
					onExit?.()
				}
			}

			// Use mousedown instead of click to capture before blur events
			document.addEventListener("mousedown", handleClickOutside)

			return () => {
				document.removeEventListener("mousedown", handleClickOutside)
			}
		}, [isVisible, decorationNode, setIsVisible, onExit])

		// Expose keyboard handler through ref
		useImperativeHandle(
			ref,
			() => ({
				onKeyDown: handleKeyDown,
			}),
			[handleKeyDown],
		)

		// Don't render if not visible or no items
		if (!isVisible || filteredItems.length === 0) {
			return null
		}

		const dropdown = (
			<div
				className={styles.portal}
				style={{
					top: position.top,
					left: position.left,
				}}
			>
				<div ref={dropdownRef} className={styles.dropdown}>
					<SlashMenuList
						items={filteredItems}
						selectedIndex={selectedIndex}
						onItemClick={(item, index) => {
							setSelectedIndex(index)
							handleItemSelect(item)
						}}
						showGroups={config.showGroups}
					/>
				</div>
			</div>
		)

		// Render in portal to body
		return createPortal(dropdown, document.body)
	},
)

// Set displayName for debugging
Object.defineProperty(SlashDropdownRenderer, "displayName", {
	value: "SlashDropdownRenderer",
	writable: false,
})

export default SlashDropdownRenderer
