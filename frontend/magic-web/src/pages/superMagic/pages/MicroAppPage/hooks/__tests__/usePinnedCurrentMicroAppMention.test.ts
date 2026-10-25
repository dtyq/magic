import { renderHook } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { usePinnedCurrentMicroAppMention } from "../usePinnedCurrentMicroAppMention"

describe("usePinnedCurrentMicroAppMention", () => {
	it("pins the current app while enabled and clears on unmount", () => {
		const mentionPanelStore = { setPinnedCurrentMicroApp: vi.fn() }
		const { unmount } = renderHook(() =>
			usePinnedCurrentMicroAppMention({
				mentionPanelStore: mentionPanelStore as never,
				enabled: true,
				appId: "app-1",
				appName: "Todo App",
			}),
		)

		expect(mentionPanelStore.setPinnedCurrentMicroApp).toHaveBeenCalledWith({
			appId: "app-1",
			appName: "Todo App",
		})

		unmount()
		expect(mentionPanelStore.setPinnedCurrentMicroApp).toHaveBeenLastCalledWith(null)
	})

	it("clears the pin when the current scene is locked to development", () => {
		const mentionPanelStore = { setPinnedCurrentMicroApp: vi.fn() }
		renderHook(() =>
			usePinnedCurrentMicroAppMention({
				mentionPanelStore: mentionPanelStore as never,
				enabled: false,
				appId: "app-1",
				appName: "Todo App",
			}),
		)

		expect(mentionPanelStore.setPinnedCurrentMicroApp).toHaveBeenCalledWith(null)
	})
})
