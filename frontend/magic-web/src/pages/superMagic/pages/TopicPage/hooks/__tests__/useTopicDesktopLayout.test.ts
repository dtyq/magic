import { act, cleanup, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import {
	HomeOnboardingAnchor,
	setHomeOnboardingAnchor,
} from "@/pages/superMagic/components/LazyGuideTour/GuideTourManager"
import { useTopicDesktopLayout } from "../useTopicDesktopLayout"
import {
	CHAT_PROJECT_SIDER_PANEL_STORAGE_KEY,
	DEFAULT_WIDTH,
	MESSAGE_PANEL_WIDTH_STORAGE_KEY,
	PROJECT_SIDER_PANEL_STORAGE_KEY,
	PROJECT_SIDER_WIDTH_STORAGE_KEY,
} from "../../../../constants/resizablePanel"

class MockResizeObserver {
	observe = vi.fn()
	disconnect = vi.fn()

	constructor(callback: ResizeObserverCallback) {
		void callback
	}
}

/** Provides deterministic storage for layout persistence tests in jsdom. */
function createLocalStorageMock(): Storage {
	let store: Record<string, string> = {}
	return {
		get length() {
			return Object.keys(store).length
		},
		clear: vi.fn(() => {
			store = {}
		}),
		getItem: vi.fn((key: string) => store[key] ?? null),
		key: vi.fn((index: number) => Object.keys(store)[index] ?? null),
		removeItem: vi.fn((key: string) => {
			delete store[key]
		}),
		setItem: vi.fn((key: string, value: string) => {
			store[key] = value
		}),
	}
}

describe("useTopicDesktopLayout", () => {
	beforeEach(() => {
		vi.stubGlobal("ResizeObserver", MockResizeObserver)
		// Layout defaults are desktop-specific; jsdom otherwise reports a narrow viewport.
		vi.stubGlobal("innerWidth", 1440)
		vi.stubGlobal("localStorage", createLocalStorageMock())
		localStorage.clear()
		/*
		 * The guide keeps the region it is framing in module memory, and jsdom shares that across the
		 * whole file. Reset it so no test inherits a region another one left behind — without this,
		 * a suite that expects the panel to stay collapsed only passes because of where it sits.
		 */
		setHomeOnboardingAnchor(null)
	})

	afterEach(() => {
		cleanup()
		pubsub.clear()
		localStorage.clear()
		vi.unstubAllGlobals()
	})

	it("should return default widths", () => {
		const { result } = renderHook(() => useTopicDesktopLayout({ isReadOnly: false }))

		expect(result.current.projectSiderWidthPx).toBe(DEFAULT_WIDTH.PROJECT_SIDER)
		expect(result.current.messagePanelWidthPx).toBe(DEFAULT_WIDTH.MESSAGE_PANEL)
		expect(result.current.isConversationPanelCollapsed).toBe(false)
	})

	it("should resize project sider and persist width", () => {
		const { result, rerender } = renderHook(() => useTopicDesktopLayout({ isReadOnly: false }))

		act(() => {
			result.current.startDragProjectSider(100)
		})
		rerender()

		act(() => {
			document.dispatchEvent(new MouseEvent("pointermove", { clientX: 150 }))
			document.dispatchEvent(new MouseEvent("pointerup", { clientX: 150 }))
		})
		rerender()

		expect(result.current.projectSiderWidthPx).toBe(DEFAULT_WIDTH.PROJECT_SIDER + 50)
		expect(localStorage.getItem(PROJECT_SIDER_WIDTH_STORAGE_KEY)).toBe(
			String(DEFAULT_WIDTH.PROJECT_SIDER + 50),
		)
	})

	it("should resize message panel with pointer events", () => {
		const { result, rerender } = renderHook(() => useTopicDesktopLayout({ isReadOnly: false }))

		act(() => {
			result.current.startDragMessagePanel(300)
		})
		rerender()

		act(() => {
			document.dispatchEvent(new MouseEvent("pointermove", { clientX: 260 }))
			document.dispatchEvent(new MouseEvent("pointerup", { clientX: 260 }))
		})
		rerender()

		expect(result.current.messagePanelWidthPx).toBe(DEFAULT_WIDTH.MESSAGE_PANEL + 40)
		expect(localStorage.getItem(MESSAGE_PANEL_WIDTH_STORAGE_KEY)).toBe(
			String(DEFAULT_WIDTH.MESSAGE_PANEL + 40),
		)
	})

	it("should end drag state without persisting when pointer is cancelled", () => {
		const { result, rerender } = renderHook(() => useTopicDesktopLayout({ isReadOnly: false }))

		act(() => {
			result.current.startDragProjectSider(100)
		})
		rerender()
		expect(result.current.isDraggingProjectSider).toBe(true)

		act(() => {
			document.dispatchEvent(new MouseEvent("pointermove", { clientX: 150 }))
			document.dispatchEvent(new MouseEvent("pointercancel", { clientX: 100 }))
		})
		rerender()

		expect(result.current.isDraggingProjectSider).toBe(false)
		expect(localStorage.getItem(PROJECT_SIDER_WIDTH_STORAGE_KEY)).toBeNull()
	})

	it("should toggle conversation panel collapse state", () => {
		const { result, rerender } = renderHook(() => useTopicDesktopLayout({ isReadOnly: false }))

		act(() => {
			result.current.toggleConversationPanel()
		})
		rerender()
		expect(result.current.isConversationPanelCollapsed).toBe(true)

		act(() => {
			result.current.toggleConversationPanel()
		})
		rerender()
		expect(result.current.isConversationPanelCollapsed).toBe(false)
	})

	it("should expand collapsed panel when detail panel becomes visible", () => {
		const { result, rerender } = renderHook(() => useTopicDesktopLayout({ isReadOnly: false }))

		act(() => {
			result.current.toggleConversationPanel()
		})
		rerender()
		expect(result.current.isConversationPanelCollapsed).toBe(true)

		act(() => {
			result.current.ensureExpandedWhenDetailVisible(true)
		})
		rerender()
		expect(result.current.isConversationPanelCollapsed).toBe(false)
	})

	it("should expand collapsed conversation panel when requested globally", () => {
		const { result, rerender } = renderHook(() => useTopicDesktopLayout({ isReadOnly: false }))

		act(() => {
			result.current.toggleConversationPanel()
		})
		rerender()
		expect(result.current.isConversationPanelCollapsed).toBe(true)

		act(() => {
			pubsub.publish(PubSubEvents.Expand_Topic_Conversation_Panel)
		})
		rerender()
		expect(result.current.isConversationPanelCollapsed).toBe(false)
	})

	it("should collapse expanded conversation panel when requested globally", () => {
		const { result, rerender } = renderHook(() => useTopicDesktopLayout({ isReadOnly: false }))

		act(() => {
			pubsub.publish(PubSubEvents.Collapse_Topic_Conversation_Panel)
		})
		rerender()

		expect(result.current.isConversationPanelCollapsed).toBe(true)
	})

	it("should ignore message panel percentage values from storage", () => {
		localStorage.setItem(MESSAGE_PANEL_WIDTH_STORAGE_KEY, "60")

		const { result } = renderHook(() => useTopicDesktopLayout({ isReadOnly: false }))

		expect(result.current.messagePanelWidthPx).toBe(DEFAULT_WIDTH.MESSAGE_PANEL)
	})

	it("should start expanded and avoid persisting collapse state for embedded layouts", () => {
		localStorage.setItem(
			"supermagic-topic-conversation-panel",
			JSON.stringify({ collapsed: true, lastExpandedSize: 420 }),
		)
		vi.mocked(localStorage.setItem).mockClear()

		const { result, rerender } = renderHook(() =>
			useTopicDesktopLayout({
				isReadOnly: false,
				persistConversationPanelState: false,
			}),
		)

		expect(result.current.isConversationPanelCollapsed).toBe(false)

		act(() => {
			result.current.toggleConversationPanel()
		})
		rerender()

		expect(result.current.isConversationPanelCollapsed).toBe(true)
		expect(localStorage.setItem).not.toHaveBeenCalledWith(
			"supermagic-topic-conversation-panel",
			expect.any(String),
		)
	})

	it("should support a temporary layout that starts collapsed and expands globally", () => {
		const { result, rerender } = renderHook(() =>
			useTopicDesktopLayout({
				isReadOnly: false,
				initialConversationPanelCollapsed: true,
				persistConversationPanelState: false,
			}),
		)

		expect(result.current.isConversationPanelCollapsed).toBe(true)

		act(() => {
			pubsub.publish(PubSubEvents.Expand_Topic_Conversation_Panel)
		})
		rerender()

		expect(result.current.isConversationPanelCollapsed).toBe(false)
	})

	describe("project sider collapse preference", () => {
		const chatPersistence = {
			storageKey: CHAT_PROJECT_SIDER_PANEL_STORAGE_KEY,
			defaultCollapsed: true,
		}

		it("keeps the project page preference under its shared key and expanded by default", () => {
			const { result, rerender } = renderHook(() =>
				useTopicDesktopLayout({ isReadOnly: false, enableProjectCollapse: true }),
			)
			expect(result.current.isProjectSiderCollapsed).toBe(false)

			act(() => result.current.collapseProjectSider())
			rerender()

			expect(result.current.isProjectSiderCollapsed).toBe(true)
			expect(
				JSON.parse(localStorage.getItem(PROJECT_SIDER_PANEL_STORAGE_KEY) ?? "{}"),
			).toEqual(expect.objectContaining({ collapsed: true }))
			expect(localStorage.getItem(CHAT_PROJECT_SIDER_PANEL_STORAGE_KEY)).toBeNull()
		})

		it("starts collapsed on first visit when the page opts in", () => {
			const { result } = renderHook(() =>
				useTopicDesktopLayout({
					isReadOnly: false,
					enableProjectCollapse: true,
					projectSiderPanelPersistence: chatPersistence,
				}),
			)

			expect(result.current.isProjectSiderCollapsed).toBe(true)
			// Reading the default must not write anything: only a user choice is a preference.
			expect(localStorage.getItem(CHAT_PROJECT_SIDER_PANEL_STORAGE_KEY)).toBeNull()
		})

		it("ignores the project page preference and does not overwrite it", () => {
			localStorage.setItem(
				PROJECT_SIDER_PANEL_STORAGE_KEY,
				JSON.stringify({ collapsed: false, lastExpandedSize: 320 }),
			)
			const { result, rerender } = renderHook(() =>
				useTopicDesktopLayout({
					isReadOnly: false,
					enableProjectCollapse: true,
					projectSiderPanelPersistence: chatPersistence,
				}),
			)
			expect(result.current.isProjectSiderCollapsed).toBe(true)

			act(() => result.current.expandProjectSider())
			rerender()

			expect(result.current.isProjectSiderCollapsed).toBe(false)
			expect(
				JSON.parse(localStorage.getItem(PROJECT_SIDER_PANEL_STORAGE_KEY) ?? "{}"),
			).toEqual({ collapsed: false, lastExpandedSize: 320 })
			expect(
				JSON.parse(localStorage.getItem(CHAT_PROJECT_SIDER_PANEL_STORAGE_KEY) ?? "{}"),
			).toEqual(expect.objectContaining({ collapsed: false }))
		})

		it("restores the saved choice instead of the default on the next visit", () => {
			localStorage.setItem(
				CHAT_PROJECT_SIDER_PANEL_STORAGE_KEY,
				JSON.stringify({ collapsed: false, lastExpandedSize: 320 }),
			)
			const { result } = renderHook(() =>
				useTopicDesktopLayout({
					isReadOnly: false,
					enableProjectCollapse: true,
					projectSiderPanelPersistence: chatPersistence,
				}),
			)

			expect(result.current.isProjectSiderCollapsed).toBe(false)
		})

		it("never reports collapsed when collapse is not enabled (e.g. read-only)", () => {
			const { result } = renderHook(() =>
				useTopicDesktopLayout({
					isReadOnly: true,
					enableProjectCollapse: false,
					projectSiderPanelPersistence: chatPersistence,
				}),
			)

			expect(result.current.isProjectSiderCollapsed).toBe(false)
		})
	})

	/**
	 * The new-user guide's steps that frame the project files area.
	 *
	 * A collapsed panel is the one state that breaks those steps: the anchor is still published, but
	 * as a zero-width box at the left edge, so the highlight lands on a sliver while the copy beside
	 * it describes a file tree that is not on screen. The panel is the layout's to open, and the
	 * guide announces the region it is about to frame — see `HOME_ONBOARDING_ANCHOR_EVENT`.
	 *
	 * The three cases below are the reaction and its two limits: it opens the panel for the region
	 * the guide is really on, it leaves the panel alone for a region it is not, and it never writes
	 * to the stored preference from a layout whose panel cannot be collapsed in the first place.
	 */
	describe("when the new-user guide frames the project panel", () => {
		beforeEach(() => {
			// The region the run is on lives in the guide's module memory, which jsdom keeps for the
			// whole file.
			setHomeOnboardingAnchor(null)
		})

		afterEach(() => {
			setHomeOnboardingAnchor(null)
		})

		it("opens a panel the user had collapsed", () => {
			const { result, rerender } = renderHook(() =>
				useTopicDesktopLayout({ isReadOnly: false, enableProjectCollapse: true }),
			)

			act(() => result.current.collapseProjectSider())
			rerender()
			expect(result.current.isProjectSiderCollapsed).toBe(true)

			act(() => setHomeOnboardingAnchor(HomeOnboardingAnchor.ProjectSider))
			rerender()

			expect(result.current.isProjectSiderCollapsed).toBe(false)
		})

		it.each([HomeOnboardingAnchor.DeliverableAttachment, "message-header-topic-group"])(
			"leaves the panel alone for a step that frames %s",
			(anchor) => {
				const { result, rerender } = renderHook(() =>
					useTopicDesktopLayout({ isReadOnly: false, enableProjectCollapse: true }),
				)

				act(() => result.current.collapseProjectSider())
				rerender()

				act(() => setHomeOnboardingAnchor(anchor))
				rerender()

				expect(result.current.isProjectSiderCollapsed).toBe(true)
			},
		)

		it("opens it for a panel that mounts while the run is already on the step", () => {
			/*
			 * The entry navigates to the page, so the order is not fixed: this is the shape of a
			 * user who closed the panel on an earlier visit — the choice is in storage — and meets
			 * the guide with the run already on the files step.
			 */
			localStorage.setItem(
				PROJECT_SIDER_PANEL_STORAGE_KEY,
				JSON.stringify({ collapsed: true, lastExpandedSize: 320 }),
			)
			setHomeOnboardingAnchor(HomeOnboardingAnchor.ProjectSider)

			const { result, rerender } = renderHook(() =>
				useTopicDesktopLayout({ isReadOnly: false, enableProjectCollapse: true }),
			)

			/*
			 * The rerender is only how this file reads the store back — `result.current` is the last
			 * render's output, not a live view. What opened the panel is the mount itself: nothing
			 * announces the region after it, so a layout that waited for an event would still be
			 * collapsed here.
			 */
			rerender()

			expect(result.current.isProjectSiderCollapsed).toBe(false)
		})

		it("never writes to the preference from a layout that cannot collapse the panel", () => {
			setHomeOnboardingAnchor(HomeOnboardingAnchor.ProjectSider)
			vi.mocked(localStorage.setItem).mockClear()

			renderHook(() => useTopicDesktopLayout({ isReadOnly: false }))

			expect(localStorage.setItem).not.toHaveBeenCalledWith(
				PROJECT_SIDER_PANEL_STORAGE_KEY,
				expect.any(String),
			)
		})
	})
})
