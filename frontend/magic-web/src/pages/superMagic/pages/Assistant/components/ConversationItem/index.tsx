import { UserAvailableAgentInfo } from "@/apis/modules/chat/types"
import FlexBox from "@/components/base/FlexBox"
import MagicAvatar from "@/components/base/MagicAvatar"
import { createStyles } from "antd-style"
import ConversationStore from "@/stores/chatNew/conversation"
import { observer } from "mobx-react-lite"
import { useMemoizedFn } from "ahooks"
import ConversationService from "@/services/chat/conversation/ConversationService"
import { BotApi } from "@/apis"
import { useChatWithMember } from "@/hooks/chat/useChatWithMember"
import { MessageReceiveType } from "@/types/chat"
import LastMessageRender from "@/pages/chatNew/components/ChatSubSider/components/LastMessageRender"
import { formatRelativeTime } from "@/utils/string"
import { useGlobalLanguage } from "@/models/config/hooks"
import { useMemo } from "react"
import { computed } from "mobx"
import SmartTooltip from "@/components/other/SmartTooltip"

const useStyles = createStyles(({ css, token }) => ({
	container: css`
		display: flex;
		align-items: center;
		gap: 8px;
		height: 60px;
		padding: 10px;
		border-radius: 8px;
		cursor: pointer;
		border: 1px solid ${token.magicColorUsages.border};

		&:hover {
			background-color: ${token.colorFillTertiary};
		}

		margin-bottom: 2px;
	`,
	active: css`
		background-color: ${token.magicColorUsages.primaryLight.default};
	`,
	assistantName: css`
		color: ${token.magicColorUsages.text[1]};
		text-overflow: ellipsis;
		font-size: 14px;
		font-weight: 400;
		line-height: 20px;
		overflow: hidden;
		white-space: nowrap;
		text-overflow: ellipsis;
	`,
	content: css`
		width: 100%;
		overflow: hidden;
		color: ${token.colorTextQuaternary};
		font-size: 12px;
		font-weight: 400;
		line-height: 16px;
		max-height: 18px;
		overflow: hidden;
		user-select: none;
		text-overflow: ellipsis;
		white-space: nowrap;

		&:empty {
			display: none;
		}
	`,
	contentWrapper: css`
		width: 100%;
		max-width: 100%;
		overflow: hidden;
	`,
	assistantNameTime: css`
		overflow: hidden;
		color: ${token.magicColorUsages.text[3]};
		text-align: right;
		text-overflow: ellipsis;
		font-size: 12px;
		font-weight: 400;
		line-height: 16px;
		white-space: nowrap;
		flex-shrink: 0;
	`,
}))

const ConversationItem = ({
	data,
	onUpdateConversationId,
	onSelectAgent,
}: {
	data: UserAvailableAgentInfo
	onUpdateConversationId: (agentId: string, conversationId: string) => void
	onSelectAgent: (agent: UserAvailableAgentInfo) => void
}) => {
	const { styles, cx } = useStyles()
	const language = useGlobalLanguage(false)

	const conversation = useMemo(
		() =>
			computed(() => {
				return data.conversation_id
					? ConversationStore.getConversation(data.conversation_id)
					: undefined
			}).get(),
		[data.conversation_id],
	)

	const isActive =
		conversation?.id && conversation?.id === ConversationStore.currentConversation?.id

	const chatWith = useChatWithMember()
	const onClick = useMemoizedFn(async () => {
		if (conversation) {
			ConversationService.switchConversation(conversation)
			onSelectAgent(data)
		} else if (data.id) {
			try {
				const res = await BotApi.registerAndAddFriend(data.id)
				if (res.user_id) {
					const conversation = await chatWith(res.user_id, MessageReceiveType.Ai, false)
					if (conversation) {
						onUpdateConversationId(data.id, conversation.id)
						onSelectAgent(data)
					}
				}
			} catch (error) {
				console.error(error)
			}
		}
	})

	return (
		<FlexBox
			align="center"
			gap={8}
			className={cx(styles.container, isActive && styles.active)}
			onClick={onClick}
		>
			<MagicAvatar size={36} src={data.agent_avatar} />
			<FlexBox vertical gap={2} className={styles.contentWrapper}>
				<FlexBox align="center" justify="space-between" gap={4}>
					<SmartTooltip className={styles.assistantName}>{data.agent_name}</SmartTooltip>
					<span className={styles.assistantNameTime}>
						{formatRelativeTime(language)(conversation?.last_receive_message_time)}
					</span>
				</FlexBox>
				<LastMessageRender
					message={conversation?.last_receive_message}
					className={styles.content}
				/>
			</FlexBox>
		</FlexBox>
	)
}

export default observer(ConversationItem)
