import { expect, test } from "@playwright/test"
import { mkdir } from "node:fs/promises"
import { dirname, isAbsolute, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { expectHeaderAction, getHostUrl, widgetFrame } from "./helpers/widget-harness"

// Treat an intentionally empty environment value as unset so auth setup always writes its default state file.
const e2eRoot = dirname(fileURLToPath(import.meta.url))
const storageStateSetting = process.env.WIDGET_E2E_STORAGE_STATE || ".auth/widget.json"
const storageStatePath = isAbsolute(storageStateSetting)
	? storageStateSetting
	: resolve(e2eRoot, storageStateSetting)

test.describe("@auth Widget authentication setup", () => {
	/** Opens the configured deployment so a user can complete login in a headed browser. */
	test("save interactive Widget authentication state", async ({ page }) => {
		test.setTimeout(0)
		await page.goto(getHostUrl())
		await page.pause()
		// Save only after the authenticated application exposes its real Header, not while the login form is visible.
		await expectHeaderAction(page, "message-header-fullscreen-button")
		await expect(widgetFrame(page).getByText("Private deployment identification code")).toHaveCount(0)
		await mkdir(dirname(storageStatePath), { recursive: true })
		// Magic persists the primary user session in IndexedDB, so cookies/localStorage alone cannot restore login.
		await page.context().storageState({ path: storageStatePath, indexedDB: true })
	})
})
