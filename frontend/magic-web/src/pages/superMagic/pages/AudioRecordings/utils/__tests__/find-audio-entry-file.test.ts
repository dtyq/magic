import { describe, expect, it } from "vitest"
import { findAudioEntryFile } from "../find-audio-entry-file"

describe("findAudioEntryFile", () => {
	it("returns index.html under the first audio display folder", () => {
		const tree = [
			{
				is_directory: true,
				display_config: { type: "audio" },
				children: [
					{
						file_id: "entry-1",
						file_name: "index.html",
						display_config: { type: "audio" },
					},
				],
			},
		]

		const entry = findAudioEntryFile(tree)
		expect(entry?.file_id).toBe("entry-1")
	})

	it("searches nested directories recursively", () => {
		const tree = [
			{
				is_directory: true,
				children: [
					{
						is_directory: true,
						display_config: { type: "audio" },
						children: [{ file_id: "nested-entry", file_name: "index.html" }],
					},
				],
			},
		]

		const entry = findAudioEntryFile(tree)
		expect(entry?.file_id).toBe("nested-entry")
		expect(entry?.display_config).toEqual({ type: "audio" })
	})

	it("returns null when no audio entry exists", () => {
		expect(findAudioEntryFile([])).toBeNull()
		expect(
			findAudioEntryFile([
				{
					is_directory: true,
					display_config: { type: "slide" },
					children: [{ file_id: "x", file_name: "index.html" }],
				},
			]),
		).toBeNull()
	})
})
