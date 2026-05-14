import { describe, expect, it } from "vitest"
import type { Topic } from "@/pages/superMagic/pages/Workspace/types"
import { sortTopicsWithPinnedFirst } from "../topicPinSort"

function createTopic(overrides: Partial<Topic> = {}): Topic {
	return {
		id: overrides.id ?? "topic-1",
		topic_name: overrides.topic_name ?? "Topic",
		updated_at: overrides.updated_at ?? "2026-05-12T10:00:00.000Z",
		is_pinned: overrides.is_pinned ?? false,
		pinned_at: overrides.pinned_at ?? null,
		...overrides,
	} as Topic
}

describe("sortTopicsWithPinnedFirst", () => {
	it("moves pinned topics ahead of unpinned topics", () => {
		const topics = [
			createTopic({ id: "topic-older", updated_at: "2026-05-12T09:00:00.000Z" }),
			createTopic({
				id: "topic-pinned",
				updated_at: "2026-05-12T08:00:00.000Z",
				is_pinned: true,
				pinned_at: "2026-05-12T11:00:00.000Z",
			}),
			createTopic({ id: "topic-newer", updated_at: "2026-05-12T10:30:00.000Z" }),
		]

		expect(sortTopicsWithPinnedFirst(topics).map((topic) => topic.id)).toEqual([
			"topic-pinned",
			"topic-newer",
			"topic-older",
		])
	})

	it("sorts unpinned topics by updated time after unpinning", () => {
		const topics = [
			createTopic({ id: "topic-a", updated_at: "2026-05-12T07:00:00.000Z" }),
			createTopic({
				id: "topic-b",
				updated_at: "2026-05-12T09:30:00.000Z",
				is_pinned: false,
				pinned_at: null,
			}),
			createTopic({ id: "topic-c", updated_at: "2026-05-12T08:30:00.000Z" }),
		]

		expect(sortTopicsWithPinnedFirst(topics).map((topic) => topic.id)).toEqual([
			"topic-b",
			"topic-c",
			"topic-a",
		])
	})
})
