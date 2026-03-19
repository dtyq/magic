import { DomClassName } from "@/constants/dom"
import MessageDropdownService from "@/services/chat/message/MessageDropdownService"
import { useMemoizedFn } from "ahooks"
import { useRef } from "react"

const MOBILE_MENU_LONG_PRESS_TIME = 700
const DEFAULT_MENU_HEIGHT = 100 // Default fallback height
const DEFAULT_MENU_WIDTH = 160 // Default fallback width
const MENU_OFFSET = 12 // Offset from message
const SCREEN_PADDING = 16 // Screen padding

/**
 * Message long press event hook
 * @param setDropdownPosition Set menu position
 * @param setOpenDropdown Set menu open state
 * @param menuSize Current menu size (width and height)
 * @returns Returns touch start and end event handlers
 */
export function useMessageTouchEvent({
	setDropdownPosition,
	setOpenDropdown,
	menuSize,
}: {
	setDropdownPosition: (position: { x: number; y: number; arrow?: "top" | "bottom" }) => void
	setOpenDropdown: (open: boolean) => void
	menuSize?: { width: number; height: number }
}) {
	const touchStartTime = useRef<number>()
	const touchEndTime = useRef<number>()
	const timer = useRef<NodeJS.Timeout | null>(null)

	const calculateMenuPosition = useMemoizedFn((messageRect: DOMRect) => {
		const { left, top, height, width } = messageRect
		const screenHeight = window.innerHeight
		const screenWidth = window.innerWidth

		// Use actual menu size if available, otherwise use defaults
		const menuHeight = menuSize?.height || DEFAULT_MENU_HEIGHT
		const menuWidth = menuSize?.width || DEFAULT_MENU_WIDTH

		// Calculate available space above and below the message
		const spaceAbove = top - SCREEN_PADDING
		const spaceBelow = screenHeight - (top + height) - SCREEN_PADDING

		// Determine if menu should be placed above or below
		// Use screen center as the deciding factor, with space consideration
		const messageCenter = top + height / 2
		const isInUpperHalf = messageCenter < screenHeight / 2

		// More intelligent positioning logic
		let shouldPlaceBelow: boolean

		if (isInUpperHalf) {
			// In upper half: prefer below if there's enough space
			shouldPlaceBelow = spaceBelow >= menuHeight
		} else {
			// In lower half: prefer above if there's enough space
			shouldPlaceBelow = spaceAbove < menuHeight
		}

		let x = left + width / 2
		let y: number
		let arrow: "top" | "bottom"

		if (shouldPlaceBelow) {
			// Place menu below message
			y = top + height + MENU_OFFSET
			arrow = "top"
		} else {
			// Place menu above message
			y = top - menuHeight - MENU_OFFSET
			arrow = "bottom"
		}

		// Ensure menu doesn't go off screen vertically
		if (y < SCREEN_PADDING) {
			y = SCREEN_PADDING
			arrow = "top" // Adjust arrow when forced to top
		} else if (y + menuHeight > screenHeight - SCREEN_PADDING) {
			y = screenHeight - menuHeight - SCREEN_PADDING
			arrow = "bottom" // Adjust arrow when forced to bottom
		}

		// Ensure menu doesn't go off screen horizontally
		if (x - menuWidth / 2 < SCREEN_PADDING) {
			x = SCREEN_PADDING + menuWidth / 2
		} else if (x + menuWidth / 2 > screenWidth - SCREEN_PADDING) {
			x = screenWidth - SCREEN_PADDING - menuWidth / 2
		}

		return { x, y, arrow }
	})

	const handleTouchStart = useMemoizedFn((e: React.TouchEvent) => {
		touchStartTime.current = +new Date()

		timer.current = setTimeout(function () {
			const messageItem = (e.target as HTMLElement)?.closest(`.${DomClassName.MESSAGE_ITEM}`)
			if (messageItem) {
				const messageId = messageItem.getAttribute("data-message-id") ?? ""
				MessageDropdownService.setMenu(messageId, messageItem)

				const messageRect = messageItem.getBoundingClientRect()
				const position = calculateMenuPosition(messageRect)

				setDropdownPosition(position)
				setOpenDropdown(true)
			}
		}, MOBILE_MENU_LONG_PRESS_TIME)
	})

	const handleTouchEnd = useMemoizedFn(() => {
		touchEndTime.current = +new Date()
		if (timer.current) clearTimeout(timer.current)
		if (touchEndTime.current - touchStartTime.current! < MOBILE_MENU_LONG_PRESS_TIME) {
			setOpenDropdown(false)
		}
	})

	return {
		handleTouchStart,
		handleTouchEnd,
	}
}
