import { describe, expect, it } from "vitest"
import { composeHeaderActions } from "../actions/composer"
import { DetailType } from "../../../types"
import type { ActionContext } from "../types"

function createContext(overrides: Partial<ActionContext> = {}): ActionContext {
	return {
		type: DetailType.Html,
		viewMode: "desktop",
		isMobile: false,
		showButtonText: true,
		isShareRoute: false,
		isFromNode: false,
		isFullscreen: false,
		isEditMode: false,
		detailMode: "files",
		showDownload: true,
		showRefreshButton: true,
		isNewestFileVersion: true,
		allowEdit: true,
		currentFile: {
			id: "file-1",
			name: "index.html",
			type: "html",
		},
		...overrides,
	}
}

describe("composeHeaderActions", () => {
	it("should compose html default actions", () => {
		const actions = composeHeaderActions(createContext())
		const keys = actions
			.filter((item) => item.kind === "builtin")
			.map((item) => (item.kind === "builtin" ? item.key : ""))

		expect(keys).toContain("viewMode")
		expect(keys).toContain("download")
		expect(keys).toContain("share")
		expect(keys).toContain("fullscreen")
		expect(keys).toContain("more")
	})

	it("should include copy action in html code mode", () => {
		const actions = composeHeaderActions(
			createContext({
				viewMode: "code",
			}),
		)
		const keys = actions
			.filter((item) => item.kind === "builtin")
			.map((item) => (item.kind === "builtin" ? item.key : ""))

		expect(keys).toContain("copy")
	})

	it("should hide actions by config", () => {
		const actions = composeHeaderActions(createContext(), {
			hideDefaults: ["share", "copy"],
		})
		const keys = actions
			.filter((item) => item.kind === "builtin")
			.map((item) => (item.kind === "builtin" ? item.key : ""))

		expect(keys).not.toContain("share")
		expect(keys).not.toContain("copy")
	})

	it("should insert custom action before target key", () => {
		const actions = composeHeaderActions(createContext(), {
			customActions: [
				{
					key: "custom-export",
					before: "share",
					render: () => "custom",
				},
			],
		})

		const orderedKeys = actions.map((item) => item.key)
		const customIndex = orderedKeys.indexOf("custom-export")
		const shareIndex = orderedKeys.indexOf("share")

		expect(customIndex).toBeGreaterThanOrEqual(0)
		expect(shareIndex).toBeGreaterThanOrEqual(0)
		expect(customIndex).toBeLessThan(shareIndex)
	})

	it("should not include navigation actions by default", () => {
		const actions = composeHeaderActions(createContext())
		const keys = actions
			.filter((item) => item.kind === "builtin")
			.map((item) => (item.kind === "builtin" ? item.key : ""))

		expect(keys).not.toContain("prev")
		expect(keys).not.toContain("next")
	})
})
