import MagicAvatar from "@/components/base/MagicAvatar"
import MagicButton from "@/components/base/MagicButton"
import type { HTMLAttributes } from "react"
import type Conversation from "@/models/chat/conversation"
import conversationStore from "@/stores/chatNew/conversation"
import MagicIcon from "@/components/base/MagicIcon"
import useGroupInfo from "@/hooks/chat/useGroupInfo"
import { observer } from "mobx-react-lite"
import { useTranslation } from "react-i18next"
import { IconDots } from "@tabler/icons-react"
import { useMemoizedFn } from "ahooks"
import { ExtraSectionKey } from "@/pages/chatNew/types"
import CurrentTopic from "../CurrentTopic"
import { userStore } from "@/models/user"
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

const GroupHeader = observer(({ conversation, className }: HeaderProps) => {
	const { t } = useTranslation("interface")

	// const imStyle = useAppearanceStore((state) => state.imStyle)

	const { groupInfo } = useGroupInfo(conversation.receive_id)

	const organization = userStore.user.getOrganizationByMagic(groupInfo?.organization_code ?? "")

	const { settingOpen } = conversationStore

	const onSettingClick = useMemoizedFn(() => {
		conversationStore.toggleSettingOpen()
	})

	return (
		<div className="flex flex-col">
			<div className={cn(chatHeaderClassName, className)}>
				<div className="flex min-w-0 flex-1 items-center gap-2">
					<MagicAvatar src={groupInfo?.group_avatar}>{groupInfo?.group_name}</MagicAvatar>
					<div className="flex min-w-0 flex-1 flex-col">
						<span className={chatHeaderTitleClassName}>{groupInfo?.group_name}</span>
						<span className={chatHeaderTopicClassName}>
							{organization?.organization_name}
						</span>
					</div>
				</div>
				<div className="flex gap-0.5">
					{/* <MagicButton
						key={ExtraSectionKey.Topic}
						className={cx({
							[styles.extraSectionButtonActive]: topicOpen,
						})}
						tip={t("chat.topic.topic")}
						type="text"
						icon={
							<MagicIcon
								size={20}
								color="currentColor"
								component={IconMessageTopic}
							/>
						}
						onClick={onTopicClick}
					/> */}
					<MagicButton
						key={ExtraSectionKey.Setting}
						className={cn(settingOpen && chatHeaderExtraSectionButtonActiveClassName)}
						tip={t("chat.setting")}
						type="text"
						icon={<MagicIcon size={20} color="currentColor" component={IconDots} />}
						onClick={onSettingClick}
					/>
				</div>
			</div>
			<CurrentTopic />
		</div>
	)
})

export default GroupHeader
