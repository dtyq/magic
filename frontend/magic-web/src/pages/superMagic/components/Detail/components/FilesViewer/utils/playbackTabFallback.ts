import type { TabItem } from "../types"
import type { KnowledgeBaseTabItem } from "../hooks/useKnowledgeBaseTab"
import type { PublishedMicroAppTabItem } from "../hooks/usePublishedMicroAppTab"

type PreviewTab = {
	create_at?: number
	active_at?: number
}

export type PlaybackTabFallback =
	| { type: "file"; tab: TabItem }
	| { type: "knowledge_base"; tab: KnowledgeBaseTabItem }
	| { type: "micro_app"; tab: PublishedMicroAppTabItem }

function getMostRecentTab<T extends PreviewTab>(tabs: T[]): T | undefined {
	return tabs.reduce<T | undefined>((mostRecent, current) => {
		if (!mostRecent) return current
		const currentTimestamp = current.active_at || current.create_at || 0
		const mostRecentTimestamp = mostRecent.active_at || mostRecent.create_at || 0
		return currentTimestamp > mostRecentTimestamp ? current : mostRecent
	}, undefined)
}

/** Chooses the preview that should remain visible after closing the playback tab. */
export function resolvePlaybackTabFallback({
	fileTabs,
	knowledgeBaseTabs,
	publishedMicroAppTabs,
}: {
	fileTabs: TabItem[]
	knowledgeBaseTabs: KnowledgeBaseTabItem[]
	publishedMicroAppTabs: PublishedMicroAppTabItem[]
}): PlaybackTabFallback | undefined {
	const fileTab = getMostRecentTab(fileTabs)
	if (fileTab) return { type: "file", tab: fileTab }

	// Keep the existing preview priority: regular files, knowledge-base tabs, then micro-apps.
	const knowledgeBaseTab = getMostRecentTab(knowledgeBaseTabs)
	if (knowledgeBaseTab) return { type: "knowledge_base", tab: knowledgeBaseTab }

	const microAppTab = getMostRecentTab(publishedMicroAppTabs)
	if (microAppTab) return { type: "micro_app", tab: microAppTab }

	return undefined
}
