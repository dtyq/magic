import { act, renderHook } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { usePublishedMicroAppTab } from "../usePublishedMicroAppTab"

const cached = [
	{ appId: "app-a", appName: "A", active: false, createdAt: 1 },
	{ appId: "app-b", appName: "B", active: true, createdAt: 2 },
]

describe("usePublishedMicroAppTab restore", () => {
	it("rebuilds cached tabs and restores the cached active tab", () => {
		const { result } = renderHook(() => usePublishedMicroAppTab("restore-project-1"))
		act(() => result.current.restorePublishedMicroAppTabs(cached, { restoreActive: true }))
		expect(result.current.publishedMicroAppTabs.map((t) => [t.data.appId, t.active])).toEqual([
			["app-a", false],
			["app-b", true],
		])
	})

	it("keeps the user's current tab when restoring without activation", () => {
		const { result } = renderHook(() => usePublishedMicroAppTab("restore-project-2"))
		act(() => result.current.openPublishedMicroAppTab({ appId: "app-b", appName: "B" }))
		act(() => result.current.restorePublishedMicroAppTabs(cached, { restoreActive: false }))
		const tabs = result.current.publishedMicroAppTabs
		expect(tabs.map((t) => t.data.appId).sort()).toEqual(["app-a", "app-b"])
		expect(tabs.filter((t) => t.active).map((t) => t.data.appId)).toEqual(["app-b"])
	})
})
