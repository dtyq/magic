export const MentionPanelBuiltinItemId = {
	PERSONAL_DRIVE: "personal-drive",
	ENTERPRISE_DRIVE: "enterprise-drive",
	ORGANIZATION_DRIVE: "organization-drive",
	PROJECT_FILES: "project-files",
	OTHER_PROJECT_FILES: "other-project-files",
	MCP_EXTENSIONS: "mcp-extensions",
	DIGITAL_EMPLOYEES: "digital-employees",
	FLOWS: "flows",
	AGENTS: "agents",
	MICRO_APPS: "micro-apps",
	SKILLS: "skills",
	TOOLS: "tools",
	UPLOAD_FILES: "upload-files",
	CANVAS_ELEMENTS: "canvas-elements",
	HISTORIES: "histories",
	TABS: "tabs",
	/** Entry a page pins for its own context, e.g. "This study" on the research page. */
	SCENE_CATALOG: "scene-catalog",
} as const

export type MentionPanelBuiltinItemId =
	(typeof MentionPanelBuiltinItemId)[keyof typeof MentionPanelBuiltinItemId]

export const MentionPanelCatalogId = {
	MCP_EXTENSIONS: MentionPanelBuiltinItemId.MCP_EXTENSIONS,
	DIGITAL_EMPLOYEES: MentionPanelBuiltinItemId.DIGITAL_EMPLOYEES,
	FLOWS: MentionPanelBuiltinItemId.FLOWS,
	AGENTS: MentionPanelBuiltinItemId.AGENTS,
	MICRO_APPS: MentionPanelBuiltinItemId.MICRO_APPS,
	SKILLS: MentionPanelBuiltinItemId.SKILLS,
	TOOLS: MentionPanelBuiltinItemId.TOOLS,
	UPLOAD_FILES: MentionPanelBuiltinItemId.UPLOAD_FILES,
	HISTORIES: MentionPanelBuiltinItemId.HISTORIES,
	TABS: MentionPanelBuiltinItemId.TABS,
	SCENE_CATALOG: MentionPanelBuiltinItemId.SCENE_CATALOG,
} as const

export type MentionPanelCatalogId =
	(typeof MentionPanelCatalogId)[keyof typeof MentionPanelCatalogId]

const mentionPanelCatalogIdSet = new Set(Object.values(MentionPanelCatalogId))

export function isMentionPanelCatalogId(value: string | undefined): value is MentionPanelCatalogId {
	if (!value) return false

	return mentionPanelCatalogIdSet.has(value as MentionPanelCatalogId)
}
