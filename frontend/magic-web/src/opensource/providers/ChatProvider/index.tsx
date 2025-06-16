import { useEffect, useMemo, type PropsWithChildren } from "react"
import type { CMessage } from "@/types/chat"
import { EventType } from "@/types/chat"
import MagicSpin from "@/opensource/components/base/MagicSpin"
import { useTranslation } from "react-i18next"
import { useLocation } from "react-router"
import { bigNumCompare } from "@/utils/string"
import { interfaceStore } from "@/opensource/stores/interface"
import type {
	StreamResponseV2,
	IntermediateResponse,
	StreamResponse,
	WebSocketPayload,
} from "@/types/request"
import MessageSeqIdService from "@/opensource/services/chat/message/MessageSeqIdService"
import MessageService from "@/opensource/services/chat/message/MessageService"
import { SeqRecordType } from "@/opensource/apis/modules/chat/types"
import type { SeqRecord } from "@/opensource/apis/modules/chat/types"
import chatWebSocket from "@/opensource/apis/clients/chatWebSocket"
import { useAuthorization, useOrganization } from "@/opensource/models/user/hooks"
import { userStore } from "@/opensource/models/user"
import { observer } from "mobx-react-lite"
import { useStyles } from "./styles"
import StreamMessageApplyServiceV2 from "@/opensource/services/chat/message/MessageApplyServices/StreamMessageApplyServiceV2"
import IntermediateMessageApplyService from "@/opensource/services/chat/message/MessageApplyServices/IntermediateMessageApplyService"

interface ChatServiceProps extends PropsWithChildren {}

const ChatProvider = observer(function ChatProvider({ children }: ChatServiceProps) {
	const { t } = useTranslation("interface")
	const { styles } = useStyles()

	const isSwitchingOrganization = interfaceStore.isSwitchingOrganization

	useEffect(() => {
		const callback = (message: WebSocketPayload) => {
			switch (message.type) {
				case EventType.Stream:
					StreamMessageApplyServiceV2.apply(message.payload as StreamResponseV2)
					break
				case EventType.Intermediate:
					IntermediateMessageApplyService.apply(message.payload as IntermediateResponse)
					break
				default:
					const payload = message.payload as SeqRecord<CMessage>
					switch (payload.type) {
						case SeqRecordType.seq:
							const seqId = payload?.seq?.seq_id
							// eslint-disable-next-line no-console
							console.log(
								"%c 接收到服务端的消息:",
								"background-color: green; color: white;",
								seqId,
								// @ts-ignore
								payload?.seq?.message?.type as string,
								message,
							)
							const magicId = userStore.user.userInfo?.magic_id
							const magicOrganizationCode = userStore.user.organizationCode
							if (magicId && seqId && magicOrganizationCode) {
								const localSeqId = MessageSeqIdService.getGlobalPullSeqId()
								if (localSeqId && bigNumCompare(localSeqId, seqId) < 0) {
									MessageService.pullOfflineMessages()
								} else {
									console.warn(
										"接收到消息，但seqId小于或等于本地seqId",
										seqId,
										localSeqId,
									)
								}
							} else {
								console.warn(
									"接收到消息，但magicId或organizationCode不存在",
									magicId,
									magicOrganizationCode,
								)
							}
							break
						default:
							break
					}
					break
			}
		}

		chatWebSocket.on("businessMessage", callback)

		return () => {
			chatWebSocket.off("businessMessage", callback)
		}
	}, [])

	const Fallback = useMemo(
		() => (
			<MagicSpin tip={t("spin.loadingUserInfo")} wrapperClassName={styles.spin}>
				<div className={styles.container} />
			</MagicSpin>
		),
		[styles.container, styles.spin, t],
	)

	if (isSwitchingOrganization) {
		return Fallback
	}

	return children
})

const ParamsCheckWrapper = ({ children }: PropsWithChildren) => {
	const { authorization } = useAuthorization()

	const { organizationCode: magicOrganizationCode } = useOrganization()

	if (!authorization || !magicOrganizationCode) return children

	return <ChatProvider>{children}</ChatProvider>
}

export default ParamsCheckWrapper
