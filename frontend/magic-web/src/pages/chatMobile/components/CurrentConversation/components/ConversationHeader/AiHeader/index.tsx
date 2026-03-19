import { observer } from "mobx-react-lite"
import FlexBox from "@/components/base/FlexBox"
import { getUserName } from "@/utils/modules/chat"
import UserInfoStore from "@/stores/userInfo"
import type { BaseHeaderProps } from "../types"
import TopicStore from "@/stores/chatNew/topic"
import ConversationStore from "@/stores/chatNew/conversation"
import { useTranslation } from "react-i18next"

const AiHeader = observer(
	({ receiveId, headerTitleClass, headerSubTitleClass, className }: BaseHeaderProps) => {
		const { t } = useTranslation("interface")

		const aiInfo = UserInfoStore.get(receiveId)
		const aiName = getUserName(aiInfo)
		const topicId = ConversationStore.currentConversation?.current_topic_id
		const topicName = topicId ? TopicStore.getTopicName(topicId) : ""

		return (
			<FlexBox vertical className={className}>
				<div className={headerTitleClass}>{aiName}</div>
				<div className={headerSubTitleClass}># {topicName || t("chat.topic.newTopic")}</div>
			</FlexBox>
		)
	},
)

export default AiHeader
