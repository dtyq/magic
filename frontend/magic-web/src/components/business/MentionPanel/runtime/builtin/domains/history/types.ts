import type { TabItem } from "@/pages/superMagic/components/Detail/components/FilesViewer/types"
import type { ProjectFilesStore } from "@/stores/projectFiles"
import type { I18nTexts } from "../../../../i18n"
import type { MentionData, MentionItem } from "../../../../types"

export interface MentionHistoryItem {
	id: string
	name: string
	description?: string
	type: MentionItem["type"]
	data?: MentionData
	icon?: string
	usage: number
}

export interface MentionHistoryStoreDependencies {
	projectFilesStore: ProjectFilesStore
	getCurrentTabs: () => TabItem[]
}

export interface MentionHistoryQueryOptions {
	count?: number
	filter?: (item: MentionHistoryItem) => boolean
}

export interface MentionHistoryAsItemsOptions {
	count?: number
	t: I18nTexts
}
