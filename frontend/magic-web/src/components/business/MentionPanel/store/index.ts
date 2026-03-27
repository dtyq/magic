import { makeAutoObservable } from "mobx"
import { createDefaultItems } from "../constants"
import { MentionItemType, PanelState, BuiltinItemId } from "../types"
import type {
	MentionItem,
	ProjectFileMentionData,
	McpMentionData,
	AgentMentionData,
	SkillMentionData,
	ToolMentionData,
	DirectoryMentionData,
	DataService,
} from "../types"
import { BotApi, CrewApi, FlowApi, GlobalApi } from "@/apis"
import type { I18nTexts } from "../i18n"
import type { UseableToolSet } from "@/types/flow"
import { LRUCache, createLRUCache } from "../utils/LRUCache"
import {
	getMentionDisplayName,
	getMentionIcon,
	getMentionDescription,
	getMentionUniqueId,
} from "../tiptap-plugin/types"
import type { MentionListItem } from "../tiptap-plugin/types"
import { platformKey } from "@/utils/storage"
import { userStore } from "@/models/user"
import { keyBy } from "lodash-es"
import type {
	TabItem,
	PlaybackTabItem,
} from "@/pages/superMagic/components/Detail/components/FilesViewer/types"
import type { WorkspaceFile, WorkspaceFolder } from "@/stores/projectFiles/types"
import type { ProjectFilesStore } from "@/stores/projectFiles"
import { getAttachmentType } from "@/pages/superMagic/components/MessageList/components/MessageAttachment/utils"
import type { MentionSkillItem } from "@/apis/modules/crew"

export type { WorkspaceFile, WorkspaceFolder }

interface McpItem {
	id: string
	name: string
	icon?: string
	description?: string
	require_fields?: unknown
	check_require_fields?: unknown
	check_auth?: boolean
}

const DEFAULT_SKILL_QUERY_KEY = "__default__"

function resolveSkillAgentCode(topicMode?: string) {
	const normalizedTopicMode = topicMode?.trim()
	if (!normalizedTopicMode || normalizedTopicMode === "default") return undefined
	return normalizedTopicMode
}

function getSkillQueryKey(topicMode?: string) {
	return resolveSkillAgentCode(topicMode) ?? DEFAULT_SKILL_QUERY_KEY
}

function mapAgentToMention(item: Bot.UserAvailableAgentInfo): MentionItem {
	return {
		id: item.id,
		type: MentionItemType.AGENT,
		name: item.name,
		icon: item.avatar,
		hasChildren: false,
		isFolder: false,
		createdAt: item.created_at,
		data: {
			agent_id: item.id,
			agent_name: item.name,
			agent_avatar: item.avatar,
			agent_description: item.description,
		} as AgentMentionData,
	}
}

function mapMcpToMention(item: McpItem): MentionItem {
	return {
		id: item.id,
		type: MentionItemType.MCP,
		name: item.name,
		icon: item.icon,
		hasChildren: false,
		isFolder: false,
		data: {
			id: item.id,
			name: item.name,
			icon: item.icon,
			description: item.description,
			require_fields: item.require_fields,
			check_require_fields: item.check_require_fields,
			check_auth: item.check_auth,
		} as McpMentionData,
	}
}

function mapSkillToMention(item: MentionSkillItem): MentionItem {
	const skillId = item.code || item.id

	return {
		id: skillId,
		type: MentionItemType.SKILL,
		name: item.name,
		icon: item.logo || undefined,
		description: item.description,
		hasChildren: false,
		isFolder: false,
		data: {
			id: skillId,
			name: item.name,
			icon: item.logo || "",
			description: item.description,
			mention_source: item.mention_source,
			package_name: item.package_name || "",
		} as SkillMentionData,
	}
}

/**
 * 类型守卫：检查是否为 playbackTab
 */
function isPlaybackTab(tab: TabItem): tab is PlaybackTabItem {
	return (
		(tab as PlaybackTabItem).isPlaybackTab === true ||
		(tab as PlaybackTabItem).type === "playback"
	)
}

// 历史记录项接口
export interface MentionHistoryItem {
	/** 唯一标识 */
	id: string
	/** 显示名称 */
	name: string
	/** 描述信息 */
	description?: string
	/** 类型 */
	type: string
	/** 原始数据 */
	data: any
	/** 图标 */
	icon?: string
	/** 使用次数 */
	usage: number
}

export class MentionPanelStore implements DataService {
	private projectFilesStore: ProjectFilesStore

	constructor(projectFilesStore: ProjectFilesStore) {
		this.projectFilesStore = projectFilesStore
		makeAutoObservable(this, {}, { autoBind: true })

		// 初始化历史记录缓存
		this.initializeHistoryCache()
	}

	mcpList: MentionItem[] = []
	agentList: MentionItem[] = []
	skillList: MentionItem[] = []
	private skillListCache = new Map<string, MentionItem[]>()
	private currentSkillQueryKey = DEFAULT_SKILL_QUERY_KEY

	toolItems: UseableToolSet.Item[] = []
	uploadFiles: MentionItem[] = []

	currentTabs: TabItem[] = []
	private fetchSkillsPromise: Promise<MentionItem[]> | null = null

	// 历史记录缓存实例（多个命名空间）
	private historyCaches = new Map<string, LRUCache<MentionHistoryItem>>()

	// ============================================================================
	// Proxy getters to ProjectFilesStore for internal use
	// ============================================================================

	get currentSelectedProject() {
		return this.projectFilesStore.currentSelectedProject
	}

	get workspaceFileTree() {
		return this.projectFilesStore.workspaceFileTree
	}

	get workspaceFilesList() {
		return this.projectFilesStore.workspaceFilesList
	}

	initLoadAttachmentsPromise: Record<string, Promise<void>> = {}

	initLoadAttachmentsPromiseResolve: Record<string, (() => void) | null> = {}

	/**
	 * 初始化加载附件的Promise
	 * @returns Promise
	 */
	initLoadAttachments(projectId: string) {
		if (!projectId) return

		this.initLoadAttachmentsPromise[projectId] = new Promise((resolve) => {
			this.initLoadAttachmentsPromiseResolve[projectId] = () => {
				resolve()
			}
		})
	}

	setCurrentTabs(tabs: TabItem[]) {
		this.currentTabs = tabs
			.reduce((prev, current) => {
				if (current.isDeleted) {
					return prev
				}

				prev.push(current)

				return prev
			}, [] as TabItem[])
			// 按最后激活时间排序
			.sort((a, b) => (b.active_at || 0) - (a.active_at || 0))
	}

	/**
	 * 完成加载附件的Promise
	 */
	finishLoadAttachmentsPromise(projectId: string) {
		this.initLoadAttachmentsPromiseResolve[projectId]?.()
	}

	/**
	 * 获取初始加载附件的Promise
	 * @param projectId - 项目ID
	 * @returns Promise
	 */
	getInitLoadAttachmentsPromise(projectId: string) {
		return this.initLoadAttachmentsPromise[projectId] ?? Promise.resolve()
	}

	/**
	 * 清除初始加载附件的Promise
	 * @param projectId - 项目ID
	 */
	clearInitLoadAttachmentsPromise(projectId: string) {
		if (projectId) {
			delete this.initLoadAttachmentsPromise[projectId]
			delete this.initLoadAttachmentsPromiseResolve[projectId]
		}
	}

	fetchMcpList() {
		return FlowApi.getAvailableMCP([]).then((res) => {
			this.mcpList = res.list.map(mapMcpToMention)
		})
	}

	fetchAgentList() {
		return BotApi.getUserAllAgentList().then((res) => {
			this.agentList = res.list.map(mapAgentToMention)
		})
	}

	fetchToolItems() {
		return FlowApi.getUseableToolList({ with_builtin: false }).then((res) => {
			this.toolItems = res.list
		})
	}

	setSkillQueryContext(topicMode?: string) {
		const nextSkillQueryKey = getSkillQueryKey(topicMode)
		if (this.currentSkillQueryKey === nextSkillQueryKey) return

		this.currentSkillQueryKey = nextSkillQueryKey
		this.fetchSkillsPromise = null
		this.skillList = this.getSkillListByQueryKey(nextSkillQueryKey)
	}

	fetchSkills(options?: { forceRefresh?: boolean }): Promise<MentionItem[]> {
		const forceRefresh = options?.forceRefresh ?? false
		if (this.fetchSkillsPromise) return this.fetchSkillsPromise
		if (!forceRefresh && this.skillListCache.has(this.currentSkillQueryKey))
			return Promise.resolve(this.getCurrentSkillList())

		const requestKey = this.currentSkillQueryKey
		const fetchPromise = this.loadAllSkills({ requestKey }).finally(() => {
			this.fetchSkillsPromise = null
		})
		this.fetchSkillsPromise = fetchPromise

		return fetchPromise
	}

	preLoadList() {
		void this.fetchSkills().catch(() => {
			if (this.skillList.length === 0) {
				this.skillList = []
			}
		})

		return Promise.all([
			GlobalApi.getSettingsGlobalData({
				query_type: ["available_agents", "available_mcp_servers", "available_tool_sets"],
				available_tool_sets_query: {
					with_builtin: false,
				},
			}).then((res) => {
				this.initData(
					res?.available_agents?.list ?? [],
					res?.available_mcp_servers?.list ?? [],
					res?.available_tool_sets?.list ?? [],
				)
			}),
		]).then(() => undefined)
	}

	/**
	 * 初始化数据
	 * @param agents 可用AI助理列表
	 * @param mcpList 可用MCP列表
	 * @param toolItems 工具列表
	 */
	initData(
		agents: Bot.UserAvailableAgentInfo[],
		mcpList: McpMentionData[],
		toolItems: UseableToolSet.Item[],
	) {
		this.agentList = agents.map(mapAgentToMention)
		this.mcpList = mcpList.map(mapMcpToMention)
		this.toolItems = toolItems
	}

	setUploadFiles(files: MentionItem[]) {
		this.uploadFiles = files
	}

	getFolderItems(folderId: string) {
		if (
			folderId === BuiltinItemId.PERSONAL_DRIVE ||
			folderId === BuiltinItemId.ORGANIZATION_DRIVE
		) {
			return []
		}

		if (folderId === BuiltinItemId.PROJECT_FILES) {
			const value = this.workspaceFilesToMentionItems(
				this.projectFilesStore.workspaceFileTree as unknown as (
					| WorkspaceFile
					| WorkspaceFolder
				)[],
			)
			return value.length > 0 ? value : []
		}

		return this.workspaceFilesToMentionItems(
			(this.projectFilesStore.workspaceFilesList.find(
				(item) => item.type === "directory" && item.relative_file_path === folderId,
			)?.children || []) as unknown as (WorkspaceFile | WorkspaceFolder)[],
		)
	}

	hasProjectFile(fileId: string) {
		return this.projectFilesStore.hasProjectFile(fileId)
	}

	hasFolder(directoryId: string) {
		return this.projectFilesStore.hasFolder(directoryId)
	}

	getMcpExtensions() {
		return this.mcpList
	}

	getAgents() {
		return this.agentList
	}

	async getSkills() {
		if (!this.skillListCache.has(this.currentSkillQueryKey)) {
			await this.fetchSkills().catch(() => {
				if (!this.skillListCache.has(this.currentSkillQueryKey)) this.skillList = []
			})
		}
		return this.getCurrentSkillList()
	}

	async refreshSkills() {
		await this.fetchSkills({ forceRefresh: true }).catch(() => {
			if (!this.skillListCache.has(this.currentSkillQueryKey)) this.skillList = []
		})
		return this.getCurrentSkillList()
	}

	getToolItems(collectionId: string) {
		if (collectionId === BuiltinItemId.TOOLS) {
			return this.toolItems.map((item) => ({
				id: item.id,
				type: MentionItemType.TOOL,
				name: item.name,
				icon: item.icon,
				hasChildren: (item.tools?.length || 0) > 0,
				isFolder: true,
			})) as MentionItem[]
		}

		const target = this.toolItems.find((item) => item.id === collectionId)

		if (!target) {
			return []
		}

		return target.tools?.map((item) => ({
			id: item.code,
			type: MentionItemType.TOOL,
			name: item.name,
			hasChildren: false,
			isFolder: false,
			data: {
				id: item.code,
				name: `${target.name}:${item.name}`,
				description: item.description,
			} as ToolMentionData,
		})) as MentionItem[]
	}

	/**
	 * Merge, deduplicate and sort smart recommendations
	 * @param tabsItems - Current open files from tabs
	 * @param historyItems - Recent mentioned files from history
	 * @returns Deduplicated and sorted mention items
	 */
	private mergeSmartRecommendations(
		tabsItems: MentionItem[],
		historyItems: MentionItem[],
	): MentionItem[] {
		// Use Map to deduplicate by unique identifier
		const itemsMap = new Map<string, MentionItem>()

		// Add tabs items first (higher priority)
		tabsItems.forEach((item) => {
			const uniqueId = getMentionUniqueId({ type: item.type, data: item.data })
			if (!itemsMap.has(uniqueId)) {
				itemsMap.set(uniqueId, item)
			}
		})

		// Add history items (skip if already exists in tabs)
		historyItems.forEach((item) => {
			const uniqueId = getMentionUniqueId({ type: item.type, data: item.data })
			if (!itemsMap.has(uniqueId)) {
				itemsMap.set(uniqueId, item)
			}
		})

		// Convert map to array, maintain insertion order (tabs first, then history)
		return Array.from(itemsMap.values())
	}

	getDefaultItems(t: I18nTexts): MentionItem[] {
		let defaultItems = createDefaultItems(t)[PanelState.DEFAULT] as MentionItem[]
		if (this.projectFilesStore.currentSelectedProject) {
			defaultItems = defaultItems.filter((item) => item.id !== BuiltinItemId.UPLOAD_FILES)

			// Get history items and tabs items, merge them into smart recommendations
			const historyItems = this.getHistoryAsMentionItems(5, t)
			const tabsItems = this.getTabsAsMentionItems(5, t)
			const smartRecommendations = this.mergeSmartRecommendations(tabsItems, historyItems)

			if (smartRecommendations.length > 0) {
				defaultItems = [
					{
						id: "smart-recommendations",
						icon: null, // Will be set in the component
						type: MentionItemType.TITLE,
						name: t?.historyActions.smartRecommendations,
						unSelectable: true,
					},
					...smartRecommendations,
					{
						id: "divider",
						type: MentionItemType.DIVIDER,
						name: "",
						unSelectable: true,
					},
					...defaultItems,
				]
			}

			return defaultItems
		}

		return defaultItems.filter((item) => item.id !== BuiltinItemId.PROJECT_FILES)
	}

	getUploadFiles() {
		return this.uploadFiles
	}

	workspaceFilesToMentionItems(files: (WorkspaceFile | WorkspaceFolder)[]): MentionItem[] {
		return files.map((file) => {
			if (file.type === "directory") {
				const relativePath = file.relative_file_path.startsWith("/")
					? file.relative_file_path.slice(1)
					: file.relative_file_path

				return {
					id: file.relative_file_path,
					type: MentionItemType.FOLDER,
					name: file.file_name,
					icon: "file-folder",
					hasChildren: file.children.length > 0,
					isFolder: true,
					path: file.relative_file_path,
					data: {
						directory_id: file.file_id,
						directory_name: file.file_name,
						directory_path: relativePath,
						directory_metadata: file?.metadata,
					} as DirectoryMentionData,
				}
			}

			const relativePath = file.relative_file_path.startsWith("/")
				? file.relative_file_path.slice(1)
				: file.relative_file_path

			return {
				id: file.file_id,
				type: MentionItemType.PROJECT_FILE,
				name: file.file_name,
				icon: file.file_extension,
				extension: file.file_extension,
				hasChildren: false,
				isFolder: false,
				path: file.relative_file_path,
				size: file.file_size,
				data: {
					file_id: file.file_id,
					file_name: file.file_name,
					file_path: relativePath,
					file_extension: file.file_extension,
				} as ProjectFileMentionData,
			}
		})
	}

	/**
	 * Fuzzy match function that checks if all characters in query appear in target string in order
	 * @param target - The target string to search in
	 * @param query - The query string to match
	 * @returns true if fuzzy match succeeds
	 */
	private fuzzyMatch(target: string, query: string): boolean {
		const targetLower = target.toLowerCase()
		const queryLower = query.toLowerCase()

		let queryIndex = 0

		for (let i = 0; i < targetLower.length && queryIndex < queryLower.length; i++) {
			if (targetLower[i] === queryLower[queryIndex]) {
				queryIndex++
			}
		}

		return queryIndex === queryLower.length
	}

	/**
	 * Check if target matches query using both exact substring match and fuzzy match
	 * @param target - The target string to search in
	 * @param query - The query string to match
	 * @returns true if either exact or fuzzy match succeeds
	 */
	private matchesQuery(target: string, query: string): boolean {
		const targetLower = target.toLowerCase()
		const queryLower = query.toLowerCase()

		// First try exact substring match (for better performance on exact matches)
		if (targetLower.includes(queryLower)) {
			return true
		}

		// Then try fuzzy match
		return this.fuzzyMatch(target, query)
	}

	async searchItems(query: string): Promise<MentionItem[]> {
		if (!query || query.trim() === "") {
			return []
		}

		const normalizedQuery = query.toLowerCase().trim()
		const results: MentionItem[] = []

		// Search in workspace files (exclude folders)
		if (this.projectFilesStore.currentSelectedProject) {
			// 如果当前选中话题，则显示项目文件
			const workspaceFileItems = this.workspaceFilesToMentionItems(
				this.projectFilesStore.workspaceFilesList as unknown as (
					| WorkspaceFile
					| WorkspaceFolder
				)[],
			)
			const matchedFiles = workspaceFileItems.filter((item) => {
				const name = item.name
				return this.matchesQuery(name, normalizedQuery)
			})
			results.push(...matchedFiles)
		} else {
			// 如果当前没有选中话题，则显示上传的文件
			const uploadFiles = this.uploadFiles.filter((item) => {
				return this.matchesQuery(item.name, normalizedQuery)
			})

			results.push(...uploadFiles)
		}

		// Search in MCP list
		const matchedMCPs = this.mcpList.filter((item) => {
			return this.matchesQuery(item.name, normalizedQuery)
		})
		results.push(...matchedMCPs)

		// Search in Agent list
		const matchedAgents = this.agentList.filter((item) => {
			return this.matchesQuery(item.name, normalizedQuery)
		})
		results.push(...matchedAgents)

		await this.fetchSkills()
		const matchedSkills = this.skillList.filter((item) => {
			return this.matchesQuery(item.name, normalizedQuery)
		})
		results.push(...matchedSkills)

		// Search in tool list
		const matchedTools = this.toolItems
			.map((item) => item.tools ?? [])
			.flat()
			.filter((item) => this.matchesQuery(item.name, normalizedQuery))
			.map((item) => ({
				id: item.code,
				type: MentionItemType.TOOL,
				name: item.name,
				hasChildren: false,
				isFolder: false,
				data: {
					id: item.code,
					name: item.name,
					description: item.description,
				} as ToolMentionData,
			})) as MentionItem[]

		results.push(...matchedTools)

		// Sort results by type priority first, then by relevance
		return results.sort((a, b) => {
			const aName = a.name.toLowerCase()
			const bName = b.name.toLowerCase()

			// Define type priority: Project Files > MCP > Agent > Skill > Tool
			const getTypePriority = (type: string): number => {
				switch (type) {
					case MentionItemType.PROJECT_FILE:
					case MentionItemType.UPLOAD_FILE:
					case MentionItemType.CLOUD_FILE:
					case MentionItemType.FOLDER:
						return 1 // Highest priority for project files
					case MentionItemType.MCP:
						return 2 // Second priority for plugins/extensions
					case MentionItemType.AGENT:
						return 3 // Third priority for agents
					case MentionItemType.SKILL:
						return 4 // Fourth priority for skills
					case MentionItemType.TOOL:
						return 5 // Lowest priority for tools
					default:
						return 6 // Other types at the end
				}
			}

			const aPriority = getTypePriority(a.type)
			const bPriority = getTypePriority(b.type)

			// Sort by type priority first
			if (aPriority !== bPriority) {
				return aPriority - bPriority
			}

			// Within the same type, sort by relevance
			// Get file extensions for priority sorting
			const aExtension =
				a.extension?.toLowerCase() ||
				(a.data as ProjectFileMentionData)?.file_extension?.toLowerCase() ||
				""
			const bExtension =
				b.extension?.toLowerCase() ||
				(b.data as ProjectFileMentionData)?.file_extension?.toLowerCase() ||
				""

			// HTML files come first within the same type
			const aIsHtml = aExtension === "html" || aExtension === "htm"
			const bIsHtml = bExtension === "html" || bExtension === "htm"
			if (aIsHtml && !bIsHtml) return -1
			if (!aIsHtml && bIsHtml) return 1

			// Exact name matches come first
			const aExact = aName === normalizedQuery
			const bExact = bName === normalizedQuery
			if (aExact && !bExact) return -1
			if (!aExact && bExact) return 1

			// Then matches that start with the query
			const aStarts = aName.startsWith(normalizedQuery)
			const bStarts = bName.startsWith(normalizedQuery)
			if (aStarts && !bStarts) return -1
			if (!aStarts && bStarts) return 1

			// Then substring matches (includes query as continuous string)
			const aIncludes = aName.includes(normalizedQuery)
			const bIncludes = bName.includes(normalizedQuery)
			if (aIncludes && !bIncludes) return -1
			if (!aIncludes && bIncludes) return 1

			// Finally, alphabetical order (fuzzy matches will be sorted alphabetically)
			return aName.localeCompare(bName)
		})
	}

	hasTool(toolId: string) {
		return this.toolItems.some((item) => item.tools?.some((tool) => tool.code === toolId))
	}

	hasAgent(agentId: string) {
		return this.agentList.some((item) => item.id === agentId)
	}

	hasMcp(mcpId: string) {
		return this.mcpList.some((item) => item.id === mcpId)
	}

	hasSkill(skillId: string) {
		return this.skillList.some((item) => item.id === skillId)
	}

	hasUploadFile(fileId: string) {
		return this.uploadFiles.some((item) => item.id === fileId)
	}

	// ============================================================================
	// 历史记录管理功能
	// ============================================================================

	/**
	 * 初始化历史记录缓存
	 */
	private initializeHistoryCache() {
		// 为默认命名空间创建缓存
		this.getHistoryCache("global")
	}

	/**
	 * 检查历史记录缓存中是否存在重复的key
	 * @param cache - 历史记录缓存
	 */
	checkHistoryCache(cache: LRUCache<MentionHistoryItem>) {
		const items = cache.getAll()
		const invalidKeys: string[] = []
		items.forEach((item) => {
			const key = this.getHistoryItemKey({
				type: item.value.type,
				data: item.value.data,
				id: item.value.id,
				name: item.value.name,
			})
			if (key !== item.key) {
				invalidKeys.push(item.key)
			}
		})
		// 删除无效的key
		invalidKeys.forEach((key) => {
			cache.delete(key)
		})
	}

	/**
	 * 获取或创建指定命名空间的历史记录缓存
	 */
	private getHistoryCache(namespace: string): LRUCache<MentionHistoryItem> {
		if (!this.historyCaches.has(namespace)) {
			const cache = createLRUCache<MentionHistoryItem>({
				maxSize: 10,
				namespace,
				enablePersistence: true,
				storagePrefix: platformKey(
					"mention-panel-history/" + userStore.user.userInfo?.user_id,
				),
			})
			this.historyCaches.set(namespace, cache)
		}
		return this.historyCaches.get(namespace)!
	}

	/**
	 * 获取当前命名空间
	 */
	private getCurrentNamespace(): string {
		return this.projectFilesStore.currentSelectedProject?.id || "global"
	}

	/**
	 * 将 MentionListItem 转换为 MentionItem
	 * @param mentionListItem - 来自编辑器的 mention 项
	 * @returns 转换后的 MentionItem
	 */
	convertMentionListItemToMentionItem(mentionListItem: MentionListItem): MentionItem | null {
		if (!mentionListItem?.attrs) {
			return null
		}

		const attrs = mentionListItem.attrs

		// 使用工具函数获取显示信息
		const id = getMentionUniqueId(attrs)
		const name = getMentionDisplayName(attrs)
		const icon = getMentionIcon(attrs)
		const description = getMentionDescription(attrs)

		return {
			id,
			name,
			icon,
			description,
			type: attrs.type,
			data: attrs.data,
			hasChildren: false,
			isFolder: false,
		}
	}

	/**
	 * 批量添加 MentionListItem 到历史记录
	 * @param mentionListItems - 来自编辑器的 mention 项数组
	 */
	addMentionListItemsToHistory(mentionListItems: MentionListItem[]) {
		if (!this.projectFilesStore.currentSelectedProject?.id) {
			return // 只有在有选中话题时才添加历史记录
		}

		mentionListItems.forEach((mentionListItem) => {
			const mentionItem = this.convertMentionListItemToMentionItem(mentionListItem)

			if (mentionItem) {
				this.addToHistory(mentionItem)
			}
		})
	}

	/**
	 * 获取历史记录项的唯一key
	 * @param item - 要添加的mention项
	 * @returns 历史记录项的唯一key
	 */
	getHistoryItemKey(item: { type: string; data: any; id: string; name: string }) {
		switch (item.type) {
			case MentionItemType.PROJECT_FILE:
				return `${item.type}_${(item.data as ProjectFileMentionData).file_path}`
			default:
				return `${item.type}_${item.id || item.name}`
		}
	}

	/**
	 * 添加历史记录
	 * @param item - 要添加的mention项
	 */
	addToHistory(item: MentionItem) {
		const namespace = this.getCurrentNamespace()
		const cache = this.getHistoryCache(namespace)

		// 创建历史记录项的唯一key
		const key = this.getHistoryItemKey({
			type: item.type,
			data: item.data,
			id: item.id,
			name: item.name,
		})

		// 检查是否已存在，如果存在则增加使用次数
		const existing = cache.get(key)
		const usage = existing ? existing.usage + 1 : 1

		const historyItem: MentionHistoryItem = {
			id: key,
			name: item.name,
			description: typeof item.description === "string" ? item.description : undefined,
			type: item.type,
			data: item.data,
			icon: typeof item.icon === "string" ? item.icon : undefined,
			usage,
		}

		cache.put(key, historyItem)
	}

	/**
	 * 将 TabItem 转换为 MentionHistoryItem
	 * @param tab - TabItem
	 * @returns MentionHistoryItem
	 */
	tabToMentionItem(tab: TabItem): MentionItem {
		const data = {
			type: MentionItemType.PROJECT_FILE,
			data: {
				file_id: tab.fileData.file_id,
				file_name: tab.fileData.file_name,
				file_path: tab.fileData.relative_file_path,
				file_extension: tab.fileData.file_extension,
				file_size: tab.fileData.file_size,
			} as ProjectFileMentionData,
		}

		const id = getMentionUniqueId(data)
		const name = getMentionDisplayName(data)

		// 根据 metadata.type 来确定 icon，优先使用 metadata.type
		// 例如：metadata.type === "design" -> icon = "design"
		//      metadata.type === "slide" -> icon = "ppt" (通过 getAttachmentType 转换)
		let icon: string
		if (tab.fileData.metadata?.type) {
			const attachmentType = getAttachmentType(tab.fileData.metadata)
			icon = attachmentType || tab.fileData.file_extension || "ts-attachment"
		} else {
			icon = getMentionIcon(data)
		}

		const description = getMentionDescription(data)

		return {
			id,
			name: name,
			description: description,
			type: MentionItemType.PROJECT_FILE,
			data: data.data,
			icon: icon,
			hasChildren: false,
			isFolder: false,
			tags: ["tab"],
		}
	}

	/**
	 * 获取所有历史记录
	 * @returns 历史记录数组
	 */
	getHistoryCount() {
		const namespace = this.getCurrentNamespace()
		const cache = this.getHistoryCache(namespace)
		return cache.getCount()
	}

	/**
	 * 获取历史记录列表
	 * @param count - 获取数量，不指定则获取全部
	 * @returns 历史记录数组
	 */
	getHistory(
		count?: number,
		filter?: (item: MentionHistoryItem) => boolean,
	): MentionHistoryItem[] {
		const namespace = this.getCurrentNamespace()
		const cache = this.getHistoryCache(namespace)

		this.checkHistoryCache(cache)

		// 获取项目文件列表
		const workspaceFileList = keyBy(
			this.projectFilesStore.workspaceFilesList.filter((file) => file.type === "file"),
			"relative_file_path",
		)

		// 获取历史记录
		const items = cache.getRecent(count, (item) => {
			if (item.value.type === MentionItemType.PROJECT_FILE) {
				// 如果项目文件不存在，则不显示
				return (
					!!workspaceFileList[item.value.data.file_path] ||
					// 兼容历史记录中文件路径没有 / 的情况
					!!workspaceFileList["/" + item.value.data.file_path]
				)
			}
			return filter ? filter(item.value) : true
		})

		return items
			.map((cacheItem) => cacheItem.value)
			.sort((a, b) => {
				// 按使用次数降序，然后按最近使用时间降序
				if (a.usage !== b.usage) {
					return b.usage - a.usage
				}
				return 0 // 相同使用次数保持LRU顺序
			})
	}

	/**
	 * 获取最近使用的历史记录
	 * @param count - 数量，默认为5
	 */
	getRecentHistory(count: number = 5): MentionHistoryItem[] {
		return this.getHistory(count)
	}

	/**
	 * 删除历史记录项
	 * @param itemId - 项目ID
	 */
	removeFromHistory(itemId: string) {
		const namespace = this.getCurrentNamespace()
		const cache = this.getHistoryCache(namespace)
		cache.delete(itemId)
	}

	/**
	 * 清空历史记录
	 */
	clearHistory() {
		const namespace = this.getCurrentNamespace()
		const cache = this.getHistoryCache(namespace)
		cache.clear()
	}

	/**
	 * 搜索历史记录
	 * @param query - 搜索查询
	 */
	searchHistory(query: string): MentionHistoryItem[] {
		if (!query.trim()) return this.getHistory()

		const allHistory = this.getHistory()
		const lowercaseQuery = query.toLowerCase()

		return allHistory.filter((item) => {
			return (
				item.name.toLowerCase().includes(lowercaseQuery) ||
				item.description?.toLowerCase().includes(lowercaseQuery) ||
				item.type.toLowerCase().includes(lowercaseQuery)
			)
		})
	}

	/**
	 * 将历史记录项转换为MentionItem
	 */
	historyToMentionItem(
		historyItem: MentionHistoryItem,
		customTag?: "tab" | "history",
	): MentionItem {
		const tags = ["recent"]
		if (customTag) {
			tags.push(customTag)
		}

		return {
			id: historyItem.data?.id || historyItem.id,
			name: historyItem.name,
			description: historyItem.description,
			type: historyItem.type as any,
			data: historyItem.data,
			icon: historyItem.icon || "",
			hasChildren: false,
			isFolder: false,
			tags, // 添加标签标识这是历史记录
		}
	}

	/**
	 * 获取当前tab作为MentionItem列表
	 * @param count - 数量
	 * @param t - 国际化文本
	 * @returns MentionItem列表
	 */
	getTabsAsMentionItems(count: number = 5, t: I18nTexts): MentionItem[] {
		// 过滤掉 playbackTab（演示模式tab）
		const fileTabs = this.currentTabs.filter((item) => !isPlaybackTab(item))

		const tabs = fileTabs.map((item) => {
			// 对于 slide 和 design 类型的文件，返回其父文件夹
			if (
				item.fileData.metadata?.type === "slide" ||
				item.fileData.metadata?.type === "design"
			) {
				let parentData = this.projectFilesStore.getFolderData(item.fileData.parent_id)

				// 如果通过 parent_id 找不到，尝试通过 relative_file_path 查找
				if (!parentData && item.fileData.relative_file_path) {
					const filePath = item.fileData.relative_file_path
					// 提取父目录路径：去掉文件名，保留目录部分
					const lastSlashIndex = filePath.lastIndexOf("/")
					if (lastSlashIndex >= 0) {
						const parentPath = filePath.substring(0, lastSlashIndex + 1)
						// 在 workspaceFilesList 中查找匹配的文件夹
						parentData = this.projectFilesStore.workspaceFilesList.find(
							(file) =>
								file.type === "directory" && file.relative_file_path === parentPath,
						) as WorkspaceFolder | undefined
					}
				}

				if (parentData) {
					const folderItem = this.workspaceFilesToMentionItems([parentData])[0]
					// 添加 tags 标记，表示这个文件夹来自 tabs，应该可以直接选择
					return {
						...folderItem,
						tags: ["tab"],
					}
				}
			}

			return this.tabToMentionItem(item)
		})

		if (tabs.length <= count) {
			return tabs
		}

		return tabs.slice(0, count).concat([
			{
				id: "tabs",
				type: MentionItemType.TABS,
				name: t.historyActions.viewAllOpenFiles,
				hasChildren: true,
				isFolder: true,
			},
		])
	}

	getAllHistory(): MentionItem[] {
		return this.getHistory().map((item) => this.historyToMentionItem(item, "history"))
	}

	getCurrentTabs(): MentionItem[] {
		// 过滤掉 playbackTab（演示模式tab）
		const fileTabs = this.currentTabs.filter((item) => !isPlaybackTab(item))

		return fileTabs.map((item) => {
			// 对于 slide 和 design 类型的文件，返回其父文件夹
			if (
				item.fileData.metadata?.type === "slide" ||
				item.fileData.metadata?.type === "design"
			) {
				let parentData = this.projectFilesStore.getFolderData(item.fileData.parent_id)

				// 如果通过 parent_id 找不到，尝试通过 relative_file_path 查找
				if (!parentData && item.fileData.relative_file_path) {
					const filePath = item.fileData.relative_file_path
					// 提取父目录路径：去掉文件名，保留目录部分
					const lastSlashIndex = filePath.lastIndexOf("/")
					if (lastSlashIndex >= 0) {
						const parentPath = filePath.substring(0, lastSlashIndex + 1)
						// 在 workspaceFilesList 中查找匹配的文件夹
						parentData = this.projectFilesStore.workspaceFilesList.find(
							(file) =>
								file.type === "directory" && file.relative_file_path === parentPath,
						) as WorkspaceFolder | undefined
					}
				}

				if (parentData) {
					const folderItem = this.workspaceFilesToMentionItems([parentData])[0]
					// 添加 tags 标记，表示这个文件夹来自 tabs，应该可以直接选择
					return {
						...folderItem,
						tags: ["tab"],
					}
				}
			}

			return this.tabToMentionItem(item)
		})
	}

	/**
	 * 获取历史记录作为MentionItem列表
	 * @param count - 数量
	 * @param t - 国际化文本
	 */
	getHistoryAsMentionItems(count: number = 5, t: I18nTexts): MentionItem[] {
		const allHistoryCount = this.getHistoryCount()

		// 过滤掉 playbackTab（演示模式tab）
		const fileTabs = this.currentTabs.filter((item) => !isPlaybackTab(item))

		const file_ids = fileTabs.map((item) => item.fileData.file_id)

		const history = this.getHistory(count, (item) => {
			if (item.type === MentionItemType.PROJECT_FILE) {
				// tab 已经显示了，则不取
				return !file_ids.includes(item.data.file_id)
			}
			return true
		})

		if (history.length <= count && allHistoryCount <= count) {
			return history.map((item) => this.historyToMentionItem(item, "history"))
		}

		return history
			.map((item) => this.historyToMentionItem(item, "history"))
			.concat([
				{
					id: "histories",
					type: MentionItemType.HISTORIES,
					name: t.historyActions.viewAllMentionedFiles,
					hasChildren: true,
					isFolder: true,
				},
			])
	}

	/**
	 * 获取历史记录统计信息
	 */
	getHistoryStats() {
		const namespace = this.getCurrentNamespace()
		const cache = this.getHistoryCache(namespace)
		return cache.getStats()
	}

	/**
	 * 清空所有命名空间的历史记录
	 */
	clearAllHistory() {
		this.historyCaches.forEach((cache) => cache.clear())
		this.historyCaches.clear()
		this.initializeHistoryCache()
	}

	private async loadAllSkills(params: { requestKey: string }) {
		const { requestKey } = params
		const agentCode = this.getSkillAgentCode(requestKey)
		const data = await CrewApi.getMentionSkills(agentCode ? { agent_code: agentCode } : {})
		return this.updateSkillList(data, requestKey)
	}

	private getSkillAgentCode(skillQueryKey: string) {
		if (skillQueryKey === DEFAULT_SKILL_QUERY_KEY) return undefined
		return skillQueryKey
	}

	private getSkillListByQueryKey(skillQueryKey: string) {
		return this.skillListCache.get(skillQueryKey) ?? []
	}

	private getCurrentSkillList() {
		return this.getSkillListByQueryKey(this.currentSkillQueryKey)
	}

	private updateSkillList(list: MentionSkillItem[], requestKey: string) {
		const nextSkillList = list.map(mapSkillToMention)
		this.skillListCache.set(requestKey, nextSkillList)
		if (requestKey !== this.currentSkillQueryKey) return this.getCurrentSkillList()

		this.skillList = nextSkillList
		return nextSkillList
	}
}

// Factory function to create MentionPanelStore instance
export function createMentionPanelStore(projectFilesStore: ProjectFilesStore): MentionPanelStore {
	return new MentionPanelStore(projectFilesStore)
}

// Re-import projectFilesStore for singleton instance
import projectFilesStore from "@/stores/projectFiles"
import type { Bot } from "@/types/bot"

const mentionPanelStore = createMentionPanelStore(projectFilesStore)

export default mentionPanelStore
