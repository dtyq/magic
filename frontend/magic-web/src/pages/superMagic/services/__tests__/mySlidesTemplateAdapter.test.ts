import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
	getSlidesTemplateCodeAvailability: vi.fn(),
	createRandomUuidV4: vi.fn(),
}))

vi.mock("@/apis", () => ({
	SuperMagicApi: {
		getSlidesTemplateCodeAvailability: mocks.getSlidesTemplateCodeAvailability,
	},
}))

vi.mock("@/apis/modules/slidesTemplateUpload", () => ({
	SLIDES_TEMPLATE_UPLOAD_API_ENABLED: false,
}))

vi.mock("@/utils/create-random-uuid-v4", () => ({
	createRandomUuidV4: mocks.createRandomUuidV4,
}))

import { createAvailableSlidesTemplateCode } from "../mySlidesTemplateAdapter"

describe("createAvailableSlidesTemplateCode", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		mocks.createRandomUuidV4.mockReturnValue("12345678-1234-4abc-8def-1234567890ab")
		mocks.getSlidesTemplateCodeAvailability.mockResolvedValue({ status: "UNUSED" })
	})

	it("generates a 16-character random suffix", async () => {
		const code = await createAvailableSlidesTemplateCode()

		expect(code).toBe("SLIDE-1234567812344ABC")
		expect(code).toHaveLength(22)
		expect(mocks.getSlidesTemplateCodeAvailability).toHaveBeenCalledWith(
			"SLIDE-1234567812344ABC",
		)
	})
})
