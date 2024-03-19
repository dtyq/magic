import MagicAvatar from "@/opensource/components/base/MagicAvatar"
import { Flex } from "antd"
import MagicButton from "@/opensource/components/base/MagicButton"
import type { HTMLAttributes } from "react"
import type Conversation from "@/opensource/models/chat/conversation"
import { cx } from "antd-style"
import conversationStore from "@/opensource/stores/chatNew/conversation"
import MagicIcon from "@/opensource/components/base/MagicIcon"
import useGroupInfo from "@/opensource/hooks/chat/useGroupInfo"
import { observer } from "mobx-react-lite"
import { useTranslation } from "react-i18next"
import { IconDots } from "@tabler/icons-react"
import { useMemoizedFn } from "ahooks"
import { ExtraSectionKey } from "@/opensource/pages/chatNew/types"
import useStyles from "../styles"
import CurrentTopic from "../CurrentTopic"
import { userStore } from "@/opensource/models/user"

interface HeaderProps extends HTMLAttributes<HTMLDivElement> {
	conversation: Conversation
}

const GroupHeader = observer(({ conversation, className }: HeaderProps) => {
	const { styles } = useStyles()
	const { t } = useTranslation("interface")

	// const imStyle = useAppearanceStore((state) => state.imStyle)

	const { groupInfo } = useGroupInfo(conversation.receive_id)

	const organization = userStore.user.getOrganizationByMagic(groupInfo?.organization_code ?? "")

	const { settingOpen } = conversationStore

	const onSettingClick = useMemoizedFn(() => {
		conversationStore.toggleSettingOpen()
	})

	return (
		<Flex vertical>
			<Flex
				gap={8}
				align="center"
				justify="space-between"
				className={cx(styles.header, className)}
			>
				<Flex gap={8} align="center" flex={1}>
					<MagicAvatar src={groupInfo?.group_avatar}>{groupInfo?.group_name}</MagicAvatar>
					<Flex vertical flex={1}>
						<span className={styles.headerTitle}>{groupInfo?.group_name}</span>
						<span className={styles.headerTopic}>
							{organization?.organization_name}
						</span>
					</Flex>
				</Flex>
				<Flex gap={2}>
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
						className={cx({
							[styles.extraSectionButtonActive]: settingOpen,
						})}
						tip={t("chat.setting")}
						type="text"
						icon={<MagicIcon size={20} color="currentColor" component={IconDots} />}
						onClick={onSettingClick}
					/>
				</Flex>
			</Flex>
			<CurrentTopic />
		</Flex>
	)
})

export default GroupHeader
