import { act, renderHook, waitFor } from "@testing-library/react"
import { createRef } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { useElementVisibility } from "../useElementVisibility"

describe("useElementVisibility", () => {
	afterEach(() => {
		vi.unstubAllGlobals()
		vi.restoreAllMocks()
	})

	it("falls back to visible when IntersectionObserver is unavailable", () => {
		vi.stubGlobal("IntersectionObserver", undefined)
		const element = document.createElement("div")
		const ref = createRef<HTMLDivElement>()
		Object.defineProperty(ref, "current", { value: element })

		const { result } = renderHook(() => useElementVisibility(ref))

		expect(result.current).toBe(true)
	})

	it("updates visibility from IntersectionObserver and disconnects on unmount", async () => {
		let callback: IntersectionObserverCallback | undefined
		const disconnect = vi.fn()
		vi.stubGlobal(
			"IntersectionObserver",
			vi.fn((nextCallback: IntersectionObserverCallback) => {
				callback = nextCallback
				return { observe: vi.fn(), disconnect }
			}),
		)
		const element = document.createElement("div")
		const ref = createRef<HTMLDivElement>()
		Object.defineProperty(ref, "current", { value: element })

		const { result, unmount } = renderHook(() => useElementVisibility(ref))
		act(() => {
			callback?.(
				[{ isIntersecting: true } as IntersectionObserverEntry],
				{} as IntersectionObserver,
			)
		})

		await waitFor(() => expect(result.current).toBe(true))
		unmount()
		expect(disconnect).toHaveBeenCalledTimes(1)
	})

	it("requires the configured intersection ratio inside a referenced root", async () => {
		let callback: IntersectionObserverCallback | undefined
		let observerOptions: IntersectionObserverInit | undefined
		vi.stubGlobal(
			"IntersectionObserver",
			vi.fn(
				(
					nextCallback: IntersectionObserverCallback,
					nextOptions: IntersectionObserverInit,
				) => {
					callback = nextCallback
					observerOptions = nextOptions
					return { observe: vi.fn(), disconnect: vi.fn() }
				},
			),
		)
		const element = document.createElement("div")
		const root = document.createElement("div")
		const ref = createRef<HTMLDivElement>()
		const rootRef = createRef<HTMLDivElement>()
		Object.defineProperty(ref, "current", { value: element })
		Object.defineProperty(rootRef, "current", { value: root })

		const { result } = renderHook(() =>
			useElementVisibility(ref, {
				minimumIntersectionRatio: 0.99,
				rootMargin: "0px -48px",
				rootRef,
				threshold: [0, 0.99, 1],
			}),
		)

		expect(observerOptions).toMatchObject({ root, rootMargin: "0px -48px" })
		act(() => {
			callback?.(
				[{ intersectionRatio: 0.8, isIntersecting: true } as IntersectionObserverEntry],
				{} as IntersectionObserver,
			)
		})
		expect(result.current).toBe(false)

		act(() => {
			callback?.(
				[{ intersectionRatio: 1, isIntersecting: true } as IntersectionObserverEntry],
				{} as IntersectionObserver,
			)
		})
		await waitFor(() => expect(result.current).toBe(true))
	})

	it("observes a dynamically mounted element without carrying visibility from the old node", async () => {
		const callbacks: IntersectionObserverCallback[] = []
		vi.stubGlobal(
			"IntersectionObserver",
			vi.fn((callback: IntersectionObserverCallback) => {
				callbacks.push(callback)
				return { observe: vi.fn(), disconnect: vi.fn() }
			}),
		)
		const first = document.createElement("section")
		const second = document.createElement("section")
		const { result, rerender } = renderHook(
			({ element }: { element: HTMLElement | null }) => useElementVisibility(element),
			{ initialProps: { element: first as HTMLElement | null } },
		)

		act(() => {
			callbacks[0]?.(
				[
					{
						target: first,
						intersectionRatio: 1,
						isIntersecting: true,
					} as IntersectionObserverEntry,
				],
				{} as IntersectionObserver,
			)
		})
		await waitFor(() => expect(result.current).toBe(true))

		rerender({ element: second })
		expect(result.current).toBe(false)
		act(() => {
			callbacks[1]?.(
				[
					{
						target: second,
						intersectionRatio: 1,
						isIntersecting: true,
					} as IntersectionObserverEntry,
				],
				{} as IntersectionObserver,
			)
		})
		await waitFor(() => expect(result.current).toBe(true))
	})

	it("requires a foreground document when requested", async () => {
		let callback: IntersectionObserverCallback | undefined
		let visibilityState: DocumentVisibilityState = "hidden"
		vi.spyOn(document, "visibilityState", "get").mockImplementation(() => visibilityState)
		vi.stubGlobal(
			"IntersectionObserver",
			vi.fn((nextCallback: IntersectionObserverCallback) => {
				callback = nextCallback
				return { observe: vi.fn(), disconnect: vi.fn() }
			}),
		)
		const element = document.createElement("section")
		const { result } = renderHook(() =>
			useElementVisibility(element, { requireDocumentVisible: true }),
		)

		act(() => {
			callback?.(
				[
					{
						target: element,
						intersectionRatio: 1,
						isIntersecting: true,
					} as IntersectionObserverEntry,
				],
				{} as IntersectionObserver,
			)
		})
		expect(result.current).toBe(false)

		visibilityState = "visible"
		act(() => document.dispatchEvent(new Event("visibilitychange")))
		await waitFor(() => expect(result.current).toBe(true))
	})
})
