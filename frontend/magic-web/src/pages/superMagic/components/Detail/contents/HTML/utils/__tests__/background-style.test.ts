import { describe, expect, it } from "vitest"
import {
	normalizeConflictingBackgroundDeclarations,
	replaceBackgroundImageInStyleAttribute,
} from "../background-style"

const NEW_BACKGROUND_IMAGE =
	"/*__ORIGINAL_URL__:images/new.png__*/url('data:image/png;base64,abc123')"

describe("background-style", () => {
	describe("replaceBackgroundImageInStyleAttribute", () => {
		it("should replace background shorthand with normalized declarations", () => {
			const result = replaceBackgroundImageInStyleAttribute({
				styleAttribute:
					"background: url('old.jpg') center center / cover no-repeat; padding: 10px;",
				nextBackgroundImage: NEW_BACKGROUND_IMAGE,
			})

			expect(result).toContain(`background-image: ${NEW_BACKGROUND_IMAGE};`)
			expect(result).toContain("background-position: center center;")
			expect(result).toContain("background-size: cover;")
			expect(result).toContain("background-repeat: no-repeat;")
			expect(result).toContain("padding: 10px;")
			expect(result).not.toContain("background: url('old.jpg')")
		})

		it("should update existing background-image without duplicating declarations", () => {
			const result = replaceBackgroundImageInStyleAttribute({
				styleAttribute:
					"background-image: url('old.jpg'); background-size: cover; background-position: center;",
				nextBackgroundImage: NEW_BACKGROUND_IMAGE,
			})

			expect(result).toContain(`background-image: ${NEW_BACKGROUND_IMAGE};`)
			expect(result.match(/background-image:/g)).toHaveLength(1)
			expect(result).not.toContain("old.jpg")
		})

		it("should preserve background color when removing background image", () => {
			const result = replaceBackgroundImageInStyleAttribute({
				styleAttribute:
					"background: url('old.jpg') center center / cover; background-color: rgba(255, 255, 255, 0.6);",
				nextBackgroundImage: "none",
			})

			expect(result).toContain("background-image: none;")
			expect(result).toContain("background-color: rgba(255, 255, 255, 0.6);")
			expect(result).not.toContain("old.jpg")
		})

		it("should handle empty style attribute", () => {
			const result = replaceBackgroundImageInStyleAttribute({
				styleAttribute: "",
				nextBackgroundImage: NEW_BACKGROUND_IMAGE,
			})

			expect(result).toBe(`background-image: ${NEW_BACKGROUND_IMAGE};`)
		})

		it("should flatten multi-layer background into a single background image", () => {
			const result = replaceBackgroundImageInStyleAttribute({
				styleAttribute:
					"background: url('old.jpg'), linear-gradient(#fff, #000); padding: 10px;",
				nextBackgroundImage: NEW_BACKGROUND_IMAGE,
			})

			expect(result).toContain(`background-image: ${NEW_BACKGROUND_IMAGE};`)
			expect(result).toContain("padding: 10px;")
			expect(result).not.toContain("old.jpg")
			expect(result).not.toContain("linear-gradient")
			expect(result).not.toContain("background: ")
		})

		it("should not treat rgba color as multi-layer background", () => {
			const result = replaceBackgroundImageInStyleAttribute({
				styleAttribute:
					"background: url('old.jpg') center center / cover no-repeat rgba(255, 255, 255, 0.6);",
				nextBackgroundImage: NEW_BACKGROUND_IMAGE,
			})

			expect(result).toContain(`background-image: ${NEW_BACKGROUND_IMAGE};`)
			expect(result).toContain("background-position: center center;")
			expect(result).toContain("background-size: cover;")
			expect(result).toContain("background-repeat: no-repeat;")
			expect(result).toContain("background-color: rgba(255, 255, 255, 0.6);")
		})

		it("should preserve named color from background shorthand", () => {
			const result = replaceBackgroundImageInStyleAttribute({
				styleAttribute: "background: url('old.jpg') center center / cover no-repeat white;",
				nextBackgroundImage: NEW_BACKGROUND_IMAGE,
			})

			expect(result).toContain(`background-image: ${NEW_BACKGROUND_IMAGE};`)
			expect(result).toContain("background-position: center center;")
			expect(result).toContain("background-size: cover;")
			expect(result).toContain("background-repeat: no-repeat;")
			expect(result).toContain("background-color: white;")
		})

		it("should preserve css variable color from background shorthand", () => {
			const result = replaceBackgroundImageInStyleAttribute({
				styleAttribute:
					"background: url('old.jpg') center center / cover no-repeat var(--bg-color);",
				nextBackgroundImage: NEW_BACKGROUND_IMAGE,
			})

			expect(result).toContain(`background-image: ${NEW_BACKGROUND_IMAGE};`)
			expect(result).toContain("background-position: center center;")
			expect(result).toContain("background-size: cover;")
			expect(result).toContain("background-repeat: no-repeat;")
			expect(result).toContain("background-color: var(--bg-color);")
		})
	})

	describe("normalizeConflictingBackgroundDeclarations", () => {
		it("should normalize conflicting background shorthand and background-image", () => {
			const result = normalizeConflictingBackgroundDeclarations(
				[
					"background: url('old.jpg') center center / cover no-repeat;",
					"padding: 30px 20px;",
					"background-image: url('images/new.png');",
				].join(" "),
			)

			expect(result).toContain("background-image: url('images/new.png');")
			expect(result).toContain("background-position: center center;")
			expect(result).toContain("background-size: cover;")
			expect(result).toContain("background-repeat: no-repeat;")
			expect(result).toContain("padding: 30px 20px;")
			expect(result).not.toContain("old.jpg")
			expect(result).not.toContain("background: url(")
		})

		it("should leave non-conflicting styles untouched", () => {
			const styleAttribute = "background-image: url('images/new.png'); padding: 12px;"

			expect(normalizeConflictingBackgroundDeclarations(styleAttribute)).toBe(styleAttribute)
		})
	})
})
