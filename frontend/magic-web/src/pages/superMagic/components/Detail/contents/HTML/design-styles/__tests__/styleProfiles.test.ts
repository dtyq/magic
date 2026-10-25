import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"
import { filterDesignStyles, type DesignStyleCatalog } from "../catalog"
import { STYLE_PROFILES } from "../styleProfiles"

const catalog = JSON.parse(
	readFileSync(resolve(process.cwd(), "public/html-design-style/catalog.json"), "utf8"),
) as DesignStyleCatalog

describe("design style profiles", () => {
	it("maps every catalog style exactly once", () => {
		const catalogCodes = catalog.styles.map((style) => style.code).sort()
		const profileCodes = STYLE_PROFILES.map((profile) => profile.code).sort()

		expect(new Set(profileCodes).size).toBe(profileCodes.length)
		expect(profileCodes).toEqual(catalogCodes)
	})

	it("provides usable bilingual content and explicit visual direction", () => {
		for (const profile of STYLE_PROFILES) {
			expect(profile.name.zh.trim(), profile.code).not.toBe("")
			expect(profile.name.en.trim(), profile.code).not.toBe("")
			expect(profile.description.zh.trim(), profile.code).not.toBe("")
			expect(profile.description.en.trim(), profile.code).not.toBe("")
			expect(profile.features.length, profile.code).toBeGreaterThanOrEqual(3)
			expect(profile.sourceSection.trim(), profile.code).not.toBe("")
		}
	})

	it("finds a style by either localized name", () => {
		const profile = STYLE_PROFILES.find((item) => item.name.zh !== item.name.en)
		expect(profile).toBeDefined()
		const style = catalog.styles.find((item) => item.code === profile?.code)
		expect(style).toBeDefined()

		expect(filterDesignStyles(catalog.styles, profile?.name.zh ?? "", "all")).toContain(style)
		expect(filterDesignStyles(catalog.styles, profile?.name.en ?? "", "all")).toContain(style)
	})
})
