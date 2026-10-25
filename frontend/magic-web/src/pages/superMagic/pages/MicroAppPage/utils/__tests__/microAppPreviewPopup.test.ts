import { describe, expect, it } from "vitest"
import { shouldOpenMessageFileInFilesWorkspace } from "../microAppPreviewPopup"

describe("shouldOpenMessageFileInFilesWorkspace", () => {
	it("keeps message files in the files workspace during development", () => {
		expect(shouldOpenMessageFileInFilesWorkspace("development")).toBe(true)
	})

	it("opens message files in a popup in preview and published mode", () => {
		expect(shouldOpenMessageFileInFilesWorkspace("preview")).toBe(false)
	})
})
