import { act, renderHook } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { usePendingActionGuard } from "../usePendingActionGuard"

describe("usePendingActionGuard", () => {
	it("runs an action immediately when it is not blocked", async () => {
		const action = vi.fn()
		const { result } = renderHook(() => usePendingActionGuard({ shouldBlock: () => false }))

		await act(async () => {
			await expect(result.current.run(action, undefined)).resolves.toBe(true)
		})

		expect(action).toHaveBeenCalledOnce()
		expect(result.current.isPending).toBe(false)
	})

	it("defers a blocked action until it is resolved", async () => {
		const action = vi.fn()
		const onBlocked = vi.fn()
		const { result } = renderHook(() =>
			usePendingActionGuard({ shouldBlock: () => true, onBlocked }),
		)

		let pendingResult: Promise<boolean> | undefined
		act(() => {
			pendingResult = result.current.run(action, { target: "next" })
		})

		expect(action).not.toHaveBeenCalled()
		expect(onBlocked).toHaveBeenCalledWith({ target: "next" })
		expect(result.current.pendingContext).toEqual({ target: "next" })
		expect(result.current.isPending).toBe(true)

		await act(async () => {
			await expect(result.current.resolve(true)).resolves.toBe(true)
			await expect(pendingResult).resolves.toBe(true)
		})

		expect(action).toHaveBeenCalledOnce()
		expect(result.current.isPending).toBe(false)
	})

	it("does not replace a pending action when another action is requested", async () => {
		const firstAction = vi.fn()
		const secondAction = vi.fn()
		const { result } = renderHook(() => usePendingActionGuard({ shouldBlock: () => true }))

		let firstResult: Promise<boolean> | undefined
		let secondResult: Promise<boolean> | undefined
		act(() => {
			firstResult = result.current.run(firstAction, undefined)
			secondResult = result.current.run(secondAction, undefined)
		})

		await expect(secondResult).resolves.toBe(false)
		await act(async () => {
			await result.current.resolve(true)
		})
		await expect(firstResult).resolves.toBe(true)
		expect(firstAction).toHaveBeenCalledOnce()
		expect(secondAction).not.toHaveBeenCalled()
	})

	it("resolves a blocked action with false when cancelled", async () => {
		const action = vi.fn()
		const { result } = renderHook(() => usePendingActionGuard({ shouldBlock: () => true }))

		let pendingResult: Promise<boolean> | undefined
		act(() => {
			pendingResult = result.current.run(action, undefined)
		})

		act(() => {
			result.current.cancel()
		})

		await expect(pendingResult).resolves.toBe(false)
		expect(action).not.toHaveBeenCalled()
		expect(result.current.isPending).toBe(false)
	})
})
