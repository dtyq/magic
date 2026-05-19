import type { MentionData, MentionItem, MentionStoreRequestBuildOptions } from "../../types"
import type { CatalogRequest, MentionStoreRequest } from "../../dispatch"
import type { MentionPanelAgentsStore } from "./domains/agents/store"
import type { MentionPanelHistoryStore } from "./domains/history/store"
import type { MentionPanelMcpStore } from "./domains/mcp/store"
import type { MentionPanelSkillsStore } from "./domains/skills/store"
import type { MentionPanelTabsStore } from "./domains/tabs/store"
import type { MentionPanelToolsStore } from "./domains/tools/store"
import type { MentionPanelUploadFilesStore } from "./domains/upload-files/store"
import type { MentionPanelWorkspaceFilesStore } from "./domains/workspace-files/store"

interface MentionPanelCatalogPluginHost {
	agentsStore: Pick<MentionPanelAgentsStore, "getItems">
	historyStore: Pick<MentionPanelHistoryStore, "getAllHistoryItems">
	mcpStore: Pick<MentionPanelMcpStore, "getItems">
	skillsStore: Pick<MentionPanelSkillsStore, "getItems" | "refreshItems">
	tabsStore: Pick<MentionPanelTabsStore, "getCurrentTabs">
	toolsStore: Pick<MentionPanelToolsStore, "getItems">
	uploadFilesStore: Pick<MentionPanelUploadFilesStore, "getItems">
}

interface MentionPanelSearchPluginHost {
	currentSelectedProject?: unknown
	matchesQuery: (target: string, query: string) => boolean
	agentsStore: Pick<MentionPanelAgentsStore, "searchItems">
	mcpStore: Pick<MentionPanelMcpStore, "searchItems">
	skillsStore: Pick<MentionPanelSkillsStore, "searchItems">
	toolsStore: Pick<MentionPanelToolsStore, "searchItems">
	uploadFilesStore: Pick<MentionPanelUploadFilesStore, "searchItems">
	workspaceFilesStore: Pick<MentionPanelWorkspaceFilesStore, "searchItems">
}

interface MentionPanelValidationPluginHost {
	agentsStore: Pick<MentionPanelAgentsStore, "hasItem">
	mcpStore: Pick<MentionPanelMcpStore, "hasItem">
	skillsStore: Pick<MentionPanelSkillsStore, "hasItem">
	toolsStore: Pick<MentionPanelToolsStore, "hasItem">
	uploadFilesStore: Pick<MentionPanelUploadFilesStore, "hasItem">
	workspaceFilesStore: Pick<MentionPanelWorkspaceFilesStore, "hasProjectFile" | "hasFolder">
}

export type MentionPanelPluginHost = MentionPanelCatalogPluginHost &
	MentionPanelSearchPluginHost &
	MentionPanelValidationPluginHost

export interface MentionPanelCatalogPlugin {
	catalogId: string
	resolveCatalog: (params: {
		store: MentionPanelPluginHost
		request: CatalogRequest
	}) => Promise<MentionItem[]> | MentionItem[]
	buildCatalogRequest?: (
		options: MentionStoreRequestBuildOptions<string>,
	) => MentionStoreRequest | null
}

export interface MentionPanelSearchPlugin {
	id: string
	search: (params: {
		store: MentionPanelPluginHost
		query: string
		normalizedQuery: string
	}) => Promise<MentionItem[]> | MentionItem[]
}

export interface MentionPanelValidationPlugin {
	itemType: string
	validate: (params: { store: MentionPanelPluginHost; data: MentionData }) => boolean
}
