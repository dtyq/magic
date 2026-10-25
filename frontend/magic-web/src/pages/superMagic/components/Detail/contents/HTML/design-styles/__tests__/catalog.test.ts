import { describe, expect, it, vi } from "vitest"
import {
	filterDesignStyles,
	getDesignStyleCategories,
	loadDesignStyleCatalog,
	resetDesignStyleCatalogCache,
} from "../catalog"
import { designStyleFixture } from "./fixtures"

const catalog = {
	format: "design-md",
	formatVersion: 1,
	styles: [designStyleFixture],
}

describe("HTML design style catalog", () => {
	it("filters and categorizes design systems", () => {
		expect(filterDesignStyles([designStyleFixture], "fixture", "all")).toEqual([
			designStyleFixture,
		])
		expect(filterDesignStyles([designStyleFixture], "", "featured")).toEqual([
			designStyleFixture,
		])
		expect(getDesignStyleCategories([designStyleFixture]).map(({ code }) => code)).toEqual([
			"all",
			"featured",
			"design",
		])
	})

	it("loads and caches the public catalog", async () => {
		resetDesignStyleCatalogCache()
		const fetchMock = vi
			.fn()
			.mockResolvedValue(new Response(JSON.stringify(catalog), { status: 200 }))
		vi.stubGlobal("fetch", fetchMock)

		await expect(loadDesignStyleCatalog()).resolves.toEqual(catalog)
		await expect(loadDesignStyleCatalog()).resolves.toEqual(catalog)
		expect(fetchMock).toHaveBeenCalledTimes(1)
		expect(fetchMock).toHaveBeenCalledWith(
			"/html-design-style/catalog.json",
			expect.objectContaining({ headers: { Accept: "application/json" } }),
		)
		vi.unstubAllGlobals()
	})

	it("rejects an invalid catalog response", async () => {
		resetDesignStyleCatalogCache()
		vi.stubGlobal(
			"fetch",
			vi
				.fn()
				.mockResolvedValue(new Response(JSON.stringify({ styles: [] }), { status: 200 })),
		)

		await expect(loadDesignStyleCatalog()).rejects.toThrow("Invalid HTML design style catalog")
		vi.unstubAllGlobals()
	})

	it("rejects section values that cannot be rendered as preview text", async () => {
		resetDesignStyleCatalogCache()
		const invalidStyle = {
			...designStyleFixture,
			design: { ...designStyleFixture.design, sections: { Overview: 42 } },
		}
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue(
				new Response(JSON.stringify({ ...catalog, styles: [invalidStyle] }), {
					status: 200,
				}),
			),
		)

		await expect(loadDesignStyleCatalog()).rejects.toThrow("Invalid HTML design style catalog")
		vi.unstubAllGlobals()
	})
})
