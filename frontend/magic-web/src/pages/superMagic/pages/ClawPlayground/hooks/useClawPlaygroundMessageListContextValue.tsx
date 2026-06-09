import { useMemo } from "react"
import type { JSONContent } from "@tiptap/core"
import type { MagicClawItem } from "@/apis"
import type { MessageListContextState } from "@/pages/superMagic/components/MessageList/context"
import type { Topic } from "@/pages/superMagic/pages/Workspace/types"
import type { ProjectFilesStore } from "@/stores/projectFiles"
import { getAvatarUrl } from "@/utils/avatar"
import { cn } from "@/lib/utils"
import { getMagiClawTemplateAvatarConfig } from "../../MagiClawPage/MagiClawTemplateAvatar"

interface UseClawPlaygroundMessageListContextValueParams {
	setSelectedTopic: (topic: Topic) => void
	magicClaw?: MagicClawItem | null
	projectFilesStore?: ProjectFilesStore
}

/** Shared MessageListProvider value for Claw playground (desktop + mobile). */
export function useClawPlaygroundMessageListContextValue(
	params: UseClawPlaygroundMessageListContextValueParams,
): MessageListContextState {
	const { setSelectedTopic, magicClaw, projectFilesStore } = params

	const assistantAvatarUrl = useMemo(() => {
		if (!magicClaw) return undefined
		if (magicClaw.icon_file_url) return magicClaw.icon_file_url

		return getMagiClawTemplateAvatarConfig(magicClaw.template_code).src
	}, [magicClaw])

	return useMemo(
		() => ({
			allowRevoke: true,
			allowUserMessageCopy: true,
			allowScheduleTaskCreate: false,
			allowMessageTooltip: true,
			allowConversationCopy: false,
			allowCreateNewTopic: false,
			onTopicSwitch: setSelectedTopic,
			projectFilesStore,
			renderAssistantAvatar: assistantAvatarUrl
				? ({ className } = {}) => (
						<img
							src={getAvatarUrl(assistantAvatarUrl, 24)}
							alt=""
							className={cn(
								"flex size-6 items-center justify-center rounded-full",
								className,
							)}
						/>
					)
				: undefined,
			showTaskCompletedBadge: false,
		}),
		[assistantAvatarUrl, setSelectedTopic, projectFilesStore],
	)
}
