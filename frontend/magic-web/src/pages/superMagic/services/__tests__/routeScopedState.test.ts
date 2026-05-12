import { describe, expect, it } from "vitest"
import { RouteName } from "@/routes/constants"
import { isSuperWorkspaceRouteName } from "../routeScopedStateMatcher"

describe("isSuperWorkspaceRouteName", () => {
	it("returns true for super workspace routes", () => {
		expect(isSuperWorkspaceRouteName(RouteName.SuperWorkspaceProjectTopicState)).toBe(true)
	})

	it("returns true for mobile tabs super routes", () => {
		expect(isSuperWorkspaceRouteName(RouteName.MobileTabs, "?tab=super")).toBe(true)
	})

	it("returns true for mobile tabs routes carrying super state", () => {
		expect(
			isSuperWorkspaceRouteName(RouteName.MobileTabs, "?tab=recording&projectId=project-1"),
		).toBe(true)
	})

	it("returns false for non super routes", () => {
		expect(isSuperWorkspaceRouteName(RouteName.MyCrew)).toBe(false)
	})

	it("returns false for mobile tabs on other tabs without super state", () => {
		expect(isSuperWorkspaceRouteName(RouteName.MobileTabs, "?tab=recording")).toBe(false)
	})
})
