import { renderHook, act, waitFor } from "@testing-library/react"
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest"
import { useDataSource, useDebouncedSearch } from "../useDataSource"
import { MentionItemType } from "../../types"
import { MentionPanelCatalogId, MentionPanelState as PanelState } from "../../businessTypes"
import type { DataService, MentionItem, MentionStoreRequestBuildOptions } from "../../types"
import type { MentionStoreRequest } from "../../dispatch"

type MockFunction = ReturnType<typeof vi.fn>

interface MockDataService extends DataService {
	dispatch: MockFunction
	fetchMcpList: MockFunction
	setRefreshHandler?: MockFunction
	getDefaultItems: MockFunction
	searchItems: MockFunction
	getFolderItems: MockFunction
	getUploadFiles: MockFunction
	getMcpExtensions: MockFunction
	getAgents: MockFunction
	getSkills: MockFunction
	refreshSkills?: MockFunction
	getToolItems: MockFunction
	preLoadList: MockFunction
	getAllHistory: MockFunction
	getCurrentTabs: MockFunction
	hasAgent: MockFunction
	hasMcp: MockFunction
	hasSkill: MockFunction
	hasTool: MockFunction
	hasUploadFile: MockFunction
	hasProjectFile: MockFunction
	hasFolder: MockFunction
	removeFromHistory: MockFunction
}

function createDispatch(dataService: MockDataService) {
	return vi.fn(async (request: MentionStoreRequest) => {
		switch (request.kind) {
			case "default":
				return { items: await dataService.getDefaultItems(request.options.t) }
			case "search":
				return { items: await dataService.searchItems(request.query) }
			case "children":
				return { items: await dataService.getFolderItems(request.id) }
			case "catalog":
				switch (request.catalogId) {
					case MentionPanelCatalogId.UPLOAD_FILES:
						return { items: await dataService.getUploadFiles() }
					case MentionPanelCatalogId.MCP_EXTENSIONS:
						return { items: await dataService.getMcpExtensions() }
					case MentionPanelCatalogId.AGENTS:
						return { items: await dataService.getAgents() }
					case MentionPanelCatalogId.SKILLS:
						return {
							items: await (request.options?.refresh
								? (dataService.refreshSkills?.() ?? dataService.getSkills())
								: dataService.getSkills()),
						}
					case MentionPanelCatalogId.TOOLS:
						return { items: await dataService.getToolItems(request.id ?? "") }
					case MentionPanelCatalogId.HISTORIES:
						return { items: await dataService.getAllHistory() }
					case MentionPanelCatalogId.TABS:
						return { items: await dataService.getCurrentTabs() }
					default:
						return { items: [] }
				}
			case "validate":
			case "effect":
			default:
				return {}
		}
	})
}

// Mock ahooks
vi.mock("ahooks", () => ({
	useMemoizedFn: <T extends (...args: never[]) => unknown>(fn: T) => fn,
}))

vi.mock("../../runtime/builtin/request-builder", () => ({
	buildMentionStoreRequest: vi.fn((options: MentionStoreRequestBuildOptions<string>) => {
		switch (options.state) {
			case "default":
				return {
					kind: "default",
					options: {
						t: options.t as never,
					},
				}
			case "search":
				if (!options.query?.trim()) return null
				return {
					kind: "search",
					query: options.query,
					...(options.scopeFolderId?.trim()
						? { scopeFolderId: options.scopeFolderId.trim() }
						: {}),
				}
			case "directory":
				if (!options.itemId) return null
				return {
					kind: "children",
					id: options.itemId,
				}
			case "catalog":
				if (!options.catalogId) return null
				return {
					kind: "catalog",
					catalogId: options.catalogId,
					...(options.itemId ? { id: options.itemId } : {}),
				}
			default:
				return null
		}
	}),
}))

// Mock constants - using factory function to avoid initialization issues
vi.mock("../../constants", () => {
	const PanelState = {
		DEFAULT: "default",
		SEARCH: "search",
		FOLDER: "folder",
		CATALOG: "catalog",
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
	let mockDataService: MockDataService

	beforeEach(() => {
		mockDataService = {
			dispatch: vi.fn(),
			fetchMcpList: vi.fn(),
			setRefreshHandler: vi.fn(),
			getDefaultItems: vi.fn(),
			searchItems: vi.fn(),
			getFolderItems: vi.fn(),
			getUploadFiles: vi.fn(),
			getMcpExtensions: vi.fn(),
			getAgents: vi.fn(),
			getSkills: vi.fn(),
			refreshSkills: vi.fn(),
			getToolItems: vi.fn(),
			preLoadList: vi.fn(),
			getAllHistory: vi.fn(),
			getCurrentTabs: vi.fn(),
			hasAgent: vi.fn(),
			hasMcp: vi.fn(),
			hasSkill: vi.fn(),
			hasTool: vi.fn(),
			hasUploadFile: vi.fn(),
			hasProjectFile: vi.fn(),
			hasFolder: vi.fn(),
			removeFromHistory: vi.fn(),
		}
		mockDataService.dispatch = createDispatch(mockDataService)
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

		it("should dispatch default item requests", async () => {
			mockDataService.getDefaultItems.mockResolvedValue([])

			const { result } = renderHook(() => useDataSource({ dataService: mockDataService }))

			await act(async () => {
				await result.current.loadDefaultItems()
			})

			expect(mockDataService.dispatch).toHaveBeenCalledWith(
				expect.objectContaining({
					kind: "default",
				}),
			)
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
				resolvePromise?.([])
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

		it("should dispatch search requests", async () => {
			mockDataService.searchItems.mockResolvedValue([])

			const { result } = renderHook(() => useDataSource({ dataService: mockDataService }))

			await act(async () => {
				await result.current.searchItems("dispatch query")
			})

			expect(mockDataService.dispatch).toHaveBeenCalledWith({
				kind: "search",
				query: "dispatch query",
			})
		})

		it("should dispatch search requests with scope folder id", async () => {
			mockDataService.searchItems.mockResolvedValue([])

			const { result } = renderHook(() => useDataSource({ dataService: mockDataService }))

			await act(async () => {
				await result.current.searchItems("q", "folder-a")
			})

			expect(mockDataService.dispatch).toHaveBeenCalledWith({
				kind: "search",
				query: "q",
				scopeFolderId: "folder-a",
			})
		})

		it("should build search request via buildStoreRequest when provided", async () => {
			const buildStoreRequest = vi.fn(
				(
					options: MentionStoreRequestBuildOptions<MentionPanelCatalogId>,
				): MentionStoreRequest | null => ({
					kind: "catalog",
					catalogId: MentionPanelCatalogId.TOOLS,
					id: options.query,
				}),
			)
			mockDataService.getToolItems.mockResolvedValue([])

			const { result } = renderHook(() =>
				useDataSource({
					dataService: mockDataService,
					buildStoreRequest,
				}),
			)

			await act(async () => {
				await result.current.searchItems("custom-search")
			})

			expect(buildStoreRequest).toHaveBeenCalledWith({
				state: PanelState.SEARCH,
				query: "custom-search",
				t: undefined,
			})
			expect(mockDataService.dispatch).toHaveBeenCalledWith({
				kind: "catalog",
				catalogId: MentionPanelCatalogId.TOOLS,
				id: "custom-search",
			})
		})

		it("should stop searching when buildStoreRequest returns null", async () => {
			const buildStoreRequest = vi.fn(() => null)

			const { result } = renderHook(() =>
				useDataSource({
					dataService: mockDataService,
					buildStoreRequest,
				}),
			)

			await act(async () => {
				await result.current.searchItems("custom-search")
			})

			expect(buildStoreRequest).toHaveBeenCalledWith({
				state: PanelState.SEARCH,
				query: "custom-search",
				t: undefined,
			})
			expect(mockDataService.dispatch).not.toHaveBeenCalled()
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

	describe("loadStateItems", () => {
		it("should load folder items for folder state", async () => {
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
				await result.current.loadStateItems(PanelState.FOLDER, { itemId: "folder-id" })
			})

			expect(mockDataService.getFolderItems).toHaveBeenCalledWith("folder-id")
			expect(result.current.items).toEqual(mockItems)
		})

		it("should load MCP extensions for catalog state", async () => {
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
				await result.current.loadStateItems(PanelState.CATALOG, {
					catalogId: MentionPanelCatalogId.MCP_EXTENSIONS,
				})
			})

			expect(mockDataService.getMcpExtensions).toHaveBeenCalled()
			expect(result.current.items).toEqual(mockItems)
		})

		it("should load agents for catalog state", async () => {
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
				await result.current.loadStateItems(PanelState.CATALOG, {
					catalogId: MentionPanelCatalogId.AGENTS,
				})
			})

			expect(mockDataService.getAgents).toHaveBeenCalled()
			expect(result.current.items).toEqual(mockItems)
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
				await result.current.loadStateItems(PanelState.FOLDER, { itemId: "folder-id" })
			})

			expect(result.current.error).toBe("Request timeout")
		})

		it("should handle unknown errors", async () => {
			const unknownError = new Error("Unknown error")
			mockDataService.getMcpExtensions.mockRejectedValue(unknownError)

			const { result } = renderHook(() => useDataSource({ dataService: mockDataService }))

			await act(async () => {
				await result.current.loadStateItems(PanelState.CATALOG, {
					catalogId: MentionPanelCatalogId.MCP_EXTENSIONS,
				})
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
				expect(mockSearchFn).toHaveBeenCalledWith("query3", undefined)
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
				expect(mockSearchFn).toHaveBeenCalledWith("test", undefined)
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
				expect(mockSearchFn).toHaveBeenCalledWith("", undefined)
			},
			{ timeout: 200 },
		)
	})
})
