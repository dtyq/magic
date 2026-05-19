import pubsub, { PubSubEvents } from "@/utils/pubsub"
import { superMagicStore } from "@/pages/superMagic/stores"
import { set } from "lodash-es"
import mock from "./mock_v6.json"

// @ts-ignore
window.test = (topicId: string = "837333386617253888") => {
	// const mock: any[] = []

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

	superMagicStore.setTest(topicId)

	// 串行推送
	function run(i: number) {
		const message = mock[i]
		if (!message) {
			return
		}
		// 获取当前消息节点传送过来的时间
		const time = message?.send_time || message?.message?.send_time

		if (message?.type === "super_magic_chunk") {
			set(message, ["topic_id"], topicId)
			pubsub.publish("super_magic_chunk_message", message)
			setTimeout(() => {
				run(i + 1)
			}, 5)
		} else {
			set(message, ["message", "send_time"], Date.now() / 1000)

			setTimeout(() => {
				set(message, ["message", "topic_id"], topicId)
				set(message, ["message", "super_magic_message", "topic_id"], "83773982673888888")
				superMagicStore.enqueueMessage(topicId, { seq: message })
				run(i + 1)
			}, 2000)
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

	// // 并发推送
	// function run() {

	// 	function send(array: any[], i: number) {
	// 		const message = array[i]
	// 		if (!message) {
	// 			return
	// 		}

	// 		if (message?.type === "super_magic_chunk") {
	// 			set(message, ["topic_id"], topicId)
	// 			pubsub.publish("super_magic_chunk_message", message)
	// 			setTimeout(() => {
	// 				send(array, i + 1)
	// 			}, 50)
	// 		} else {
	// 			// 获取当前消息节点传送过来的时间
	// 			set(message, ["message", "send_time"], Date.now() / 1000)

	// 			setTimeout(() => {
	// 				set(message, ["message", "topic_id"], topicId)
	// 				set(message, ["message", "super_magic_message", "topic_id"], "83773982673888888")
	// 				superMagicStore.enqueueMessage(topicId, { seq: message })
	// 				send(array, i + 1)
	// 			}, 1000)
	// 		}
	// 	}
	// 	const [a, b, ...c] = mock
	// 	const messageA = c.filter((o) => o?.type === "super_magic_chunk")
	// 	const messageB = c.filter((o) => o?.type !== "super_magic_chunk")

	// 	superMagicStore.enqueueMessage(topicId, { seq: a })
	// 	superMagicStore.enqueueMessage(topicId, { seq: b })

	// 	setTimeout(() => {
	// 		send(messageB, 0)
	// 		send(messageA, 2)
	// 	}, 3000)
	// }

	setTimeout(() => {
		run(0)
	}, 1000)
}
