import { act, renderHook } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import type { PPTStore } from "../../stores/PPTStore"
import { useSlideHandlers } from "../useSlideHandlers"

vi.mock("ahooks", async () => {
	const React = await import("react")
	function useMemoizedFn<T extends (...args: never[]) => unknown>(fn: T): T {
		const fnRef = React.useRef(fn)
		fnRef.current = fn
		return React.useCallback(((...args: never[]) => fnRef.current(...args)) as T, [])
	}
	return { useMemoizedFn }
})

function createStore(resolvers: Array<() => void>) {
	return {
		isTransitioning: false,
		slides: [{ path: "a.html" }, { path: "b.html" }, { path: "c.html" }],
		getFileIdByPath: (path: string) => `id-${path}`,
		refreshSlideByFileId: vi.fn(
			() =>
				new Promise<void>((resolve) => {
					resolvers.push(resolve)
				}),
		),
	} as unknown as PPTStore
}

describe("useSlideHandlers refresh all progress", () => {
	it("reports done/total while refreshing and clears when finished", async () => {
		const resolvers: Array<() => void> = []
		const store = createStore(resolvers)
		const { result } = renderHook(() =>
			useSlideHandlers({
				store,
				setIsAnySlideEditing: vi.fn(),
				setIsSidebarCollapsed: vi.fn(),
			}),
		)

		expect(result.current.refreshAllProgress).toBeNull()

		let refreshPromise: Promise<void> = Promise.resolve()
		act(() => {
			refreshPromise = result.current.handleRefreshAllSlides()
		})
		expect(result.current.refreshAllProgress).toEqual({ done: 0, total: 3 })

		await act(async () => {
			resolvers[0]()
			await Promise.resolve()
		})
		expect(result.current.refreshAllProgress).toEqual({ done: 1, total: 3 })

		await act(async () => {
			resolvers[1]()
			resolvers[2]()
			await refreshPromise
		})
		expect(result.current.refreshAllProgress).toBeNull()
	})

	it("ignores a second click while a refresh is running", async () => {
		const resolvers: Array<() => void> = []
		const store = createStore(resolvers)
		const { result } = renderHook(() =>
			useSlideHandlers({
				store,
				setIsAnySlideEditing: vi.fn(),
				setIsSidebarCollapsed: vi.fn(),
			}),
		)

		let refreshPromise: Promise<void> = Promise.resolve()
		act(() => {
			refreshPromise = result.current.handleRefreshAllSlides()
		})
		await act(async () => {
			await result.current.handleRefreshAllSlides()
		})
		expect(store.refreshSlideByFileId).toHaveBeenCalledTimes(3)

		await act(async () => {
			resolvers.forEach((resolve) => resolve())
			await refreshPromise
		})
	})
})
