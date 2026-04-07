import { describe, expect, it } from "vitest"
import {
	isEmployeeMarketPrimaryActionDisabled,
	isOfficialBuiltinPublisherType,
	isOfficialPublisherType,
	resolveEmployeeMarketPrimaryActionLabel,
	resolvePublisherLabel,
} from "./employee-card-shared"

function createT() {
	return (key: string) => key
}

describe("resolvePublisherLabel", () => {
	it("returns publisher name for user publishers", () => {
		expect(resolvePublisherLabel("USER", "沈思明", createT())).toBe("沈思明")
	})

	it("falls back to localized label when publisher name is missing", () => {
		expect(resolvePublisherLabel("USER", "", createT())).toBe("employeeCard.publisherUser")
	})

	it("keeps official label when publisher name exists", () => {
		expect(resolvePublisherLabel("OFFICIAL", "Any Name", createT())).toBe(
			"skillsLibrary.official",
		)
	})

	it("resolves official builtin label", () => {
		expect(resolvePublisherLabel("OFFICIAL_BUILTIN", "Any Name", createT())).toBe(
			"employeeCard.officialBuiltin",
		)
	})
})

describe("isOfficialPublisherType", () => {
	it("returns true for official publisher", () => {
		expect(isOfficialPublisherType("OFFICIAL")).toBe(true)
	})

	it("returns true for official builtin publisher", () => {
		expect(isOfficialPublisherType("OFFICIAL_BUILTIN")).toBe(true)
	})

	it("returns false for non-official publisher", () => {
		expect(isOfficialPublisherType("USER")).toBe(false)
	})
})

describe("isOfficialBuiltinPublisherType", () => {
	it("returns true only for OFFICIAL_BUILTIN", () => {
		expect(isOfficialBuiltinPublisherType("OFFICIAL_BUILTIN")).toBe(true)
		expect(isOfficialBuiltinPublisherType("OFFICIAL")).toBe(false)
		expect(isOfficialBuiltinPublisherType("USER")).toBe(false)
	})
})

describe("resolveEmployeeMarketPrimaryActionLabel", () => {
	const agent = (overrides: Record<string, unknown>) =>
		({
			publisherType: "USER",
			isAdded: false,
			allowDelete: false,
			...overrides,
		}) as import("@/services/crew/CrewService").StoreAgentView

	it("prioritizes official builtin", () => {
		expect(
			resolveEmployeeMarketPrimaryActionLabel(
				agent({ publisherType: "OFFICIAL_BUILTIN", isAdded: true, allowDelete: false }),
				createT(),
			),
		).toBe("employeeCard.officialBuiltin")
	})

	it("uses hire when market agent can be hired", () => {
		expect(resolveEmployeeMarketPrimaryActionLabel(agent({}), createT())).toBe("hire")
	})
})

describe("isEmployeeMarketPrimaryActionDisabled", () => {
	const agent = (overrides: Record<string, unknown>) =>
		({
			publisherType: "USER",
			isAdded: false,
			allowDelete: false,
			...overrides,
		}) as import("@/services/crew/CrewService").StoreAgentView

	it("disables hire for official builtin", () => {
		expect(
			isEmployeeMarketPrimaryActionDisabled(
				agent({ publisherType: "OFFICIAL_BUILTIN", allowDelete: false }),
			),
		).toBe(true)
	})

	it("does not disable dismiss for official builtin", () => {
		expect(
			isEmployeeMarketPrimaryActionDisabled(
				agent({ publisherType: "OFFICIAL_BUILTIN", allowDelete: true }),
			),
		).toBe(false)
	})
})
