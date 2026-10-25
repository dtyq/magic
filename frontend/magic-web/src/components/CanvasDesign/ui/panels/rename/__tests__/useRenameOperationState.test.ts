import { act, renderHook } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { useRenameOperationState } from "../useRenameOperationState"

describe("useRenameOperationState", () => {
	it("serializes an operation and allows stopping subsequent work", () => {
		const { result } = renderHook(() => useRenameOperationState())

		act(() => {
			expect(result.current.begin()).toBe(true)
		})
		expect(result.current.saving).toBe(true)
		expect(result.current.begin()).toBe(false)

		act(() => result.current.requestStop())
		expect(result.current.shouldStop()).toBe(true)

		act(() => result.current.finish())
		expect(result.current.saving).toBe(false)
	})

	it("clears an operation error when a new operation begins", () => {
		const { result } = renderHook(() => useRenameOperationState())

		act(() => result.current.setError("rename failed"))
		expect(result.current.error).toBe("rename failed")

		act(() => result.current.begin())
		expect(result.current.error).toBe("")
	})
})
