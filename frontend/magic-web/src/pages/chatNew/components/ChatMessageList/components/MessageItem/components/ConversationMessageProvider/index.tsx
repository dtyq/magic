import type { PropsWithChildren } from "react"
import { useMemo } from "react"
import { isAppMessageId } from "@/utils/random"
import { get } from "lodash-es"
import { observer } from "mobx-react-lite"
import MessageStore from "@/stores/chatNew/message"
import { ConversationMessageContext } from "./context"
import { userStore } from "@/models/user"

interface ConversationMessageProviderProps extends PropsWithChildren {
	messageId: string
}

const ConversationMessageProvider = observer(
	({ messageId, children }: ConversationMessageProviderProps) => {
		const isUnReceived = useMemo(() => {
			return isAppMessageId(messageId)
		}, [messageId])

		const msgSeq = MessageStore.getMessage(messageId)

		const msg = msgSeq?.message

		const uid = userStore.user.userInfo?.user_id
		const userId = get(msg, ["sender_id"], uid)
		const isSelf = useMemo(() => (uid ? userId === uid : false), [userId, uid])

		const conversationMessage = useMemo(() => {
			return {
				messageId,
				isSelf,
				isUnReceived,
				message: msg,
			}
		}, [messageId, isSelf, isUnReceived, msg])

		return (
			<ConversationMessageContext.Provider value={conversationMessage}>
				{children}
			</ConversationMessageContext.Provider>
		)
	},
)

export default ConversationMessageProvider
