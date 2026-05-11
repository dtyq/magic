import { UserAvailableAgentInfo } from "@/apis/modules/chat/types"
import MagicAvatar from "@/components/base/MagicAvatar"
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
import { cn } from "@/lib/utils"

const conversationRowClassName = cn(
	"mb-0.5 flex h-[60px] cursor-pointer items-center gap-2 rounded-md p-2.5",
	"hover:bg-fill active:bg-fill-secondary",
	"focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
)

function ConversationItem({
	data,
	onUpdateConversationId,
	onSelectAgent,
}: {
	data: UserAvailableAgentInfo
	onUpdateConversationId: (agentId: string, conversationId: string) => void
	onSelectAgent: (agent: UserAvailableAgentInfo) => void
}) {
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
		<div
			className={cn(
				conversationRowClassName,
				isActive && "bg-fill-secondary hover:bg-fill-secondary",
			)}
			onClick={onClick}
		>
			<MagicAvatar size={36} src={data.agent_avatar} />
			<div className="flex w-full min-w-0 max-w-full flex-col gap-0.5 overflow-hidden">
				<div className="flex min-w-0 items-center justify-between gap-1">
					<SmartTooltip className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-sm font-normal leading-5 text-foreground/80">
						{data.agent_name}
					</SmartTooltip>
					<span className="shrink-0 overflow-hidden text-ellipsis whitespace-nowrap text-right text-xs font-normal leading-4 text-foreground/35">
						{formatRelativeTime(language)(conversation?.last_receive_message_time)}
					</span>
				</div>
				<LastMessageRender
					message={conversation?.last_receive_message}
					className="max-h-[18px] w-full select-none overflow-hidden text-ellipsis whitespace-nowrap text-xs font-normal leading-4 text-muted-foreground empty:hidden"
				/>
			</div>
		</div>
	)
}

export default observer(ConversationItem)
