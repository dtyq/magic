import { MentionItemType } from "../../types"
import { MentionPanelItemType } from "./panel-item-types"
import type { MentionItemRenderer } from "../../renderers/types"
import { renderMentionItemIcon } from "../../renderers/shared/icon"
import {
	getMentionItemTypeDescription,
	renderMentionItemDescription,
	renderMentionItemTitleSuffix,
} from "../../renderers/shared/helpers"
import { agentsRenderer } from "./domains/agents"
import { historyRenderer } from "./domains/history"
import { mcpRenderer } from "./domains/mcp"
import { skillsRenderer } from "./domains/skills"
import { tabsRenderer } from "./domains/tabs"
import { toolsRenderer } from "./domains/tools"
import { uploadFilesRenderer } from "./domains/upload-files"
import { workspaceFilesRendererEntries } from "./domains/workspace-files"

const defaultRenderer: MentionItemRenderer = {
	renderIcon: renderMentionItemIcon,
	renderDescription: renderMentionItemDescription,
	renderTitleSuffix: renderMentionItemTitleSuffix,
	getTypeDescription: getMentionItemTypeDescription,
}

const domainRendererEntries: Array<[string, MentionItemRenderer]> = [
	[MentionItemType.MCP, mcpRenderer],
	[MentionItemType.AGENT, agentsRenderer],
	[MentionItemType.SKILL, skillsRenderer],
	[MentionItemType.TOOL, toolsRenderer],
	[MentionItemType.TITLE, {}],
	[MentionItemType.DIVIDER, {}],
	[MentionPanelItemType.TABS, tabsRenderer],
	[MentionPanelItemType.HISTORIES, historyRenderer],
	[MentionItemType.UPLOAD_FILE, uploadFilesRenderer],
	...workspaceFilesRendererEntries,
]

const domainRenderers = new Map<string, MentionItemRenderer>(domainRendererEntries)

const specialRenderers = new Map<string, MentionItemRenderer>([
	[MentionItemType.TITLE, { ...defaultRenderer, renderIcon: renderMentionItemIcon }],
	[MentionItemType.DIVIDER, {}],
])

export function getBuiltinMentionItemRenderer(type: string): MentionItemRenderer {
	const renderer = specialRenderers.get(type) ?? domainRenderers.get(type)
	if (!renderer) return defaultRenderer

	return {
		...defaultRenderer,
		...renderer,
	}
}
