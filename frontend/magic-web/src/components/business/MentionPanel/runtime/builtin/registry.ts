import { MentionItemType } from "../../types"
import { agentsCatalogPlugin, agentsSearchPlugin, agentsValidationPlugin } from "./domains/agents"
import { historyCatalogPlugin } from "./domains/history"
import { mcpCatalogPlugin, mcpSearchPlugin, mcpValidationPlugin } from "./domains/mcp"
import { skillsCatalogPlugin, skillsSearchPlugin, skillsValidationPlugin } from "./domains/skills"
import { tabsCatalogPlugin } from "./domains/tabs"
import { toolsCatalogPlugin, toolsSearchPlugin, toolsValidationPlugin } from "./domains/tools"
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
	agentsCatalogPlugin,
	skillsCatalogPlugin,
	toolsCatalogPlugin,
	historyCatalogPlugin,
	tabsCatalogPlugin,
]

const searchPlugins = [
	workspaceFilesSearchPlugin,
	uploadFilesSearchPlugin,
	mcpSearchPlugin,
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
]

export const mentionPanelCatalogPluginMap = new Map(
	catalogPlugins.map((plugin) => [plugin.catalogId, plugin]),
)

export const mentionPanelSearchPlugins = searchPlugins

export const mentionPanelValidationPluginMap = new Map(
	validationPlugins.map((plugin) => [plugin.itemType, plugin]),
)
