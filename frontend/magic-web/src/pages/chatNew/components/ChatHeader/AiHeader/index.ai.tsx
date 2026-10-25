import MagicButton from "@/components/base/MagicButton"
import type { HTMLAttributes } from "react"
import { getUserName } from "@/utils/modules/chat"
import conversationStore from "@/stores/chatNew/conversation"
import MagicIcon from "@/components/base/MagicIcon"
import { useTranslation } from "react-i18next"
import { useMemoizedFn } from "ahooks"
import useUserInfo from "@/hooks/chat/useUserInfo"
import { observer } from "mobx-react-lite"
import useCurrentTopic from "@/pages/chatNew/hooks/useCurrentTopic"
import { IconDots } from "@tabler/icons-react"
import { IconMessageTopic } from "@/enhance/tabler/icons-react"
import conversationService from "@/services/chat/conversation/ConversationService"
import type Conversation from "@/models/chat/conversation"
import MagicAvatar from "@/components/base/MagicAvatar"
import { cn } from "@/utils/cn"
import {
	chatHeaderClassName,
	chatHeaderExtraSectionButtonActiveClassName,
	chatHeaderTitleClassName,
	chatHeaderTopicClassName,
} from "../classNames"

interface HeaderProps extends HTMLAttributes<HTMLDivElement> {
	conversation: Conversation
}

const CurrentTopic = observer(() => {
	const { t } = useTranslation("interface")

	const currentTopic = useCurrentTopic()

	return (
		<span className={chatHeaderTopicClassName}>
			# {currentTopic?.name || t("chat.topic.newTopic")} #
		</span>
	)
})

const AiHeader = observer(({ conversation, className }: HeaderProps) => {
	const { t } = useTranslation("interface")

	// const imStyle = useAppearanceStore((state) => state.imStyle)
	const { userInfo: conversationUser } = useUserInfo(conversation?.receive_id)

	const { settingOpen, topicOpen } = conversationStore
	const topicIconClick = useMemoizedFn(() => {
		conversationService.updateTopicOpen(conversation, !topicOpen)
	})

	const onSettingClick = useMemoizedFn(() => {
		conversationStore.toggleSettingOpen()
	})

	return (
		<div className={cn(chatHeaderClassName, className)}>
			<div className="flex min-w-0 flex-1 items-center gap-2">
				<MagicAvatar src={conversationUser?.avatar_url} size={40}>
					{getUserName(conversationUser)}
				</MagicAvatar>
				<div className="flex min-w-0 flex-1 flex-col">
					<span className={chatHeaderTitleClassName}>
						{getUserName(conversationUser)}
					</span>
					<CurrentTopic />
				</div>
			</div>
			<div className="flex gap-0.5">
				<MagicButton
					className={cn(topicOpen && chatHeaderExtraSectionButtonActiveClassName)}
					tip={t("chat.topic.topic")}
					type="text"
					icon={<MagicIcon size={20} color="currentColor" component={IconMessageTopic} />}
					onClick={topicIconClick}
				/>
				<MagicButton
					className={cn(settingOpen && chatHeaderExtraSectionButtonActiveClassName)}
					tip={t("chat.setting")}
					type="text"
					icon={<MagicIcon size={20} color="currentColor" component={IconDots} />}
					onClick={onSettingClick}
				/>
			</div>
		</div>
	)
})

export default AiHeader
