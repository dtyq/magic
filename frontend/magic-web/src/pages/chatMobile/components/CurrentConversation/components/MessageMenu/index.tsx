import { observer } from "mobx-react-lite"
import { useTranslation } from "react-i18next"
import { clipboard } from "@/utils/clipboard-helpers"

import MessageDropdownStore from "@/stores/chatNew/messageUI/Dropdown"
import MessageDropdownService from "@/services/chat/message/MessageDropdownService"
import { createStyles } from "antd-style"
import { Popover, PopoverProps } from "antd-mobile"
import { useEffect, useRef, useState } from "react"
import { useMemoizedFn } from "ahooks"

// Components
import MenuItemList from "./components/MenuItemList"

interface MessageMenuProps extends Omit<PopoverProps, "content"> {
	messageId: string
}

const useStyles = createStyles(({ css, token }) => ({
	menu: css`
		--background: ${token.magicColorUsages.tertiary.active} !important;
		border-radius: 8px;
		gap: 8px;
		color: ${token.magicColorUsages.white};
	`,
	touchWrapper: css`
		width: fit-content;
		max-width: 100%;
		/* Allow text selection */
		user-select: text;
		-webkit-user-select: text;
		-moz-user-select: text;
		-ms-user-select: text;

		/* Improve text selection on mobile */
		-webkit-touch-callout: default;
		-webkit-tap-highlight-color: rgba(0, 0, 0, 0.1);

		&.pressing {
			transition: all 0.1s ease;
		}
	`,
}))

const MessageMenu = observer(({ children, messageId, ...props }: MessageMenuProps) => {
	const { t } = useTranslation()
	const { styles } = useStyles()
	const [open, setOpen] = useState(false)
	const isPressingRef = useRef(false)
	// Touch interaction refs
	const longPressTimer = useRef<NodeJS.Timeout | null>(null)
	const touchStartTime = useRef(0)
	const touchStartPosition = useRef({ x: 0, y: 0 })
	const isLongPressTriggered = useRef(false)
	const messageRef = useRef<HTMLDivElement>(null)

	// Helper function to select all text in the message
	const selectAllMessageText = useMemoizedFn(() => {
		if (!messageRef.current) return

		try {
			const selection = window.getSelection()
			if (!selection) return

			// Clear any existing selection
			selection.removeAllRanges()

			// Create a new range that covers all text in the message
			const range = document.createRange()
			range.selectNodeContents(messageRef.current)
			selection.addRange(range)

			// Ensure the selection is visible and user can interact with it
			// Add a small delay to ensure selection is properly established
			setTimeout(() => {
				// Force a reflow to ensure selection handles appear on mobile
				if (selection.rangeCount > 0) {
					const rect = selection.getRangeAt(0).getBoundingClientRect()
					console.log("Selection established with bounds:", rect)
				}
			}, 50)
		} catch (error) {
			console.warn("Failed to select message text:", error)
		}
	})

	// Helper function to get selected text or all message text
	const getTextToCopy = useMemoizedFn((): string => {
		const selection = window.getSelection()
		const selectedText = selection?.toString().trim()

		// If user has selected text (including adjusted selection), use that
		if (selectedText) {
			return selectedText
		}

		// Otherwise, get all text from the message
		if (messageRef.current) {
			return messageRef.current.innerText || messageRef.current.textContent || ""
		}

		return ""
	})

	// Enhanced copy function
	const handleCopy = useMemoizedFn(async () => {
		try {
			const textToCopy = getTextToCopy()

			if (!textToCopy) {
				console.warn("No text to copy")
				return
			}

			await clipboard.writeText(textToCopy)

			console.log("Text copied to clipboard:", textToCopy)

			// Clear text selection after copying (optional - remove this if you want to keep selection)
			// const selection = window.getSelection()
			// if (selection) {
			// 	selection.removeAllRanges()
			// }
		} catch (error) {
			console.error("Failed to copy text:", error)
		}
	})

	const menuItems = MessageDropdownStore.menu
		.filter((item) => !item.key.startsWith("divider"))
		.map((item) => {
			return {
				key: item.key,
				icon: item.icon,
				label: t(item.label ?? "", { ns: "interface" }),
			}
		})

	const handleClick = (key: string) => {
		console.log("handleClick called with key:", key) // Debug log
		try {
			// Handle copy action specially
			if (key === "copy") {
				handleCopy()
			} else {
				MessageDropdownService.clickMenuItem(key as any)
			}
			console.log("MessageDropdownService.clickMenuItem executed") // Debug log
		} catch (error) {
			console.error("Error in MessageDropdownService.clickMenuItem:", error)
		}
		closePopover()
	}

	const openPopover = useMemoizedFn((e: EventTarget) => {
		if (messageId) {
			MessageDropdownService.setMenu(messageId, e)
		}

		// Select all text in the message when opening the menu
		selectAllMessageText()

		setOpen(true)
	})

	// Add a function to clear text selection when needed
	const clearTextSelection = useMemoizedFn(() => {
		const selection = window.getSelection()
		if (selection) {
			selection.removeAllRanges()
		}
	})

	const closePopover = useMemoizedFn(() => {
		setOpen(false)
		// Note: We don't clear text selection here to allow users to adjust their selection
		// Text selection will be cleared when copy is performed or when user taps elsewhere
	})

	// Handle outside clicks to close popover
	useEffect(() => {
		if (!open) return

		const handleOutsideClick = (e: Event) => {
			const target = e.target as Element
			if (!target) return

			// Find popover content
			const popoverElement = document.querySelector(".adm-popover-content")

			// Don't close if clicking inside popover content
			if (popoverElement && popoverElement.contains(target)) {
				return
			}

			// Don't close if clicking on a menu item
			if (target.closest('[data-menu-item="true"]')) {
				return
			}

			// Don't close if clicking within the message area (to allow text selection adjustment)
			if (messageRef.current && messageRef.current.contains(target)) {
				return
			}

			// Close popover for any other clicks
			closePopover()
			window.getSelection()?.removeAllRanges()
		}

		// Add listeners after a short delay to avoid immediate closing
		// Use normal event phase (not capture) to allow menu items to handle clicks first
		const timer = setTimeout(() => {
			document.addEventListener("touchstart", handleOutsideClick, false)
			document.addEventListener("click", handleOutsideClick, false)
		}, 300)

		return () => {
			clearTimeout(timer)
			document.removeEventListener("touchstart", handleOutsideClick, false)
			document.removeEventListener("click", handleOutsideClick, false)
		}
	}, [open, closePopover, messageId])

	// Clear long press timer
	const clearLongPressTimer = useMemoizedFn(() => {
		if (longPressTimer.current) {
			clearTimeout(longPressTimer.current)
			longPressTimer.current = null
		}
	})

	// HACK:更新按压状态的函数，使用 CSS 类而不是 state
	// 避免iOS上重新渲染导致横向滚动失败
	// 并且 滚动的时候不能够改动样式，不然ios会认为这是一个点击行为进而阻止滚动
	const updatePressingState = useMemoizedFn((pressing: boolean) => {
		if (!messageRef.current) return

		isPressingRef.current = pressing

		if (pressing) {
			messageRef.current.classList.add("pressing")
		} else {
			messageRef.current.classList.remove("pressing")
		}
	})
	// Handle touch start - initiate long press detection
	const handleTouchStart = useMemoizedFn((e: React.TouchEvent<HTMLDivElement>) => {
		const touch = e.touches[0]
		const now = Date.now()

		// Reset states
		touchStartTime.current = now
		touchStartPosition.current = { x: touch.clientX, y: touch.clientY }
		isLongPressTriggered.current = false
		updatePressingState(true)

		// Clear any existing timer
		clearLongPressTimer()

		// Set up long press timer
		longPressTimer.current = setTimeout(() => {
			isLongPressTriggered.current = true
			openPopover(e.target)
			updatePressingState(false)
		}, 500) // 500ms for long press
	})

	// Handle touch move - cancel long press if moved too much
	const handleTouchMove = useMemoizedFn((e: React.TouchEvent<HTMLDivElement>) => {
		if (!longPressTimer.current) return

		const touch = e.touches[0]
		const deltaX = Math.abs(touch.clientX - touchStartPosition.current.x)
		const deltaY = Math.abs(touch.clientY - touchStartPosition.current.y)

		// Increase tolerance to 20px to avoid accidental cancellation
		if (deltaX > 20 || deltaY > 20) {
			clearLongPressTimer()
			updatePressingState(false)
		}
	})

	// Handle touch end - handle short tap if long press wasn't triggered
	const handleTouchEnd = useMemoizedFn((e: React.TouchEvent<HTMLDivElement>) => {
		const now = Date.now()
		const touchDuration = now - touchStartTime.current

		updatePressingState(false)

		// If long press was already triggered, do nothing
		if (isLongPressTriggered.current) {
			clearLongPressTimer()
			return
		}

		// Clear the long press timer
		clearLongPressTimer()

		// Handle short tap (less than 500ms)
		if (touchDuration < 500) {
			// On short tap, if menu is open and text is selected, don't close immediately
			// This allows users to adjust their text selection
			if (open) {
				const selection = window.getSelection()
				if (selection && selection.toString().length > 0) {
					// Keep menu open to allow selection adjustment
					return
				}
			}
			// For short taps without selection, you can add other logic here if needed
		}
	})

	// Handle touch cancel - clean up states
	const handleTouchCancel = useMemoizedFn(() => {
		clearLongPressTimer()
		updatePressingState(false)
		isLongPressTriggered.current = false
	})

	return (
		<Popover
			visible={open}
			trigger="click"
			mode="dark"
			className={styles.menu}
			placement="top"
			{...props}
			content={
				<MenuItemList
					menuItems={menuItems}
					onItemClick={handleClick}
					className={styles.menu}
				/>
			}
		>
			<div
				ref={messageRef}
				className={`${styles.touchWrapper}`}
				data-message-id={messageId}
				onTouchStart={handleTouchStart}
				onTouchMove={handleTouchMove}
				onTouchEnd={handleTouchEnd}
				onTouchCancel={handleTouchCancel}
			// onClick={(e) => {
			// 	// Prevent Popover's default click behavior
			// 	e.preventDefault()
			// 	e.stopPropagation()
			// }}
			>
				{children}
			</div>
		</Popover>
	)
})

export default MessageMenu
