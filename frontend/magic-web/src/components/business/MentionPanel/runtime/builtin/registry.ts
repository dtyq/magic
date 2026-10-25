import { MentionItemType } from "../../types"
import { MentionPanelBuiltinItemId } from "./catalog-ids"
import { agentsCatalogPlugin, agentsSearchPlugin, agentsValidationPlugin } from "./domains/agents"
import {
	digitalEmployeesCatalogPlugin,
	digitalEmployeesSearchPlugin,
} from "./domains/digital-employees"
import { flowsCatalogPlugin } from "./domains/flows"
import { historyCatalogPlugin } from "./domains/history"
import { mcpCatalogPlugin, mcpSearchPlugin, mcpValidationPlugin } from "./domains/mcp"
import { skillsCatalogPlugin, skillsSearchPlugin, skillsValidationPlugin } from "./domains/skills"
import { sceneCatalogCatalogPlugin, sceneCatalogSearchPlugin } from "./domains/scene-catalog"
import { tabsCatalogPlugin } from "./domains/tabs"
import { isMicroAppEnabled } from "@/services/microAppFeature"
import { toolsCatalogPlugin, toolsSearchPlugin, toolsValidationPlugin } from "./domains/tools"
import type { MentionPanelSearchPlugin } from "./registry-types"
import {
	uploadFilesCatalogPlugin,
	uploadFilesSearchPlugin,
	uploadFilesValidationPlugin,
} from "./domains/upload-files"
import {
	workspaceFilesSearchPlugin,
	workspaceFilesValidationPlugins,
} from "./domains/workspace-files"

const catalogPlugins = [
	uploadFilesCatalogPlugin,
	mcpCatalogPlugin,
	digitalEmployeesCatalogPlugin,
	flowsCatalogPlugin,
	agentsCatalogPlugin,
	...(!isMicroAppEnabled()
		? []
		: [
				{
					catalogId: MentionPanelBuiltinItemId.MICRO_APPS,
					resolveCatalog: ({ store }) => store.microAppsStore.getItems(),
				},
			]),
	skillsCatalogPlugin,
	toolsCatalogPlugin,
	historyCatalogPlugin,
	tabsCatalogPlugin,
	sceneCatalogCatalogPlugin,
]

const searchPlugins = [
	// First, so its items win over builtin results for the same file (see searchBuiltinMentionItems).
	sceneCatalogSearchPlugin,
	workspaceFilesSearchPlugin,
	uploadFilesSearchPlugin,
	mcpSearchPlugin,
	digitalEmployeesSearchPlugin,
	agentsSearchPlugin,
	skillsSearchPlugin,
	toolsSearchPlugin,
]

const validationPlugins = [
	...workspaceFilesValidationPlugins,
	agentsValidationPlugin,
	mcpValidationPlugin,
	skillsValidationPlugin,
	toolsValidationPlugin,
	uploadFilesValidationPlugin,
	{
		itemType: MentionItemType.DESIGN_MARKER,
		validate: () => true,
	},
	{
		itemType: MentionItemType.PROJECT,
		validate: ({ data }) => Boolean(data && "project_id" in data && data.project_id),
	},
	{
		itemType: MentionItemType.MICRO_APP,
		validate: ({ data }) => Boolean(data && "app_id" in data && data.app_id),
	},
]

export const mentionPanelCatalogPluginMap = new Map(
	catalogPlugins.map((plugin) => [plugin.catalogId, plugin]),
)

export const mentionPanelSearchPlugins = searchPlugins

const microAppsSearchPlugin: MentionPanelSearchPlugin = {
	id: "micro-apps",
	search: ({ store, normalizedQuery }) =>
		store.microAppsStore.searchItems(normalizedQuery, store.matchesQuery),
}

if (isMicroAppEnabled()) mentionPanelSearchPlugins.push(microAppsSearchPlugin)

export const mentionPanelValidationPluginMap = new Map(
	validationPlugins.map((plugin) => [plugin.itemType, plugin]),
)
