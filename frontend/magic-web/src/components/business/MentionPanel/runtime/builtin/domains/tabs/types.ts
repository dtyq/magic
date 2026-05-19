import type {
	PlaybackTabItem,
	TabItem,
} from "@/pages/superMagic/components/Detail/components/FilesViewer/types"

export interface MentionTabsStoreDependencies {
	getFolderMentionItemsFromTab: (tab: TabItem) => unknown | null
}

export function isPlaybackTab(tab: TabItem): tab is PlaybackTabItem {
	return (
		(tab as PlaybackTabItem).isPlaybackTab === true ||
		(tab as PlaybackTabItem).type === "playback"
	)
}
