import { defineConfig, devices } from "@playwright/test"
import { config as loadEnv } from "dotenv"
import { dirname, isAbsolute, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const e2eRoot = dirname(fileURLToPath(import.meta.url))
loadEnv({ path: resolve(e2eRoot, ".env") })

const hostUrl = process.env.WIDGET_E2E_HOST_URL ?? "http://127.0.0.1:4317"
const storageStateSetting = process.env.WIDGET_E2E_STORAGE_STATE
const storageState = storageStateSetting
	? isAbsolute(storageStateSetting)
		? storageStateSetting
		: resolve(e2eRoot, storageStateSetting)
	: undefined
const reportDir = resolve(e2eRoot, "playwright-report")
const testResultsDir = resolve(e2eRoot, "test-results")

/** Configures the standalone headless contract suite and keeps every execution inspectable. */
export default defineConfig({
	testDir: e2eRoot,
	outputDir: testResultsDir,
	// Each test may boot the iframe twice, and each boot can include one update-boundary reload.
	timeout: 90_000,
	expect: { timeout: 5_000 },
	fullyParallel: false,
	// Real iframe tests share one authenticated local dev service; serialize files to avoid SDK-load races.
	workers: 1,
	// Retry intermittent remote iframe failures consistently in local and CI runs.
	retries: 2,
	reporter: [
		["list"],
		[
			"html",
			{
				outputFolder: reportDir,
				open: process.env.CI ? "never" : "always",
			},
		],
	],
	use: {
		baseURL: hostUrl,
		...(storageState ? { storageState } : {}),
		headless: true,
		trace: "on",
		screenshot: "only-on-failure",
		video: "on",
	},
	projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
	webServer: {
		command: "node ./serve-fixture.mjs",
		url: `${hostUrl}/healthz`,
		reuseExistingServer: !process.env.CI,
	},
})
