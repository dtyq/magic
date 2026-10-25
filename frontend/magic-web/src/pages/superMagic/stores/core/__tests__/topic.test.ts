import { describe, expect, it } from "vitest"
import { TopicMode } from "@/pages/superMagic/pages/Workspace/TopicMode"
import type { Topic } from "@/pages/superMagic/pages/Workspace/types"
import { TopicStore } from "../topic"

function createTopic(overrides: Partial<Topic> = {}): Topic {
	return {
		id: "topic-1",
		topic_name: "Topic",
		topic_mode: TopicMode.Empty,
		...overrides,
	} as Topic
}

describe("TopicStore.updateTopic", () => {
	it("keeps the local employee when detail has no topic mode", () => {
		const store = new TopicStore()
		const localTopic = createTopic({
			topic_mode: TopicMode.CustomAgent,
			agent_code: "SMA-preview",
		})
		store.setTopics([localTopic])
		store.setSelectedTopic(localTopic)

		store.updateTopic(
			createTopic({
				topic_mode: TopicMode.Empty,
				topic_name: "Renamed",
			}),
		)

		expect(store.selectedTopic).toEqual(
			expect.objectContaining({
				topic_name: "Renamed",
				topic_mode: TopicMode.CustomAgent,
				agent_code: "SMA-preview",
			}),
		)
		expect(store.topics[0]).toEqual(
			expect.objectContaining({
				topic_mode: TopicMode.CustomAgent,
				agent_code: "SMA-preview",
			}),
		)
	})

	it("keeps the selected employee when only the selected topic has one", () => {
		const store = new TopicStore()
		store.setTopics([createTopic({ topic_mode: TopicMode.Empty })])
		store.setSelectedTopic(
			createTopic({
				topic_mode: TopicMode.CustomAgent,
				agent_code: "SMA-preview",
			}),
		)

		store.updateTopic(createTopic({ topic_mode: TopicMode.Empty, topic_name: "Detail" }))

		expect(store.selectedTopic?.agent_code).toBe("SMA-preview")
		expect(store.topics[0]?.agent_code).toBe("SMA-preview")
	})

	it("uses the server employee once detail includes a topic mode", () => {
		const store = new TopicStore()
		const localTopic = createTopic({
			topic_mode: TopicMode.CustomAgent,
			agent_code: "SMA-preview",
		})
		store.setTopics([localTopic])
		store.setSelectedTopic(localTopic)

		store.updateTopic(
			createTopic({
				topic_mode: TopicMode.PPT,
				agent_code: undefined,
			}),
		)

		expect(store.selectedTopic?.topic_mode).toBe(TopicMode.PPT)
		expect(store.selectedTopic?.agent_code).toBeUndefined()
	})
})
