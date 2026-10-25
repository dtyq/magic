import { describe, expect, it } from "vitest"
import { loadFileIconByType } from "./index"

describe("MagicFileIcon", () => {
	it.each(["opus", ".OPUS", "m4a"])("maps %s to the audio icon asset", async (extension) => {
		const audioIcon = await loadFileIconByType("mp3")
		const icon = await loadFileIconByType(extension)

		expect(icon).toBe(audioIcon)
	})
})
