import { renderHook, act, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { useMentionPanel } from "../useMentionPanel"
import { defaultMentionPanelCatalogBehavior } from "../../catalogBehavior"
import {
	type DataService,
	type MentionItem,
	MentionItemType,
	type MentionPanelCatalogBehavior,
	type MentionStoreRequestBuildOptions,
} from "../../types"
import {
	MentionPanelBuiltinItemId,
	MentionPanelCatalogId,
	MentionPanelState as PanelState,
} from "../../businessTypes"
import type { MentionStoreRequest } from "../../dispatch"
import { en } from "../../i18n/locales/en"

vi.mock("ahooks", () => ({
	useMemoizedFn: <T extends (...args: never[]) => unknown>(fn: T) => fn,
}))

vi.mock("../useKeyboardNav", () => ({
	useKeyboardNav: vi.fn(),
}))

interface MockDataService extends DataService {
	dispatch: ReturnType<typeof vi.fn>
	preLoadList: ReturnType<typeof vi.fn>
	removeFromHistory: ReturnType<typeof vi.fn>
}

const defaultItems: MentionItem[] = [
	{
		id: MentionPanelBuiltinItemId.PROJECT_FILES,
		type: MentionItemType.FOLDER,
		name: "Project Files",
		hasChildren: true,
		isFolder: true,
	},
	{
		id: MentionPanelBuiltinItemId.UPLOAD_FILES,
		type: MentionItemType.FOLDER,
		name: "Upload Files",
		hasChildren: true,
		isFolder: true,
	},
	{
		id: MentionPanelBuiltinItemId.AGENTS,
		type: MentionItemType.AGENT,
		name: "Agents",
		hasChildren: true,
		isFolder: true,
	},
	{
		id: MentionPanelBuiltinItemId.MCP_EXTENSIONS,
		type: MentionItemType.MCP,
		name: "MCP",
		hasChildren: true,
		isFolder: true,
	},
	{
		id: MentionPanelBuiltinItemId.SKILLS,
		type: MentionItemType.SKILL,
		name: "Skills",
		hasChildren: true,
		isFolder: true,
	},
	{
		id: MentionPanelBuiltinItemId.TOOLS,
		type: MentionItemType.TOOL,
		name: "Tools",
		hasChildren: true,
		isFolder: true,
	},
]

const agentItems: MentionItem[] = [
	{
		id: "agent-1",
		type: MentionItemType.AGENT,
		name: "Agent One",
	},
]

const toolGroups: MentionItem[] = [
	{
		id: "tool-group",
		type: MentionItemType.TOOL,
		name: "Tool Group",
		hasChildren: true,
		isFolder: true,
	},
]

const toolLeafItems: MentionItem[] = [
	{
		id: "tool-leaf",
		type: MentionItemType.TOOL,
		name: "Leaf Tool",
	},
]

const customDefaultItems: MentionItem[] = [
	{
		id: "custom-entry",
		type: MentionItemType.FOLDER,
		name: "Custom Entry",
		hasChildren: true,
		isFolder: true,
	},
]

const customCatalogItems: MentionItem[] = [
	{
		id: "custom-leaf",
		type: MentionItemType.PROJECT_FILE,
		name: "Custom Leaf",
	},
]

function createDataService(): MockDataService {
	return {
		preLoadList: vi.fn(),
		removeFromHistory: vi.fn(),
		dispatch: vi.fn(async (request: MentionStoreRequest) => {
			switch (request.kind) {
				case "default":
					return {
						items: defaultItems,
					}
				case "catalog":
					switch (request.catalogId) {
						case MentionPanelCatalogId.AGENTS:
							return {
								items: agentItems,
							}
						case MentionPanelCatalogId.TOOLS:
							return {
								items:
									request.id === MentionPanelBuiltinItemId.TOOLS
										? toolGroups
										: toolLeafItems,
							}
						default:
							return {
								items: [],
							}
					}
				case "search":
				case "children":
				case "effect":
				case "validate":
				default:
					return {}
			}
		}),
	}
}

describe("useMentionPanel", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("should enter agent catalog using navigation item context", async () => {
		const dataService = createDataService()
		const { result } = renderHook(() =>
			useMentionPanel({
				dataService,
				t: en,
				catalogBehavior: defaultMentionPanelCatalogBehavior,
			}),
		)

		await waitFor(() => {
			expect(result.current.state.items).toHaveLength(defaultItems.length)
		})

		act(() => {
			result.current.actions.selectItem(2)
		})

		await act(async () => {
			await result.current.actions.confirmSelection()
		})

		await waitFor(() => {
			expect(result.current.state.currentState).toBe(PanelState.CATALOG)
			expect(result.current.state.navigationStack).toHaveLength(1)
			expect(result.current.state.navigationStack[0]?.catalogId).toBe(
				MentionPanelCatalogId.AGENTS,
			)
			expect(result.current.state.items).toEqual(agentItems)
		})
	})

	it("should navigate back from catalog to default state", async () => {
		const dataService = createDataService()
		const { result } = renderHook(() =>
			useMentionPanel({
				dataService,
				t: en,
				catalogBehavior: defaultMentionPanelCatalogBehavior,
			}),
		)

		await waitFor(() => {
			expect(result.current.state.items).toHaveLength(defaultItems.length)
		})

		act(() => {
			result.current.actions.selectItem(2)
		})

		await act(async () => {
			await result.current.actions.confirmSelection()
		})

		await waitFor(() => {
			expect(result.current.state.currentState).toBe(PanelState.CATALOG)
		})

		await act(async () => {
			await result.current.actions.navigateBack()
		})

		await waitFor(() => {
			expect(result.current.state.currentState).toBe(PanelState.DEFAULT)
			expect(result.current.state.navigationStack).toHaveLength(0)
			expect(result.current.state.items).toEqual(defaultItems)
		})
	})

	it("should restore tool catalog from breadcrumb using navigation context", async () => {
		const dataService = createDataService()
		const { result } = renderHook(() =>
			useMentionPanel({
				dataService,
				t: en,
				catalogBehavior: defaultMentionPanelCatalogBehavior,
			}),
		)

		await waitFor(() => {
			expect(result.current.state.items).toHaveLength(defaultItems.length)
		})

		act(() => {
			result.current.actions.selectItem(5)
		})

		await act(async () => {
			await result.current.actions.confirmSelection()
		})

		await waitFor(() => {
			expect(result.current.state.currentState).toBe(PanelState.CATALOG)
			expect(result.current.state.navigationStack[0]?.catalogId).toBe(
				MentionPanelCatalogId.TOOLS,
			)
			expect(result.current.state.items).toEqual(toolGroups)
		})

		await act(async () => {
			await result.current.actions.confirmSelection()
		})

		await waitFor(() => {
			expect(result.current.state.navigationStack).toHaveLength(2)
			expect(result.current.state.items).toEqual(toolLeafItems)
		})

		await act(async () => {
			await result.current.actions.navigateToBreadcrumb(0)
		})

		await waitFor(() => {
			expect(result.current.state.currentState).toBe(PanelState.CATALOG)
			expect(result.current.state.navigationStack).toHaveLength(1)
			expect(result.current.state.navigationStack[0]?.catalogId).toBe(
				MentionPanelCatalogId.TOOLS,
			)
			expect(result.current.state.items).toEqual(toolGroups)
		})
	})

	it("should remove history items using the original history cache id", async () => {
		const dataService = createDataService()
		const { result } = renderHook(() =>
			useMentionPanel({
				dataService,
				t: en,
				catalogBehavior: defaultMentionPanelCatalogBehavior,
			}),
		)

		const historyItem: MentionItem = {
			id: "project-file-derived-id",
			type: MentionItemType.PROJECT_FILE,
			name: "History File",
			tags: ["history"],
			metadata: {
				historyItemId: "history-cache-id",
			},
		}

		await act(async () => {
			await result.current.actions.deleteHistoryItem(historyItem)
		})

		expect(dataService.removeFromHistory).toHaveBeenCalledWith("history-cache-id")
	})

	it("should pass custom catalog id through injected behavior", async () => {
		const customCatalogId = "custom-catalog"
		const dataService: MockDataService = {
			preLoadList: vi.fn(),
			removeFromHistory: vi.fn(),
			dispatch: vi.fn(async (request: MentionStoreRequest) => {
				if (request.kind === "default") {
					return {
						items: customDefaultItems,
					}
				}

				if (
					request.kind === "catalog" &&
					request.catalogId === customCatalogId &&
					request.id === "custom-entry"
				) {
					return {
						items: customCatalogItems,
					}
				}

				return {}
			}),
		}

		const catalogBehavior: MentionPanelCatalogBehavior<typeof customCatalogId> = {
			getStaticTransition: ({ currentState, itemId }) => {
				if (currentState !== PanelState.DEFAULT || itemId !== "custom-entry") return null

				return {
					state: PanelState.CATALOG,
					catalogId: customCatalogId,
				}
			},
		}

		const buildStoreRequest = (
			options: MentionStoreRequestBuildOptions<typeof customCatalogId>,
		): MentionStoreRequest | null => {
			if (options.state === PanelState.DEFAULT) {
				return {
					kind: "default",
					options: {
						t: en,
					},
				}
			}

			if (options.state === PanelState.CATALOG && options.catalogId && options.itemId) {
				return {
					kind: "catalog",
					catalogId: options.catalogId,
					id: options.itemId,
				}
			}

			return null
		}

		const { result } = renderHook(() =>
			useMentionPanel<typeof customCatalogId>({
				dataService,
				t: en,
				catalogBehavior,
				buildStoreRequest,
			}),
		)

		await waitFor(() => {
			expect(result.current.state.items).toEqual(customDefaultItems)
		})

		await act(async () => {
			await result.current.actions.confirmSelection()
		})

		await waitFor(() => {
			expect(result.current.state.currentState).toBe(PanelState.CATALOG)
			expect(result.current.state.navigationStack[0]?.catalogId).toBe(customCatalogId)
			expect(result.current.state.items).toEqual(customCatalogItems)
		})
	})
})
