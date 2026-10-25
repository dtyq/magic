import { describe, expect, it } from "vitest"
import { RouteName } from "@/routes/constants"
import { resolveShareErrorBackNavigation } from "../utils/share-error-back"

describe("resolveShareErrorBackNavigation", () => {
	it("sends desktop users to the Super home instead of the site root", () => {
		expect(resolveShareErrorBackNavigation(false)).toEqual({
			name: RouteName.Super,
			replace: true,
			viewTransition: false,
		})
	})

	it("sends mobile users to the mobile home instead of the site root", () => {
		expect(resolveShareErrorBackNavigation(true)).toEqual({
			name: RouteName.MobileHome,
			replace: true,
			viewTransition: false,
		})
	})
})
