import { act, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
	HTML_PREVIEW_READY_TIMEOUT,
	HTML_PREVIEW_SLOW_THRESHOLD,
	useHtmlPreviewFreshness,
} from "../useHtmlPreviewFreshness"

describe("HTML preview freshness", () => {
	it("keeps background checks quiet but times out an actual render", () => {
		const { result } = renderHook(() => useHtmlPreviewFreshness("file-a"))
		let request = 0
		act(() => {
			request = result.current.begin(false)
		})
		act(() => vi.advanceTimersByTime(HTML_PREVIEW_READY_TIMEOUT))
		expect(result.current.phase).toBe("idle")
		act(() => result.current.rendering(request))
		act(() => vi.advanceTimersByTime(HTML_PREVIEW_READY_TIMEOUT))
		expect(result.current.phase).toBe("failed")
	})
	it("flags a slow update without failing it, then recovers on acknowledgement", () => {
		const onFailed = vi.fn()
		const { result } = renderHook(() => useHtmlPreviewFreshness("file-a", onFailed))
		let request = 0
		act(() => {
			request = result.current.begin()
		})
		act(() => vi.advanceTimersByTime(HTML_PREVIEW_SLOW_THRESHOLD))
		expect(result.current.phase).toBe("updating")
		expect(result.current.slow).toBe(true)
		expect(onFailed).not.toHaveBeenCalled()
		act(() => result.current.ready(request))
		expect(result.current.phase).toBe("idle")
		expect(result.current.slow).toBe(false)
	})
	it("fails only after the hard timeout and reports the elapsed time", () => {
		const onFailed = vi.fn()
		const { result } = renderHook(() => useHtmlPreviewFreshness("file-a", onFailed))
		act(() => {
			result.current.begin()
		})
		act(() => vi.advanceTimersByTime(HTML_PREVIEW_READY_TIMEOUT - 1))
		expect(result.current.phase).toBe("updating")
		act(() => vi.advanceTimersByTime(1))
		expect(result.current.phase).toBe("failed")
		expect(onFailed).toHaveBeenCalledWith(
			expect.objectContaining({
				reason: "update_timeout",
				elapsedMs: HTML_PREVIEW_READY_TIMEOUT,
			}),
		)
	})
	beforeEach(() => vi.useFakeTimers())
	afterEach(() => vi.useRealTimers())
	it("keeps later work pending when an earlier refresh succeeds or fails", () => {
		const { result } = renderHook(() => useHtmlPreviewFreshness("file-a"))
		let previous = 0
		let current = 0
		act(() => {
			previous = result.current.begin()
			current = result.current.begin()
		})
		act(() => {
			result.current.ready(previous)
			result.current.fail(previous, "load_failed")
		})
		expect(result.current.phase).toBe("updating")
		act(() => result.current.rendering(current))
		expect(result.current.phase).toBe("rendering")
		act(() => result.current.ready(current))
		expect(result.current.phase).toBe("idle")
		expect(result.current.hasRendered).toBe(true)
	})
	it("reports an unacknowledged preview and accepts a late acknowledgement", () => {
		const { result } = renderHook(() => useHtmlPreviewFreshness("file-a"))
		let request = 0
		act(() => {
			request = result.current.begin()
			result.current.rendering(request)
		})
		act(() => vi.advanceTimersByTime(HTML_PREVIEW_READY_TIMEOUT))
		expect(result.current.phase).toBe("failed")
		expect(result.current.hasRendered).toBe(false)
		act(() => result.current.ready(request))
		expect(result.current.phase).toBe("idle")
	})
	it("allows retry without forgetting the last working preview", () => {
		const { result } = renderHook(() => useHtmlPreviewFreshness("file-a"))
		act(() => {
			const request = result.current.begin()
			result.current.ready(request)
		})
		act(() => {
			const request = result.current.begin()
			result.current.fail(request, "load_failed")
		})
		expect(result.current.hasRendered).toBe(true)
		expect(result.current.phase).toBe("failed")
		act(() => result.current.begin())
		expect(result.current.phase).toBe("updating")
	})
	it("invalidates pending work on file switches and unmount", () => {
		const { result, rerender, unmount } = renderHook(
			({ file }) => useHtmlPreviewFreshness(file),
			{ initialProps: { file: "a" } },
		)
		let request = 0
		act(() => {
			request = result.current.begin()
		})
		rerender({ file: "b" })
		expect(result.current.isCurrent(request)).toBe(false)
		expect(result.current.phase).toBe("idle")
		act(() => {
			request = result.current.begin()
		})
		unmount()
		expect(result.current.isCurrent(request)).toBe(false)
		expect(vi.getTimerCount()).toBe(0)
	})
	it("reports why a generation failed, with whether anything was shown", () => {
		const onFailed = vi.fn()
		const { result } = renderHook(() => useHtmlPreviewFreshness("file-a", onFailed))
		let request = 0
		act(() => {
			request = result.current.begin()
		})
		act(() => vi.advanceTimersByTime(HTML_PREVIEW_READY_TIMEOUT))
		expect(onFailed).toHaveBeenLastCalledWith({
			reason: "update_timeout",
			elapsedMs: HTML_PREVIEW_READY_TIMEOUT,
			hasRendered: false,
			error: undefined,
		})

		act(() => {
			request = result.current.begin()
			result.current.rendering(request)
		})
		act(() => vi.advanceTimersByTime(HTML_PREVIEW_READY_TIMEOUT))
		expect(onFailed).toHaveBeenLastCalledWith(
			expect.objectContaining({ reason: "render_timeout", hasRendered: false }),
		)

		const cause = new Error("boom")
		act(() => {
			request = result.current.begin()
			result.current.ready(request)
		})
		act(() => {
			request = result.current.begin()
			result.current.fail(request, "process_failed", cause)
		})
		expect(onFailed).toHaveBeenLastCalledWith(
			expect.objectContaining({
				reason: "process_failed",
				hasRendered: true,
				error: cause,
			}),
		)
		expect(onFailed).toHaveBeenCalledTimes(3)
	})
	it("does not report failures superseded by a newer generation", () => {
		const onFailed = vi.fn()
		const { result } = renderHook(() => useHtmlPreviewFreshness("file-a", onFailed))
		let previous = 0
		act(() => {
			previous = result.current.begin()
			result.current.begin()
		})
		act(() => result.current.fail(previous, "load_failed", new Error("late")))
		expect(onFailed).not.toHaveBeenCalled()
	})
})
