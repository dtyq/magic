import type { CMessage } from "@/types/chat"
import { EventType } from "@/types/chat"
import { bigNumCompare } from "@/utils/string"
import type {
	StreamResponseV2,
	IntermediateResponse,
	WebSocketPayload,
	RecordSummaryResultMessage,
} from "@/types/request"
import MessageSeqIdService from "./MessageSeqIdService"
import MessageService from "./MessageService"
import { SeqRecordType } from "@/apis/modules/chat/types"
import type { SeqRecord } from "@/apis/modules/chat/types"
import chatWebSocket from "@/apis/clients/chatWebSocket"
import { userStore } from "@/models/user"
import StreamMessageApplyServiceV2 from "./MessageApplyServices/StreamMessageApplyServiceV2"
import IntermediateMessageApplyService from "./MessageApplyServices/IntermediateMessageApplyService"
import { WorkspaceStateCache } from "@/pages/superMagic/utils/superMagicCache"
import { logger as Logger } from "@/utils/log"

const logger = Logger.createLogger("ChatBusinessMessageService")

/**
 * Callback for showing record summary notification
 */
export interface ShowRecordSummaryNotificationCallback {
	(options: {
		workspaceId: string
		projectId: string
		topicId: string
		success: boolean
		workspaceName?: string
		projectName?: string
	}): void
}

/**
 * Service for managing WebSocket business message listeners
 * Handles message processing and connection lifecycle
 */
class ChatBusinessMessageService {
	private isInitialized = false

	private businessMessageHandler: ((message: WebSocketPayload) => void) | null = null

	private openHandler: (() => void) | null = null

	private closeHandler: (() => void) | null = null

	private showRecordSummaryNotificationCallback: ShowRecordSummaryNotificationCallback | null =
		null

	private isBusinessMessageListenerBound: boolean = false

	/**
	 * Initialize the service and bind event listeners
	 * @param showRecordSummaryNotification Optional callback for showing record summary notifications
	 */
	init(showRecordSummaryNotification?: ShowRecordSummaryNotificationCallback) {
		if (this.isInitialized) {
			logger.warn("ChatBusinessMessageService already initialized")
			return
		}

		this.showRecordSummaryNotificationCallback = showRecordSummaryNotification || null

		// Create business message handler
		this.businessMessageHandler = (message: WebSocketPayload) => {
			this.handleBusinessMessage(message)
		}

		// Create connection handlers
		this.openHandler = () => {
			this.bindBusinessMessageListener()
		}

		this.closeHandler = () => {
			this.unbindBusinessMessageListener()
		}

		// Register connection state listeners
		chatWebSocket.on("open", this.openHandler)
		chatWebSocket.on("close", this.closeHandler)

		// If already connected, bind immediately
		if (chatWebSocket.isConnected) {
			this.bindBusinessMessageListener()
		}

		this.isInitialized = true
		logger.log("ChatBusinessMessageService initialized")
	}

	/**
	 * Destroy the service and cleanup all listeners
	 */
	destroy() {
		if (!this.isInitialized) {
			return
		}

		// Unbind all listeners
		if (this.openHandler) {
			chatWebSocket.off("open", this.openHandler)
			this.openHandler = null
		}

		if (this.closeHandler) {
			chatWebSocket.off("close", this.closeHandler)
			this.closeHandler = null
		}

		this.unbindBusinessMessageListener()

		this.showRecordSummaryNotificationCallback = null
		this.isInitialized = false
		logger.log("ChatBusinessMessageService destroyed")
	}

	private bindBusinessMessageListener() {
		if (this.businessMessageHandler && !this.isBusinessMessageListenerBound) {
			chatWebSocket.on("businessMessage", this.businessMessageHandler)
			this.isBusinessMessageListenerBound = true
			logger.log("Business message listener bound")
		}
	}

	private unbindBusinessMessageListener() {
		if (this.businessMessageHandler && this.isBusinessMessageListenerBound) {
			chatWebSocket.off("businessMessage", this.businessMessageHandler)
			this.isBusinessMessageListenerBound = false
			logger.log("Business message listener unbound")
		}
	}

	/**
	 * Handle business message
	 */
	private handleBusinessMessage(message: WebSocketPayload) {
		switch (message.type) {
			case EventType.Stream:
				StreamMessageApplyServiceV2.apply(message.payload as StreamResponseV2)
				break
			case EventType.Intermediate:
				this.handleIntermediateMessage(message.payload as RecordSummaryResultMessage)
				break
			default:
				this.handleSeqRecordMessage(message.payload as SeqRecord<CMessage>)
				break
		}
	}

	/**
	 * Handle intermediate message (including record summary results)
	 */
	private handleIntermediateMessage(
		messagePayload: RecordSummaryResultMessage | IntermediateResponse,
	) {
		console.log("message.payload", messagePayload)

		// Check if it's a record summary result message
		if (
			typeof messagePayload === "object" &&
			messagePayload !== null &&
			"type" in messagePayload &&
			messagePayload.type === "recording_summary_result"
		) {
			this.handleRecordSummaryResult(messagePayload as RecordSummaryResultMessage)
		} else {
			IntermediateMessageApplyService.apply(messagePayload as IntermediateResponse)
		}
	}

	/**
	 * Handle record summary result message
	 */
	private handleRecordSummaryResult(messagePayload: RecordSummaryResultMessage) {
		if (!this.showRecordSummaryNotificationCallback) {
			return
		}

		const currentOrganization = userStore.user.organizationCode
		const state = WorkspaceStateCache.get(userStore.user.userInfo)

		// Check if same organization
		const isSameOrganization =
			messagePayload.recording_summary_result.organization_code === currentOrganization

		// Check if currently on target page
		const isInTopicPage =
			state.topicId === messagePayload.recording_summary_result.topic_id &&
			state.workspaceId === messagePayload.recording_summary_result.workspace_id &&
			state.projectId === messagePayload.recording_summary_result.project_id

		// Show notification if same organization but not on target page
		if (isSameOrganization && !isInTopicPage) {
			this.showRecordSummaryNotificationCallback({
				workspaceId: messagePayload.recording_summary_result.workspace_id,
				projectId: messagePayload.recording_summary_result.project_id,
				topicId: messagePayload.recording_summary_result.topic_id,
				success: messagePayload.recording_summary_result.success,
				workspaceName: messagePayload.recording_summary_result.workspace_name,
				projectName: messagePayload.recording_summary_result.project_name,
			})
		}
	}

	/**
	 * Handle sequence record message
	 */
	private handleSeqRecordMessage(payload: SeqRecord<CMessage>) {
		switch (payload.type) {
			case SeqRecordType.seq:
				const seqId = payload?.seq?.seq_id

				console.log(
					"%c 接收到服务端的消息:",
					"background-color: green; color: white;",
					seqId,
					// @ts-ignore
					payload?.seq?.message?.type as string,
					payload,
				)

				const magicId = userStore.user.userInfo?.magic_id
				const magicOrganizationCode = userStore.user.organizationCode

				if (magicId && seqId && magicOrganizationCode) {
					const localSeqId = MessageSeqIdService.getGlobalPullSeqId()
					if (localSeqId && bigNumCompare(localSeqId, seqId) < 0) {
						MessageService.pullOfflineMessages()
					} else {
						console.warn("接收到消息，但seqId小于或等于本地seqId", seqId, localSeqId)
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
	}
}

export default new ChatBusinessMessageService()
