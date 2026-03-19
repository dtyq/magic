import type { IntermediateResponse, SeqResponse } from "@/types/request"
import {
	EndConversationInputMessage,
	IntermediateMessageType,
	RawMessage,
	StartConversationInputMessage,
	SuperMagicMessageQueueMessage,
} from "@/types/chat/intermediate_message"
import ConversationService from "@/services/chat/conversation/ConversationService"
import pubsub, { PubSubEvents } from "@/utils/pubsub"

class IntermediateMessageApplyService {
	/**
	 * 应用消息
	 * @param message 消息对象
	 */
	apply(message: IntermediateResponse) {
		switch (message.seq.message.type) {
			case IntermediateMessageType.StartConversationInput:
				this.applyStartConversationInputMessage(
					message.seq as SeqResponse<StartConversationInputMessage>,
				)
				break
			case IntermediateMessageType.Raw:
				this.applyRawConversationSuperMagicMessage(message.seq as SeqResponse<RawMessage>)
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
			default:
				break
		}
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
		pubsub.publish("super_magic_stream_message", seq?.message)
	}

	/**
	 * 超级麦吉消息队列更新接收
	 * @param seq 消息对象
	 */
	applySuperMagicMessageQueue(seq: SeqResponse<SuperMagicMessageQueueMessage>) {
		pubsub.publish(PubSubEvents.SuperMagicMessageQueueConsumed, seq?.message)
	}
}

export default new IntermediateMessageApplyService()
