import { makeAutoObservable } from "mobx"
import { createDefaultItems } from "./default-items"
import { MentionItemType, PanelState } from "../../types"
import { MentionPanelBuiltinItemId as BuiltinItemId } from "./catalog-ids"
import type {
	MentionData,
	MentionItem,
	McpMentionData,
	MentionSceneCatalog,
	ProjectFileDisplayResolver,
} from "../../types"
import type {
	CatalogRequest,
	EffectRequest,
	MentionStoreRequest,
	MentionStoreResult,
} from "../../dispatch"
import { mentionPanelCatalogPluginMap, mentionPanelValidationPluginMap } from "./registry"
import type { MentionPanelPluginHost } from "./registry-types"
import { GlobalApi } from "@/apis"
import type { I18nTexts } from "../../i18n"
import type { UseableToolSet } from "@/types/flow"
import type { MentionListItem } from "../../tiptap-plugin/types"
import type { TabItem } from "@/pages/superMagic/components/Detail/components/FilesViewer/types"
import type { WorkspaceFile, WorkspaceFolder } from "@/stores/projectFiles/types"
import type { ProjectFilesStore } from "@/stores/projectFiles"
import {
	isCanvasElementsMentionItemId,
	MentionPanelCanvasElementsStore,
	type ActiveCanvasElementsContext,
} from "./domains/canvas-elements"
import { MentionPanelAgentsStore } from "./domains/agents"
import { MentionPanelDigitalEmployeesStore } from "./domains/digital-employees"
import { MentionPanelHistoryStore } from "./domains/history"
import { MentionPanelMcpStore } from "./domains/mcp"
import { MentionPanelSkillsStore } from "./domains/skills"
import { MentionPanelTabsStore } from "./domains/tabs"
import { MentionPanelToolsStore } from "./domains/tools"
import { MentionPanelMicroAppsStore, createMicroAppMentionItem } from "./domains/micro-apps"
import { MentionPanelSceneCatalogStore } from "./domains/scene-catalog"
import { MentionPanelUploadFilesStore } from "./domains/upload-files"
import { MentionPanelWorkspaceFilesStore } from "./domains/workspace-files"
import projectFilesStore from "@/stores/projectFiles"
import type { Bot } from "@/types/bot"
import {
	convertMentionListItemToMentionItem,
	mergeSmartRecommendations,
} from "./store-helpers/history"
import { prependPinnedRootItems } from "./store-helpers/pinned-root-items"
import { matchesQuery, searchBuiltinMentionItems } from "./store-helpers/search"
import type { MentionFilePreviewSourceRow } from "./domains/file-preview/preview-utils"
import { resolveFolderWorkspaceEntryFromTab } from "../../utils/projectReferenceMention"
import type { MagicWidget } from "@magic-web/widget-sdk"

export type { WorkspaceFile, WorkspaceFolder }

/** Describes host-controlled visibility for fixed root rows in the Mention panel. */
export interface MentionPanelBuiltinVisibility {
	projectFiles?: boolean
	uploadFiles?: boolean
	otherProjectFiles?: boolean
	digitalEmployees?: boolean
	microApps?: boolean
	workflows?: boolean
	connectors?: boolean
	skills?: boolean
	canvasElements?: boolean
}

type CustomMentionSearchHandler = (
	query: string,
	scope: MagicWidget.CustomMentionSearchContext["scope"],
	signal: AbortSignal,
) => Promise<MagicWidget.CustomMentionSearchResult[]>

export const DEFAULT_CUSTOM_MENTION_ICON = "ts-doc-file"

/** Normalizes host icon tokens to local TSIcon names; falls back to the safe ts-doc-file token. */
export function normalizeCustomMentionIcon(icon: string | undefined): string {
	if (!icon || typeof icon !== "string") return DEFAULT_CUSTOM_MENTION_ICON
	const trimmed = icon.trim()
	if (/^(https?:|data:|blob:|\/\/)/i.test(trimmed)) return DEFAULT_CUSTOM_MENTION_ICON
	return trimmed.startsWith("ts-") || trimmed === "file-folder"
		? trimmed
		: DEFAULT_CUSTOM_MENTION_ICON
}

/** Resolves an optional HTTPS icon URL safely; rejects non-HTTPS, malformed, or oversized URLs. */
export function normalizeCustomMentionIconUrl(url: string | undefined): string | undefined {
	if (!url || typeof url !== "string") return undefined
	const trimmed = url.trim()
	if (trimmed.length > 2048) return undefined
	try {
		const parsed = new URL(trimmed)
		return parsed.protocol === "https:" ? trimmed : undefined
	} catch {
		return undefined
	}
}

const BUILTIN_VISIBILITY_IDS: Record<keyof MentionPanelBuiltinVisibility, string[]> = {
	projectFiles: [BuiltinItemId.PROJECT_FILES],
	uploadFiles: [BuiltinItemId.UPLOAD_FILES],
	otherProjectFiles: [BuiltinItemId.OTHER_PROJECT_FILES],
	digitalEmployees: [BuiltinItemId.DIGITAL_EMPLOYEES],
	microApps: [BuiltinItemId.MICRO_APPS],
	workflows: [BuiltinItemId.FLOWS],
	connectors: [BuiltinItemId.MCP_EXTENSIONS],
	skills: [BuiltinItemId.SKILLS],
	canvasElements: [BuiltinItemId.CANVAS_ELEMENTS],
}

export class MentionPanelStore {
	private readonly projectFilesStore: ProjectFilesStore
	private readonly mcpStore: MentionPanelMcpStore
	private readonly agentsStore: MentionPanelAgentsStore
	private readonly digitalEmployeesStore: MentionPanelDigitalEmployeesStore
	private readonly skillsStore: MentionPanelSkillsStore
	private readonly toolsStore: MentionPanelToolsStore
	private readonly microAppsStore: MentionPanelMicroAppsStore
	private readonly uploadFilesStore: MentionPanelUploadFilesStore
	private readonly workspaceFilesStore: MentionPanelWorkspaceFilesStore
	private readonly tabsStore: MentionPanelTabsStore
	private readonly historyStore: MentionPanelHistoryStore
	private readonly canvasElementsStore: MentionPanelCanvasElementsStore
	private readonly sceneCatalogStore: MentionPanelSceneCatalogStore
	pinnedRootItems: MentionItem[] = []
	private builtinVisibility: MentionPanelBuiltinVisibility = {}
	private customMentionGroups: MagicWidget.CustomMentionGroup[] = []
	private customMentionSearch?: CustomMentionSearchHandler
	private customMentionSearchController?: AbortController
	private customMentionSearchGeneration = 0

	constructor(projectFilesStore: ProjectFilesStore) {
		this.projectFilesStore = projectFilesStore
		this.mcpStore = new MentionPanelMcpStore()
		this.agentsStore = new MentionPanelAgentsStore()
		this.digitalEmployeesStore = new MentionPanelDigitalEmployeesStore()
		this.skillsStore = new MentionPanelSkillsStore()
		this.toolsStore = new MentionPanelToolsStore()
		this.microAppsStore = new MentionPanelMicroAppsStore()
		this.uploadFilesStore = new MentionPanelUploadFilesStore()
		this.workspaceFilesStore = new MentionPanelWorkspaceFilesStore({
			projectFilesStore,
		})
		this.tabsStore = new MentionPanelTabsStore({
			getFolderMentionItemsFromTab: (tab) => this.getFolderMentionItemFromTab(tab),
		})
		this.historyStore = new MentionPanelHistoryStore({
			projectFilesStore,
			getCurrentTabs: () => this.tabsStore.currentTabs,
		})
		this.canvasElementsStore = new MentionPanelCanvasElementsStore()
		this.sceneCatalogStore = new MentionPanelSceneCatalogStore()
		makeAutoObservable<MentionPanelStore, "projectFilesStore">(
			this,
			{ projectFilesStore: false },
			{ autoBind: true },
		)
	}

	get filePresentationOptions() {
		return {
			context: this.projectFilesStore.filePresentationContext,
			index: this.projectFilesStore.filePresentationIndex,
		}
	}

	get currentSelectedProject() {
		return this.projectFilesStore.currentSelectedProject
	}

	get workspaceFileTree() {
		return this.projectFilesStore.workspaceFileTree
	}

	get workspaceFilesList() {
		return this.projectFilesStore.workspaceFilesList
	}

	get currentTabPreviewRows(): MentionFilePreviewSourceRow[] {
		return this.tabsStore.currentTabPreviewRows
	}

	initLoadAttachmentsPromise: Record<string, Promise<void>> = {}

	initLoadAttachmentsPromiseResolve: Record<string, (() => void) | null> = {}

	initLoadAttachments(projectId: string) {
		if (!projectId) return

		this.initLoadAttachmentsPromise[projectId] = new Promise((resolve) => {
			this.initLoadAttachmentsPromiseResolve[projectId] = () => {
				resolve()
			}
		})
	}

	setCurrentTabs(tabs: TabItem[]) {
		this.tabsStore.setTabs(tabs)
	}

	setActiveCanvasElementsContext(context: ActiveCanvasElementsContext | null) {
		this.canvasElementsStore.setActiveContext(context)
	}

	clearActiveCanvasElementsContext(designProjectId?: string) {
		this.canvasElementsStore.clearActiveContext(designProjectId)
	}

	invalidateActiveCanvasElementsCache() {
		this.canvasElementsStore.invalidateCache()
	}

	finishLoadAttachmentsPromise(projectId: string) {
		this.initLoadAttachmentsPromiseResolve[projectId]?.()
	}

	getInitLoadAttachmentsPromise(projectId: string) {
		return this.initLoadAttachmentsPromise[projectId] ?? Promise.resolve()
	}

	clearInitLoadAttachmentsPromise(projectId: string) {
		if (projectId) {
			delete this.initLoadAttachmentsPromise[projectId]
			delete this.initLoadAttachmentsPromiseResolve[projectId]
		}
	}

	setPinnedCurrentMicroApp(app: { appId: string; appName?: string } | null) {
		const item = app ? createMicroAppMentionItem(app) : null
		this.pinnedRootItems = item ? [item] : []
	}

	/** Applies host-level business entry visibility to every Mention panel result. */
	setBuiltinVisibility(visibility: MentionPanelBuiltinVisibility = {}) {
		this.builtinVisibility = visibility
	}

	/** Replaces host-provided named groups without mutating an existing editor draft. */
	setCustomMentionGroups(groups: MagicWidget.CustomMentionGroup[] = []) {
		this.customMentionSearchController?.abort()
		this.customMentionSearchController = undefined
		this.customMentionSearchGeneration += 1
		this.customMentionGroups = groups.map((group) => ({
			...group,
			items: group.items.map((item) => ({
				...item,
				data: item.data ? { ...item.data } : undefined,
			})),
		}))
	}

	/** Installs the iframe bridge used only for non-empty custom Mention searches. */
	setCustomMentionSearch(handler?: CustomMentionSearchHandler) {
		this.customMentionSearchController?.abort()
		this.customMentionSearchController = undefined
		this.customMentionSearch = handler
		this.customMentionSearchGeneration += 1
	}

	/** Exposes the current immutable group snapshot to stale-detail guards. */
	get customMentionGroupsSnapshot() {
		return this.customMentionGroups
	}

	/** Filters disabled roots and pinned micro-app items without changing catalog data. */
	private filterVisibleItems(items: MentionItem[]): MentionItem[] {
		const hiddenIds = new Set(
			Object.entries(BUILTIN_VISIBILITY_IDS).flatMap(([key, ids]) =>
				this.builtinVisibility[key as keyof MentionPanelBuiltinVisibility] === false
					? ids
					: [],
			),
		)
		return items.filter((item) => {
			if (hiddenIds.has(item.id)) return false
			if (
				this.builtinVisibility.microApps === false &&
				item.type === MentionItemType.MICRO_APP
			) {
				return false
			}
			return true
		})
	}

	/**
	 * Pins a scene's own entry (e.g. "This study") above the root list of this store instance;
	 * null removes it. Selections stay ordinary mentions such as project_file.
	 */
	setPinnedSceneCatalog(catalog: MentionSceneCatalog | null) {
		this.sceneCatalogStore.setCatalog(catalog)
	}

	/**
	 * Lets a scene relabel project entries in "Current project files" (name, icon, hidden).
	 * Display only: paths and ids in the inserted mention stay real. null restores the default.
	 */
	setProjectFileDisplayResolver(resolver: ProjectFileDisplayResolver | null) {
		this.workspaceFilesStore.setDisplayResolver(resolver)
	}

	setSkillQueryContext(topicMode?: string, agentCode?: string) {
		// On the home page custom employees are represented directly by their
		// identifier in `topicMode`; inside a topic the code is carried separately.
		this.digitalEmployeesStore.setCurrentAgentCode(agentCode ?? topicMode)
		this.skillsStore.setQueryContext({
			topicMode,
			agentCode,
		})
	}

	preLoadList() {
		return Promise.all([
			this.digitalEmployeesStore.fetchItems({ force: true }).catch(() => []),
			this.skillsStore.fetchItems().catch(() => {
				if (this.skillsStore.items.length === 0) this.skillsStore.items = []
			}),
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

	initData(
		agents: Bot.UserAvailableAgentInfo[],
		_mcpList: McpMentionData[],
		toolItems: UseableToolSet.Item[],
	) {
		this.agentsStore.setItems(agents)
		// MCP mentions intentionally come from the user's added-connector
		// storage (__added__), not from the global available MCP preload.
		this.toolsStore.setItems(toolItems)
	}

	setUploadFiles(files: MentionItem[]) {
		this.uploadFilesStore.setItems(files)
	}

	/** Builds the same Mention item for folder browsing and search results. */
	private getCustomMentionItems(
		group: MagicWidget.CustomMentionGroup,
		query?: string,
		items = group.items,
	): MentionItem[] {
		return items
			.filter(
				(item) =>
					!query ||
					this.matchesQuery(item.title?.trim() || item.text, query) ||
					this.matchesQuery(item.text, query) ||
					Boolean(item.description && this.matchesQuery(item.description, query)),
			)
			.map((item) => {
				// Keep the short UI label separate from the self-contained text sent to the Agent.
				const displayLabel = item.title?.trim() || item.text
				const icon = normalizeCustomMentionIcon(item.icon)
				const iconUrl = normalizeCustomMentionIconUrl(item.iconUrl)
				return {
					id: item.id,
					name: displayLabel,
					description: item.description,
					type: MentionItemType.TEXT,
					data: {
						...item.data,
						groupId: group.id,
						id: item.id,
						label: displayLabel,
						text: item.text,
						type: item.type,
					},
					icon,
					iconUrl,
					metadata: {
						customMention: true,
						customMentionGroupId: group.id,
						...(iconUrl ? { iconUrl } : {}),
					},
				}
			})
	}

	/** Queries the host and converts only results belonging to known static groups. */
	private async getDynamicCustomMentionItems(
		query: string,
		scope: MagicWidget.CustomMentionSearchContext["scope"],
	): Promise<MentionItem[]> {
		if (!this.customMentionSearch) return []
		this.customMentionSearchController?.abort()
		const controller = new AbortController()
		const generation = ++this.customMentionSearchGeneration
		this.customMentionSearchController = controller
		try {
			const results = await this.customMentionSearch(query, scope, controller.signal)
			if (controller.signal.aborted || generation !== this.customMentionSearchGeneration) {
				throw new DOMException("Custom Mention search was superseded", "AbortError")
			}
			const groupsById = new Map(this.customMentionGroups.map((group) => [group.id, group]))
			return results.flatMap((result) => {
				if (scope.type === "group" && result.groupId !== scope.groupId) return []
				const group = groupsById.get(result.groupId)
				if (!group || !Array.isArray(result.items)) return []
				return this.getCustomMentionItems(group, undefined, result.items)
			})
		} finally {
			if (this.customMentionSearchController === controller) {
				this.customMentionSearchController = undefined
			}
		}
	}

	/** Merges static and callback-owned items while letting the latest callback payload win by identity. */
	private mergeCustomMentionItems(
		staticItems: MentionItem[],
		dynamicItems: MentionItem[],
	): MentionItem[] {
		const merged = new Map<string, MentionItem>()
		for (const item of staticItems) {
			merged.set(`${item.data?.groupId ?? ""}:${item.id}`, item)
		}
		for (const item of dynamicItems) {
			merged.set(`${item.data?.groupId ?? ""}:${item.id}`, item)
		}
		return Array.from(merged.values())
	}

	/** Resolves a custom group before falling back to the built-in folder sources. */
	private getFolderMentionItems(folderId: string) {
		const customGroup = this.customMentionGroups.find((group) => group.id === folderId)
		if (customGroup) return this.getCustomMentionItems(customGroup)
		if (isCanvasElementsMentionItemId(folderId)) {
			return this.canvasElementsStore.getFolderMentionItems(folderId)
		}

		return this.workspaceFilesStore.getFolderMentionItems(folderId, {
			personalDrive: BuiltinItemId.PERSONAL_DRIVE,
			organizationDrive: BuiltinItemId.ORGANIZATION_DRIVE,
			projectFiles: BuiltinItemId.PROJECT_FILES,
		})
	}

	dispatch(request: MentionStoreRequest): Promise<MentionStoreResult> | MentionStoreResult {
		return this.handleDispatch(request)
	}

	private handleDispatch(
		request: MentionStoreRequest,
	): Promise<MentionStoreResult> | MentionStoreResult {
		switch (request.kind) {
			case "default":
				return {
					items: this.filterVisibleItems(this.buildDefaultItems(request.options.t)),
				}
			case "search":
				return this.searchMentionItems(request.query, request.scopeFolderId).then(
					(items) => ({
						items: this.filterVisibleItems(items),
					}),
				)
			case "children":
				return {
					items: this.getFolderMentionItems(request.id),
				}
			case "catalog":
				return this.resolveCatalogItems(request)
			case "effect":
				return this.runEffect(request)
			case "validate":
				return {
					isValid: this.validateMention(request.item),
				}
			default:
				return {}
		}
	}

	private resolveCatalogItems(
		request: CatalogRequest,
	): Promise<MentionStoreResult> | MentionStoreResult {
		const catalogEnabled = !Object.entries(BUILTIN_VISIBILITY_IDS).some(
			([key, ids]) =>
				this.builtinVisibility[key as keyof MentionPanelBuiltinVisibility] === false &&
				ids.includes(request.catalogId),
		)
		if (!catalogEnabled) return { items: [] }
		const catalogPlugin = mentionPanelCatalogPluginMap.get(request.catalogId)
		if (!catalogPlugin) {
			return {
				items: [],
			}
		}

		return Promise.resolve(
			catalogPlugin.resolveCatalog({ store: this.getPluginHost(), request }),
		).then((items) => ({
			items: this.filterVisibleItems(items),
		}))
	}

	private runEffect(request: EffectRequest): Promise<MentionStoreResult> | MentionStoreResult {
		switch (request.effect) {
			case "refresh-mcp":
				return Promise.resolve(this.mcpStore.fetchItems()).then(() => ({}))
			default:
				return {}
		}
	}

	private getPluginHost(): MentionPanelPluginHost {
		return {
			currentSelectedProject: this.currentSelectedProject,
			matchesQuery: this.matchesQuery,
			agentsStore: this.agentsStore,
			digitalEmployeesStore: this.digitalEmployeesStore,
			historyStore: this.historyStore,
			mcpStore: this.mcpStore,
			skillsStore: this.skillsStore,
			tabsStore: this.tabsStore,
			toolsStore: this.toolsStore,
			microAppsStore: this.microAppsStore,
			sceneCatalogStore: this.sceneCatalogStore,
			uploadFilesStore: this.uploadFilesStore,
			workspaceFilesStore: this.workspaceFilesStore,
		}
	}

	private buildDefaultItems(t: I18nTexts): MentionItem[] {
		let defaultItems = createDefaultItems(t)[PanelState.DEFAULT] as MentionItem[]
		if (this.customMentionGroups.length > 0) {
			const activeGroups = this.customMentionGroups.filter((group) => group.items.length > 0)

			// Helper to convert a CustomMentionGroup configuration into a MentionItem folder entry
			const toMentionItem = (group: MagicWidget.CustomMentionGroup): MentionItem => {
				const icon = normalizeCustomMentionIcon(group.icon)
				const iconUrl = normalizeCustomMentionIconUrl(group.iconUrl)
				return {
					id: group.id,
					type: MentionItemType.FOLDER,
					name: group.label,
					icon,
					iconUrl,
					hasChildren: true,
					isFolder: true,
					metadata: {
						customMentionGroup: true,
						customMentionGroupId: group.id,
						...(group.placement ? { placement: group.placement } : {}),
						...(iconUrl ? { iconUrl } : {}),
					},
				}
			}

			// Groups configured with placement="start" are rendered before built-in categories
			const startItems = activeGroups
				.filter((group) => group.placement === "start")
				.map(toMentionItem)

			// Default groups (or placement="end") are placed after built-in categories
			const endItems = activeGroups
				.filter((group) => group.placement !== "start")
				.map(toMentionItem)

			defaultItems = [...startItems, ...defaultItems, ...endItems]
		}
		if (this.projectFilesStore.currentSelectedProject) {
			defaultItems = defaultItems.filter((item) => item.id !== BuiltinItemId.UPLOAD_FILES)
			defaultItems = this.injectCanvasElementsRootItem(defaultItems, t)

			const historyItems = this.historyStore.getHistoryAsMentionItems({
				count: 5,
				t,
			})
			const tabsItems = this.tabsStore.getTabsAsMentionItems(5, t)
			const smartRecommendations = mergeSmartRecommendations(tabsItems, historyItems)

			if (smartRecommendations.length > 0) {
				defaultItems = [
					{
						id: "smart-recommendations",
						icon: null,
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

			return this.prependPinnedRootItems(defaultItems)
		}

		return this.prependPinnedRootItems(
			defaultItems.filter((item) => item.id !== BuiltinItemId.PROJECT_FILES),
		)
	}

	private prependPinnedRootItems(items: MentionItem[]): MentionItem[] {
		const sceneRootItem = this.sceneCatalogStore.getRootItem()
		return prependPinnedRootItems(
			items,
			sceneRootItem ? [sceneRootItem, ...this.pinnedRootItems] : this.pinnedRootItems,
		)
	}

	private injectCanvasElementsRootItem(items: MentionItem[], t: I18nTexts): MentionItem[] {
		const rootItem = this.canvasElementsStore.getRootMentionItem({
			lazy: true,
			label: t.defaultItems.canvasElements,
		})
		if (!rootItem || items.some((item) => item.id === rootItem.id)) return items

		const otherProjectFilesIndex = items.findIndex(
			(item) => item.id === BuiltinItemId.OTHER_PROJECT_FILES,
		)
		const projectFilesIndex = items.findIndex((item) => item.id === BuiltinItemId.PROJECT_FILES)
		const insertIndex =
			otherProjectFilesIndex >= 0
				? otherProjectFilesIndex + 1
				: projectFilesIndex >= 0
					? projectFilesIndex + 1
					: items.length
		const nextItems = [...items]
		nextItems.splice(insertIndex, 0, rootItem)
		return nextItems
	}

	matchesQuery(target: string, query: string): boolean {
		return matchesQuery(target, query)
	}

	/** Searches host items within their group, or alongside built-ins from the root. */
	private async searchMentionItems(
		query: string,
		scopeFolderId?: string,
	): Promise<MentionItem[]> {
		const customGroup = this.customMentionGroups.find((group) => group.id === scopeFolderId)
		if (customGroup) {
			if (!query.trim()) return []
			const staticItems = this.getCustomMentionItems(customGroup, query)
			if (this.customMentionSearch) {
				try {
					const dynamicItems = await this.getDynamicCustomMentionItems(query, {
						type: "group",
						groupId: customGroup.id,
					})
					return this.mergeCustomMentionItems(staticItems, dynamicItems)
				} catch (error) {
					if (error instanceof DOMException && error.name === "AbortError") throw error
					if (
						error instanceof Error &&
						error.message === "Custom Mention search is not configured"
					) {
						this.customMentionSearch = undefined
					} else {
						console.error("Magic widget custom Mention search failed", error)
					}
				}
			}
			return staticItems
		}
		if (isCanvasElementsMentionItemId(scopeFolderId)) {
			return this.canvasElementsStore.searchItems(query, scopeFolderId, this.matchesQuery)
		}

		const builtinItems = await searchBuiltinMentionItems({
			query,
			pluginHost: this.getPluginHost(),
		})
		if (scopeFolderId?.trim()) return builtinItems
		let customItems = query.trim()
			? this.customMentionGroups.flatMap((group) => this.getCustomMentionItems(group, query))
			: []
		if (query.trim() && this.customMentionSearch) {
			try {
				const dynamicItems = await this.getDynamicCustomMentionItems(query, {
					type: "global",
				})
				customItems = this.mergeCustomMentionItems(customItems, dynamicItems)
			} catch (error) {
				if (error instanceof DOMException && error.name === "AbortError") throw error
				if (
					error instanceof Error &&
					error.message === "Custom Mention search is not configured"
				) {
					this.customMentionSearch = undefined
				} else {
					console.error("Magic widget custom Mention search failed", error)
				}
			}
		}
		return [
			...this.canvasElementsStore.searchItems(query, undefined, this.matchesQuery),
			...builtinItems,
			...customItems,
		]
	}

	private validateMention(item: { type: string; data?: MentionData }): boolean {
		const { type, data } = item
		if (!data) return false
		const validationPlugin = mentionPanelValidationPluginMap.get(type)
		if (!validationPlugin) return false

		return validationPlugin.validate({
			store: this.getPluginHost(),
			data,
		})
	}

	addMentionListItemsToHistory(mentionListItems: MentionListItem[]) {
		if (!this.projectFilesStore.currentSelectedProject?.id) return

		mentionListItems.forEach((mentionListItem) => {
			const mentionItem = convertMentionListItemToMentionItem(mentionListItem)
			if (mentionItem) this.addToHistory(mentionItem)
		})
	}

	private addToHistory(item: MentionItem) {
		this.historyStore.addToHistory(item)
	}

	removeFromHistory(itemId: string) {
		this.historyStore.removeFromHistory(itemId)
	}

	getCurrentTabs(): MentionItem[] {
		return this.tabsStore.getCurrentTabs()
	}

	private getFolderMentionItemFromTab(tab: TabItem): MentionItem | null {
		const folderData = resolveFolderWorkspaceEntryFromTab(tab, {
			getFolderData: (parentId) => this.projectFilesStore.getFolderData(parentId),
			workspaceFilesList: this.projectFilesStore.workspaceFilesList,
		})

		if (!folderData) return null

		return this.workspaceFilesStore.workspaceFilesToMentionItems([folderData])[0] ?? null
	}
}

export function createMentionPanelStore(projectFilesStore: ProjectFilesStore): MentionPanelStore {
	return new MentionPanelStore(projectFilesStore)
}

const mentionPanelStore = createMentionPanelStore(projectFilesStore)

export default mentionPanelStore
