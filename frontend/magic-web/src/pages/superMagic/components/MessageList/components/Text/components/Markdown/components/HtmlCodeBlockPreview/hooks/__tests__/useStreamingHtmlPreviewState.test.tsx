import { act, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useStreamingHtmlPreviewState } from "../useStreamingHtmlPreviewState"

describe("useStreamingHtmlPreviewState", () => {
	beforeEach(() => {
		vi.useFakeTimers()
	})

	afterEach(() => {
		vi.useRealTimers()
	})

	it("keeps the last safe html prefix until the streaming script closes", async () => {
		const safePrefix = "<html><body><main>Report</main>"
		const { result, rerender } = renderHook(
			({ content }) => useStreamingHtmlPreviewState({ content }),
			{
				initialProps: {
					content: `${safePrefix}<script>const chart = createChart(`,
				},
			},
		)

		expect(result.current.committedContent).toBe(safePrefix)

		rerender({ content: `${safePrefix}<script>const chart = createChart({ title: "EIC"` })
		await act(async () => {
			await vi.advanceTimersByTimeAsync(480)
		})

		expect(result.current.committedContent).toBe(safePrefix)

		const completeContent = `${safePrefix}<script>const chart = createChart({ title: "EIC" })</script></body></html>`
		rerender({ content: completeContent })
		await act(async () => {
			await vi.advanceTimersByTimeAsync(480)
		})

		expect(result.current.committedContent).toBe(completeContent)
	})

	it("still batches ordinary static html updates", async () => {
		const { result, rerender } = renderHook(
			({ content }) => useStreamingHtmlPreviewState({ content }),
			{ initialProps: { content: "<main>First</main>" } },
		)

		rerender({ content: "<main>First</main><section>Second</section>" })
		expect(result.current.committedContent).toBe("<main>First</main>")

		await act(async () => {
			await vi.advanceTimersByTimeAsync(480)
		})

		expect(result.current.committedContent).toBe("<main>First</main><section>Second</section>")
	})

	it("stops a pending safe commit when streaming is suspended", async () => {
		const { result, rerender } = renderHook(
			({ content, isSuspended }) => useStreamingHtmlPreviewState({ content, isSuspended }),
			{
				initialProps: { content: "<main>First</main>", isSuspended: false },
			},
		)

		rerender({
			content: "<main>First</main><section>Second</section>",
			isSuspended: false,
		})
		rerender({
			content: "<main>First</main><section>Second</section>",
			isSuspended: true,
		})

		await act(async () => {
			await vi.advanceTimersByTimeAsync(120)
		})

		expect(result.current.committedContent).toBe("<main>First</main>")
	})
})
