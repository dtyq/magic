import { describe, expect, it } from "vitest"
import { normalizePath } from "../utils"
import { resolveDesignDslPathCandidatesToWorkspaceRelative } from "../designDslPathUtils"

/** 契约测试：DSL / workspace 路径候选展开不因小幅重构静默改变 */
describe("design path contract", () => {
	it("normalizes workspace-relative segments consistently", () => {
		expect(normalizePath("/foo/bar/")).toBe("foo/bar")
		expect(normalizePath("foo/bar")).toBe("foo/bar")
	})

	it("expands dsl candidates for project base", () => {
		const candidates = resolveDesignDslPathCandidatesToWorkspaceRelative(
			"./images/a.png",
			"画布一",
		)
		expect(candidates.length).toBeGreaterThan(0)
		expect(candidates.some((c) => c.includes("images"))).toBe(true)
	})
})
