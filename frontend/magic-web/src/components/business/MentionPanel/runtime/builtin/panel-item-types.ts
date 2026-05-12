import { MentionItemType } from "../../types"

export const MentionPanelItemType = {
	...MentionItemType,
	TABS: "tabs",
	HISTORIES: "histories",
} as const

export type MentionPanelItemType = (typeof MentionPanelItemType)[keyof typeof MentionPanelItemType]
