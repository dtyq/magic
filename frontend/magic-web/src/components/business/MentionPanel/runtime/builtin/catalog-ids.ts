export const MentionPanelBuiltinItemId = {
	PERSONAL_DRIVE: "personal-drive",
	ENTERPRISE_DRIVE: "enterprise-drive",
	ORGANIZATION_DRIVE: "organization-drive",
	PROJECT_FILES: "project-files",
	MCP_EXTENSIONS: "mcp-extensions",
	AGENTS: "agents",
	SKILLS: "skills",
	TOOLS: "tools",
	UPLOAD_FILES: "upload-files",
	HISTORIES: "histories",
	TABS: "tabs",
} as const

export type MentionPanelBuiltinItemId =
	(typeof MentionPanelBuiltinItemId)[keyof typeof MentionPanelBuiltinItemId]

export const MentionPanelCatalogId = {
	MCP_EXTENSIONS: MentionPanelBuiltinItemId.MCP_EXTENSIONS,
	AGENTS: MentionPanelBuiltinItemId.AGENTS,
	SKILLS: MentionPanelBuiltinItemId.SKILLS,
	TOOLS: MentionPanelBuiltinItemId.TOOLS,
	UPLOAD_FILES: MentionPanelBuiltinItemId.UPLOAD_FILES,
	HISTORIES: MentionPanelBuiltinItemId.HISTORIES,
	TABS: MentionPanelBuiltinItemId.TABS,
} as const

export type MentionPanelCatalogId =
	(typeof MentionPanelCatalogId)[keyof typeof MentionPanelCatalogId]

const mentionPanelCatalogIdSet = new Set(Object.values(MentionPanelCatalogId))

export function isMentionPanelCatalogId(value: string | undefined): value is MentionPanelCatalogId {
	if (!value) return false

	return mentionPanelCatalogIdSet.has(value as MentionPanelCatalogId)
}
