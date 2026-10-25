import { act, renderHook } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { useStableArrayReference } from "../useStableArrayReference"

describe("useStableArrayReference", () => {
	it("reuses the previous array when every element reference is unchanged", () => {
		const first = { key: "first" }
		const second = { key: "second" }
		const { result, rerender } = renderHook(({ value }) => useStableArrayReference(value), {
			initialProps: { value: [first, second] },
		})
		const stable = result.current

		rerender({ value: [first, second] })

		expect(result.current).toBe(stable)
	})

	it("returns the new array when an element or length changes", () => {
		const first = { key: "first" }
		const second = { key: "second" }
		const third = { key: "third" }
		const { result, rerender } = renderHook(({ value }) => useStableArrayReference(value), {
			initialProps: { value: [first, second] },
		})
		const initial = result.current

		rerender({ value: [{ key: "replacement" }, second] })
		const replaced = result.current
		expect(replaced).not.toBe(initial)

		rerender({ value: [third, first, second] })
		const prepended = result.current
		expect(prepended).not.toBe(replaced)

		rerender({ value: [third, first] })
		expect(result.current).not.toBe(prepended)
	})

	it("does not mutate the input array or its elements", () => {
		const first = { key: "first" }
		const input = [first]
		const { result } = renderHook(() => useStableArrayReference(input))

		act(() => {
			input.push({ key: "second" })
		})

		expect(result.current).toBe(input)
		expect(result.current[0]).toBe(first)
	})
})
