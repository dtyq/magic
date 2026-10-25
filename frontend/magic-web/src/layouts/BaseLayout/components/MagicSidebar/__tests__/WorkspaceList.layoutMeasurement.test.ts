import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

describe("WorkspaceList floating layout measurement", () => {
	it("waits for a usable Sheet layout before committing virtual project heights", async () => {
		const source = await readFile(
			resolve(
				process.cwd(),
				"src/layouts/BaseLayout/components/MagicSidebar/WorkspaceList/WorkspaceList.tsx",
			),
			"utf8",
		)

		// Protect the lifecycle contract without importing the sidebar's application-wide stores.
		expect(source).toContain("containerHeight")
		expect(source).toContain("window.requestAnimationFrame(measure)")
		expect(source).toContain(
			'scrollArea.closest<HTMLElement>("[data-sidebar-project-navigation]")',
		)
	})
})
