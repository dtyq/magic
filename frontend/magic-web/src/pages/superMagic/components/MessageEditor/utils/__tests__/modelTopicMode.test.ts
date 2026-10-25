import { describe, expect, it } from "vitest"
import { TopicMode } from "@/pages/superMagic/pages/Workspace/TopicMode"
import { resolveModelTopicMode } from "../modelTopicMode"

describe("resolveModelTopicMode", () => {
	it("uses the explicit model catalog mode without changing the business mode", () => {
		expect(resolveModelTopicMode(TopicMode.MicroApp, TopicMode.Default)).toBe(TopicMode.Default)
	})

	it("uses the default catalog for the crew creator business mode", () => {
		expect(resolveModelTopicMode(TopicMode.CrewCreator, TopicMode.Default)).toBe(
			TopicMode.Default,
		)
	})

	it("falls back to the business mode when no model catalog mode is provided", () => {
		expect(resolveModelTopicMode(TopicMode.General)).toBe(TopicMode.General)
	})
})
