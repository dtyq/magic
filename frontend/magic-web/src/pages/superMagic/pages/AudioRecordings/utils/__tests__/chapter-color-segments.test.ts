import { describe, expect, it } from "vitest"
import { buildColorSegmentsFromTopics } from "../chapter-color-segments"
import type { RecordingTopicSection } from "../../types/recording-detail"

describe("buildColorSegmentsFromTopics", () => {
	it("maps topic dialogue ranges into flat waveform color segments", () => {
		const topics: RecordingTopicSection[] = [
			{
				id: "topic_a",
				name: "Topic A",
				color: "#112233",
				summaryTitle: "Summary",
				summaryText: "Body",
				summarySpeakers: [],
				itemsTitle: "Related",
				items: [
					{ time: 10, timeEnd: 40, speakers: ["spk_a"], text: "Line one" },
					{ time: 50, speakers: ["spk_b"], text: "Line two" },
				],
			},
		]

		expect(buildColorSegmentsFromTopics(topics)).toEqual([
			{ start: 0, end: 50, color: "#112233", name: "Topic A" },
		])
	})

	it("snaps adjacent bands together and anchors the first band to zero", () => {
		const topics: RecordingTopicSection[] = [
			{
				id: "topic_a",
				name: "Topic A",
				color: "#112233",
				summaryTitle: "Summary",
				summaryText: "Body",
				summarySpeakers: [],
				itemsTitle: "Related",
				items: [{ time: 10, timeEnd: 40, speakers: ["spk_a"], text: "Line one" }],
			},
			{
				id: "topic_b",
				name: "Topic B",
				color: "#445566",
				summaryTitle: "Summary",
				summaryText: "Body",
				summarySpeakers: [],
				itemsTitle: "Related",
				items: [{ time: 50, timeEnd: 80, speakers: ["spk_b"], text: "Line two" }],
			},
		]

		expect(buildColorSegmentsFromTopics(topics)).toEqual([
			{ start: 0, end: 40, color: "#112233", name: "Topic A" },
			{ start: 40, end: 80, color: "#445566", name: "Topic B" },
		])
	})
})
