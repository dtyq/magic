import { describe, it, expect, vi, beforeEach } from "vitest"
import mentionPanelStore from "../store"
import projectFilesStore from "@/stores/projectFiles"
import { MentionItemType, MentionItem } from "../../../types"
import { MentionPanelCatalogId } from "../../../businessTypes"
import { BotApi, CrewApi, FlowApi, GlobalApi } from "@/apis"
import type { GetSettingsGlobalDataResponse } from "@/apis/types"
import type { GetUserAvailableAgentListResponse } from "@/types/bot"
import type { GetAvailableMCPListResponse, UseableToolSet, WithPage } from "@/types/flow"
import type { SkillDomainItem } from "../domains/skills/types"
import { type ProjectListItem, ProjectStatus } from "@/pages/superMagic/pages/Workspace/types"
import { TopicMode } from "@/pages/superMagic/pages/Workspace/TopicMode"
import { AttachmentSource } from "@/pages/superMagic/components/TopicFilesButton/hooks/types"

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

async function getSkillItems(): Promise<MentionItem[]> {
	const result = await mentionPanelStore.dispatch({
		kind: "catalog",
		catalogId: MentionPanelCatalogId.SKILLS,
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

		it("should pass topic mode as agent_code", async () => {
			mentionPanelStore.setSkillQueryContext("general")

			await getSkillItems()

			expect(CrewApi.getMentionSkills).toHaveBeenCalledWith({
				agent_code: "general",
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
})
