import { describe, it, expect, vi } from "vitest"
import { fetchPaddingData } from "../request"

describe("fetchPadingData", () => {
	it("应该正确处理单次请求", async () => {
		const mockFetch = vi.fn().mockResolvedValue({
			items: [1, 2, 3],
			has_more: false,
			page_token: "123",
		})

		const result = await fetchPaddingData(mockFetch)

		expect(mockFetch).toHaveBeenCalledTimes(1)
		expect(mockFetch).toHaveBeenCalledWith({ page_token: "" })
		expect(result).toEqual([1, 2, 3])
	})

	it("应该正确处理多次请求", async () => {
		const mockFetch = vi
			.fn()
			.mockResolvedValueOnce({
				items: [1, 2, 3],
				has_more: true,
				page_token: "123",
			})
			.mockResolvedValueOnce({
				items: [4, 5, 6],
				has_more: false,
				next_offset: "",
			})

		const result = await fetchPaddingData(mockFetch)

		expect(mockFetch).toHaveBeenCalledTimes(2)
		expect(mockFetch).toHaveBeenNthCalledWith(1, { page_token: "" })
		expect(mockFetch).toHaveBeenNthCalledWith(2, { page_token: "123" })
		expect(result).toEqual([1, 2, 3, 4, 5, 6])
	})

	it("应该正确使用resolveArray选项", async () => {
		const mockFetch = vi.fn().mockResolvedValue({
			items: [1, 2, 3],
			has_more: false,
			page_token: "123",
		})

		const result = await fetchPaddingData(mockFetch)

		expect(mockFetch).toHaveBeenCalledTimes(1)
		expect(mockFetch).toHaveBeenCalledWith({ page_token: "" })
		expect(result).toEqual([1, 2, 3])
	})

	it("应该正确处理prevData参数", async () => {
		const mockFetch = vi.fn().mockResolvedValue({
			items: [4, 5, 6],
			has_more: false,
			next_offset: 6,
		})

		const result = await fetchPaddingData(mockFetch, [1, 2, 3])

		expect(mockFetch).toHaveBeenCalledTimes(1)
		expect(mockFetch).toHaveBeenCalledWith({ page_token: "" })
		expect(result).toEqual([1, 2, 3, 4, 5, 6])
	})

	it("应该正确处理空数据", async () => {
		const mockFetch = vi.fn().mockResolvedValue({
			items: [],
			has_more: false,
			next_offset: 0,
		})

		const result = await fetchPaddingData(mockFetch)

		expect(mockFetch).toHaveBeenCalledTimes(1)
		expect(result).toEqual([])
	})

	it("应该正确处理请求错误", async () => {
		const mockFetch = vi.fn().mockRejectedValue(new Error("网络错误"))

		await expect(fetchPaddingData(mockFetch)).rejects.toThrow("网络错误")
	})
})
