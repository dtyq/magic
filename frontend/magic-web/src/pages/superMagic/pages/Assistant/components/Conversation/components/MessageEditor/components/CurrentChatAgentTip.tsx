import { createStyles } from "antd-style"
import { observer } from "mobx-react-lite"
import { useTranslation } from "react-i18next"
import ConversationStore from "@/stores/chatNew/conversation"
import FlexBox from "@/components/base/FlexBox"
import useUserInfo from "@/hooks/chat/useUserInfo"
import { getUserName } from "@/utils/modules/chat"
import MagicAvatar from "@/components/base/MagicAvatar"
import { useAssistantData } from "../../../../DataProvider"

const useStyles = createStyles(({ css, token }) => ({
	container: css`
		padding: 4px 8px;
		color: ${token.magicColorUsages.text[2]};
		font-size: 12px;
		font-style: normal;
		font-weight: 400;
		line-height: 16px;
		background-color: ${token.magicColorUsages.primaryLight.default};
		border-radius: 4px;
	`,
	userInfo: css`
		display: flex;
		align-items: center;
		gap: 4px;
		margin: 0 6px;
		color: ${token.magicColorUsages.text[1]};
		text-overflow: ellipsis;
		font-size: 12px;
		font-style: normal;
		font-weight: 600;
		line-height: 16px;
	`,
}))

const CurrentChatAgentTip = () => {
	const { styles } = useStyles()
	const { t } = useTranslation("super")
	const { selectedAgent } = useAssistantData()

	const { currentConversation } = ConversationStore

	const { userInfo } = useUserInfo(currentConversation?.receive_id ?? "")

	if (!currentConversation || !currentConversation.isAiConversation) return null

	return (
		<FlexBox align="center" justify="center" className={styles.container}>
			{t("currentChatAgentTip.chatting")}
			<div className={styles.userInfo}>
				<MagicAvatar src={selectedAgent?.agent_avatar || userInfo?.avatar_url} size={20} />
				{selectedAgent?.agent_name || getUserName(userInfo)}
			</div>
			{t("currentChatAgentTip.conversation")}
		</FlexBox>
	)
}

export default observer(CurrentChatAgentTip)
