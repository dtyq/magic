import { safeBtoaToJson } from "@/utils/encoding"
import type { Position, Size } from "../types"

// Scroll state management
export class ScrollState {
	static canScroll = true
	static isScrolling = false
	static lastScrollTop = 0
	static lastMessageId = ""

	static reset() {
		this.canScroll = true
		this.isScrolling = false
		this.lastScrollTop = 0
		this.lastMessageId = ""
	}

	static setScrolling(value: boolean) {
		this.isScrolling = value
	}

	static setCanScroll(value: boolean) {
		this.canScroll = value
	}

	static setLastScrollTop(value: number) {
		this.lastScrollTop = value
	}

	static setLastMessageId(value: string) {
		this.lastMessageId = value
	}
}

// Position adjustment utilities
export const adjustDropdownPosition = (
	position: Position,
	size: Size,
	marginSize: number = 4,
): Position => {
	if (typeof window === "undefined") return position

	const windowWidth = window.innerWidth - marginSize * 2
	const windowHeight = window.innerHeight - marginSize * 2

	const adjustedPosition = { ...position }

	// Ensure dropdown right boundary doesn't exceed screen
	if (adjustedPosition.x + size.width + marginSize > windowWidth) {
		adjustedPosition.x = windowWidth - size.width - marginSize
	}

	// Ensure dropdown doesn't exceed left boundary
	if (adjustedPosition.x < 0) {
		adjustedPosition.x = marginSize
	}

	// Ensure dropdown bottom doesn't exceed screen
	if (adjustedPosition.y + size.height > windowHeight) {
		adjustedPosition.y = windowHeight - size.height - marginSize
	}

	// Ensure dropdown doesn't exceed top boundary
	if (adjustedPosition.y < 0) {
		adjustedPosition.y = marginSize
	}

	return adjustedPosition
}

// Scroll calculation utilities
export const calculateScrollDistance = (element: HTMLElement): number => {
	const { scrollTop, clientHeight, scrollHeight } = element
	return Math.abs(scrollTop + clientHeight - scrollHeight)
}

export const isAtBottom = (element: HTMLElement, threshold: number = 100): boolean => {
	return calculateScrollDistance(element) < threshold
}

export const isScrollingUp = (currentScrollTop: number): boolean => {
	const isUp = ScrollState.lastScrollTop - currentScrollTop > 0
	ScrollState.setLastScrollTop(currentScrollTop)
	return isUp
}

// Message utilities
export const generateMessageKey = (
	conversationId: string,
	topicId: string,
	messageId: string,
): string => {
	return `${conversationId}-${topicId}-${messageId}`
}

export const parseFileInfo = (encodedFileInfo: string): any => {
	try {
		return safeBtoaToJson(encodedFileInfo)
	} catch (error) {
		console.error("Parse file info failed", error)
		return null
	}
}

// Element utilities
export const findMessageElement = (
	container: HTMLElement,
	messageId: string,
): HTMLElement | null => {
	return container.querySelector(`[data-message-id="${messageId}"]`)
}

export const findClosestMessageElement = (target: HTMLElement): HTMLElement | null => {
	return target.closest("[data-message-id]")
}

export const getMessageId = (element: HTMLElement | null): string | null => {
	return element?.getAttribute("data-message-id") || null
}

// Timing utilities
export const createScrollTimeout = (callback: () => void, delay: number = 0): NodeJS.Timeout => {
	return setTimeout(callback, delay)
}

export const clearScrollTimeout = (timer: NodeJS.Timeout | null): void => {
	if (timer) {
		clearTimeout(timer)
	}
}

export function isMessageInView(messageId: string, parentElement: HTMLElement | null) {
	if (!parentElement) return false

	const element = document.getElementById(messageId)
	if (!element) return false

	const rect = element.getBoundingClientRect()
	// 元素的顶部进入视图，判断为true
	return (
		(rect.top >= 0 && rect.top <= (parentElement.clientHeight || parentElement.scrollHeight)) ||
		(rect.bottom >= 0 &&
			rect.bottom <= (parentElement.clientHeight || parentElement.scrollHeight))
	)
}
