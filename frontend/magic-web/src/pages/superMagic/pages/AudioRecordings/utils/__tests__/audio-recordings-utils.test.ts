import { describe, expect, it, vi } from "vitest"
import type { AudioProjectListItem } from "@/types/audioProject"

vi.mock("i18next", () => ({
	default: {
		t: (key: string) => key,
	},
	t: (key: string) => key,
}))

vi.mock("@/utils/string", () => ({
	formatTime: () => "mock-time",
}))
import {
	isAudioProjectDetailReady,
	isAudioProjectPreviewReady,
} from "../audio-recordings-utils"

const MOCK_AUDIO_FILE_ID = "mock-audio-file-001"

function createItem(overrides: Partial<AudioProjectListItem> = {}): AudioProjectListItem {
	return {
		id: "project-1",
		project_name: "Weekly sync",
		card_status: "summarized",
		is_summarized: true,
		created_at: 1710000000,
		duration: 754,
		tags: [],
		device_id: "mock-device",
		audio_source: "recorded",
		current_phase: "summarizing",
		phase_status: "completed",
		...overrides,
	}
}

describe("isAudioProjectPreviewReady", () => {
	it("allows summarized items", () => {
		expect(isAudioProjectPreviewReady(createItem())).toBe(true)
	})

	it("allows not_summarized items with audio_file_id", () => {
		expect(
			isAudioProjectPreviewReady(
				createItem({
					card_status: "not_summarized",
					is_summarized: false,
					audio_file_id: MOCK_AUDIO_FILE_ID,
				}),
			),
		).toBe(true)
	})

	it("blocks not_summarized items without audio_file_id", () => {
		expect(
			isAudioProjectPreviewReady(
				createItem({
					card_status: "not_summarized",
					is_summarized: false,
				}),
			),
		).toBe(false)
	})

	it("blocks summarizing items", () => {
		expect(
			isAudioProjectPreviewReady(
				createItem({
					card_status: "summarizing",
					is_summarized: false,
				}),
			),
		).toBe(false)
	})
})

describe("isAudioProjectDetailReady", () => {
	it("only allows summarized items", () => {
		expect(isAudioProjectDetailReady(createItem())).toBe(true)
		expect(
			isAudioProjectDetailReady(
				createItem({
					card_status: "not_summarized",
					audio_file_id: MOCK_AUDIO_FILE_ID,
				}),
			),
		).toBe(false)
	})
})
