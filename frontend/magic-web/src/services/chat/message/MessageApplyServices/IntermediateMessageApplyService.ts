import type { IntermediateResponse, SeqResponse } from "@/types/request"
import {
	EndConversationInputMessage,
	IntermediateMessageType,
	RawMessage,
	StartConversationInputMessage,
	SuperMagicChunkMessage,
	SuperMagicCheckpointRollbackMessage,
	SuperMagicFileChangeMessage,
	SuperMagicMessageQueueMessage,
} from "@/types/chat/intermediate_message"
import ConversationService from "@/services/chat/conversation/ConversationService"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import { projectAttachmentsChangeLog } from "@/pages/superMagic/utils/projectAttachments/changeLogReporter"
import { logger as Logger } from "@/infrastructure/logger"

const logger = Logger.createLogger("IntermediateMessageApplyService")

class IntermediateMessageApplyService {
	/** Payload shapes already reported, so a chatty channel cannot flood the logs */
	private readonly warnedPayloadShapes = new Set<string>()

	/**
	 * 应用消息
	 * @param message 消息对象
	 */
	apply(message: IntermediateResponse) {
		// The intermediate channel also carries payloads without `seq` (for example realtime
		// pushes newer than this client). Ignore them instead of throwing an unhandled rejection.
		const messageType = message?.seq?.message?.type
		if (!messageType) {
			this.warnUnsupportedPayload(message)
			return
		}

		switch (messageType) {
			case IntermediateMessageType.StartConversationInput:
				this.applyStartConversationInputMessage(
					message.seq as SeqResponse<StartConversationInputMessage>,
				)
				break
			case IntermediateMessageType.Raw:
				this.applyRawConversationSuperMagicMessage(message.seq as SeqResponse<RawMessage>)
				break
			case IntermediateMessageType.SuperMagicChunk:
				this.applySuperMagicChunkMessage(message.seq as SeqResponse<SuperMagicChunkMessage>)
				break
			case IntermediateMessageType.EndConversationInput:
				this.applyEndConversationInputMessage(
					message.seq as SeqResponse<EndConversationInputMessage>,
				)
				break
			case IntermediateMessageType.SuperMagicMessageQueueChange:
				this.applySuperMagicMessageQueue(
					message.seq as SeqResponse<SuperMagicMessageQueueMessage>,
				)
				break
			case IntermediateMessageType.SuperMagicFileChange:
				this.applySuperMagicFileChange(
					message.seq as SeqResponse<SuperMagicFileChangeMessage>,
				)
				break
			case IntermediateMessageType.SuperMagicCheckpointRollback:
				this.applySuperMagicCheckpointRollback(
					message.seq as SeqResponse<SuperMagicCheckpointRollbackMessage>,
				)
				break
			default:
				break
		}
	}

	private warnUnsupportedPayload(message: unknown) {
		const payloadType = (message as { type?: unknown } | null | undefined)?.type
		const shape = typeof payloadType === "string" ? payloadType : "unknown"
		if (this.warnedPayloadShapes.has(shape)) return
		this.warnedPayloadShapes.add(shape)
		logger.warn("Ignored intermediate payload without seq message", { payloadType: shape })
	}

	/**
	 * 应用开始会话输入消息
	 * @param message 消息对象
	 */
	applyStartConversationInputMessage(message: SeqResponse<StartConversationInputMessage>) {
		ConversationService.startConversationInput(
			message.message.start_conversation_input.conversation_id,
			message.message.start_conversation_input.topic_id,
		)
	}

	/**
	 * 应用结束会话输入消息
	 * @param message 消息对象
	 */
	applyEndConversationInputMessage(message: SeqResponse<EndConversationInputMessage>) {
		ConversationService.endConversationInput(
			message.message.end_conversation_input.conversation_id,
			message.message.end_conversation_input.topic_id,
		)
	}

	/**
	 * 超级麦吉流式消息块接收
	 * @param seq 消息对象
	 */
	applyRawConversationSuperMagicMessage(seq: SeqResponse<RawMessage>) {
		pubsub.publish(PubSubEvents.Stream_Message, seq?.message)
	}

	/**
	 * 超级麦吉流式消息块接收
	 * @param seq 消息对象
	 */
	applySuperMagicChunkMessage(seq: SeqResponse<SuperMagicChunkMessage>) {
		pubsub.publish("super_magic_chunk_message", seq?.message)
	}

	/**
	 * 超级麦吉消息队列更新接收
	 * @param seq 消息对象
	 */
	applySuperMagicMessageQueue(seq: SeqResponse<SuperMagicMessageQueueMessage>) {
		pubsub.publish(PubSubEvents.SuperMagicMessageQueueConsumed, seq?.message)
	}

	applySuperMagicFileChange(seq: SeqResponse<SuperMagicFileChangeMessage>) {
		projectAttachmentsChangeLog.intermediateReceived(seq)
		pubsub.publish(PubSubEvents.Super_Magic_File_Change_Intermediate, seq)
		projectAttachmentsChangeLog.intermediatePublished(seq)
	}

	applySuperMagicCheckpointRollback(seq: SeqResponse<SuperMagicCheckpointRollbackMessage>) {
		// 保留完整 seq，消费方需要用 conversation_id 路由，并把外层 seq_id 仅作为事件身份。
		pubsub.publish(PubSubEvents.Super_Magic_Checkpoint_Rollback, seq)
	}
}

export default new IntermediateMessageApplyService()
