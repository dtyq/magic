import MagicButton from "@/components/base/MagicButton"
import type { HTMLAttributes } from "react"
import { useMemo } from "react"
import type Conversation from "@/models/chat/conversation"
import { getUserDepartmentFirstPath, getUserJobTitle, getUserName } from "@/utils/modules/chat"
import conversationStore from "@/stores/chatNew/conversation"
import MagicIcon from "@/components/base/MagicIcon"
import useUserInfo from "@/hooks/chat/useUserInfo"
import { useTranslation } from "react-i18next"
import { useMemoizedFn } from "ahooks"
import { IconDots } from "@tabler/icons-react"
import { ExtraSectionKey } from "@/pages/chatNew/types"
import CurrentTopic from "../CurrentTopic"
import MagicAvatar from "@/components/base/MagicAvatar"
import DepartmentRender from "@/components/business/DepartmentRender"
import { observer } from "mobx-react-lite"
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

function HeaderRaw({ conversation, className }: HeaderProps) {
	const { t } = useTranslation("interface")

	// const imStyle = useAppearanceStore((state) => state.imStyle)
	const { userInfo: conversationUser } = useUserInfo(conversation.receive_id)

	const { settingOpen } = conversationStore

	const departmentPath = useMemo(
		() => getUserDepartmentFirstPath(conversationUser),
		[conversationUser],
	)

	const onSettingClick = useMemoizedFn(() => {
		conversationStore.toggleSettingOpen()
	})

	return (
		<div className="flex flex-col">
			<div className={cn(chatHeaderClassName, className)}>
				<div className="flex min-w-0 flex-1 items-center gap-2">
					<MagicAvatar src={conversationUser?.avatar_url} size={40}>
						{getUserName(conversationUser)}
					</MagicAvatar>
					<div className="flex min-w-0 flex-1 flex-col">
						<span className={chatHeaderTitleClassName}>
							{getUserName(conversationUser)}
						</span>
						<span className={chatHeaderTopicClassName}>
							<DepartmentRender path={departmentPath} />
							{getUserJobTitle(conversationUser) &&
								` | ${getUserJobTitle(conversationUser)}`}
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
}

const UserHeader = observer(HeaderRaw)

export default UserHeader
