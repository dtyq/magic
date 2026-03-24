import { act, renderHook } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { useDeferUntilFileTabsCacheLoaded } from "../useDeferUntilFileTabsCacheLoaded"

describe("useDeferUntilFileTabsCacheLoaded", () => {
	it("无 projectId 时 schedule 通过 setTimeout 执行", async () => {
		const fn = vi.fn()
		const { result } = renderHook(() => useDeferUntilFileTabsCacheLoaded(undefined))

		act(() => {
			result.current.scheduleWhenTabsCacheReady(fn)
		})

		expect(fn).not.toHaveBeenCalled()
		await act(async () => {
			await vi.waitFor(() => expect(fn).toHaveBeenCalledTimes(1))
		})
	})

	it("未就绪时排队，仅最后一次在 onFileTabsCacheLoaded 后执行", async () => {
		const first = vi.fn()
		const second = vi.fn()
		const { result } = renderHook(() => useDeferUntilFileTabsCacheLoaded("p1"))

		act(() => {
			result.current.scheduleWhenTabsCacheReady(first)
			result.current.scheduleWhenTabsCacheReady(second)
		})

		expect(first).not.toHaveBeenCalled()
		expect(second).not.toHaveBeenCalled()

		act(() => {
			result.current.onFileTabsCacheLoaded("p1")
		})

		await act(async () => {
			await vi.waitFor(() => expect(second).toHaveBeenCalledTimes(1))
		})
		expect(first).not.toHaveBeenCalled()
	})

	it("projectId 不匹配时不视为就绪", async () => {
		const fn = vi.fn()
		const { result } = renderHook(() => useDeferUntilFileTabsCacheLoaded("p1"))

		act(() => {
			result.current.scheduleWhenTabsCacheReady(fn)
			result.current.onFileTabsCacheLoaded("other")
		})

		await new Promise((r) => setTimeout(r, 30))
		expect(fn).not.toHaveBeenCalled()
	})

	it("projectId 变化后清空 pending", async () => {
		const fn = vi.fn()
		const { result, rerender } = renderHook(
			({ pid }: { pid?: string }) => useDeferUntilFileTabsCacheLoaded(pid),
			{ initialProps: { pid: "p1" as string | undefined } },
		)

		act(() => {
			result.current.scheduleWhenTabsCacheReady(fn)
		})

		rerender({ pid: "p2" })

		act(() => {
			result.current.onFileTabsCacheLoaded("p1")
		})

		await new Promise((r) => setTimeout(r, 30))
		expect(fn).not.toHaveBeenCalled()
	})
})
