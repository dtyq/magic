import { describe, it, expect, vi, beforeEach } from "vitest"
import mentionPanelStore from "../index"
import projectFilesStore from "@/stores/projectFiles"
import { MentionItemType, MentionItem } from "../../types"
import { BotApi, CrewApi, FlowApi, GlobalApi } from "@/apis"

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
	const flattenWorkspaceFileTree = (tree: any[]): any[] =>
		tree.reduce((acc, item) => {
			acc.push(item)
			if (item.children) {
				acc.push(...flattenWorkspaceFileTree(item.children))
			}
			return acc
		}, [] as any[])

	const store = {
		workspaceFileTree: [] as any[],
		workspaceFilesList: [] as any[],
		currentSelectedProject: null as any,
		setWorkspaceFileTree(tree: any[]) {
			this.workspaceFileTree = tree
			this.workspaceFilesList = flattenWorkspaceFileTree(tree)
		},
		setSelectedProject(project: any) {
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

describe("MentionPanelStore Sorting Algorithm", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		// Reset store state
		const store = mentionPanelStore as any
		projectFilesStore.setWorkspaceFileTree([])
		projectFilesStore.setSelectedProject(null)
		mentionPanelStore.mcpList = []
		mentionPanelStore.agentList = []
		mentionPanelStore.skillList = []
		mentionPanelStore.toolItems = []
		mentionPanelStore.uploadFiles = []
		store.skillListCache = new Map()
		store.currentSkillQueryKey = "__default__"
		store.fetchSkillsPromise = null

		vi.mocked(CrewApi.getMentionSkills).mockResolvedValue({
			code: 1000,
			message: "ok",
			data: [],
		})

		vi.mocked(GlobalApi.getSettingsGlobalData).mockResolvedValue({
			available_agents: {
				list: [
					{
						id: "agent1",
						name: "test-agent",
						avatar: "avatar1",
						description: "desc1",
						created_at: "2023-01-01",
					},
				],
			},
			available_mcp_servers: {
				list: [
					{
						id: "mcp1",
						name: "test-mcp",
						icon: "icon1",
						description: "desc1",
						require_fields: [],
						check_require_fields: false,
						check_auth: false,
					},
				],
			},
			available_tool_sets: {
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
								input: {},
								output: {},
								custom_system_input: {},
							},
							{
								code: "tool-code-2",
								name: "html-parser",
								description: "desc2",
								input: {},
								output: {},
								custom_system_input: {},
							},
						],
					},
				],
			},
		} as any)
	})

	describe("fuzzyMatch algorithm", () => {
		it("should match when all query characters appear in order", () => {
			// Access private method through any type casting for testing
			const store = mentionPanelStore as any

			expect(store.fuzzyMatch("hello world", "helo")).toBe(true)
			expect(store.fuzzyMatch("component.tsx", "cmpnt")).toBe(true)
			expect(store.fuzzyMatch("index.html", "indx")).toBe(true)
			expect(store.fuzzyMatch("my-awesome-file.js", "mawefj")).toBe(true)
		})

		it("should match overview.html with vew query (debug case)", () => {
			const store = mentionPanelStore as any

			// Test the specific case that user reported
			const result = store.fuzzyMatch("overview.html", "vew")

			// Debug the matching process
			const target = "overview.html"
			const query = "vew"
			const targetLower = target.toLowerCase()
			const queryLower = query.toLowerCase()

			let queryIndex = 0
			const matches = []

			for (let i = 0; i < targetLower.length && queryIndex < queryLower.length; i++) {
				if (targetLower[i] === queryLower[queryIndex]) {
					matches.push({ char: queryLower[queryIndex], targetIndex: i, queryIndex })
					queryIndex++
				}
			}

			// Expected matches: v at index 1, e at index 2, w at index 7
			expect(matches).toEqual([
				{ char: "v", targetIndex: 1, queryIndex: 0 },
				{ char: "e", targetIndex: 2, queryIndex: 1 },
				{ char: "w", targetIndex: 7, queryIndex: 2 },
			])
			expect(queryIndex).toBe(queryLower.length)
			expect(result).toBe(true)
		})

		it("should not match when characters are out of order", () => {
			const store = mentionPanelStore as any

			expect(store.fuzzyMatch("hello world", "oleh")).toBe(false)
			expect(store.fuzzyMatch("component.tsx", "tnpmc")).toBe(false)
		})

		it("should not match when query contains characters not in target", () => {
			const store = mentionPanelStore as any

			expect(store.fuzzyMatch("hello", "xyz")).toBe(false)
			expect(store.fuzzyMatch("component", "zyx")).toBe(false)
		})

		it("should handle case insensitive matching", () => {
			const store = mentionPanelStore as any

			expect(store.fuzzyMatch("Hello World", "HELO")).toBe(true)
			expect(store.fuzzyMatch("COMPONENT.TSX", "cmpnt")).toBe(true)
		})

		it("should handle empty strings", () => {
			const store = mentionPanelStore as any

			expect(store.fuzzyMatch("hello", "")).toBe(true)
			expect(store.fuzzyMatch("", "h")).toBe(false)
			expect(store.fuzzyMatch("", "")).toBe(true)
		})
	})

	describe("matchesQuery method", () => {
		it("should prioritize exact substring match over fuzzy match", () => {
			const store = mentionPanelStore as any

			expect(store.matchesQuery("hello world", "hello")).toBe(true)
			expect(store.matchesQuery("component.tsx", "comp")).toBe(true)
		})

		it("should fall back to fuzzy match when substring match fails", () => {
			const store = mentionPanelStore as any

			expect(store.matchesQuery("hello world", "helo")).toBe(true)
			expect(store.matchesQuery("component.tsx", "cmpnt")).toBe(true)
		})

		it("should return false when neither match succeeds", () => {
			const store = mentionPanelStore as any

			expect(store.matchesQuery("hello world", "xyz")).toBe(false)
			expect(store.matchesQuery("component.tsx", "zyx")).toBe(false)
		})
	})

	describe("searchItems sorting algorithm", () => {
		beforeEach(() => {
			// Mock API responses
			vi.mocked(FlowApi.getAvailableMCP).mockResolvedValue({
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
			} as any)

			vi.mocked(BotApi.getUserAllAgentList).mockResolvedValue({
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
			} as any)

			vi.mocked(FlowApi.getUseableToolList).mockResolvedValue({
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
								input: {},
								output: {},
								custom_system_input: {},
							},
							{
								code: "tool-code-2",
								name: "html-parser",
								description: "desc2",
								input: {},
								output: {},
								custom_system_input: {},
							},
						],
					},
				],
			} as any)

			vi.mocked(CrewApi.getMentionSkills).mockResolvedValue({
				code: 1000,
				message: "ok",
				data: [
					{
						id: "analyzing-data-dashboard",
						code: "analyzing-data-dashboard",
						name: "数据分析看板",
						description: "Dashboard skill",
						logo: null,
						source: "system",
					},
				],
			})

			// Setup test data
			mentionPanelStore.uploadFiles = [
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
			] as MentionItem[]
		})

		it("should prioritize HTML files first", async () => {
			await mentionPanelStore.preLoadList()
			const results = await mentionPanelStore.searchItems("a")

			// Find HTML and non-HTML files
			const htmlFiles = results.filter((item) => {
				const ext =
					item.extension?.toLowerCase() ||
					(item.data as any)?.file_extension?.toLowerCase() ||
					""
				return ext === "html" || ext === "htm"
			})
			const nonHtmlFiles = results.filter((item) => {
				const ext =
					item.extension?.toLowerCase() ||
					(item.data as any)?.file_extension?.toLowerCase() ||
					""
				return ext !== "html" && ext !== "htm"
			})

			// HTML files should come before non-HTML files
			if (htmlFiles.length > 0 && nonHtmlFiles.length > 0) {
				const firstHtmlIndex = results.findIndex((item) => htmlFiles.includes(item))
				const firstNonHtmlIndex = results.findIndex((item) => nonHtmlFiles.includes(item))
				expect(firstHtmlIndex).toBeLessThan(firstNonHtmlIndex)
			}
		})

		it("should prioritize exact matches after HTML priority", async () => {
			await mentionPanelStore.preLoadList()
			const results = await mentionPanelStore.searchItems("awesome-page.html")

			// Should find the exact match
			expect(results).toHaveLength(1)
			expect(results[0].name).toBe("awesome-page.html")
		})

		it("should prioritize prefix matches", async () => {
			await mentionPanelStore.preLoadList()
			const results = await mentionPanelStore.searchItems("index")

			// Should find files starting with 'index'
			const prefixMatches = results.filter((item) =>
				item.name.toLowerCase().startsWith("index"),
			)
			expect(prefixMatches.length).toBeGreaterThan(0)
		})

		it("should support fuzzy matching for non-contiguous characters", async () => {
			await mentionPanelStore.preLoadList()
			const results = await mentionPanelStore.searchItems("cmpnt")

			// Should find 'component.tsx' through fuzzy matching
			const fuzzyMatch = results.find((item) => item.name === "component.tsx")
			expect(fuzzyMatch).toBeDefined()
		})

		it("should support fuzzy matching for tool names", async () => {
			await mentionPanelStore.preLoadList()
			const results = await mentionPanelStore.searchItems("awetl")

			// Should find 'awesome-tool' through fuzzy matching
			const fuzzyMatch = results.find((item) => item.name === "awesome-tool")
			expect(fuzzyMatch).toBeDefined()
		})

		it("should handle substring matches between prefix and fuzzy matches", async () => {
			await mentionPanelStore.preLoadList()
			const results = await mentionPanelStore.searchItems("html")

			// Should find both 'index.html', 'awesome-page.html' and 'html-parser'
			const htmlMatches = results.filter((item) => item.name.toLowerCase().includes("html"))
			expect(htmlMatches.length).toBeGreaterThan(0)

			// HTML files should still come first due to extension priority
			const htmlFiles = htmlMatches.filter((item) => {
				const ext =
					item.extension?.toLowerCase() ||
					(item.data as any)?.file_extension?.toLowerCase() ||
					""
				return ext === "html" || ext === "htm"
			})
			if (htmlFiles.length > 0) {
				expect(results.indexOf(htmlFiles[0])).toBe(0)
			}
		})

		it("should return empty array for empty query", async () => {
			const results = await mentionPanelStore.searchItems("")
			expect(results).toEqual([])
		})

		it("should return empty array for whitespace-only query", async () => {
			const results = await mentionPanelStore.searchItems("   ")
			expect(results).toEqual([])
		})

		it("should handle queries with no matches", async () => {
			await mentionPanelStore.preLoadList()
			const results = await mentionPanelStore.searchItems("xyz123nonexistent")
			expect(results).toEqual([])
		})

		it("should sort alphabetically within same priority level", async () => {
			// Add more test data with same priority
			mentionPanelStore.uploadFiles.push(
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
			)

			await mentionPanelStore.preLoadList()
			const results = await mentionPanelStore.searchItems("a")

			// Find HTML files containing 'a'
			const htmlFiles = results.filter((item) => {
				const ext =
					item.extension?.toLowerCase() ||
					(item.data as any)?.file_extension?.toLowerCase() ||
					""
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
			projectFilesStore.setSelectedProject({
				id: "test-project",
			} as any)

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
					children: [],
				},
			] as any[])
		})

		it("should search and sort workspace files correctly", async () => {
			const results = await mentionPanelStore.searchItems("m")

			// Should find both files but HTML should come first
			expect(results.length).toBeGreaterThan(0)

			const htmlFile = results.find((item) => item.name === "home.html")
			const tsFile = results.find((item) => item.name === "main.ts")

			if (htmlFile && tsFile) {
				expect(results.indexOf(htmlFile)).toBeLessThan(results.indexOf(tsFile))
			}
		})

		it("should support fuzzy matching on workspace file names", async () => {
			const results = await mentionPanelStore.searchItems("mts")

			// Should find 'main.ts' through fuzzy matching on file name
			const nameMatch = results.find((item) => item.name === "main.ts")
			expect(nameMatch).toBeDefined()
		})

		it("should find overview.html with vew query (user reported issue)", async () => {
			// Reset to ensure clean state
			projectFilesStore.setSelectedProject(null)
			mentionPanelStore.uploadFiles = [
				{
					id: "overview-file",
					type: MentionItemType.UPLOAD_FILE,
					name: "overview.html",
					icon: "html",
					extension: "html",
					hasChildren: false,
					isFolder: false,
				},
			] as MentionItem[]

			const results = await mentionPanelStore.searchItems("vew")

			// Should find overview.html through fuzzy matching
			const overviewMatch = results.find((item) => item.name === "overview.html")
			expect(overviewMatch).toBeDefined()
			expect(results.length).toBeGreaterThan(0)
		})

		it("should find workspace files with fuzzy matching when topic is selected", async () => {
			// Set up workspace files scenario (when project is selected)
			projectFilesStore.setSelectedProject({
				id: "test-project",
			} as any)

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
					children: [],
				},
			] as any[])

			const results = await mentionPanelStore.searchItems("vew")

			// Should find overview.html in workspace files
			const overviewMatch = results.find((item) => item.name === "overview.html")
			expect(overviewMatch).toBeDefined()
			expect(results.length).toBeGreaterThan(0)
		})

		it("should find files in different data sources based on context", async () => {
			await mentionPanelStore.preLoadList()

			// Test 1: No topic selected - should search upload files + MCP + agents + tools
			projectFilesStore.setSelectedProject(null)
			mentionPanelStore.uploadFiles = [
				{
					id: "upload1",
					type: MentionItemType.UPLOAD_FILE,
					name: "overview.html",
					icon: "html",
					extension: "html",
					hasChildren: false,
					isFolder: false,
				},
			] as MentionItem[]

			let results = await mentionPanelStore.searchItems("vew")
			const uploadMatch = results.find((item) => item.name === "overview.html")
			expect(uploadMatch).toBeDefined()

			// Test 2: Topic selected - should search workspace files + MCP + agents + tools
			projectFilesStore.setSelectedProject({ id: "test" } as any)
			projectFilesStore.setWorkspaceFileTree([
				{
					type: "file",
					file_name: "overview.html",
					file_extension: "html",
					file_key: "/overview.html",
					relative_file_path: "/overview.html",
					is_hidden: false,
					children: [],
				},
			] as any[])

			results = await mentionPanelStore.searchItems("vew")
			const workspaceMatch = results.find((item) => item.name === "overview.html")
			expect(workspaceMatch).toBeDefined()
		})
	})

	describe("mention skills api integration", () => {
		it("should omit agent_code for default topic mode", async () => {
			await mentionPanelStore.getSkills()

			expect(CrewApi.getMentionSkills).toHaveBeenCalledWith({})
		})

		it("should pass topic mode as agent_code", async () => {
			mentionPanelStore.setSkillQueryContext("general")

			await mentionPanelStore.getSkills()

			expect(CrewApi.getMentionSkills).toHaveBeenCalledWith({
				agent_code: "general",
			})
		})

		it("should refresh latest skill data when requested", async () => {
			vi.mocked(CrewApi.getMentionSkills)
				.mockResolvedValueOnce({
					code: 1000,
					message: "ok",
					data: [
						{
							id: "skill-a",
							code: "skill-a",
							name: "Skill A",
							description: "Old description",
							logo: null,
							source: "system",
						},
					],
				})
				.mockResolvedValueOnce({
					code: 1000,
					message: "ok",
					data: [
						{
							id: "skill-b",
							code: "skill-b",
							name: "Skill B",
							description: "New description",
							logo: "logo-b",
							source: "agent",
						},
					],
				})

			await mentionPanelStore.getSkills()
			expect(mentionPanelStore.skillList[0]?.name).toBe("Skill A")

			await mentionPanelStore.refreshSkills()

			expect(CrewApi.getMentionSkills).toHaveBeenCalledTimes(2)
			expect(mentionPanelStore.skillList[0]?.name).toBe("Skill B")
		})

		it("should keep mention skill item shape stable", async () => {
			vi.mocked(CrewApi.getMentionSkills).mockResolvedValueOnce({
				code: 1000,
				message: "ok",
				data: [
					{
						id: "skill-1",
						code: "skill-1",
						name: "Skill One",
						description: "Skill description",
						logo: "skill-logo",
						source: "mine",
					},
				],
			})

			const items = await mentionPanelStore.refreshSkills()

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
	})
})
