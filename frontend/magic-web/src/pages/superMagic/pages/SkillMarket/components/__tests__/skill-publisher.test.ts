import { describe, expect, it } from "vitest"
import { resolveStoreSkillPublisherLabel } from "../skill-publisher"

function translate(key: string) {
	switch (key) {
		case "skillsLibrary.official":
			return "Official"
		case "employeeCard.officialBuiltin":
			return "Official Built-in"
		case "employeeCard.publisherVerified":
			return "Verified Creator"
		case "employeeCard.publisherPartner":
			return "Partner"
		default:
			return key
	}
}

describe("resolveStoreSkillPublisherLabel", () => {
	it("uses official built-in copy from publisher type", () => {
		expect(
			resolveStoreSkillPublisherLabel({
				authorName: undefined,
				publisherType: "OFFICIAL_BUILTIN",
				t: translate,
				fallbackLabel: "Unknown",
			}),
		).toBe("Official Built-in")
	})

	it("uses publisher name for user skills", () => {
		expect(
			resolveStoreSkillPublisherLabel({
				authorName: "Alice",
				publisherType: "USER",
				t: translate,
				fallbackLabel: "Unknown",
			}),
		).toBe("Alice")
	})
})
