import { renderHook, act } from "@testing-library/react"
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest"
import {
	useKeyboardNav,
	useDebouncedKeyboard,
	useKeyboardShortcuts,
	useFocusManager,
	// @ts-ignore
} from "../useKeyboardNav"
import { KeyboardAction } from "../../types"

// Mock ahooks
vi.mock("ahooks", () => ({
	useMemoizedFn: (fn: any) => {
		// Return a function that calls the original function
		return (...args: any[]) => fn(...args)
	},
}))

// Mock constants
vi.mock("../../constants", () => {
	const KeyboardAction = {
		SELECT_PREVIOUS: "selectPrevious",
		SELECT_NEXT: "selectNext",
		CONFIRM: "confirm",
		NAVIGATE_BACK: "navigateBack",
		ENTER_FOLDER: "enterFolder",
		EXIT: "exit",
	}

	return {
		KEYBOARD_MAPPING: {
			ArrowUp: KeyboardAction.SELECT_PREVIOUS,
			ArrowDown: KeyboardAction.SELECT_NEXT,
			Enter: KeyboardAction.CONFIRM,
			ArrowLeft: KeyboardAction.NAVIGATE_BACK,
			ArrowRight: KeyboardAction.ENTER_FOLDER,
			Escape: KeyboardAction.EXIT,
		},
		DEBOUNCE_DELAYS: {
			KEYBOARD: 50,
		},
	}
})

describe("useKeyboardNav", () => {
	let mockHandlers: {
		onSelectPrevious: ReturnType<typeof vi.fn>
		onSelectNext: ReturnType<typeof vi.fn>
		onConfirm: ReturnType<typeof vi.fn>
		onNavigateBack: ReturnType<typeof vi.fn>
		onEnterFolder: ReturnType<typeof vi.fn>
		onExit: ReturnType<typeof vi.fn>
	}

	beforeEach(() => {
		mockHandlers = {
			onSelectPrevious: vi.fn(),
			onSelectNext: vi.fn(),
			onConfirm: vi.fn(),
			onNavigateBack: vi.fn(),
			onEnterFolder: vi.fn(),
			onExit: vi.fn(),
		}
	})

	afterEach(() => {
		vi.clearAllMocks()
	})

	describe("initialization", () => {
		it("should return handleKeyDown function", () => {
			const { result } = renderHook(() => useKeyboardNav(mockHandlers))

			expect(typeof result.current.handleKeyDown).toBe("function")
		})

		it("should add global keydown listener when enabled", () => {
			const addEventListenerSpy = vi.spyOn(document, "addEventListener")

			renderHook(() => useKeyboardNav({ ...mockHandlers, enabled: true }))

			expect(addEventListenerSpy).toHaveBeenCalledWith("keydown", expect.any(Function), {
				capture: true,
			})
		})

		it("should not add listener when disabled", () => {
			const addEventListenerSpy = vi.spyOn(document, "addEventListener")

			renderHook(() => useKeyboardNav({ ...mockHandlers, enabled: false }))

			expect(addEventListenerSpy).not.toHaveBeenCalled()
		})

		it("should remove listener on unmount", () => {
			const removeEventListenerSpy = vi.spyOn(document, "removeEventListener")

			const { unmount } = renderHook(() => useKeyboardNav(mockHandlers))

			unmount()

			expect(removeEventListenerSpy).toHaveBeenCalledWith("keydown", expect.any(Function), {
				capture: true,
			})
		})
	})

	describe("keyboard event handling", () => {
		it("should handle ArrowUp key", () => {
			const { result } = renderHook(() => useKeyboardNav(mockHandlers))

			const event = new KeyboardEvent("keydown", { key: "ArrowUp" })
			Object.defineProperty(event, "preventDefault", {
				value: vi.fn(),
				writable: true,
			})
			Object.defineProperty(event, "stopPropagation", {
				value: vi.fn(),
				writable: true,
			})

			act(() => {
				result.current.handleKeyDown(event)
			})

			expect(mockHandlers.onSelectPrevious).toHaveBeenCalledTimes(1)
		})

		it("should handle ArrowDown key", () => {
			const { result } = renderHook(() => useKeyboardNav(mockHandlers))

			const event = new KeyboardEvent("keydown", { key: "ArrowDown" })
			Object.defineProperty(event, "preventDefault", {
				value: vi.fn(),
				writable: true,
			})
			Object.defineProperty(event, "stopPropagation", {
				value: vi.fn(),
				writable: true,
			})

			act(() => {
				result.current.handleKeyDown(event)
			})

			expect(mockHandlers.onSelectNext).toHaveBeenCalledTimes(1)
		})

		it("should handle Enter key", () => {
			const { result } = renderHook(() => useKeyboardNav(mockHandlers))

			const event = new KeyboardEvent("keydown", { key: "Enter" })
			Object.defineProperty(event, "preventDefault", {
				value: vi.fn(),
				writable: true,
			})
			Object.defineProperty(event, "stopPropagation", {
				value: vi.fn(),
				writable: true,
			})

			act(() => {
				result.current.handleKeyDown(event)
			})

			expect(mockHandlers.onConfirm).toHaveBeenCalledTimes(1)
		})

		it("should handle ArrowLeft key", () => {
			const { result } = renderHook(() => useKeyboardNav(mockHandlers))

			const event = new KeyboardEvent("keydown", { key: "ArrowLeft" })
			Object.defineProperty(event, "preventDefault", {
				value: vi.fn(),
				writable: true,
			})
			Object.defineProperty(event, "stopPropagation", {
				value: vi.fn(),
				writable: true,
			})

			act(() => {
				result.current.handleKeyDown(event)
			})

			expect(mockHandlers.onNavigateBack).toHaveBeenCalledTimes(1)
		})

		it("should handle ArrowRight key", () => {
			const { result } = renderHook(() => useKeyboardNav(mockHandlers))

			const event = new KeyboardEvent("keydown", { key: "ArrowRight" })
			Object.defineProperty(event, "preventDefault", {
				value: vi.fn(),
				writable: true,
			})
			Object.defineProperty(event, "stopPropagation", {
				value: vi.fn(),
				writable: true,
			})

			act(() => {
				result.current.handleKeyDown(event)
			})

			expect(mockHandlers.onEnterFolder).toHaveBeenCalledTimes(1)
		})

		it("should handle Escape key", () => {
			const { result } = renderHook(() => useKeyboardNav(mockHandlers))

			const event = new KeyboardEvent("keydown", { key: "Escape" })
			Object.defineProperty(event, "preventDefault", {
				value: vi.fn(),
				writable: true,
			})
			Object.defineProperty(event, "stopPropagation", {
				value: vi.fn(),
				writable: true,
			})

			act(() => {
				result.current.handleKeyDown(event)
			})

			expect(mockHandlers.onExit).toHaveBeenCalledTimes(1)
		})

		it("should ignore unmapped keys", () => {
			const { result } = renderHook(() => useKeyboardNav(mockHandlers))

			const event = new KeyboardEvent("keydown", { key: "Tab" })

			act(() => {
				result.current.handleKeyDown(event)
			})

			// No handlers should be called
			Object.values(mockHandlers).forEach((handler) => {
				expect(handler).not.toHaveBeenCalled()
			})
		})

		it("should ignore events with modifier keys", () => {
			const { result } = renderHook(() => useKeyboardNav(mockHandlers))

			const eventWithCtrl = new KeyboardEvent("keydown", {
				key: "ArrowUp",
				ctrlKey: true,
			})

			act(() => {
				result.current.handleKeyDown(eventWithCtrl)
			})

			expect(mockHandlers.onSelectPrevious).not.toHaveBeenCalled()
		})

		it("should prevent default when preventDefault is true", () => {
			const { result } = renderHook(() =>
				useKeyboardNav({ ...mockHandlers, preventDefault: true }),
			)

			const event = new KeyboardEvent("keydown", { key: "ArrowUp" })
			const preventDefaultSpy = vi.fn()
			const stopPropagationSpy = vi.fn()

			Object.defineProperty(event, "preventDefault", {
				value: preventDefaultSpy,
				writable: true,
			})
			Object.defineProperty(event, "stopPropagation", {
				value: stopPropagationSpy,
				writable: true,
			})

			act(() => {
				result.current.handleKeyDown(event)
			})

			expect(preventDefaultSpy).toHaveBeenCalled()
			expect(stopPropagationSpy).toHaveBeenCalled()
		})

		it("should not prevent default when preventDefault is false", () => {
			const { result } = renderHook(() =>
				useKeyboardNav({ ...mockHandlers, preventDefault: false }),
			)

			const event = new KeyboardEvent("keydown", { key: "ArrowUp" })
			const preventDefaultSpy = vi.fn()

			Object.defineProperty(event, "preventDefault", {
				value: preventDefaultSpy,
				writable: true,
			})

			act(() => {
				result.current.handleKeyDown(event)
			})

			expect(preventDefaultSpy).not.toHaveBeenCalled()
		})

		it("should not handle events when disabled", () => {
			const { result } = renderHook(() => useKeyboardNav({ ...mockHandlers, enabled: false }))

			const event = new KeyboardEvent("keydown", { key: "ArrowUp" })

			act(() => {
				result.current.handleKeyDown(event)
			})

			expect(mockHandlers.onSelectPrevious).not.toHaveBeenCalled()
		})
	})

	describe("dynamic enable/disable", () => {
		it("should update listener when enabled changes", () => {
			const addEventListenerSpy = vi.spyOn(document, "addEventListener")
			const removeEventListenerSpy = vi.spyOn(document, "removeEventListener")

			const { rerender } = renderHook(
				({ enabled }) => useKeyboardNav({ ...mockHandlers, enabled }),
				{ initialProps: { enabled: true } },
			)

			expect(addEventListenerSpy).toHaveBeenCalledTimes(1)

			rerender({ enabled: false })

			expect(removeEventListenerSpy).toHaveBeenCalledTimes(1)

			rerender({ enabled: true })

			expect(addEventListenerSpy).toHaveBeenCalledTimes(2)
		})
	})
})

describe("useDebouncedKeyboard", () => {
	beforeEach(() => {
		vi.useFakeTimers()
	})

	afterEach(() => {
		vi.useRealTimers()
		vi.clearAllMocks()
	})

	it("should return a debounced callback", () => {
		const mockCallback = vi.fn()
		const { result } = renderHook(() => useDebouncedKeyboard(mockCallback, 100))

		expect(typeof result.current).toBe("function")
	})

	it("should debounce the callback", () => {
		const mockCallback = vi.fn()
		const { result } = renderHook(() => useDebouncedKeyboard(mockCallback, 100))

		act(() => {
			const cleanup = result.current()
			// Fast forward time
			vi.advanceTimersByTime(100)
		})

		expect(mockCallback).toHaveBeenCalledTimes(1)
	})

	it("should allow cleanup of timeout", () => {
		const mockCallback = vi.fn()
		const { result } = renderHook(() => useDebouncedKeyboard(mockCallback, 100))

		act(() => {
			const cleanup = result.current()
			// Call cleanup before timeout
			cleanup()
			vi.advanceTimersByTime(100)
		})

		expect(mockCallback).not.toHaveBeenCalled()
	})
})

describe("useKeyboardShortcuts", () => {
	let mockShortcuts: Record<string, ReturnType<typeof vi.fn>>

	beforeEach(() => {
		mockShortcuts = {
			"Ctrl+s": vi.fn(),
			"Alt+f": vi.fn(),
			"Meta+z": vi.fn(),
			"Shift+Enter": vi.fn(),
			F1: vi.fn(),
		}
	})

	afterEach(() => {
		vi.clearAllMocks()
	})

	it("should handle single key shortcuts", () => {
		renderHook(() => useKeyboardShortcuts(mockShortcuts))

		const event = new KeyboardEvent("keydown", { key: "F1" })
		const preventDefaultSpy = vi.fn()

		Object.defineProperty(event, "preventDefault", {
			value: preventDefaultSpy,
			writable: true,
		})

		act(() => {
			document.dispatchEvent(event)
		})

		expect(mockShortcuts.F1).toHaveBeenCalledTimes(1)
		expect(preventDefaultSpy).toHaveBeenCalled()
	})

	it("should handle Ctrl key combinations", () => {
		renderHook(() => useKeyboardShortcuts(mockShortcuts))

		const event = new KeyboardEvent("keydown", {
			key: "s",
			ctrlKey: true,
		})
		const preventDefaultSpy = vi.fn()

		Object.defineProperty(event, "preventDefault", {
			value: preventDefaultSpy,
			writable: true,
		})

		act(() => {
			document.dispatchEvent(event)
		})

		expect(mockShortcuts["Ctrl+s"]).toHaveBeenCalledTimes(1)
		expect(preventDefaultSpy).toHaveBeenCalled()
	})

	it("should handle Alt key combinations", () => {
		renderHook(() => useKeyboardShortcuts(mockShortcuts))

		const event = new KeyboardEvent("keydown", {
			key: "f",
			altKey: true,
		})
		const preventDefaultSpy = vi.fn()

		Object.defineProperty(event, "preventDefault", {
			value: preventDefaultSpy,
			writable: true,
		})

		act(() => {
			document.dispatchEvent(event)
		})

		expect(mockShortcuts["Alt+f"]).toHaveBeenCalledTimes(1)
	})

	it("should handle Meta key combinations", () => {
		renderHook(() => useKeyboardShortcuts(mockShortcuts))

		const event = new KeyboardEvent("keydown", {
			key: "z",
			metaKey: true,
		})
		const preventDefaultSpy = vi.fn()

		Object.defineProperty(event, "preventDefault", {
			value: preventDefaultSpy,
			writable: true,
		})

		act(() => {
			document.dispatchEvent(event)
		})

		expect(mockShortcuts["Meta+z"]).toHaveBeenCalledTimes(1)
	})

	it("should handle Shift key combinations", () => {
		renderHook(() => useKeyboardShortcuts(mockShortcuts))

		const event = new KeyboardEvent("keydown", {
			key: "Enter",
			shiftKey: true,
		})
		const preventDefaultSpy = vi.fn()

		Object.defineProperty(event, "preventDefault", {
			value: preventDefaultSpy,
			writable: true,
		})

		act(() => {
			document.dispatchEvent(event)
		})

		expect(mockShortcuts["Shift+Enter"]).toHaveBeenCalledTimes(1)
	})

	it("should ignore unregistered shortcuts", () => {
		renderHook(() => useKeyboardShortcuts(mockShortcuts))

		const event = new KeyboardEvent("keydown", { key: "x" })
		const preventDefaultSpy = vi.fn()

		Object.defineProperty(event, "preventDefault", {
			value: preventDefaultSpy,
			writable: true,
		})

		act(() => {
			document.dispatchEvent(event)
		})

		Object.values(mockShortcuts).forEach((handler) => {
			expect(handler).not.toHaveBeenCalled()
		})
		expect(preventDefaultSpy).not.toHaveBeenCalled()
	})

	it("should clean up listener on unmount", () => {
		const removeEventListenerSpy = vi.spyOn(document, "removeEventListener")

		const { unmount } = renderHook(() => useKeyboardShortcuts(mockShortcuts))

		unmount()

		expect(removeEventListenerSpy).toHaveBeenCalledWith("keydown", expect.any(Function))
	})
})

describe("useFocusManager", () => {
	let mockContainer: HTMLElement
	let mockContainerRef: React.RefObject<HTMLElement>

	beforeEach(() => {
		mockContainer = document.createElement("div")
		mockContainer.focus = vi.fn()

		// Add some focusable elements
		const item1 = document.createElement("div")
		item1.setAttribute("tabindex", "0")
		const item2 = document.createElement("div")
		item2.setAttribute("tabindex", "-1")
		const item3 = document.createElement("div")
		item3.setAttribute("tabindex", "0")

		item1.focus = vi.fn()
		item2.focus = vi.fn()
		item3.focus = vi.fn()

		mockContainer.appendChild(item1)
		mockContainer.appendChild(item2)
		mockContainer.appendChild(item3)

		mockContainerRef = { current: mockContainer }

		// Mock querySelector and querySelectorAll
		mockContainer.querySelector = vi.fn((selector) => {
			if (selector === '[tabindex="0"], [tabindex="-1"]') {
				return item1
			}
			return null
		})

		mockContainer.querySelectorAll = vi.fn((selector) => {
			if (selector === '[tabindex="0"], [tabindex="-1"]') {
				return [item1, item2, item3] as unknown as NodeListOf<Element>
			}
			return [] as unknown as NodeListOf<Element>
		})
	})

	afterEach(() => {
		vi.clearAllMocks()
	})

	it("should focus container", () => {
		const { result } = renderHook(() => useFocusManager(mockContainerRef))

		act(() => {
			result.current.focusContainer()
		})

		expect(mockContainer.focus).toHaveBeenCalledTimes(1)
	})

	it("should focus first focusable item", () => {
		const { result } = renderHook(() => useFocusManager(mockContainerRef))

		act(() => {
			result.current.focusFirstItem()
		})

		expect(mockContainer.querySelector).toHaveBeenCalledWith('[tabindex="0"], [tabindex="-1"]')
		expect((mockContainer.children[0] as HTMLElement).focus).toHaveBeenCalledTimes(1)
	})

	it("should focus last focusable item", () => {
		const { result } = renderHook(() => useFocusManager(mockContainerRef))

		act(() => {
			result.current.focusLastItem()
		})

		expect(mockContainer.querySelectorAll).toHaveBeenCalledWith(
			'[tabindex="0"], [tabindex="-1"]',
		)
		expect((mockContainer.children[2] as HTMLElement).focus).toHaveBeenCalledTimes(1)
	})

	it("should handle missing container ref", () => {
		const nullRef = { current: null }
		const { result } = renderHook(() => useFocusManager(nullRef))

		expect(() => {
			result.current.focusContainer()
			result.current.focusFirstItem()
			result.current.focusLastItem()
		}).not.toThrow()
	})

	it("should handle container with no focusable elements", () => {
		const emptyContainer = document.createElement("div")
		emptyContainer.querySelector = vi.fn(() => null)
		emptyContainer.querySelectorAll = vi.fn(() => [] as unknown as NodeListOf<Element>)

		const emptyRef = { current: emptyContainer }
		const { result } = renderHook(() => useFocusManager(emptyRef))

		expect(() => {
			result.current.focusFirstItem()
			result.current.focusLastItem()
		}).not.toThrow()
	})
})
