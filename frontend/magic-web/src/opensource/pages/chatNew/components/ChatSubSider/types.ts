export const enum MessageGroupKey {
	Pinned = "Pinned",
	Single = "Single",
	Group = "Group",
}

export type BatchKey = MessageGroupKey | "Ai"

export interface ConversationGroupLists {
	topGroupList: string[]
	singleGroupList: string[]
	groupGroupList: string[]
	aiGroupList: string[]
}

export interface RenderedLists {
	[MessageGroupKey.Pinned]: string[]
	[MessageGroupKey.Single]: string[]
	[MessageGroupKey.Group]: string[]
	Ai: string[]
}
