import type { FileViewerTabType, TabItem } from "../types"
import {
	KNOWLEDGE_BASE_TAB_ID_PREFIX,
	PLAYBACK_TAB_ID,
	PUBLISHED_MICRO_APP_TAB_ID_PREFIX,
} from "./tabConstants"
import { isWebsiteTab } from "./websiteTabs"

type TabTypeSource = Pick<TabItem, "id"> & Partial<Pick<TabItem, "type">>

export function getFileViewerTabType(
	tab: TabTypeSource | null | undefined,
): FileViewerTabType | null {
	if (!tab) return null
	if (tab.type) return tab.type
	if (tab.id === PLAYBACK_TAB_ID) return "playback"
	if (tab.id.startsWith(KNOWLEDGE_BASE_TAB_ID_PREFIX)) return "knowledge_base"
	if (tab.id.startsWith(PUBLISHED_MICRO_APP_TAB_ID_PREFIX)) return "micro_app"
	if (isWebsiteTab(tab)) return "website"
	return "file"
}

export function hasActivePreviewTab(
	fileTabs: Array<{ active?: boolean }>,
	knowledgeBaseTabs: Array<{ active?: boolean }> = [],
	publishedMicroAppTabs: Array<{ active?: boolean }> = [],
) {
	return (
		fileTabs.some((tab) => tab.active) ||
		knowledgeBaseTabs.some((tab) => tab.active) ||
		publishedMicroAppTabs.some((tab) => tab.active)
	)
}
