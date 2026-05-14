import type { ProjectListItem } from "@/pages/superMagic/pages/Workspace/types"

export type SharedWorkspaceTab = "sharedWithMe" | "sharedByMe"

export interface SharedWorkspaceCreatorOption {
	id: string
	name: string
	avatarUrl?: string
}

export interface SharedWorkspaceProject extends ProjectListItem {
	creator?: ProjectListItem["creator"]
	member_count?: number
}
