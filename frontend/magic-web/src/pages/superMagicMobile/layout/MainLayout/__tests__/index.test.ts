import { describe, expect, it } from "vitest"

import { resolveEmbeddedShellState } from "../resolveEmbeddedShellState"

describe("resolveEmbeddedShellState", () => {
	it.each([
		["/demo/super/micro-apps", "mobile-micro-apps-page"],
		["/demo/super/micro-apps/list", "mobile-micro-apps-list-page"],
		["/demo/super/micro-app/project-1", "mobile-micro-app-detail-page"],
	])("uses the mobile shell without the legacy header for %s", (pathname, testIdPrefix) => {
		expect(resolveEmbeddedShellState(pathname)).toEqual({
			enabled: true,
			activeView: "microApps",
			testIdPrefix,
			showMainHeader: false,
		})
	})

	it("uses the mobile shell without the legacy header for the AI canvas home", () => {
		expect(resolveEmbeddedShellState("/demo/super/ai-canvas")).toEqual({
			enabled: true,
			activeView: "aiCanvas",
			testIdPrefix: "mobile-ai-canvas-page",
			showMainHeader: false,
		})
	})

	it.each([
		"/demo/super/research",
		"/demo/super/research/personas",
		"/demo/super/research/templates",
		"/demo/super/research/studies",
		// A study id must not fall through to the generic project routes.
		"/demo/super/research/100000000000009005",
	])("uses the mobile shell without the legacy header for AI research %s", (pathname) => {
		expect(resolveEmbeddedShellState(pathname)).toEqual({
			enabled: true,
			activeView: "personaResearch",
			testIdPrefix: "mobile-persona-research-page",
			showMainHeader: false,
		})
	})
})
