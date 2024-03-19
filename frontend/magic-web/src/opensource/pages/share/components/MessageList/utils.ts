import { superMagicStore } from "@/opensource/pages/superMagic/stores"

/**
 * @description 数据来源于IM表，在客户端需要将数据磨平差异
 * @param messages 消息列表（IM表数据格式）
 */
export function messagesTransformer(messages: Array<any>) {
	superMagicStore.loadSharedMessages(messages)
	return (messages || [])?.map((o) => {
		return {
			...o,
			magic_message_id: o?.message_id,
			app_message_id: o?.message_id,
			topic_id: o?.topic_id,
			type: o?.type,
			send_time: o?.send_timestamp,
			status: o?.status,
			event: o?.event,
			debug: o?.[o?.type],
			correlation_id: o?.correlation_id,
			role: o?.role || "user",
			seq_id: o?.message_id,
		}
	})
}
