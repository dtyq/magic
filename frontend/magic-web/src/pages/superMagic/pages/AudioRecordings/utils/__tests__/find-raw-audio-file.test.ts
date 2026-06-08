import { describe, expect, it } from "vitest"
import { findRawAudioFile } from "../find-raw-audio-file"

const MOCK_AUDIO_FILE_ID = "mock-audio-file-001"
const MOCK_AUDIO_FILE_ID_ALT = "mock-audio-file-002"

describe("findRawAudioFile", () => {
	it("returns the file matching preferred file id", () => {
		const list = [
			{ file_id: MOCK_AUDIO_FILE_ID, file_name: "recording.mp3", file_extension: "mp3" },
			{ file_id: MOCK_AUDIO_FILE_ID_ALT, file_name: "other.wav", file_extension: "wav" },
		]

		const file = findRawAudioFile(list, MOCK_AUDIO_FILE_ID_ALT)
		expect(file?.file_id).toBe(MOCK_AUDIO_FILE_ID_ALT)
	})

	it("falls back to the first visible audio extension when preferred id is missing", () => {
		const list = [
			{
				file_id: "hidden-audio",
				file_name: "hidden.mp3",
				file_extension: "mp3",
				is_hidden: true,
			},
			{ file_id: MOCK_AUDIO_FILE_ID, file_name: "recording.m4a", file_extension: "m4a" },
		]

		const file = findRawAudioFile(list, "missing-id")
		expect(file?.file_id).toBe(MOCK_AUDIO_FILE_ID)
	})

	it("skips directories and non-audio extensions", () => {
		const list = [
			{ file_id: "dir-1", is_directory: true, file_name: "folder" },
			{ file_id: "note-1", file_name: "note.md", file_extension: "md" },
		]

		expect(findRawAudioFile(list)).toBeNull()
	})

	it("falls back when preferred id points to a hidden audio file", () => {
		const list = [
			{
				file_id: MOCK_AUDIO_FILE_ID,
				file_name: "hidden.mp3",
				file_extension: "mp3",
				is_hidden: 1,
			},
			{ file_id: MOCK_AUDIO_FILE_ID_ALT, file_name: "visible.m4a", file_extension: "m4a" },
		]

		const file = findRawAudioFile(list, MOCK_AUDIO_FILE_ID)
		expect(file?.file_id).toBe(MOCK_AUDIO_FILE_ID_ALT)
	})

	it("falls back when preferred id points to a non-audio file", () => {
		const list = [
			{ file_id: MOCK_AUDIO_FILE_ID, file_name: "note.md", file_extension: "md" },
			{ file_id: MOCK_AUDIO_FILE_ID_ALT, file_name: "recording.wav", file_extension: "wav" },
		]

		const file = findRawAudioFile(list, MOCK_AUDIO_FILE_ID)
		expect(file?.file_id).toBe(MOCK_AUDIO_FILE_ID_ALT)
	})

	it("returns null when preferred id is only a hidden or non-audio match", () => {
		const list = [
			{
				file_id: MOCK_AUDIO_FILE_ID,
				file_name: "hidden.mp3",
				file_extension: "mp3",
				is_hidden: true,
			},
		]

		expect(findRawAudioFile(list, MOCK_AUDIO_FILE_ID)).toBeNull()
	})
})
