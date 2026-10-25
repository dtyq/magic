import { act, renderHook, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import type { OptionItem } from "../../../panels/types"
import { useSlidesTemplateFavorite } from "../useSlidesTemplateFavorite"

const template: OptionItem = {
	value: "PPT-business",
	label: "Business",
	is_favorite: false,
}

function createDeferred<T>() {
	let resolve!: (value: T) => void
	const promise = new Promise<T>((promiseResolve) => {
		resolve = promiseResolve
	})
	return { promise, resolve }
}

describe("useSlidesTemplateFavorite", () => {
	it("returns the updated favorite state after a successful request", async () => {
		const adapter = {
			favorite: vi.fn(async () => undefined),
			unfavorite: vi.fn(async () => undefined),
		}
		const updateFavorite = vi.fn()
		const { result } = renderHook(() => useSlidesTemplateFavorite(adapter))

		await act(async () => {
			await expect(result.current.toggleFavorite(template, updateFavorite)).resolves.toBe(
				true,
			)
			await expect(
				result.current.toggleFavorite({ ...template, is_favorite: true }, updateFavorite),
			).resolves.toBe(false)
		})

		expect(adapter.favorite).toHaveBeenCalledWith("PPT-business")
		expect(adapter.unfavorite).toHaveBeenCalledWith("PPT-business")
	})

	it("rolls back an optimistic update and clears pending state after failure", async () => {
		const adapter = {
			favorite: vi.fn(async () => Promise.reject(new Error("network error"))),
			unfavorite: vi.fn(async () => undefined),
		}
		const updateFavorite = vi.fn()
		const { result } = renderHook(() => useSlidesTemplateFavorite(adapter))

		await act(async () => {
			await expect(result.current.toggleFavorite(template, updateFavorite)).rejects.toThrow(
				"network error",
			)
		})

		expect(updateFavorite).toHaveBeenNthCalledWith(1, "PPT-business", true, template)
		expect(updateFavorite).toHaveBeenNthCalledWith(2, "PPT-business", false, template)
		expect(result.current.pendingCodes.has("PPT-business")).toBe(false)
	})

	it("ignores a repeated toggle while the same template request is pending", async () => {
		const request = createDeferred<void>()
		const adapter = {
			favorite: vi.fn(() => request.promise),
			unfavorite: vi.fn(async () => undefined),
		}
		const updateFavorite = vi.fn()
		const { result } = renderHook(() => useSlidesTemplateFavorite(adapter))

		let firstRequest!: Promise<boolean | undefined>
		let repeatedRequest!: Promise<boolean | undefined>
		act(() => {
			firstRequest = result.current.toggleFavorite(template, updateFavorite)
			repeatedRequest = result.current.toggleFavorite(template, updateFavorite)
		})

		expect(adapter.favorite).toHaveBeenCalledTimes(1)
		await expect(repeatedRequest).resolves.toBeUndefined()
		expect(result.current.pendingCodes.has("PPT-business")).toBe(true)
		request.resolve()
		await act(async () => firstRequest)
		await waitFor(() => expect(result.current.pendingCodes.has("PPT-business")).toBe(false))
	})
})
