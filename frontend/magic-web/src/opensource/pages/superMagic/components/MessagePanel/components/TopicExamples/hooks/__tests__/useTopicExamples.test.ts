import { renderHook, waitFor } from "@testing-library/react"
import { describe, it, expect, beforeEach, vi } from "vitest"
import { useTopicExamples } from "../useTopicExamples"
import { TopicMode } from "@/opensource/pages/superMagic/pages/Workspace/types"

// Mock fetch
global.fetch = vi.fn()

const mockExampleData = {
	[TopicMode.Translate]: [
		{
			id: 0,
			title: { zh_CN: "翻译示例1", en_US: "Translation Example 1" },
			content: { zh_CN: "翻译内容1", en_US: "Translation content 1" },
		},
		{
			id: 1,
			title: { zh_CN: "翻译示例2", en_US: "Translation Example 2" },
			content: { zh_CN: "翻译内容2", en_US: "Translation content 2" },
		},
		{
			id: 2,
			title: { zh_CN: "翻译示例3", en_US: "Translation Example 3" },
			content: { zh_CN: "翻译内容3", en_US: "Translation content 3" },
		},
		{
			id: 3,
			title: { zh_CN: "翻译示例4", en_US: "Translation Example 4" },
			content: { zh_CN: "翻译内容4", en_US: "Translation content 4" },
		},
		{
			id: 4,
			title: { zh_CN: "翻译示例5", en_US: "Translation Example 5" },
			content: { zh_CN: "翻译内容5", en_US: "Translation content 5" },
		},
		{
			id: 5,
			title: { zh_CN: "翻译示例6", en_US: "Translation Example 6" },
			content: { zh_CN: "翻译内容6", en_US: "Translation content 6" },
		},
	],
	[TopicMode.Write]: [
		{
			id: 0,
			title: { zh_CN: "写作示例1", en_US: "Writing Example 1" },
			content: { zh_CN: "写作内容1", en_US: "Writing content 1" },
		},
		{
			id: 1,
			title: { zh_CN: "写作示例2", en_US: "Writing Example 2" },
			content: { zh_CN: "写作内容2", en_US: "Writing content 2" },
		},
	],
}

describe("useTopicExamples", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		// Reset global cache
		;(global.fetch as any).mockResolvedValue({
			json: async () => mockExampleData,
		})
	})

	it("should fetch and return examples for given mode", async () => {
		const { result } = renderHook(() =>
			useTopicExamples({
				topicMode: TopicMode.Translate,
				count: 5,
				enabled: true,
			}),
		)

		// Initially loading
		expect(result.current.loading).toBe(true)
		expect(result.current.exampleList).toEqual([])

		// Wait for data to load
		await waitFor(() => {
			expect(result.current.loading).toBe(false)
		})

		// Should have examples
		expect(result.current.exampleList.length).toBeGreaterThan(0)
		expect(result.current.exampleList.length).toBeLessThanOrEqual(5)
		expect(result.current.allExampleList).toEqual(mockExampleData)
	})

	it("should return empty list for Chat mode", async () => {
		const { result } = renderHook(() =>
			useTopicExamples({
				topicMode: TopicMode.Chat,
				count: 5,
				enabled: true,
			}),
		)

		await waitFor(() => {
			expect(result.current.loading).toBe(false)
		})

		expect(result.current.exampleList).toEqual([])
	})

	it("should return empty list for RecordSummary mode", async () => {
		const { result } = renderHook(() =>
			useTopicExamples({
				topicMode: TopicMode.RecordSummary,
				count: 5,
				enabled: true,
			}),
		)

		await waitFor(() => {
			expect(result.current.loading).toBe(false)
		})

		expect(result.current.exampleList).toEqual([])
	})

	it("should refresh examples when refreshExamples is called", async () => {
		const { result } = renderHook(() =>
			useTopicExamples({
				topicMode: TopicMode.Translate,
				count: 5,
				enabled: true,
			}),
		)

		await waitFor(() => {
			expect(result.current.loading).toBe(false)
		})

		const initialExamples = result.current.exampleList
		const initialRotationCount = result.current.rotationCount

		// Refresh examples
		result.current.refreshExamples()

		await waitFor(() => {
			expect(result.current.rotationCount).toBe(initialRotationCount + 1)
		})

		// Examples might be the same or different due to randomization
		expect(result.current.exampleList.length).toBeGreaterThan(0)
	})

	it("should not fetch data when enabled is false", async () => {
		const { result } = renderHook(() =>
			useTopicExamples({
				topicMode: TopicMode.Translate,
				count: 5,
				enabled: false,
			}),
		)

		// Should remain in initial state
		expect(result.current.exampleList).toEqual([])
		expect(result.current.loading).toBe(false)
	})

	it("should respect custom count parameter", async () => {
		const { result } = renderHook(() =>
			useTopicExamples({
				topicMode: TopicMode.Translate,
				count: 3,
				enabled: true,
			}),
		)

		await waitFor(() => {
			expect(result.current.loading).toBe(false)
		})

		expect(result.current.exampleList.length).toBeLessThanOrEqual(3)
	})

	it("should update examples when topicMode changes", async () => {
		const { result, rerender } = renderHook(
			({ mode }) =>
				useTopicExamples({
					topicMode: mode,
					count: 5,
					enabled: true,
				}),
			{
				initialProps: { mode: TopicMode.Translate },
			},
		)

		await waitFor(() => {
			expect(result.current.loading).toBe(false)
		})

		expect(result.current.exampleList.length).toBeGreaterThan(0)

		// Change mode
		rerender({ mode: TopicMode.Write })

		await waitFor(() => {
			// Should have new examples (or empty if Write mode has no data)
			expect(result.current.exampleList.length).toBeLessThanOrEqual(2)
		})
	})
})
