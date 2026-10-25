import { MentionItemType } from "../../types"

export const MentionPanelItemType = {
	...MentionItemType,
	TABS: "tabs",
	HISTORIES: "histories",
	OTHER_PROJECT_FILES: "other_project_files",
	SCENE_CATALOG: "scene_catalog",
} as const

export type MentionPanelItemType = (typeof MentionPanelItemType)[keyof typeof MentionPanelItemType]
