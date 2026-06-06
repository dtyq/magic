import { describe, expect, it, vi } from "vitest"
import {
	formatRecordingCreatedTime,
	formatRecordingDefaultName,
	parseAudioProjectTimestamp,
	resolveRecordingDisplayName,
	resolveRecordingSourceLabel,
} from "../audio-recordings-utils"
import type { AudioProjectListItem } from "@/types/audioProject"

vi.mock("@/utils/string", () => ({
	formatTime: (time: number, format?: string) => {
		if (format === "YYYY/MM/DD HH:mm") return "2026/06/06 11:05"
		return "Apr 10 09:15"
	},
}))

vi.mock("i18next", () => ({
	default: {
		t: (key: string, options?: { datetime?: string }) => {
			if (key === "defaultName") return `${options?.datetime} 的录音`
			return key
		},
	},
}))

function createItem(overrides: Partial<AudioProjectListItem> = {}): AudioProjectListItem {
	return {
		id: "project-1",
		project_name: "Weekly sync",
		card_status: "summarized",
		is_summarized: true,
		created_at: 1710000000,
		duration: 125,
		tags: [],
		device_id: "",
		audio_source: "recorded",
		current_phase: "summarizing",
		phase_status: "completed",
		...overrides,
	}
}

describe("parseAudioProjectTimestamp", () => {
	it("parses valid unix seconds string", () => {
		expect(parseAudioProjectTimestamp("1710000000")).toBe(1710000000)
	})

	it("parses numeric unix seconds", () => {
		expect(parseAudioProjectTimestamp(1710000000)).toBe(1710000000)
	})

	it("returns null for invalid values", () => {
		expect(parseAudioProjectTimestamp("")).toBeNull()
		expect(parseAudioProjectTimestamp("invalid")).toBeNull()
		expect(parseAudioProjectTimestamp(0)).toBeNull()
	})
})

describe("formatRecordingCreatedTime", () => {
	it("returns string fallback when timestamp is invalid", () => {
		expect(formatRecordingCreatedTime("invalid")).toBe("invalid")
	})

	it("formats valid timestamp", () => {
		expect(formatRecordingCreatedTime(1710000000)).toBe("Apr 10 09:15")
	})
})

describe("formatRecordingDefaultName", () => {
	it("formats valid timestamp with localized recording suffix", () => {
		expect(formatRecordingDefaultName(1710000000)).toBe("2026/06/06 11:05 的录音")
	})

	it("returns empty string for invalid timestamp", () => {
		expect(formatRecordingDefaultName("invalid")).toBe("")
	})
})

describe("resolveRecordingDisplayName", () => {
	it("prefers trimmed project name when present", () => {
		expect(resolveRecordingDisplayName("Weekly sync", 1710000000)).toBe("Weekly sync")
	})

	it("falls back to localized default name when project name is blank", () => {
		expect(resolveRecordingDisplayName("", 1710000000)).toBe("2026/06/06 11:05 的录音")
		expect(resolveRecordingDisplayName("   ", 1710000000)).toBe("2026/06/06 11:05 的录音")
	})
})

describe("resolveRecordingSourceLabel", () => {
	const labels = {
		sourceRecorded: "Phone mic",
		sourceImported: "Imported audio",
		sourceDevice: "Device recording",
	}

	it("prefers device name when present", () => {
		expect(
			resolveRecordingSourceLabel(
				createItem({ device_id: "Redmi K70 Ultra", audio_source: "recorded" }),
				labels,
			),
		).toBe("Redmi K70 Ultra")
	})

	it("falls back to imported label without device name", () => {
		expect(
			resolveRecordingSourceLabel(
				createItem({ audio_source: "imported", device_id: "" }),
				labels,
			),
		).toBe("Imported audio")
	})

	it("falls back to recorded label without device name", () => {
		expect(
			resolveRecordingSourceLabel(
				createItem({ audio_source: "recorded", device_id: "" }),
				labels,
			),
		).toBe("Phone mic")
	})
})
