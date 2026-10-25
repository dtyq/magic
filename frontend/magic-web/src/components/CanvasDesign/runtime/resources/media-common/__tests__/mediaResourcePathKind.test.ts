import { describe, expect, it } from "vitest"
import { getMediaResourcePathKind } from "../mediaResourcePathKind"

describe("getMediaResourcePathKind", () => {
	it("uses explicit metadata for asset paths", () => {
		expect(getMediaResourcePathKind("asset://image.png")).toBe("other")
		expect(getMediaResourcePathKind("asset://image.png", { mediaType: "image" })).toBe("image")
		expect(getMediaResourcePathKind("asset://video-id", { mediaType: "video" })).toBe("video")
		expect(getMediaResourcePathKind("asset://audio-id", { mediaType: "audio" })).toBe("audio")
	})

	it("keeps extension detection for ordinary paths", () => {
		expect(getMediaResourcePathKind("./images/example.PNG")).toBe("image")
		expect(getMediaResourcePathKind("./videos/example.mp4")).toBe("video")
		expect(getMediaResourcePathKind("./audios/example.mp3")).toBe("audio")
	})
})
