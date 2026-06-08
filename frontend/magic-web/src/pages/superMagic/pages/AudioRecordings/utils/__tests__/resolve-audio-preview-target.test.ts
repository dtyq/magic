import { describe, expect, it } from "vitest"
import {
	resolveAudioPreviewTarget,
	resolveAudioPreviewTargetWithFallback,
} from "../resolve-audio-preview-target"

const MOCK_AUDIO_FILE_ID = "mock-audio-file-001"
const MOCK_HTML_ENTRY_ID = "mock-html-entry-001"

describe("resolveAudioPreviewTarget", () => {
	it("returns html entry for summarized items", () => {
		const tree = [
			{
				is_directory: true,
				display_config: { type: "audio" },
				children: [{ file_id: MOCK_HTML_ENTRY_ID, file_name: "index.html" }],
			},
		]

		const target = resolveAudioPreviewTarget({
			cardStatus: "summarized",
			tree,
			list: [],
		})

		expect(target?.kind).toBe("html")
		expect(target?.file.file_id).toBe(MOCK_HTML_ENTRY_ID)
	})

	it("returns raw audio for not_summarized items", () => {
		const list = [
			{ file_id: MOCK_AUDIO_FILE_ID, file_name: "recording.mp3", file_extension: "mp3" },
		]

		const target = resolveAudioPreviewTarget({
			cardStatus: "not_summarized",
			audioFileId: MOCK_AUDIO_FILE_ID,
			tree: [],
			list,
		})

		expect(target?.kind).toBe("raw-audio")
		expect(target?.file.file_id).toBe(MOCK_AUDIO_FILE_ID)
	})

	it("returns raw audio for summarizing items with audio_file_id", () => {
		const list = [
			{ file_id: MOCK_AUDIO_FILE_ID, file_name: "recording.mp3", file_extension: "mp3" },
		]

		const target = resolveAudioPreviewTarget({
			cardStatus: "summarizing",
			audioFileId: MOCK_AUDIO_FILE_ID,
			tree: [],
			list,
		})

		expect(target?.kind).toBe("raw-audio")
		expect(target?.file.file_id).toBe(MOCK_AUDIO_FILE_ID)
	})

	it("returns null for summarizing items without audio_file_id", () => {
		const target = resolveAudioPreviewTarget({
			cardStatus: "summarizing",
			tree: [],
			list: [],
		})

		expect(target).toBeNull()
	})
})

describe("resolveAudioPreviewTargetWithFallback", () => {
	it("falls back to raw audio when html entry is missing", () => {
		const list = [
			{ file_id: MOCK_AUDIO_FILE_ID, file_name: "recording.mp3", file_extension: "mp3" },
		]

		const result = resolveAudioPreviewTargetWithFallback({
			tree: [],
			list,
		})

		expect(result.target?.kind).toBe("raw-audio")
		expect(result.missingKind).toBeNull()
	})

	it("reports raw-audio missing for not_summarized without a playable file", () => {
		const result = resolveAudioPreviewTargetWithFallback({
			cardStatus: "not_summarized",
			tree: [],
			list: [],
		})

		expect(result.target).toBeNull()
		expect(result.missingKind).toBe("raw-audio")
	})

	it("returns raw audio for summarizing without trying html entry first", () => {
		const list = [
			{ file_id: MOCK_AUDIO_FILE_ID, file_name: "recording.mp3", file_extension: "mp3" },
		]

		const result = resolveAudioPreviewTargetWithFallback({
			cardStatus: "summarizing",
			audioFileId: MOCK_AUDIO_FILE_ID,
			tree: [],
			list,
		})

		expect(result.target?.kind).toBe("raw-audio")
		expect(result.missingKind).toBeNull()
	})
})
