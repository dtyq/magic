import { act, renderHook } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { usePublishedMicroAppTab } from "../hooks/usePublishedMicroAppTab"

describe("usePublishedMicroAppTab", () => {
	it("opens a published micro-app tab keyed by app id and reuses it on repeat open", () => {
		const { result } = renderHook(() => usePublishedMicroAppTab("project-open"))

		act(() => {
			result.current.openPublishedMicroAppTab({
				appId: "app-1",
				appName: "深圳卓悦线上内购",
			})
		})

		expect(result.current.publishedMicroAppTabs).toHaveLength(1)
		expect(result.current.publishedMicroAppTabs[0]).toMatchObject({
			id: "__micro_app__app-1",
			type: "micro_app",
			title: "深圳卓悦线上内购",
			active: true,
			closeable: true,
		})
		expect(result.current.isPublishedMicroAppTab("__micro_app__app-1")).toBe(true)

		act(() => {
			result.current.openPublishedMicroAppTab({
				appId: "app-2",
				appName: "另一个应用",
			})
		})

		expect(result.current.publishedMicroAppTabs).toHaveLength(2)
		expect(
			result.current.publishedMicroAppTabs.find((tab) => tab.id === "__micro_app__app-1")
				?.active,
		).toBe(false)
		expect(
			result.current.publishedMicroAppTabs.find((tab) => tab.id === "__micro_app__app-2")
				?.active,
		).toBe(true)

		act(() => {
			result.current.openPublishedMicroAppTab({
				appId: "app-1",
				appName: "深圳卓悦线上内购",
			})
		})

		expect(result.current.publishedMicroAppTabs).toHaveLength(2)
		expect(
			result.current.publishedMicroAppTabs.find((tab) => tab.id === "__micro_app__app-1")
				?.active,
		).toBe(true)
	})

	it("preserves the active tab when the viewer remounts for the same project", () => {
		const firstViewer = renderHook(() => usePublishedMicroAppTab("project-persist"))

		act(() => {
			firstViewer.result.current.openPublishedMicroAppTab({
				appId: "app-1",
				appName: "客户看板",
			})
		})
		firstViewer.unmount()

		const nextViewer = renderHook(() => usePublishedMicroAppTab("project-persist"))

		expect(nextViewer.result.current.publishedMicroAppTabs).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					id: "__micro_app__app-1",
					active: true,
					data: { appId: "app-1", appName: "客户看板" },
				}),
			]),
		)
		nextViewer.unmount()
	})

	it("does not share tabs between projects", () => {
		const firstViewer = renderHook(() => usePublishedMicroAppTab("project-isolated-a"))
		act(() => firstViewer.result.current.openPublishedMicroAppTab({ appId: "app-a" }))
		firstViewer.unmount()

		const secondViewer = renderHook(() => usePublishedMicroAppTab("project-isolated-b"))

		expect(secondViewer.result.current.publishedMicroAppTabs).toEqual([])
		secondViewer.unmount()
	})

	it("does not restore a tab after the user closes it", () => {
		const firstViewer = renderHook(() => usePublishedMicroAppTab("project-closed"))
		act(() => firstViewer.result.current.openPublishedMicroAppTab({ appId: "app-closed" }))
		act(() => firstViewer.result.current.closePublishedMicroAppTab("__micro_app__app-closed"))
		firstViewer.unmount()

		const nextViewer = renderHook(() => usePublishedMicroAppTab("project-closed"))

		expect(nextViewer.result.current.publishedMicroAppTabs).toEqual([])
		nextViewer.unmount()
	})

	it("ignores empty app ids", () => {
		const { result } = renderHook(() => usePublishedMicroAppTab("project-empty"))

		act(() => {
			result.current.openPublishedMicroAppTab({ appId: "  " })
		})

		expect(result.current.publishedMicroAppTabs).toHaveLength(0)
	})
})
