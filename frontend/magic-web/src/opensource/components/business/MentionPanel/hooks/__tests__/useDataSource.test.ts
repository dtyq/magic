import { renderHook, act, waitFor } from "@testing-library/react"
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest"
// @ts-ignore
import { useDataSource, useDebouncedSearch } from "../useDataSource"
import { PanelState, MentionItemType } from "../../types"
import type { DataService, MentionItem } from "../../types"

// Mock ahooks
vi.mock("ahooks", () => ({
	useMemoizedFn: (fn: any) => fn,
}))

// Mock constants - using factory function to avoid initialization issues
vi.mock("../../constants", () => {
	const PanelState = {
		DEFAULT: "default",
		SEARCH: "search",
		FOLDER: "folder",
		MCP: "mcp",
		AGENT: "agent",
	}

	return {
		DEFAULT_ITEMS: {
			[PanelState.DEFAULT]: [
				{
					id: "project-files",
					type: "folder",
					name: "当前项目文件",
					icon: "file-folder",
					hasChildren: true,
				},
				{
					id: "mcp-extensions",
					type: "mcp",
					name: "MCP 扩展",
					icon: "plug",
					hasChildren: true,
				},
				{
					id: "agents",
					type: "agent",
					name: "智能体",
					icon: "magic-bots",
					hasChildren: true,
				},
			],
		},
		ERROR_MESSAGES: {
			UNKNOWN_ERROR: "未知错误",
			NETWORK_ERROR: "网络连接异常",
			TIMEOUT_ERROR: "请求超时",
		},
		DEBOUNCE_DELAYS: {
			SEARCH: 300,
		},
	}
})

describe("useDataSource", () => {
	let mockDataService: {
		[K in keyof DataService]: ReturnType<typeof vi.fn>
	}

	beforeEach(() => {
		mockDataService = {
			getDefaultItems: vi.fn(),
			searchItems: vi.fn(),
			getFolderItems: vi.fn(),
			getMcpExtensions: vi.fn(),
			getAgents: vi.fn(),
			preLoadList: vi.fn(),
		}
	})

	afterEach(() => {
		vi.clearAllMocks()
	})

	describe("initialization", () => {
		it("should initialize with empty state", () => {
			const { result } = renderHook(() => useDataSource({}))

			expect(result.current.items).toEqual([])
			expect(result.current.loading).toBe(false)
			expect(result.current.error).toBeUndefined()
		})

		it("should initialize with provided initial state", () => {
			const { result } = renderHook(() => useDataSource({ initialState: PanelState.SEARCH }))

			expect(result.current.items).toEqual([])
			expect(result.current.loading).toBe(false)
			expect(result.current.error).toBeUndefined()
		})

		it("should initialize with data service", () => {
			const { result } = renderHook(() => useDataSource({ dataService: mockDataService }))

			expect(result.current.items).toEqual([])
			expect(result.current.loading).toBe(false)
			expect(result.current.error).toBeUndefined()
		})
	})

	describe("loadDefaultItems", () => {
		it("should load default items using data service", async () => {
			const mockItems: MentionItem[] = [
				{
					id: "service-1",
					type: MentionItemType.PROJECT_FILE,
					name: "Service Item",
					icon: "file",
				},
			]
			mockDataService.getDefaultItems.mockResolvedValue(mockItems)

			const { result } = renderHook(() => useDataSource({ dataService: mockDataService }))

			await act(async () => {
				await result.current.loadDefaultItems()
			})

			expect(mockDataService.getDefaultItems).toHaveBeenCalledTimes(1)
			expect(result.current.items).toEqual(mockItems)
			expect(result.current.loading).toBe(false)
			expect(result.current.error).toBeUndefined()
		})

		it("should load static default items when no data service", async () => {
			const { result } = renderHook(() => useDataSource({}))

			await act(async () => {
				await result.current.loadDefaultItems()
			})

			expect(result.current.items).toEqual([
				{
					id: "project-files",
					type: "folder",
					name: "当前项目文件",
					icon: "file-folder",
					hasChildren: true,
				},
				{
					id: "mcp-extensions",
					type: "mcp",
					name: "MCP 扩展",
					icon: "plug",
					hasChildren: true,
				},
				{
					id: "agents",
					type: "agent",
					name: "智能体",
					icon: "magic-bots",
					hasChildren: true,
				},
			])
			expect(result.current.loading).toBe(false)
		})

		it("should handle errors and use fallback data", async () => {
			const error = new Error("Service error")
			mockDataService.getDefaultItems.mockRejectedValue(error)

			const { result } = renderHook(() => useDataSource({ dataService: mockDataService }))

			await act(async () => {
				await result.current.loadDefaultItems()
			})

			expect(result.current.error).toBe("Service error")
			expect(result.current.loading).toBe(false)
			expect(result.current.items).toEqual([
				{
					id: "project-files",
					type: "folder",
					name: "当前项目文件",
					icon: "file-folder",
					hasChildren: true,
				},
				{
					id: "mcp-extensions",
					type: "mcp",
					name: "MCP 扩展",
					icon: "plug",
					hasChildren: true,
				},
				{
					id: "agents",
					type: "agent",
					name: "智能体",
					icon: "magic-bots",
					hasChildren: true,
				},
			])
		})

		it("should set loading state during operation", async () => {
			let resolvePromise: (value: MentionItem[]) => void
			const promise = new Promise<MentionItem[]>((resolve) => {
				resolvePromise = resolve
			})
			mockDataService.getDefaultItems.mockReturnValue(promise)

			const { result } = renderHook(() => useDataSource({ dataService: mockDataService }))

			act(() => {
				result.current.loadDefaultItems()
			})

			expect(result.current.loading).toBe(true)

			await act(async () => {
				resolvePromise!([])
				await promise
			})

			expect(result.current.loading).toBe(false)
		})
	})

	describe("searchItems", () => {
		it("should search items with query", async () => {
			const mockItems: MentionItem[] = [
				{
					id: "search-1",
					type: MentionItemType.PROJECT_FILE,
					name: "Search Result",
					icon: "file",
				},
			]
			mockDataService.searchItems.mockResolvedValue(mockItems)

			const { result } = renderHook(() => useDataSource({ dataService: mockDataService }))

			await act(async () => {
				await result.current.searchItems("test query")
			})

			expect(mockDataService.searchItems).toHaveBeenCalledWith("test query")
			expect(result.current.items).toEqual(mockItems)
		})

		it("should not search for empty query", async () => {
			const { result } = renderHook(() => useDataSource({ dataService: mockDataService }))

			await act(async () => {
				await result.current.searchItems("")
			})

			expect(mockDataService.searchItems).not.toHaveBeenCalled()
			expect(mockDataService.getDefaultItems).not.toHaveBeenCalled()
		})

		it("should not search for whitespace-only query", async () => {
			const { result } = renderHook(() => useDataSource({ dataService: mockDataService }))

			await act(async () => {
				await result.current.searchItems("   ")
			})

			expect(mockDataService.searchItems).not.toHaveBeenCalled()
			expect(mockDataService.getDefaultItems).not.toHaveBeenCalled()
		})

		it("should use mock search when no data service", async () => {
			const { result } = renderHook(() => useDataSource({}))

			await act(async () => {
				await result.current.searchItems("demo")
			})

			expect(result.current.items).toEqual([])
		})

		it("should handle search errors", async () => {
			const error = new Error("Search failed")
			mockDataService.searchItems.mockRejectedValue(error)

			const { result } = renderHook(() => useDataSource({ dataService: mockDataService }))

			await act(async () => {
				await result.current.searchItems("test")
			})

			expect(result.current.error).toBe("Search failed")
			expect(result.current.loading).toBe(false)
		})
	})

	describe("loadFolderItems", () => {
		it("should load folder items", async () => {
			const mockItems: MentionItem[] = [
				{
					id: "folder-item-1",
					type: MentionItemType.PROJECT_FILE,
					name: "Folder Item",
					icon: "file",
				},
			]
			mockDataService.getFolderItems.mockResolvedValue(mockItems)

			const { result } = renderHook(() => useDataSource({ dataService: mockDataService }))

			await act(async () => {
				await result.current.loadFolderItems("folder-id")
			})

			expect(mockDataService.getFolderItems).toHaveBeenCalledWith("folder-id")
			expect(result.current.items).toEqual(mockItems)
		})

		it("should use mock folder items when no data service", async () => {
			const { result } = renderHook(() => useDataSource({}))

			await act(async () => {
				await result.current.loadFolderItems("project-files")
			})

			expect(result.current.items).toEqual([])
		})

		it("should handle folder loading errors", async () => {
			const error = new Error("Folder load failed")
			mockDataService.getFolderItems.mockRejectedValue(error)

			const { result } = renderHook(() => useDataSource({ dataService: mockDataService }))

			await act(async () => {
				await result.current.loadFolderItems("folder-id")
			})

			expect(result.current.error).toBe("Folder load failed")
		})
	})

	describe("loadMcpExtensions", () => {
		it("should load MCP extensions", async () => {
			const mockItems: MentionItem[] = [
				{
					id: "mcp-1",
					type: MentionItemType.MCP,
					name: "MCP Extension",
					icon: "plug",
				},
			]
			mockDataService.getMcpExtensions.mockResolvedValue(mockItems)

			const { result } = renderHook(() => useDataSource({ dataService: mockDataService }))

			await act(async () => {
				await result.current.loadMcpExtensions()
			})

			expect(mockDataService.getMcpExtensions).toHaveBeenCalled()
			expect(result.current.items).toEqual(mockItems)
		})

		it("should use mock MCP extensions when no data service", async () => {
			const { result } = renderHook(() => useDataSource({}))

			await act(async () => {
				await result.current.loadMcpExtensions()
			})

			expect(result.current.items).toEqual([])
		})

		it("should handle MCP loading errors", async () => {
			const error = new Error("MCP load failed")
			mockDataService.getMcpExtensions.mockRejectedValue(error)

			const { result } = renderHook(() => useDataSource({ dataService: mockDataService }))

			await act(async () => {
				await result.current.loadMcpExtensions()
			})

			expect(result.current.error).toBe("MCP load failed")
		})
	})

	describe("loadAgents", () => {
		it("should load agents", async () => {
			const mockItems: MentionItem[] = [
				{
					id: "agent-1",
					type: MentionItemType.AGENT,
					name: "AI Agent",
					icon: "magic-bots",
				},
			]
			mockDataService.getAgents.mockResolvedValue(mockItems)

			const { result } = renderHook(() => useDataSource({ dataService: mockDataService }))

			await act(async () => {
				await result.current.loadAgents()
			})

			expect(mockDataService.getAgents).toHaveBeenCalled()
			expect(result.current.items).toEqual(mockItems)
		})

		it("should use mock agents when no data service", async () => {
			const { result } = renderHook(() => useDataSource({}))

			await act(async () => {
				await result.current.loadAgents()
			})

			expect(result.current.items).toEqual([])
		})

		it("should handle agent loading errors", async () => {
			const error = new Error("Agent load failed")
			mockDataService.getAgents.mockRejectedValue(error)

			const { result } = renderHook(() => useDataSource({ dataService: mockDataService }))

			await act(async () => {
				await result.current.loadAgents()
			})

			expect(result.current.error).toBe("Agent load failed")
		})
	})

	describe("clearError", () => {
		it("should clear error state", async () => {
			const error = new Error("Test error")
			mockDataService.getDefaultItems.mockRejectedValue(error)

			const { result } = renderHook(() => useDataSource({ dataService: mockDataService }))

			// Set an error first
			await act(async () => {
				await result.current.loadDefaultItems()
			})

			expect(result.current.error).toBeTruthy()

			// Clear the error
			act(() => {
				result.current.clearError()
			})

			expect(result.current.error).toBeUndefined()
		})
	})

	describe("refreshData", () => {
		it("should refresh current data", async () => {
			mockDataService.getDefaultItems.mockResolvedValue([])

			const { result } = renderHook(() => useDataSource({ dataService: mockDataService }))

			await act(async () => {
				await result.current.refreshData()
			})

			expect(mockDataService.getDefaultItems).toHaveBeenCalled()
		})

		it("should handle refresh errors", async () => {
			const error = new Error("Refresh failed")
			mockDataService.getDefaultItems.mockRejectedValue(error)

			const { result } = renderHook(() => useDataSource({ dataService: mockDataService }))

			await act(async () => {
				await result.current.refreshData()
			})

			expect(result.current.error).toBe("Refresh failed")
		})
	})

	describe("error handling", () => {
		it("should handle network errors", async () => {
			const networkError = new Error("Network error")
			mockDataService.searchItems.mockRejectedValue(networkError)

			const { result } = renderHook(() => useDataSource({ dataService: mockDataService }))

			await act(async () => {
				await result.current.searchItems("test")
			})

			expect(result.current.error).toBe("Network error")
		})

		it("should handle timeout errors", async () => {
			const timeoutError = new Error("Request timeout")
			mockDataService.getFolderItems.mockRejectedValue(timeoutError)

			const { result } = renderHook(() => useDataSource({ dataService: mockDataService }))

			await act(async () => {
				await result.current.loadFolderItems("folder-id")
			})

			expect(result.current.error).toBe("Request timeout")
		})

		it("should handle unknown errors", async () => {
			const unknownError = new Error("Unknown error")
			mockDataService.getMcpExtensions.mockRejectedValue(unknownError)

			const { result } = renderHook(() => useDataSource({ dataService: mockDataService }))

			await act(async () => {
				await result.current.loadMcpExtensions()
			})

			expect(result.current.error).toBe("Unknown error")
		})
	})
})

describe("useDebouncedSearch", () => {
	it("should debounce search calls", async () => {
		const mockSearchFn = vi.fn()
		const { result } = renderHook(() => useDebouncedSearch(mockSearchFn, 100))

		// Call search multiple times quickly
		act(() => {
			result.current.debouncedSearch("query1")
		})

		act(() => {
			result.current.debouncedSearch("query2")
		})

		act(() => {
			result.current.debouncedSearch("query3")
		})

		// Should not call immediately
		expect(mockSearchFn).not.toHaveBeenCalled()

		// Wait for debounce - only the last call should execute
		await waitFor(
			() => {
				expect(mockSearchFn).toHaveBeenCalledWith("query3")
			},
			{ timeout: 200 },
		)

		// Ensure it was called exactly once (the last call)
		expect(mockSearchFn).toHaveBeenCalledTimes(1)
	})

	it("should use default delay", async () => {
		const mockSearchFn = vi.fn()
		const { result } = renderHook(() => useDebouncedSearch(mockSearchFn))

		act(() => {
			result.current.debouncedSearch("test")
		})

		await waitFor(
			() => {
				expect(mockSearchFn).toHaveBeenCalledWith("test")
			},
			{ timeout: 400 },
		)
	})

	it("should handle empty queries", async () => {
		const mockSearchFn = vi.fn()
		const { result } = renderHook(() => useDebouncedSearch(mockSearchFn, 100))

		act(() => {
			result.current.debouncedSearch("")
		})

		await waitFor(
			() => {
				expect(mockSearchFn).toHaveBeenCalledWith("")
			},
			{ timeout: 200 },
		)
	})
})
