import { createElement } from "react"
import { MentionItemType } from "../../types"
import type { MentionItem } from "../../types"
import type { I18nTexts } from "../../i18n/types"
import { MentionPanelBuiltinItemId as BuiltinItemId } from "./catalog-ids"
import PlugIcon from "../../components/icons/PlugIcon"
import BotIcon from "../../components/icons/BotIcon"
import SkillIcon from "../../components/icons/SkillIcon"
import ToolIcon from "../../components/icons/ToolIcon"

export const NON_SELECTABLE_BUILTIN_ITEM_IDS = [
	BuiltinItemId.PERSONAL_DRIVE,
	BuiltinItemId.ENTERPRISE_DRIVE,
	BuiltinItemId.ORGANIZATION_DRIVE,
	BuiltinItemId.PROJECT_FILES,
	BuiltinItemId.MCP_EXTENSIONS,
	BuiltinItemId.AGENTS,
] as const

export function isSelectableBuiltinItemId(itemId: string) {
	return !NON_SELECTABLE_BUILTIN_ITEM_IDS.includes(
		itemId as (typeof NON_SELECTABLE_BUILTIN_ITEM_IDS)[number],
	)
}

export function createDefaultItems(t: I18nTexts): Record<string, MentionItem[]> {
	return {
		default: [
			{
				id: BuiltinItemId.PROJECT_FILES,
				type: MentionItemType.FOLDER,
				name: t.defaultItems.projectFiles,
				icon: "file-folder",
				hasChildren: true,
				isFolder: true,
			},
			{
				id: BuiltinItemId.UPLOAD_FILES,
				type: MentionItemType.FOLDER,
				name: t.defaultItems.uploadFiles,
				icon: "file-folder",
				hasChildren: true,
				isFolder: true,
			},
			{
				id: BuiltinItemId.AGENTS,
				type: MentionItemType.AGENT,
				name: t.defaultItems.agents,
				icon: createElement(BotIcon),
				hasChildren: true,
				isFolder: true,
			},
			{
				id: BuiltinItemId.MCP_EXTENSIONS,
				type: MentionItemType.MCP,
				name: t.defaultItems.mcpExtensions,
				icon: createElement(PlugIcon),
				hasChildren: true,
				isFolder: true,
			},
			{
				id: BuiltinItemId.SKILLS,
				type: MentionItemType.SKILL,
				name: t.defaultItems.skills,
				icon: createElement(SkillIcon),
				hasChildren: true,
				isFolder: true,
			},
			{
				id: BuiltinItemId.TOOLS,
				type: MentionItemType.TOOL,
				name: t.defaultItems.tools,
				icon: createElement(ToolIcon),
				hasChildren: true,
				isFolder: true,
			},
		],
	}
}

export const DEFAULT_ITEMS: Record<string, MentionItem[]> = {
	default: [
		{
			id: BuiltinItemId.PROJECT_FILES,
			type: MentionItemType.FOLDER,
			name: "当前项目文件",
			icon: "file-folder",
			hasChildren: true,
		},
	],
}
