import { describe, expect, it } from "vitest"
import { ElementTypeEnum } from "../../../../../runtime/document/types"
import { getMediaDownloadLabel } from "."

const translate = (_key: string, fallback: string) => fallback

describe("getMediaDownloadLabel", () => {
	it("uses the audio-specific label for audio elements", () => {
		expect(getMediaDownloadLabel(ElementTypeEnum.Audio, translate)).toBe("下载音频")
	})

	it("keeps the generic label for image and video elements", () => {
		expect(getMediaDownloadLabel(ElementTypeEnum.Image, translate)).toBe("下载")
		expect(getMediaDownloadLabel(ElementTypeEnum.Video, translate)).toBe("下载")
	})
})
