import { describe, expect, it } from "vitest"
import {
	COMPOSER_SHELL_CHROME_HEIGHT,
	ORDINARY_COMPOSER_CARD_HEIGHT,
	PPT_COMPOSER_MIN_INPUT_HEIGHT,
	SPECIALIZED_COMPOSER_MIN_INPUT_HEIGHT,
	VIDEO_PRODUCTION_COMPOSER_MIN_INPUT_HEIGHT,
	resolveComposerMinInputHeight,
} from "@/pages/superMagic/components/ConversationInputResize/constants"

describe("TopicMessagePanel input minimum height", () => {
	it("uses the PPT-specific floor before other specialized composer rules", () => {
		expect(
			resolveComposerMinInputHeight({
				isPptMode: true,
				isVideoProductionMode: true,
				isSpecializedMode: true,
			}),
		).toBe(PPT_COMPOSER_MIN_INPUT_HEIGHT)
	})

	it("uses the standard floor for ordinary conversations and scene presets", () => {
		expect(
			resolveComposerMinInputHeight({
				isPptMode: false,
				isVideoProductionMode: false,
				isSpecializedMode: false,
			}),
		).toBeUndefined()
	})

	it("keeps the existing floor for composers with specialized controls", () => {
		expect(
			resolveComposerMinInputHeight({
				isPptMode: false,
				isVideoProductionMode: false,
				isSpecializedMode: true,
			}),
		).toBe(SPECIALIZED_COMPOSER_MIN_INPUT_HEIGHT)
	})

	it("uses the video production floor before other specialized composer rules", () => {
		expect(
			resolveComposerMinInputHeight({
				isPptMode: false,
				isVideoProductionMode: true,
				isSpecializedMode: true,
			}),
		).toBe(VIDEO_PRODUCTION_COMPOSER_MIN_INPUT_HEIGHT)
	})

	it("keeps a locked-mode composer's card at the ordinary card height", () => {
		const lockedMode = {
			isPptMode: false,
			isVideoProductionMode: false,
			isSpecializedMode: false,
			isLockedMode: true,
		}
		expect(resolveComposerMinInputHeight(lockedMode)).toBe(
			ORDINARY_COMPOSER_CARD_HEIGHT + COMPOSER_SHELL_CHROME_HEIGHT.default,
		)
		// The AI canvas sits beside its canvas panel, so its composer uses the small size.
		expect(resolveComposerMinInputHeight({ ...lockedMode, editorSize: "small" })).toBe(
			ORDINARY_COMPOSER_CARD_HEIGHT + COMPOSER_SHELL_CHROME_HEIGHT.small,
		)
	})
})
