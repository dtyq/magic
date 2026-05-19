import { makeAutoObservable } from "mobx"
import { createDefaultItems } from "./default-items"
import { MentionItemType, PanelState } from "../../types"
import { MentionPanelBuiltinItemId as BuiltinItemId } from "./catalog-ids"
import type { MentionData, MentionItem, McpMentionData } from "../../types"
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
import { MentionPanelAgentsStore } from "./domains/agents"
import { MentionPanelHistoryStore } from "./domains/history"
import { MentionPanelMcpStore } from "./domains/mcp"
import { MentionPanelSkillsStore } from "./domains/skills"
import { MentionPanelTabsStore } from "./domains/tabs"
import { MentionPanelToolsStore } from "./domains/tools"
import { MentionPanelUploadFilesStore } from "./domains/upload-files"
import { MentionPanelWorkspaceFilesStore } from "./domains/workspace-files"
import projectFilesStore from "@/stores/projectFiles"
import type { Bot } from "@/types/bot"
import {
	convertMentionListItemToMentionItem,
	mergeSmartRecommendations,
} from "./store-helpers/history"
import { matchesQuery, searchBuiltinMentionItems } from "./store-helpers/search"
import type { MentionFilePreviewSourceRow } from "./domains/file-preview/preview-utils"

export type { WorkspaceFile, WorkspaceFolder }

export class MentionPanelStore {
	private readonly projectFilesStore: ProjectFilesStore
	private readonly mcpStore: MentionPanelMcpStore
	private readonly agentsStore: MentionPanelAgentsStore
	private readonly skillsStore: MentionPanelSkillsStore
	private readonly toolsStore: MentionPanelToolsStore
	private readonly uploadFilesStore: MentionPanelUploadFilesStore
	private readonly workspaceFilesStore: MentionPanelWorkspaceFilesStore
	private readonly tabsStore: MentionPanelTabsStore
	private readonly historyStore: MentionPanelHistoryStore

	constructor(projectFilesStore: ProjectFilesStore) {
		this.projectFilesStore = projectFilesStore
		this.mcpStore = new MentionPanelMcpStore()
		this.agentsStore = new MentionPanelAgentsStore()
		this.skillsStore = new MentionPanelSkillsStore()
		this.toolsStore = new MentionPanelToolsStore()
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
		makeAutoObservable(this, {}, { autoBind: true })
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

	setSkillQueryContext(topicMode?: string, agentCode?: string) {
		this.skillsStore.setQueryContext({
			topicMode,
			agentCode,
		})
	}

	preLoadList() {
		return Promise.all([
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
		mcpList: McpMentionData[],
		toolItems: UseableToolSet.Item[],
	) {
		this.agentsStore.setItems(agents)
		this.mcpStore.setItems(mcpList)
		this.toolsStore.setItems(toolItems)
	}

	setUploadFiles(files: MentionItem[]) {
		this.uploadFilesStore.setItems(files)
	}

	private getFolderMentionItems(folderId: string) {
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
					items: this.buildDefaultItems(request.options.t),
				}
			case "search":
				return this.searchMentionItems(request.query).then((items) => ({ items }))
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
		const catalogPlugin = mentionPanelCatalogPluginMap.get(request.catalogId)
		if (!catalogPlugin) {
			return {
				items: [],
			}
		}

		return Promise.resolve(
			catalogPlugin.resolveCatalog({ store: this.getPluginHost(), request }),
		).then((items) => ({
			items,
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
			historyStore: this.historyStore,
			mcpStore: this.mcpStore,
			skillsStore: this.skillsStore,
			tabsStore: this.tabsStore,
			toolsStore: this.toolsStore,
			uploadFilesStore: this.uploadFilesStore,
			workspaceFilesStore: this.workspaceFilesStore,
		}
	}

	private buildDefaultItems(t: I18nTexts): MentionItem[] {
		let defaultItems = createDefaultItems(t)[PanelState.DEFAULT] as MentionItem[]
		if (this.projectFilesStore.currentSelectedProject) {
			defaultItems = defaultItems.filter((item) => item.id !== BuiltinItemId.UPLOAD_FILES)

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

			return defaultItems
		}

		return defaultItems.filter((item) => item.id !== BuiltinItemId.PROJECT_FILES)
	}

	matchesQuery(target: string, query: string): boolean {
		return matchesQuery(target, query)
	}

	private async searchMentionItems(query: string): Promise<MentionItem[]> {
		return searchBuiltinMentionItems({
			query,
			pluginHost: this.getPluginHost(),
		})
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
		if (
			tab.fileData.display_config?.type !== "slide" &&
			tab.fileData.display_config?.type !== "design"
		) {
			return null
		}

		let parentData = this.projectFilesStore.getFolderData(tab.fileData.parent_id)
		if (!parentData && tab.fileData.relative_file_path) {
			const filePath = tab.fileData.relative_file_path
			const lastSlashIndex = filePath.lastIndexOf("/")
			if (lastSlashIndex >= 0) {
				const parentPath = filePath.substring(0, lastSlashIndex + 1)
				parentData = this.projectFilesStore.workspaceFilesList.find(
					(file) => file.type === "directory" && file.relative_file_path === parentPath,
				) as WorkspaceFolder | undefined
			}
		}

		if (!parentData) return null

		return this.workspaceFilesStore.workspaceFilesToMentionItems([parentData])[0] ?? null
	}
}

export function createMentionPanelStore(projectFilesStore: ProjectFilesStore): MentionPanelStore {
	return new MentionPanelStore(projectFilesStore)
}

const mentionPanelStore = createMentionPanelStore(projectFilesStore)

export default mentionPanelStore
