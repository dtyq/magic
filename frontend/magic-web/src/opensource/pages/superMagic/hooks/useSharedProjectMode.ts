import { useEffect } from "react"
import pubsub, { PubSubEvents } from "@/opensource/utils/pubsub"
import { TopicMode } from "../pages/Workspace/types"
import superMagicModeService from "@/opensource/services/superMagic/SuperMagicModeService"

interface UseSharedProjectModeParams {
	setTopicMode: (mode: TopicMode) => void
}

function useSharedProjectMode({ setTopicMode }: UseSharedProjectModeParams) {
	useEffect(() => {
		const handleSharedProjectMode = (data?: { mode?: TopicMode }) => {
			if (!data?.mode || !superMagicModeService.isModeValid(data.mode)) {
				return
			}
			setTopicMode(data.mode)
		}

		pubsub.subscribe(
			PubSubEvents.Super_Magic_Receive_Shared_Project_Mode,
			handleSharedProjectMode,
		)
		return () => {
			pubsub.unsubscribe(
				PubSubEvents.Super_Magic_Receive_Shared_Project_Mode,
				handleSharedProjectMode,
			)
		}
	}, [setTopicMode])
}

export default useSharedProjectMode
