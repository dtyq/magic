import pubsub from "@/utils/pubsub"
import { superMagicStore } from "@/pages/superMagic/stores"
import { set } from "lodash-es"

// @ts-ignore
window.test = (topicId: string = "837333386617253888") => {
	const mock: any[] = []

	function check() {
		const allAfterAgentReply = mock.filter((o) => {
			return o?.message?.general_agent_card?.event === "after_agent_reply"
		})

		allAfterAgentReply.forEach((o) => {
			const aa = mock.some((i) => {
				return (
					i?.message?.general_agent_card?.event === "before_agent_reply" &&
					o?.message?.general_agent_card?.correlation_id ===
					i?.message?.general_agent_card?.correlation_id
				)
				if (!aa) {
					console.error("流式消息卡片丢失", i)
				}
			})
		})
		console.log("allAfterAgentReply", allAfterAgentReply)
	}

	check()

	const lastMessageTime: null | number = null

	function run(i: number) {
		const message = mock[i]
		if (!message) {
			return
		}
		// 获取当前消息节点传送过来的时间
		const time = message?.send_time || message?.message?.send_time

		if (message?.type === "raw") {
			set(message, ["topic_id"], topicId)
			pubsub.publish("super_magic_stream_message", message)
			setTimeout(() => {
				run(i + 1)
			}, 10)
		} else {
			// set(message, ["message", "send_time"], Date.now() / 1000)
			set(message, ["message", "topic_id"], topicId)
			set(message, ["message", "general_agent_card", "topic_id"], "83773982673888888")
			superMagicStore.enqueueMessage(topicId, { seq: message })

			setTimeout(() => {
				run(i + 1)
			}, 50)
		}
		// console.log(
		// 	"time",
		// 	lastMessageTime ? time || 0 - lastMessageTime : 0,
		// 	time,
		// 	lastMessageTime,
		// )
		// setTimeout(
		// 	() => {
		// 		lastMessageTime = time || 0
		// 		run(i + 1)
		// 	},
		// 	500,
		// 	// lastMessageTime ? time - lastMessageTime : 0,
		// )
	}

	run(0)
}
