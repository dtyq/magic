import { useEffect, useMemo } from "react"
import { createMentionPanelStore } from "@/components/business/MentionPanel/builtin-store"
import { useCrewEditStore } from "@/pages/superMagic/pages/CrewEdit/context"
import { TopicMode } from "@/pages/superMagic/pages/Workspace/types"
import { createPromptMentionDataService } from "./promptMentionDataService"

export function usePromptMentionDataService() {
	const { projectFilesStore, crewCode } = useCrewEditStore()

	const promptMentionStore = useMemo(
		() => createMentionPanelStore(projectFilesStore),
		[projectFilesStore],
	)

	const promptMentionDataService = useMemo(
		() => createPromptMentionDataService(promptMentionStore),
		[promptMentionStore],
	)

	useEffect(() => {
		if (crewCode) {
			promptMentionStore.setSkillQueryContext(TopicMode.CustomAgent, crewCode)
		} else {
			promptMentionStore.setSkillQueryContext(TopicMode.Default)
		}

		void promptMentionStore.preLoadList()
	}, [crewCode, promptMentionStore])

	return promptMentionDataService
}
