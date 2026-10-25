import { describe, expect, it } from "vitest"
import { isAllowedFileType, isAudioFile, validateCanvasFilePath, validateFile } from "../ids"

describe("audio file validation", () => {
	it.each([
		["voice.mp3", "audio/mpeg"],
		["voice.wav", "audio/wav"],
		["voice.ogg", "audio/ogg"],
		["voice.m4a", "audio/mp4"],
		["voice.aac", "audio/aac"],
	])("accepts supported audio file %s", (name, type) => {
		const file = new File(["audio"], name, { type })

		expect(isAudioFile(file)).toBe(true)
		expect(isAllowedFileType(file)).toBe(true)
		expect(validateFile(file)).toEqual({ valid: true })
	})

	it.each([
		["voice.flac", "audio/flac"],
		["voice.mid", "audio/midi"],
	])("rejects unsupported audio file %s", (name, type) => {
		const file = new File(["audio"], name, { type })

		expect(isAudioFile(file)).toBe(false)
		expect(isAllowedFileType(file)).toBe(false)
		expect(validateFile(file)).toMatchObject({ valid: false })
	})
})

describe("Canvas media path validation", () => {
	it("accepts asset references without inferring their media type from the id", () => {
		expect(validateCanvasFilePath("asset://opaque-id")).toEqual({ valid: true })
		expect(validateCanvasFilePath("asset://reference.png")).toEqual({ valid: true })
	})

	it.each(["asset:/opaque-id", "asset://", "asset://opaque-id/child.png"])(
		"rejects malformed asset reference %s before extension validation",
		(path) => {
			expect(validateCanvasFilePath(path)).toMatchObject({ valid: false })
		},
	)
})
