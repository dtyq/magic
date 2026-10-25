import { useEffect } from "react"
import type { MentionPanelStore } from "@/components/business/MentionPanel/builtin-store"

interface UsePinnedCurrentMicroAppMentionParams {
	mentionPanelStore: MentionPanelStore
	enabled: boolean
	appId?: string
	appName?: string
}

/** Pin this micro-app at the first-level @ panel in runtime chats. */
export function usePinnedCurrentMicroAppMention({
	mentionPanelStore,
	enabled,
	appId,
	appName,
}: UsePinnedCurrentMicroAppMentionParams) {
	useEffect(() => {
		if (!enabled || !appId?.trim()) {
			mentionPanelStore.setPinnedCurrentMicroApp(null)
			return
		}

		mentionPanelStore.setPinnedCurrentMicroApp({ appId, appName })
		return () => mentionPanelStore.setPinnedCurrentMicroApp(null)
	}, [mentionPanelStore, enabled, appId, appName])
}
