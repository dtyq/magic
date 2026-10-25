import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import mentionPanelStore from "../store"
import projectFilesStore from "@/stores/projectFiles"
import { MentionItemType, MentionItem } from "../../../types"
import { MentionPanelCatalogId } from "../../../businessTypes"
import { zhCN } from "../../../i18n/locales/zh-CN"
import { BotApi, CrewApi, FlowApi, GlobalApi } from "@/apis"
import type { GetSettingsGlobalDataResponse } from "@/apis/types"
import type { GetUserAvailableAgentListResponse } from "@/types/bot"
import type { GetAvailableMCPListResponse, UseableToolSet, WithPage } from "@/types/flow"
import type { SkillDomainItem } from "../domains/skills/types"
import { type ProjectListItem, ProjectStatus } from "@/pages/superMagic/pages/Workspace/types"
import { TopicMode } from "@/pages/superMagic/pages/Workspace/TopicMode"
import { AttachmentSource } from "@/pages/superMagic/components/TopicFilesButton/hooks/types"
import { ElementTypeEnum } from "@/components/CanvasDesign/runtime/document/types"

interface TestWorkspaceEntry {
	type: "file" | "directory"
	file_id?: string
	file_name?: string
	file_extension?: string
	file_key?: string
	relative_file_path?: string
	file_size?: number
	file_url?: string
	task_id?: string
	project_id?: string
	file_type?: string
	is_hidden?: boolean
	parent_id?: string
	display_config?: { type?: string; name?: string }
	source: AttachmentSource
	children: TestWorkspaceEntry[]
}

// Mock APIs
vi.mock("@/apis", () => ({
	BotApi: {
		getUserAllAgentList: vi.fn(),
	},
	CrewApi: {
		getMentionSkills: vi.fn(),
	},
	FlowApi: {
		getAvailableMCP: vi.fn(),
		getUseableToolList: vi.fn(),
	},
	GlobalApi: {
		getSettingsGlobalData: vi.fn(),
	},
	SuperMagicApi: {
		getCrewList: vi.fn().mockResolvedValue({ list: [] }),
		getMentionMicroApps: vi.fn().mockResolvedValue({ list: [] }),
	},
}))

vi.mock("@/pages/superMagic/components/MessageList/components/MessageAttachment/utils", () => ({
	getFileTreeIconType: vi.fn(() => "ts-folder"),
}))

vi.mock("@/stores/projectFiles", () => {
	const flattenWorkspaceFileTree = (tree: TestWorkspaceEntry[]): TestWorkspaceEntry[] =>
		tree.reduce((acc, item) => {
			acc.push(item)
			if (item.children) {
				acc.push(...flattenWorkspaceFileTree(item.children))
			}
			return acc
		}, [] as TestWorkspaceEntry[])

	const store = {
		workspaceFileTree: [] as TestWorkspaceEntry[],
		workspaceFilesList: [] as TestWorkspaceEntry[],
		currentSelectedProject: null as ProjectListItem | null,
		setWorkspaceFileTree(tree: TestWorkspaceEntry[]) {
			this.workspaceFileTree = tree
			this.workspaceFilesList = flattenWorkspaceFileTree(tree)
		},
		setSelectedProject(project: ProjectListItem | null) {
			this.currentSelectedProject = project
		},
		hasProjectFile(fileId: string) {
			return this.workspaceFilesList.some(
				(item) => item.type === "file" && item.file_id === fileId,
			)
		},
		hasFolder(fileId: string) {
			return this.workspaceFilesList.some(
				(item) => item.type === "directory" && item.file_id === fileId,
			)
		},
		getFolderData(folderId: string | number | undefined) {
			return this.workspaceFilesList.find(
				(item) => item.type === "directory" && String(item.file_id) === String(folderId),
			)
		},
	}

	return {
		__esModule: true,
		default: store,
	}
})

vi.mock("@/models/user", () => ({
	userStore: {
		user: {
			userInfo: {
				organization_code: "test-org",
			},
		},
	},
}))

async function searchItems(query: string): Promise<MentionItem[]> {
	const result = await mentionPanelStore.dispatch({
		kind: "search",
		query,
	})
	return result.items ?? []
}

/** Searches the current custom group through the same scoped request used by the panel. */
async function searchItemsInGroup(query: string, scopeFolderId: string): Promise<MentionItem[]> {
	const result = await mentionPanelStore.dispatch({
		kind: "search",
		query,
		scopeFolderId,
	})
	return result.items ?? []
}

async function getSkillItems(): Promise<MentionItem[]> {
	const result = await mentionPanelStore.dispatch({
		kind: "catalog",
		catalogId: MentionPanelCatalogId.SKILLS,
	})
	return result.items ?? []
}

async function getDefaultItems(): Promise<MentionItem[]> {
	const result = await mentionPanelStore.dispatch({
		kind: "default",
		options: {
			t: zhCN,
		},
	})
	return result.items ?? []
}

async function refreshSkillItems(): Promise<MentionItem[]> {
	const result = await mentionPanelStore.dispatch({
		kind: "catalog",
		catalogId: MentionPanelCatalogId.SKILLS,
		options: {
			refresh: true,
		},
	})
	return result.items ?? []
}

interface TestMentionPanelStore {
	matchesQuery: (target: string, query: string) => boolean
	mcpStore: { items: MentionItem[] }
	agentsStore: { items: MentionItem[] }
	skillsStore: {
		items: MentionItem[]
		currentSkillQueryKey: string
	}
	toolsStore: { toolItems: UseableToolSet.Item[] }
	uploadFilesStore: { items: MentionItem[] }
}

function getTestStore(): TestMentionPanelStore {
	return mentionPanelStore as unknown as TestMentionPanelStore
}

function getItemExtension(item: MentionItem): string {
	if (item.extension) return item.extension.toLowerCase()
	if (!item.data || !("file_extension" in item.data)) return ""

	return typeof item.data.file_extension === "string"
		? item.data.file_extension.toLowerCase()
		: ""
}

function createToolSchema(): UseableToolSet.UsableTool["input"] {
	return {} as UseableToolSet.UsableTool["input"]
}

function createMockAgentListResponse(): GetUserAvailableAgentListResponse {
	return {
		page: 1,
		total: 1,
		list: [
			{
				id: "agent1",
				name: "test-agent",
				avatar: "avatar1",
				description: "desc1",
				created_at: "2023-01-01",
			},
		],
	}
}

function createMockMcpListResponse(): GetAvailableMCPListResponse {
	return {
		page: 1,
		page_size: 10,
		total: 1,
		list: [
			{
				id: "mcp1",
				name: "test-mcp",
				icon: "icon1",
				description: "desc1",
				type: "mcp",
				offline: false,
				require_fields: [],
				check_require_fields: false,
				check_auth: false,
				user_operation: 0,
			},
		],
	}
}

function createMockToolSetResponse(): WithPage<UseableToolSet.Item[]> {
	return {
		page: 1,
		page_size: 10,
		total: 1,
		list: [
			{
				id: "tool1",
				name: "test-tool",
				icon: "icon1",
				description: "test tool description",
				creator: "test-creator",
				created_at: "2023-01-01",
				modifier: "test-modifier",
				updated_at: "2023-01-01",
				tool_set_id: "toolset1",
				agent_used_count: 0,
				tools: [
					{
						code: "tool-code-1",
						name: "awesome-tool",
						description: "desc1",
						input: createToolSchema(),
						output: createToolSchema(),
						custom_system_input: createToolSchema(),
					},
					{
						code: "tool-code-2",
						name: "html-parser",
						description: "desc2",
						input: createToolSchema(),
						output: createToolSchema(),
						custom_system_input: createToolSchema(),
					},
				],
			},
		],
	}
}

function createMockGlobalSettingsResponse(): GetSettingsGlobalDataResponse {
	return {
		available_agents: createMockAgentListResponse(),
		available_mcp_servers: createMockMcpListResponse(),
		available_tool_sets: createMockToolSetResponse(),
		login_code: {
			login_code: "",
		},
		memory_list: {
			success: true,
			data: [],
			total: 0,
			has_more: false,
			next_page_token: "",
		},
	}
}

function createTestProject(id: string): ProjectListItem {
	return {
		id,
		project_status: ProjectStatus.WAITING,
		project_mode: TopicMode.General,
		workspace_id: "workspace-1",
		work_dir: "/workspace",
		workspace_name: "Test Workspace",
		project_name: "Test Project",
		current_topic_id: "topic-1",
		current_topic_status: "waiting",
		created_at: "2023-01-01",
		updated_at: "2023-01-01",
		tag: "",
	}
}

describe("MentionPanelStore Sorting Algorithm", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		// Reset store state
		const store = getTestStore()
		projectFilesStore.setWorkspaceFileTree([])
		projectFilesStore.setSelectedProject(null)
		store.mcpStore.items = []
		store.agentsStore.items = []
		store.skillsStore.items = []
		store.toolsStore.toolItems = []
		store.uploadFilesStore.items = []
		store.skillsStore.currentSkillQueryKey = "__default__"
		mentionPanelStore.setCurrentTabs([])
		mentionPanelStore.clearActiveCanvasElementsContext()
		mentionPanelStore.setPinnedCurrentMicroApp(null)
		mentionPanelStore.setBuiltinVisibility({})
		mentionPanelStore.setCustomMentionGroups([])
		mentionPanelStore.setPinnedSceneCatalog(null)

		vi.mocked(CrewApi.getMentionSkills).mockResolvedValue([])

		vi.mocked(GlobalApi.getSettingsGlobalData).mockResolvedValue(
			createMockGlobalSettingsResponse(),
		)
	})

	describe("matchesQuery method", () => {
		it("should prioritize exact substring match over fuzzy match", () => {
			const store = getTestStore()

			expect(store.matchesQuery("hello world", "hello")).toBe(true)
			expect(store.matchesQuery("component.tsx", "comp")).toBe(true)
		})

		it("should fall back to fuzzy match when substring match fails", () => {
			const store = getTestStore()

			expect(store.matchesQuery("hello world", "helo")).toBe(true)
			expect(store.matchesQuery("component.tsx", "cmpnt")).toBe(true)
		})

		it("should return false when neither match succeeds", () => {
			const store = getTestStore()

			expect(store.matchesQuery("hello world", "xyz")).toBe(false)
			expect(store.matchesQuery("component.tsx", "zyx")).toBe(false)
		})
	})

	describe("default root items", () => {
		it("exposes named custom groups as directories and text mentions", async () => {
			mentionPanelStore.setCustomMentionGroups([
				{
					id: "custom-group-fixture",
					label: "Fixture group",
					items: [
						{
							id: "custom-item-fixture",
							type: "card",
							text: "Fixture content",
							title: "Fixture card",
							data: { source: "fixture" },
						},
					],
				},
			])

			const rootItems = await getDefaultItems()
			expect(rootItems.at(-1)).toMatchObject({
				id: "custom-group-fixture",
				name: "Fixture group",
				hasChildren: true,
			})
			const contentItems = await mentionPanelStore.dispatch({
				kind: "children",
				id: "custom-group-fixture",
			})
			expect(contentItems.items).toEqual([
				expect.objectContaining({
					id: "custom-item-fixture",
					name: "Fixture card",
					type: MentionItemType.TEXT,
					metadata: { customMention: true, customMentionGroupId: "custom-group-fixture" },
					data: expect.objectContaining({
						groupId: "custom-group-fixture",
						id: "custom-item-fixture",
						label: "Fixture card",
						text: "Fixture content",
						type: "card",
						source: "fixture",
					}),
				}),
			])
		})

		it("falls back to semantic text when a custom item has no usable title", async () => {
			mentionPanelStore.setCustomMentionGroups([
				{
					id: "fallback-group-fixture",
					label: "Fallback group",
					items: [
						{
							id: "fallback-item-fixture",
							type: "card",
							text: "Fallback semantic text",
							title: "   ",
						},
					],
				},
			])

			const result = await mentionPanelStore.dispatch({
				kind: "children",
				id: "fallback-group-fixture",
			})
			expect(result.items?.[0]).toMatchObject({
				name: "Fallback semantic text",
				data: {
					label: "Fallback semantic text",
					text: "Fallback semantic text",
				},
			})
		})

		it("resolves valid tokens and HTTPS iconUrls for custom groups and items", async () => {
			mentionPanelStore.setCustomMentionGroups([
				{
					id: "icon-group",
					label: "Icon Group",
					icon: "ts-doc-file",
					iconUrl: "https://example.com/group-icon.png",
					items: [
						{
							id: "icon-item-valid",
							type: "card",
							text: "Card With Icon",
							icon: "ts-api",
							iconUrl: "https://example.com/item-icon.png",
						},
						{
							id: "icon-item-fallback",
							type: "card",
							text: "Card With Fallback",
							icon: "invalid-token-name",
							iconUrl: "http://insecure.com/rejected.png",
						},
					],
				},
			])

			const rootItems = await getDefaultItems()
			const customGroupItem = rootItems.find((item) => item.id === "icon-group")
			expect(customGroupItem).toMatchObject({
				id: "icon-group",
				icon: "ts-doc-file",
				iconUrl: "https://example.com/group-icon.png",
				metadata: expect.objectContaining({
					customMentionGroup: true,
					iconUrl: "https://example.com/group-icon.png",
				}),
			})

			const contentItems = await mentionPanelStore.dispatch({
				kind: "children",
				id: "icon-group",
			})
			expect(contentItems.items).toHaveLength(2)

			// Valid item
			expect(contentItems.items?.[0]).toMatchObject({
				id: "icon-item-valid",
				icon: "ts-api",
				iconUrl: "https://example.com/item-icon.png",
				metadata: expect.objectContaining({
					customMention: true,
					iconUrl: "https://example.com/item-icon.png",
				}),
			})

			// Fallback item: invalid token falls back to ts-doc-file, insecure http URL is stripped
			expect(contentItems.items?.[1]).toMatchObject({
				id: "icon-item-fallback",
				icon: "ts-doc-file",
				iconUrl: undefined,
				metadata: expect.objectContaining({
					customMention: true,
				}),
			})
			expect(contentItems.items?.[1]?.iconUrl).toBeUndefined()
		})

		it("orders custom groups according to placement in root items", async () => {
			mentionPanelStore.setCustomMentionGroups([
				{
					id: "start-group-1",
					label: "Start Group 1",
					placement: "start",
					items: [{ id: "item-s1", type: "card", text: "S1" }],
				},
				{
					id: "start-group-2",
					label: "Start Group 2",
					placement: "start",
					items: [{ id: "item-s2", type: "card", text: "S2" }],
				},
				{
					id: "end-group-1",
					label: "End Group 1",
					placement: "end",
					items: [{ id: "item-e1", type: "card", text: "E1" }],
				},
				{
					id: "default-group-1",
					label: "Default Group 1",
					items: [{ id: "item-d1", type: "card", text: "D1" }],
				},
			])

			const rootItems = await getDefaultItems()
			const startGroup1Index = rootItems.findIndex((item) => item.id === "start-group-1")
			const startGroup2Index = rootItems.findIndex((item) => item.id === "start-group-2")
			const endGroup1Index = rootItems.findIndex((item) => item.id === "end-group-1")
			const defaultGroup1Index = rootItems.findIndex((item) => item.id === "default-group-1")

			// Start groups appear at the beginning of the list
			expect(startGroup1Index).toBe(0)
			expect(startGroup2Index).toBe(1)

			// Built-in categories appear after start groups
			const builtinSkillsIndex = rootItems.findIndex(
				(item) => item.id === MentionItemType.SKILL,
			)
			if (builtinSkillsIndex !== -1) {
				expect(builtinSkillsIndex).toBeGreaterThan(startGroup2Index)
				expect(builtinSkillsIndex).toBeLessThan(endGroup1Index)
			}

			// End groups appear after built-ins in configured order
			expect(endGroup1Index).toBeLessThan(defaultGroup1Index)
			expect(defaultGroup1Index).toBe(rootItems.length - 1)
		})

		it("should show other project files without a current project", async () => {
			projectFilesStore.setSelectedProject(null)

			const items = await getDefaultItems()
			const otherProjectFilesIndex = items.findIndex(
				(item) => item.id === "other-project-files",
			)
			const uploadFilesIndex = items.findIndex((item) => item.id === "upload-files")

			expect(items.some((item) => item.id === "project-files")).toBe(false)
			expect(uploadFilesIndex).toBe(0)
			expect(otherProjectFilesIndex).toBe(1)
		})

		it("puts the pinned current micro app at the start of the root list", async () => {
			projectFilesStore.setSelectedProject(createTestProject("test-project"))
			mentionPanelStore.setPinnedCurrentMicroApp({
				appId: "app-1",
				appName: "Todo App",
			})

			const items = await getDefaultItems()
			expect(items[0]).toMatchObject({
				id: "app-1",
				type: MentionItemType.MICRO_APP,
				name: "Todo App",
				data: { app_id: "app-1", app_name: "Todo App" },
			})
		})

		it("filters disabled business roots and pinned micro apps", async () => {
			projectFilesStore.setSelectedProject(createTestProject("test-project"))
			mentionPanelStore.setPinnedCurrentMicroApp({
				appId: "app-hidden",
				appName: "Hidden App",
			})
			mentionPanelStore.setBuiltinVisibility({
				projectFiles: false,
				uploadFiles: false,
				otherProjectFiles: false,
				digitalEmployees: false,
				microApps: false,
				connectors: false,
				workflows: false,
				skills: false,
				canvasElements: false,
			})

			const items = await getDefaultItems()
			expect(items.some((item) => item.id === "app-hidden")).toBe(false)
			expect(items.some((item) => item.id === "project-files")).toBe(false)
			expect(items.some((item) => item.id === "other-project-files")).toBe(false)
			expect(items.some((item) => item.id === "upload-files")).toBe(false)
			expect(items.some((item) => item.id === "mcp-extensions")).toBe(false)
			expect(items.some((item) => item.id === "digital-employees")).toBe(false)
			expect(items.some((item) => item.id === "flows")).toBe(false)
			expect(items.some((item) => item.id === "skills")).toBe(false)

			const connectorItems = await mentionPanelStore.dispatch({
				kind: "catalog",
				catalogId: MentionPanelCatalogId.MCP_EXTENSIONS,
			})
			expect(connectorItems.items).toEqual([])
		})

		it("keeps flow child rows outside the root visibility configuration", async () => {
			mentionPanelStore.setBuiltinVisibility({ digitalEmployees: false })

			const items = await getDefaultItems()
			expect(items.some((item) => item.id === "digital-employees")).toBe(false)

			const flowItems = await mentionPanelStore.dispatch({
				kind: "catalog",
				catalogId: MentionPanelCatalogId.FLOWS,
			})
			expect(flowItems.items?.map((item) => item.id)).toEqual(["agents", "tools"])
		})
	})

	describe("custom group search", () => {
		beforeEach(() => {
			mentionPanelStore.setCustomMentionSearch(undefined)
			mentionPanelStore.setCustomMentionGroups([
				{
					id: "fixture-charts",
					label: "Charts",
					items: [
						{
							id: "fixture-chart-a",
							type: "chart",
							title: "Chart A",
							text: "Mock revenue for a sample quarter",
							description: "Fixture chart description",
						},
					],
				},
				{
					id: "fixture-reports",
					label: "Reports",
					items: [
						{
							id: "fixture-report-a",
							type: "report",
							title: "Report A",
							text: "Mock revenue for a different period",
							description: "Fixture report description",
						},
					],
				},
			])
		})

		it("merges dynamic global results while preserving their group identity", async () => {
			const search = vi.fn().mockResolvedValue([
				{
					groupId: "fixture-reports",
					items: [
						{
							id: "dynamic-report",
							type: "report",
							title: "Dynamic Report",
							text: "Dynamic report result",
						},
					],
				},
			])
			mentionPanelStore.setCustomMentionSearch(search)

			const results = await searchItems("dynamic")
			expect(search).toHaveBeenCalledWith(
				"dynamic",
				{ type: "global" },
				expect.any(AbortSignal),
			)
			expect(results.filter((item) => item.metadata?.customMention)).toMatchObject([
				{
					id: "dynamic-report",
					data: { groupId: "fixture-reports", text: "Dynamic report result" },
				},
			])
		})

		it("merges only the active group's static and dynamic search results", async () => {
			const search = vi.fn().mockResolvedValue([
				{
					groupId: "fixture-reports",
					items: [{ id: "wrong-group", type: "report", text: "Wrong group" }],
				},
				{
					groupId: "fixture-charts",
					items: [{ id: "dynamic-chart", type: "chart", text: "Dynamic chart" }],
				},
			])
			mentionPanelStore.setCustomMentionSearch(search)

			const results = await searchItemsInGroup("dynamic", "fixture-charts")
			expect(search).toHaveBeenCalledWith(
				"dynamic",
				{ type: "group", groupId: "fixture-charts" },
				expect.any(AbortSignal),
			)
			expect(results.map((item) => item.id)).toEqual(["dynamic-chart"])
		})

		it("merges static and dynamic results and lets the callback replace duplicate identities", async () => {
			const search = vi.fn().mockResolvedValue([
				{
					groupId: "fixture-charts",
					items: [
						{
							id: "fixture-chart-a",
							type: "chart",
							title: "Chart A refreshed",
							text: "Fresh chart result",
						},
						{
							id: "dynamic-chart",
							type: "chart",
							text: "Additional dynamic chart",
						},
					],
				},
			])
			mentionPanelStore.setCustomMentionSearch(search)

			const results = await searchItems("mock revenue")
			const customResults = results.filter((item) => item.metadata?.customMention)
			expect(customResults.map((item) => item.id)).toEqual([
				"fixture-chart-a",
				"fixture-report-a",
				"dynamic-chart",
			])
			expect(customResults.find((item) => item.id === "fixture-chart-a")).toMatchObject({
				name: "Chart A refreshed",
				data: { text: "Fresh chart result" },
			})
		})

		it("finds custom items globally by title and semantic text", async () => {
			const byTitle = await searchItems("Chart A")
			expect(byTitle.filter((item) => item.metadata?.customMention)).toMatchObject([
				{ id: "fixture-chart-a", name: "Chart A" },
			])

			const byText = await searchItems("sample quarter")
			expect(byText.filter((item) => item.metadata?.customMention)).toMatchObject([
				{
					id: "fixture-chart-a",
					data: { groupId: "fixture-charts", text: "Mock revenue for a sample quarter" },
				},
			])

			const acrossGroups = await searchItems("mock revenue")
			expect(
				acrossGroups
					.filter((item) => item.metadata?.customMention)
					.map((item) => item.data?.groupId),
			).toEqual(["fixture-charts", "fixture-reports"])
		})

		it("limits a scoped search to its group and matches descriptions", async () => {
			const byText = await searchItemsInGroup("mock revenue", "fixture-charts")
			expect(byText).toMatchObject([{ id: "fixture-chart-a", name: "Chart A" }])

			const byDescription = await searchItemsInGroup("chart description", "fixture-charts")
			expect(byDescription).toMatchObject([{ id: "fixture-chart-a" }])
			expect(await searchItemsInGroup("report description", "fixture-charts")).toEqual([])
		})
	})

	describe("scene catalog", () => {
		const reportItem: MentionItem = {
			id: "f-report",
			type: MentionItemType.PROJECT_FILE,
			name: "report.html",
			icon: "html",
			data: {
				file_id: "f-report",
				file_name: "report.html",
				file_path: "studies/s1/report.html",
				file_extension: "html",
			},
		}
		const personaItem: MentionItem = {
			id: "f-wang",
			type: MentionItemType.PROJECT_FILE,
			name: "王浩",
			description: "通勤咖啡重度用户",
			icon: "json",
			data: {
				file_id: "f-wang",
				file_name: "王浩",
				file_path: "personas/p-wang.json",
				file_extension: "json",
			},
		}

		function pinStudy(groups: { personas?: MentionItem[]; outputs?: MentionItem[] }) {
			mentionPanelStore.setPinnedSceneCatalog({
				name: "本次研究",
				groups: [
					{ id: "personas", title: "受访人设", items: groups.personas ?? [] },
					{ id: "outputs", title: "研究产物", items: groups.outputs ?? [] },
				],
			})
		}

		it("pins the entry first, above the pinned micro app", async () => {
			projectFilesStore.setSelectedProject(createTestProject("test-project"))
			mentionPanelStore.setPinnedCurrentMicroApp({ appId: "app-1", appName: "Todo App" })
			pinStudy({ personas: [personaItem] })

			const items = await getDefaultItems()
			expect(items[0]).toMatchObject({
				id: "scene-catalog",
				type: "scene_catalog",
				name: "本次研究",
				hasChildren: true,
			})
			expect(items[1]).toMatchObject({ id: "app-1" })
		})

		it("hides the entry when every group is empty", async () => {
			pinStudy({})

			const items = await getDefaultItems()
			expect(items.some((item) => item.id === "scene-catalog")).toBe(false)
		})

		it("lists a title row per group when there are several", async () => {
			pinStudy({ personas: [personaItem], outputs: [reportItem] })

			const result = await mentionPanelStore.dispatch({
				kind: "catalog",
				catalogId: MentionPanelCatalogId.SCENE_CATALOG,
			})
			expect(result.items?.map((item) => [item.type, item.name])).toEqual([
				[MentionItemType.TITLE, "受访人设"],
				[MentionItemType.PROJECT_FILE, "王浩"],
				[MentionItemType.TITLE, "研究产物"],
				[MentionItemType.PROJECT_FILE, "report.html"],
			])
			expect(result.items?.[3]?.tags).toContain("scene-catalog")
		})

		it("omits the title of a lone group, the breadcrumb already names the catalog", async () => {
			pinStudy({ outputs: [reportItem] })

			const result = await mentionPanelStore.dispatch({
				kind: "catalog",
				catalogId: MentionPanelCatalogId.SCENE_CATALOG,
			})
			expect(result.items?.map((item) => [item.type, item.name])).toEqual([
				[MentionItemType.PROJECT_FILE, "report.html"],
			])
		})

		it("searches names and taglines, keeping one row per file", async () => {
			projectFilesStore.setSelectedProject(createTestProject("test-project"))
			projectFilesStore.setWorkspaceFileTree([
				{
					type: "file",
					file_id: "f-report",
					file_name: "report.html",
					file_extension: "html",
					relative_file_path: "/studies/s1/report.html",
					project_id: "test-project",
					source: AttachmentSource.PROJECT_DIRECTORY,
					children: [],
				},
			])
			pinStudy({ personas: [personaItem], outputs: [reportItem] })

			const reports = (await searchItems("report")).filter((item) => item.id === "f-report")
			expect(reports).toHaveLength(1)
			expect(reports[0]?.tags).toContain("scene-catalog")

			expect((await searchItems("王浩")).map((item) => item.id)).toContain("f-wang")
			expect((await searchItems("通勤咖啡")).map((item) => item.id)).toContain("f-wang")
		})
	})

	describe("searchItems sorting algorithm", () => {
		beforeEach(() => {
			// Mock API responses
			vi.mocked(FlowApi.getAvailableMCP).mockResolvedValue(createMockMcpListResponse())

			vi.mocked(BotApi.getUserAllAgentList).mockResolvedValue(createMockAgentListResponse())

			vi.mocked(FlowApi.getUseableToolList).mockResolvedValue(createMockToolSetResponse())

			vi.mocked(CrewApi.getMentionSkills).mockResolvedValue([
				{
					id: "analyzing-data-dashboard",
					code: "analyzing-data-dashboard",
					name: "数据分析看板",
					description: "Dashboard skill",
					logo: null,
					mention_source: "system",
					package_name: "",
				},
			])

			// Setup test data
			mentionPanelStore.setUploadFiles([
				{
					id: "file1",
					type: MentionItemType.UPLOAD_FILE,
					name: "index.html",
					icon: "html",
					extension: "html",
					hasChildren: false,
					isFolder: false,
				},
				{
					id: "file2",
					type: MentionItemType.UPLOAD_FILE,
					name: "component.tsx",
					icon: "tsx",
					extension: "tsx",
					hasChildren: false,
					isFolder: false,
				},
				{
					id: "file3",
					type: MentionItemType.UPLOAD_FILE,
					name: "awesome-page.html",
					icon: "html",
					extension: "html",
					hasChildren: false,
					isFolder: false,
				},
				{
					id: "file4",
					type: MentionItemType.UPLOAD_FILE,
					name: "utility.js",
					icon: "js",
					extension: "js",
					hasChildren: false,
					isFolder: false,
				},
			] as MentionItem[])
		})

		it("should prioritize HTML files first", async () => {
			await mentionPanelStore.preLoadList()
			const results = await searchItems("a")

			// Find HTML and non-HTML files
			const htmlFiles = results.filter((item) => {
				const ext = getItemExtension(item)
				return ext === "html" || ext === "htm"
			})
			const nonHtmlFiles = results.filter((item) => {
				const ext = getItemExtension(item)
				return ext !== "html" && ext !== "htm"
			})

			// HTML files should come before non-HTML files
			if (htmlFiles.length > 0 && nonHtmlFiles.length > 0) {
				const firstHtmlIndex = results.findIndex((item) => htmlFiles.includes(item))
				const firstNonHtmlIndex = results.findIndex((item) => nonHtmlFiles.includes(item))
				expect(firstHtmlIndex).toBeLessThan(firstNonHtmlIndex)
			}
		})

		it("should find skills by description in global search", async () => {
			await mentionPanelStore.preLoadList()
			const results = await searchItems("dashboard")
			const skillMatch = results.find((item) => item.name === "数据分析看板")

			expect(skillMatch).toBeDefined()
			expect(skillMatch?.type).toBe(MentionItemType.SKILL)
		})

		it("should prefer the skill identifier over unrelated description matches", async () => {
			vi.mocked(CrewApi.getMentionSkills).mockResolvedValue([
				{
					id: "creating-slides",
					code: "creating-slides",
					name: "Create Slides",
					description:
						"Slide/PPT creation skill that provides complete slide creation capabilities. CRITICAL - When user message contains [@slide_project:...] mention, load this skill first.",
					logo: null,
					mention_source: "system",
					package_name: "creating-slides",
				},
				{
					id: "canvas-designer",
					code: "canvas-designer",
					name: "Canvas Designer",
					description:
						"Core canvas design skill covering project management. CRITICAL - When user message contains [@design_canvas_project:...] mention, load this skill first.",
					logo: null,
					mention_source: "system",
					package_name: "canvas-designer",
				},
				{
					id: "skill-creator",
					code: "skill-creator",
					name: "Skill Creator",
					description: "Create and evaluate skills.",
					logo: null,
					mention_source: "system",
					package_name: "skill-creator",
				},
			])

			await mentionPanelStore.preLoadList()
			const results = await searchItems("skill-cre")

			expect(results.map((item) => item.name)).toEqual(["Skill Creator"])
		})

		it("should prioritize exact matches after HTML priority", async () => {
			await mentionPanelStore.preLoadList()
			const results = await searchItems("awesome-page.html")

			// Should find the exact match
			expect(results).toHaveLength(1)
			expect(results[0].name).toBe("awesome-page.html")
		})

		it("should prioritize prefix matches", async () => {
			await mentionPanelStore.preLoadList()
			const results = await searchItems("index")

			// Should find files starting with 'index'
			const prefixMatches = results.filter((item) =>
				item.name.toLowerCase().startsWith("index"),
			)
			expect(prefixMatches.length).toBeGreaterThan(0)
		})

		it("should support fuzzy matching for non-contiguous characters", async () => {
			await mentionPanelStore.preLoadList()
			const results = await searchItems("cmpnt")

			// Should find 'component.tsx' through fuzzy matching
			const fuzzyMatch = results.find((item) => item.name === "component.tsx")
			expect(fuzzyMatch).toBeDefined()
		})

		it("should support fuzzy matching for tool names", async () => {
			await mentionPanelStore.preLoadList()
			const results = await searchItems("awetl")

			// Should find 'awesome-tool' through fuzzy matching
			const fuzzyMatch = results.find((item) => item.name === "awesome-tool")
			expect(fuzzyMatch).toBeDefined()
		})

		it("should handle substring matches between prefix and fuzzy matches", async () => {
			await mentionPanelStore.preLoadList()
			const results = await searchItems("html")

			// Should find both 'index.html', 'awesome-page.html' and 'html-parser'
			const htmlMatches = results.filter((item) => item.name.toLowerCase().includes("html"))
			expect(htmlMatches.length).toBeGreaterThan(0)

			// HTML files should still come first due to extension priority
			const htmlFiles = htmlMatches.filter((item) => {
				const ext = getItemExtension(item)
				return ext === "html" || ext === "htm"
			})
			if (htmlFiles.length > 0) {
				expect(results.indexOf(htmlFiles[0])).toBe(0)
			}
		})

		it("should return empty array for empty query", async () => {
			const results = await searchItems("")
			expect(results).toEqual([])
		})

		it("should return empty array for whitespace-only query", async () => {
			const results = await searchItems("   ")
			expect(results).toEqual([])
		})

		it("should handle queries with no matches", async () => {
			await mentionPanelStore.preLoadList()
			const results = await searchItems("xyz123nonexistent")
			expect(results).toEqual([])
		})

		it("should sort alphabetically within same priority level", async () => {
			// Add more test data with same priority
			const store = getTestStore()
			mentionPanelStore.setUploadFiles(
				store.uploadFilesStore.items.concat([
					{
						id: "file5",
						type: MentionItemType.UPLOAD_FILE,
						name: "zebra.html",
						icon: "html",
						extension: "html",
						hasChildren: false,
						isFolder: false,
					},
					{
						id: "file6",
						type: MentionItemType.UPLOAD_FILE,
						name: "apple.html",
						icon: "html",
						extension: "html",
						hasChildren: false,
						isFolder: false,
					},
				]),
			)

			await mentionPanelStore.preLoadList()
			const results = await searchItems("a")

			// Find HTML files containing 'a'
			const htmlFiles = results.filter((item) => {
				const ext = getItemExtension(item)
				return (ext === "html" || ext === "htm") && item.name.toLowerCase().includes("a")
			})

			if (htmlFiles.length > 1) {
				// Should be sorted alphabetically
				for (let i = 0; i < htmlFiles.length - 1; i++) {
					expect(
						htmlFiles[i].name.localeCompare(htmlFiles[i + 1].name),
					).toBeLessThanOrEqual(0)
				}
			}
		})
	})

	describe("integration with workspace files", () => {
		beforeEach(() => {
			// Setup workspace files
			projectFilesStore.setSelectedProject(createTestProject("test-project"))

			projectFilesStore.setWorkspaceFileTree([
				{
					type: "file",
					file_id: "ws1",
					file_name: "home.html",
					file_extension: "html",
					file_key: "/src/home.html",
					relative_file_path: "/src/home.html",
					file_size: 1024,
					file_url: "",
					task_id: "",
					project_id: "test-project",
					file_type: "html",
					is_hidden: false,
					source: AttachmentSource.PROJECT_DIRECTORY,
					children: [],
				},
				{
					type: "file",
					file_id: "ws2",
					file_name: "main.ts",
					file_extension: "ts",
					file_key: "/src/main.ts",
					relative_file_path: "/src/main.ts",
					file_size: 2048,
					file_url: "",
					task_id: "",
					project_id: "test-project",
					file_type: "ts",
					is_hidden: false,
					source: AttachmentSource.PROJECT_DIRECTORY,
					children: [],
				},
			])
		})

		it("should search and sort workspace files correctly", async () => {
			const results = await searchItems("m")

			// Should find both files but HTML should come first
			expect(results.length).toBeGreaterThan(0)

			const htmlFile = results.find((item) => item.name === "home.html")
			const tsFile = results.find((item) => item.name === "main.ts")

			if (htmlFile && tsFile) {
				expect(results.indexOf(htmlFile)).toBeLessThan(results.indexOf(tsFile))
			}
		})

		it("should support fuzzy matching on workspace file names", async () => {
			const results = await searchItems("mts")

			// Should find 'main.ts' through fuzzy matching on file name
			const nameMatch = results.find((item) => item.name === "main.ts")
			expect(nameMatch).toBeDefined()
		})

		it("should find overview.html with vew query (user reported issue)", async () => {
			// Reset to ensure clean state
			projectFilesStore.setSelectedProject(null)
			mentionPanelStore.setUploadFiles([
				{
					id: "overview-file",
					type: MentionItemType.UPLOAD_FILE,
					name: "overview.html",
					icon: "html",
					extension: "html",
					hasChildren: false,
					isFolder: false,
				},
			] as MentionItem[])

			const results = await searchItems("vew")

			// Should find overview.html through fuzzy matching
			const overviewMatch = results.find((item) => item.name === "overview.html")
			expect(overviewMatch).toBeDefined()
			expect(results.length).toBeGreaterThan(0)
		})

		it("should find workspace files with fuzzy matching when topic is selected", async () => {
			// Set up workspace files scenario (when project is selected)
			projectFilesStore.setSelectedProject(createTestProject("test-project"))

			projectFilesStore.setWorkspaceFileTree([
				{
					type: "file",
					file_id: "ws1",
					file_name: "overview.html",
					file_extension: "html",
					file_key: "/docs/overview.html",
					relative_file_path: "/docs/overview.html",
					file_size: 1024,
					file_url: "",
					task_id: "",
					project_id: "test-project",
					file_type: "html",
					is_hidden: false,
					source: AttachmentSource.PROJECT_DIRECTORY,
					children: [],
				},
			])

			const results = await searchItems("vew")

			// Should find overview.html in workspace files
			const overviewMatch = results.find((item) => item.name === "overview.html")
			expect(overviewMatch).toBeDefined()
			expect(results.length).toBeGreaterThan(0)
		})

		it("should keep an open design directory tab as a valid folder mention", async () => {
			projectFilesStore.setSelectedProject(createTestProject("test-project"))

			const designDirectory = {
				type: "directory" as const,
				file_id: "design-dir",
				file_name: "pink-jk-pikachu-design",
				file_extension: "",
				file_key: "/pink-jk-pikachu-design",
				relative_file_path: "/pink-jk-pikachu-design",
				file_size: 0,
				file_url: "",
				task_id: "",
				project_id: "test-project",
				file_type: "",
				is_hidden: false,
				parent_id: "missing-parent",
				source: AttachmentSource.PROJECT_DIRECTORY,
				display_config: {
					type: "design",
				},
				children: [],
			}

			projectFilesStore.setWorkspaceFileTree([designDirectory])
			mentionPanelStore.setCurrentTabs([
				{
					id: "design-dir",
					title: "pink-jk-pikachu-design",
					fileData: {
						...designDirectory,
						is_directory: true,
					},
					active: true,
					closeable: true,
				},
			])

			const [tabMention] = mentionPanelStore.getCurrentTabs()

			expect(tabMention).toMatchObject({
				id: "/pink-jk-pikachu-design",
				name: "pink-jk-pikachu-design",
				type: MentionItemType.FOLDER,
				hasChildren: false,
				isFolder: true,
				tags: ["tab"],
				data: {
					directory_id: "design-dir",
					directory_name: "pink-jk-pikachu-design",
					directory_path: "pink-jk-pikachu-design",
					directory_metadata: {
						type: "design",
					},
				},
			})

			const validation = await mentionPanelStore.dispatch({
				kind: "validate",
				item: {
					type: MentionItemType.FOLDER,
					data: tabMention.data,
				},
			})

			expect(validation.isValid).toBe(true)
		})

		it("should show active canvas elements as a root category after project files", async () => {
			projectFilesStore.setSelectedProject(createTestProject("test-project"))
			mentionPanelStore.setActiveCanvasElementsContext({
				designProjectId: "design-dir",
				canvasName: "pink-jk-pikachu-design",
				getCanvasDocument: () => ({
					elements: [
						{
							id: "hero",
							type: ElementTypeEnum.Image,
							name: "Hero Layer",
							src: "./images/hero.png",
							zIndex: 1,
						},
					],
				}),
				resolveFileBySrc: () =>
					({
						file_id: "file-hero",
						file_name: "hero.png",
						file_extension: "png",
						relative_file_path: "/design/images/hero.png",
						is_directory: false,
					}) as any,
			})

			const items = await getDefaultItems()
			const projectFilesIndex = items.findIndex((item) => item.id === "project-files")
			const otherProjectFilesIndex = items.findIndex(
				(item) => item.id === "other-project-files",
			)
			const canvasElementsIndex = items.findIndex((item) => item.id === "canvas-elements")

			expect(projectFilesIndex).toBeGreaterThanOrEqual(0)
			expect(otherProjectFilesIndex).toBe(projectFilesIndex + 1)
			expect(canvasElementsIndex).toBe(otherProjectFilesIndex + 1)
			expect(items[canvasElementsIndex]).toMatchObject({
				type: MentionItemType.FOLDER,
				name: "画布元素",
				description: "pink-jk-pikachu-design",
				hasChildren: true,
				isFolder: true,
			})
		})

		it("should show canvas elements root lazily without scanning an empty active canvas", async () => {
			projectFilesStore.setSelectedProject(createTestProject("test-project"))
			const getCanvasDocument = vi.fn(() => ({
				elements: [
					{
						id: "shape",
						type: ElementTypeEnum.Rectangle,
						name: "Shape Layer",
						zIndex: 1,
					},
				],
			}))
			mentionPanelStore.setActiveCanvasElementsContext({
				designProjectId: "design-dir",
				canvasName: "empty-design",
				getCanvasDocument,
				resolveFileBySrc: () => null,
			})

			const items = await getDefaultItems()
			const canvasElementsItem = items.find((item) => item.id === "canvas-elements")

			expect(canvasElementsItem).toMatchObject({
				type: MentionItemType.FOLDER,
				name: "画布元素",
				description: "empty-design",
			})
			expect(getCanvasDocument).not.toHaveBeenCalled()
		})

		it("should include active canvas elements in global search by layer name", async () => {
			projectFilesStore.setSelectedProject(createTestProject("test-project"))
			mentionPanelStore.setActiveCanvasElementsContext({
				designProjectId: "design-dir",
				canvasName: "pink-jk-pikachu-design",
				getCanvasDocument: () => ({
					elements: [
						{
							id: "hero",
							type: ElementTypeEnum.Image,
							name: "Hero Layer",
							zIndex: 1,
							contents: [{ contentId: "main", src: "./images/hero.png" }],
							activeContentId: "main",
							mainContentId: "main",
						},
					],
				}),
				resolveFileBySrc: () =>
					({
						file_id: "file-hero",
						file_name: "hero.png",
						file_extension: "png",
						relative_file_path: "/design/images/hero.png",
						is_directory: false,
					}) as any,
			})

			const results = await searchItems("Hero")

			expect(results[0]).toMatchObject({
				type: MentionItemType.PROJECT_FILE,
				name: "Hero Layer",
				tags: ["canvas-element"],
				data: {
					file_id: "file-hero",
					file_name: "hero.png",
				},
			})
		})

		it("should resolve an open dashboard entry tab to its parent folder mention", async () => {
			projectFilesStore.setSelectedProject(createTestProject("test-project"))

			const dashboardMetadata = {
				type: "dashboard",
				name: "销售数据分析看板",
			}
			const dashboardEntry = {
				type: "file" as const,
				file_id: "dashboard-entry",
				file_name: "index.html",
				file_extension: "html",
				file_key: "/销售数据分析看板/index.html",
				relative_file_path: "/销售数据分析看板/index.html",
				file_size: 1024,
				file_url: "",
				task_id: "",
				project_id: "test-project",
				file_type: "html",
				is_hidden: false,
				parent_id: "dashboard-dir",
				source: AttachmentSource.PROJECT_DIRECTORY,
				display_config: dashboardMetadata,
				children: [],
			}
			const dashboardDirectory = {
				type: "directory" as const,
				file_id: "dashboard-dir",
				file_name: "销售数据分析看板",
				file_extension: "",
				file_key: "/销售数据分析看板",
				relative_file_path: "/销售数据分析看板",
				file_size: 0,
				file_url: "",
				task_id: "",
				project_id: "test-project",
				file_type: "",
				is_hidden: false,
				source: AttachmentSource.PROJECT_DIRECTORY,
				display_config: dashboardMetadata,
				children: [dashboardEntry],
			}

			projectFilesStore.setWorkspaceFileTree([dashboardDirectory])
			mentionPanelStore.setCurrentTabs([
				{
					id: "dashboard-entry",
					title: "销售数据分析看板",
					filePath: "/销售数据分析看板/index.html",
					fileData: dashboardEntry,
					active: true,
					closeable: true,
				},
			])

			const [tabMention] = mentionPanelStore.getCurrentTabs()

			expect(tabMention).toMatchObject({
				id: "/销售数据分析看板",
				name: "销售数据分析看板",
				type: MentionItemType.FOLDER,
				hasChildren: true,
				isFolder: true,
				tags: ["tab"],
				data: {
					directory_id: "dashboard-dir",
					directory_name: "销售数据分析看板",
					directory_path: "销售数据分析看板",
					directory_metadata: dashboardMetadata,
				},
			})

			const validation = await mentionPanelStore.dispatch({
				kind: "validate",
				item: {
					type: MentionItemType.FOLDER,
					data: tabMention.data,
				},
			})

			expect(validation.isValid).toBe(true)
		})

		it("should normalize open project file tab paths", () => {
			projectFilesStore.setSelectedProject(createTestProject("test-project"))

			mentionPanelStore.setCurrentTabs([
				{
					id: "file-tab",
					title: "home.html",
					filePath: "/src/home.html",
					fileData: {
						file_id: "file-tab",
						file_name: "home.html",
						file_extension: "html",
						relative_file_path: "/src/home.html",
					},
					active: true,
					closeable: true,
				},
			])

			const [tabMention] = mentionPanelStore.getCurrentTabs()

			expect(tabMention).toMatchObject({
				id: "project:file-tab/src/home.html",
				name: "home.html",
				type: MentionItemType.PROJECT_FILE,
				data: {
					file_id: "file-tab",
					file_name: "home.html",
					file_path: "src/home.html",
					file_extension: "html",
				},
			})
			expect(tabMention.id).not.toContain("//")
		})

		it("should find files in different data sources based on context", async () => {
			await mentionPanelStore.preLoadList()

			// Test 1: No topic selected - should search upload files + MCP + agents + tools
			projectFilesStore.setSelectedProject(null)
			mentionPanelStore.setUploadFiles([
				{
					id: "upload1",
					type: MentionItemType.UPLOAD_FILE,
					name: "overview.html",
					icon: "html",
					extension: "html",
					hasChildren: false,
					isFolder: false,
				},
			] as MentionItem[])

			let results = await searchItems("vew")
			const uploadMatch = results.find((item) => item.name === "overview.html")
			expect(uploadMatch).toBeDefined()

			// Test 2: Topic selected - should search workspace files + MCP + agents + tools
			projectFilesStore.setSelectedProject(createTestProject("test"))
			projectFilesStore.setWorkspaceFileTree([
				{
					type: "file",
					file_name: "overview.html",
					file_extension: "html",
					file_key: "/overview.html",
					relative_file_path: "/overview.html",
					is_hidden: false,
					source: AttachmentSource.PROJECT_DIRECTORY,
					children: [],
				},
			])

			results = await searchItems("vew")
			const workspaceMatch = results.find((item) => item.name === "overview.html")
			expect(workspaceMatch).toBeDefined()
		})
	})

	describe("mention skills api integration", () => {
		it("should omit agent_code for default topic mode", async () => {
			await getSkillItems()

			expect(CrewApi.getMentionSkills).toHaveBeenCalledWith({})
		})

		it("should omit agent_code for non-custom agent topic modes", async () => {
			mentionPanelStore.setSkillQueryContext("general")

			await getSkillItems()

			expect(CrewApi.getMentionSkills).toHaveBeenCalledWith({})
		})

		it("should pass the selected employee code for custom agent mode", async () => {
			mentionPanelStore.setSkillQueryContext(TopicMode.CustomAgent, "SMA-agent-1")

			await getSkillItems()

			expect(CrewApi.getMentionSkills).toHaveBeenCalledWith({
				agent_code: "SMA-agent-1",
			})
		})

		it("should fetch latest skill data on every getSkills call", async () => {
			vi.mocked(CrewApi.getMentionSkills)
				.mockResolvedValueOnce([
					{
						id: "skill-a",
						code: "skill-a",
						name: "Skill A",
						description: "Old description",
						logo: null,
						mention_source: "system",
						package_name: "",
					},
				])
				.mockResolvedValueOnce([
					{
						id: "skill-b",
						code: "skill-b",
						name: "Skill B",
						description: "New description",
						logo: null,
						mention_source: "system",
						package_name: "",
					},
				])

			const store = getTestStore()
			await getSkillItems()
			expect(store.skillsStore.items[0]?.name).toBe("Skill A")

			await getSkillItems()

			expect(CrewApi.getMentionSkills).toHaveBeenCalledTimes(2)
			expect(store.skillsStore.items[0]?.name).toBe("Skill B")
		})

		it("should refresh latest skill data when requested", async () => {
			vi.mocked(CrewApi.getMentionSkills)
				.mockResolvedValueOnce([
					{
						id: "skill-a",
						code: "skill-a",
						name: "Skill A",
						description: "Old description",
						logo: null,
						mention_source: "system",
						package_name: "",
					},
				])
				.mockResolvedValueOnce([
					{
						id: "skill-b",
						code: "skill-b",
						name: "Skill B",
						description: "New description",
						logo: "logo-b",
						mention_source: "agent",
						package_name: "",
					},
				])

			const store = getTestStore()
			await getSkillItems()
			expect(store.skillsStore.items[0]?.name).toBe("Skill A")

			await refreshSkillItems()

			expect(CrewApi.getMentionSkills).toHaveBeenCalledTimes(2)
			expect(store.skillsStore.items[0]?.name).toBe("Skill B")
		})

		it("should keep mention skill item shape stable", async () => {
			vi.mocked(CrewApi.getMentionSkills).mockResolvedValueOnce([
				{
					id: "skill-1",
					code: "skill-1",
					name: "Skill One",
					description: "Skill description",
					logo: "skill-logo",
					mention_source: "mine",
					package_name: "",
				},
			])

			const items = await refreshSkillItems()

			expect(items).toEqual([
				expect.objectContaining({
					id: "skill-1",
					type: MentionItemType.SKILL,
					name: "Skill One",
					description: "Skill description",
					data: expect.objectContaining({
						id: "skill-1",
						name: "Skill One",
						icon: "skill-logo",
						description: "Skill description",
					}),
				}),
			])
		})

		it("should search skills with the query context captured at search start", async () => {
			let resolveDefaultSkills: ((value: SkillDomainItem[]) => void) | undefined

			vi.mocked(CrewApi.getMentionSkills)
				.mockImplementationOnce(
					() =>
						new Promise((resolve) => {
							resolveDefaultSkills = resolve
						}),
				)
				.mockResolvedValueOnce([
					{
						id: "general-skill",
						code: "general-skill",
						name: "General Skill",
						description: "General description",
						logo: null,
						mention_source: "agent",
						package_name: "",
					},
				])

			const searchPromise = searchItems("alpha")

			mentionPanelStore.setSkillQueryContext("general")
			await getSkillItems()

			resolveDefaultSkills?.([
				{
					id: "alpha-skill",
					code: "alpha-skill",
					name: "Alpha Skill",
					description: "Alpha description",
					logo: null,
					mention_source: "system",
					package_name: "",
				},
			])

			const results = await searchPromise

			expect(results.find((item) => item.name === "Alpha Skill")).toBeDefined()
			expect(results.find((item) => item.name === "General Skill")).toBeUndefined()
		})
	})

	describe("project file display resolver", () => {
		const tree = () => [
			{
				type: "directory" as const,
				file_id: "d-templates",
				file_name: "templates",
				relative_file_path: "/templates/",
				project_id: "test-project",
				source: AttachmentSource.PROJECT_DIRECTORY,
				children: [
					{
						type: "file" as const,
						file_id: "f-voices",
						file_name: "voices.html",
						file_extension: "html",
						relative_file_path: "/templates/voices.html",
						project_id: "test-project",
						source: AttachmentSource.PROJECT_DIRECTORY,
						children: [],
					},
				],
			},
			{
				type: "directory" as const,
				file_id: "d-chats",
				file_name: "template-chats",
				relative_file_path: "/template-chats/",
				project_id: "test-project",
				source: AttachmentSource.PROJECT_DIRECTORY,
				children: [],
			},
		]

		function resolver({ path, isDirectory }: { path: string; isDirectory: boolean }) {
			if (path.startsWith("template-chats")) return { hidden: true }
			if (isDirectory && path.replace(/\/$/, "") === "templates") return { name: "报告模板" }
			if (path === "templates/voices.html") return { name: "人声（默认）" }
			return null
		}

		async function listProjectFiles() {
			const result = await mentionPanelStore.dispatch({
				kind: "children",
				id: "project-files",
			})
			return result.items ?? []
		}

		beforeEach(() => {
			projectFilesStore.setSelectedProject(createTestProject("test-project"))
			projectFilesStore.setWorkspaceFileTree(tree() as never)
			mentionPanelStore.setProjectFileDisplayResolver(resolver)
		})

		afterEach(() => {
			mentionPanelStore.setProjectFileDisplayResolver(null)
		})

		it("relabels and hides folders while keeping their real path", async () => {
			const items = await listProjectFiles()

			expect(items.map((item) => item.name)).toEqual(["报告模板"])
			expect(items[0]).toMatchObject({
				id: "/templates/",
				data: { directory_name: "templates", directory_path: "templates/" },
			})
		})

		it("labels a file like a template mention: real path, label as file_name", async () => {
			const result = await mentionPanelStore.dispatch({
				kind: "children",
				id: "/templates/",
			})

			expect(result.items?.[0]).toMatchObject({
				id: "f-voices",
				type: MentionItemType.PROJECT_FILE,
				name: "人声（默认）",
				description: "voices.html",
				data: {
					file_id: "f-voices",
					file_name: "人声（默认）",
					file_path: "templates/voices.html",
					file_extension: "html",
					project_id: "test-project",
				},
			})
		})

		it("finds a relabelled file by its label or its real name", async () => {
			expect((await searchItems("人声")).map((item) => item.id)).toContain("f-voices")
			expect((await searchItems("voices")).map((item) => item.id)).toContain("f-voices")
		})

		it("leaves plain projects untouched once the resolver is cleared", async () => {
			mentionPanelStore.setProjectFileDisplayResolver(null)

			expect((await listProjectFiles()).map((item) => item.name)).toEqual([
				"templates",
				"template-chats",
			])
		})
	})
})
