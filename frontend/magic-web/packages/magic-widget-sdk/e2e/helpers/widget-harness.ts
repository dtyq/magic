import { expect, type Frame, type Page } from "@playwright/test"

/** Matches the global update boundary in both supported UI languages. */
const UPDATE_BOUNDARY_TEXT = /Please Refresh The Page|请刷新页面/

/** Creates the host URL with environment-provided deployment identifiers. */
export function getHostUrl(): string {
	const appUrl = process.env.WIDGET_E2E_APP_URL
	if (!appUrl) throw new Error("WIDGET_E2E_APP_URL is required")

	const query = new URLSearchParams({
		appUrl,
		crewId: process.env.WIDGET_E2E_CREW_ID ?? "crew-e2e-fictional",
		deploymentCode: process.env.WIDGET_E2E_DEPLOYMENT_CODE ?? "deployment-fictional",
		organizationCode: process.env.WIDGET_E2E_ORGANIZATION_CODE ?? "organization-fictional",
	})
	return `/?${query.toString()}`
}

/** Opens the standalone host fixture and waits for the SDK inline iframe. */
export async function openWidgetHost(page: Page): Promise<void> {
	await page.goto(getHostUrl())
	const status = page.getByTestId("status")
	await expect(status).not.toHaveText("sdk-load-failed")
	await expect(status).toContainText("mount-inline:success")
	await expect(page.locator("iframe")).toBeVisible()
	await expectHeaderAction(page, "message-header-fullscreen-button")
	// Input commands target the editor, so wait for its readiness handshake after the Header mounts.
	await expect(page.getByTestId("event-result")).toContainText("agent-ready")
}

/** Returns the Magic Web iframe locator used by all browser assertions. */
export function widgetFrame(page: Page) {
	return page.frameLocator("iframe")
}

/** Reads the serialized SDK config from the iframe URL to verify the host-to-iframe contract. */
export async function widgetConfig(page: Page): Promise<Record<string, unknown>> {
	const src = await page.locator("iframe").getAttribute("src")
	if (!src) throw new Error("Widget iframe src is missing")
	const serialized = new URL(src).searchParams.get("magicWidgetConfig")
	if (!serialized) throw new Error("Widget iframe config is missing")
	return JSON.parse(serialized) as Record<string, unknown>
}

/** Finds the widget document. It is cross-origin, so only Playwright's frame handle can reload it. */
function widgetContentFrame(page: Page): Frame | undefined {
	return page.frames().find((frame) => frame.url().includes("magicWidgetEmbed=1"))
}

/**
 * Reloads a widget that landed on the update boundary.
 * Development builds do not auto-refresh, so one failed lazy import would otherwise end the test.
 */
async function reloadWidgetFrameIfUpdateBoundaryVisible(page: Page): Promise<boolean> {
	const frame = widgetContentFrame(page)
	if (!frame) return false
	const boundaryVisible = await frame.getByText(UPDATE_BOUNDARY_TEXT).first().isVisible()
	if (!boundaryVisible) return false
	// Reload only the embedded document so host callbacks and fixture state remain intact.
	await frame.goto(frame.url(), { waitUntil: "domcontentloaded" })
	return true
}

/** Waits until the iframe Header has mounted and exposes the requested action. */
export async function expectHeaderAction(page: Page, testId: string): Promise<void> {
	let reloadCount = 0
	await expect(async () => {
		// One reload covers a transient dev-server import failure; a second covers the reload itself failing once.
		if (reloadCount < 2 && (await reloadWidgetFrameIfUpdateBoundaryVisible(page))) {
			reloadCount += 1
			throw new Error("Widget iframe showed the update boundary and was reloaded")
		}
		await expect(widgetFrame(page).getByTestId(testId)).toBeVisible()
	}).toPass({ timeout: 30_000 })
}
