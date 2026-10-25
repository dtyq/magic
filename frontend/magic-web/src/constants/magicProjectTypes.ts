/** 项目身份只取自已取得的 display_config；普通扩展名和业务转换器仍由各模块维护。 */
export const MAGIC_PROJECT_TYPES = [
	{
		kind: "audio",
		displayTypes: ["audio"],
		iconName: "audio-project",
		attachmentType: "audio",
		extensionType: "audio",
		customIconPolicy: "none",
		previewKind: "audio",
		helpKind: "recording.project",
	},
	{
		kind: "slide",
		displayTypes: ["slide"],
		iconName: "ppt",
		attachmentType: "ppt",
		extensionType: "pptx",
		customIconPolicy: "none",
		previewKind: "slide",
		helpKind: "project.slide",
	},
	{
		kind: "dashboard",
		displayTypes: ["dashboard"],
		iconName: "dashboard",
		attachmentType: "dashboard",
		extensionType: "dashboard",
		customIconPolicy: "none",
		previewKind: null,
		helpKind: "project.dashboard",
	},
	{
		kind: "self-media",
		displayTypes: ["self-media"],
		iconName: "self-media",
		attachmentType: "self-media",
		extensionType: "self-media",
		customIconPolicy: "none",
		previewKind: "self-media",
		helpKind: null,
	},
	{
		kind: "design",
		displayTypes: ["design"],
		iconName: "design",
		attachmentType: "design",
		extensionType: "design",
		customIconPolicy: "none",
		previewKind: "design",
		helpKind: "project.design",
	},
	{
		kind: "ai-card",
		displayTypes: ["ai-card"],
		iconName: "ai-sparkle",
		attachmentType: "ai-card",
		extensionType: "ai-card",
		customIconPolicy: "none",
		previewKind: "ai-card",
		helpKind: "project.ai-card",
	},
	{
		kind: "slide-template",
		displayTypes: ["slide-template"],
		iconName: "other",
		attachmentType: "slide-template",
		extensionType: "slide-template",
		customIconPolicy: "none",
		previewKind: "slide-template",
		helpKind: "project.slide-template",
	},
	{
		kind: "custom",
		displayTypes: ["custom"],
		iconName: "custom",
		attachmentType: "custom",
		extensionType: "custom",
		customIconPolicy: "configured",
		previewKind: null,
		helpKind: "project.custom",
	},
	{
		kind: "micro-app",
		displayTypes: ["micro-app", "html-app"],
		iconName: "micro-app",
		attachmentType: "micro-app",
		extensionType: "micro-app",
		customIconPolicy: "configured",
		previewKind: null,
		helpKind: "project.micro-app",
	},
	{
		kind: "video",
		displayTypes: ["video"],
		iconName: "video",
		attachmentType: "video",
		extensionType: "video",
		customIconPolicy: "none",
		previewKind: null,
		helpKind: "project.video",
	},
] as const

export type MagicProjectTypeDefinition = (typeof MAGIC_PROJECT_TYPES)[number]
export type MagicProjectKind = MagicProjectTypeDefinition["kind"]
export type MagicProjectPreviewKind = NonNullable<MagicProjectTypeDefinition["previewKind"]>
export type MagicProjectHelpKind = NonNullable<MagicProjectTypeDefinition["helpKind"]>

const typesByDisplayType = new Map<string, MagicProjectTypeDefinition>(
	MAGIC_PROJECT_TYPES.flatMap((definition) =>
		definition.displayTypes.map((type) => [type, definition] as const),
	),
)

/** 未知值保持未知；别名只影响前端识别，不回写用户配置。 */
export function getMagicProjectType(type: unknown): MagicProjectTypeDefinition | undefined {
	return typeof type === "string" ? typesByDisplayType.get(type) : undefined
}
