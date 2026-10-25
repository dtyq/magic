import { test, expect, type Page } from "@playwright/test"
import {
	expectHeaderAction,
	openWidgetHost,
	widgetConfig,
	widgetFrame,
} from "./helpers/widget-harness"

/** Opens the fixture group after its root row becomes visible in the virtual list. */
async function openBusinessChartsGroup(page: Page): Promise<void> {
	const frame = widgetFrame(page)
	await frame.getByTestId("super-message-editor-at-button").click()
	const scroller = frame.getByTestId("virtuoso-scroller")
	await expect(scroller).toBeVisible()
	await expect(frame.getByRole("option").first()).toBeVisible()
	await expect
		.poll(() => scroller.evaluate((element) => element.scrollHeight > element.clientHeight))
		.toBe(true)
	// Custom groups follow built-in entries, so scroll the root list before entering it.
	await scroller.evaluate((element) => {
		element.scrollTop = element.scrollHeight
	})
	const group = frame.getByRole("option").filter({ hasText: "Business charts" })
	await expect(group).toBeVisible()
	await group.locator("button").click()
}

test.describe("Magic Widget SDK contract", () => {
	test.beforeEach(async ({ page }) => {
		test.skip(!process.env.WIDGET_E2E_APP_URL, "Set WIDGET_E2E_APP_URL for SDK contract E2E")
		await openWidgetHost(page)
	})

	test("renders all standard Header actions inside iframe", async ({ page }) => {
		for (const action of [
			"message-header-fullscreen-button",
			"message-header-pin-window-button",
			"message-header-new-topic-button",
			"message-header-history-button",
			"message-header-share-button",
			"message-header-menu-button",
			"message-header-close-button",
		]) {
			await expectHeaderAction(page, action)
		}
		await expect(page.locator(".magic-widget-close")).toHaveCount(0)
	})

	test("routes representative Header callbacks to the host fixture", async ({ page }) => {
		const actionTestIds = {
			fullscreen: "message-header-fullscreen-button",
			pin: "message-header-pin-window-button",
			newTopic: "message-header-new-topic-button",
			history: "message-header-history-button",
			share: "message-header-share-button",
			more: "message-header-menu-button",
		} as const
		for (const action of Object.keys(actionTestIds) as Array<keyof typeof actionTestIds>) {
			await expectHeaderAction(page, actionTestIds[action])
			// Send the valid iframe protocol request directly so callback coverage is independent of Agent permissions.
			await page.evaluate((headerAction) => {
				const iframe = document
					.querySelector("[data-magic-widget-root]")
					?.shadowRoot?.querySelector("iframe")
				if (!iframe?.contentWindow) throw new Error("Widget iframe is unavailable")
				const iframeUrl = new URL(iframe.src)
				const event = new MessageEvent("message", {
					origin: new URL(new URLSearchParams(location.search).get("appUrl") ?? "")
						.origin,
					source: iframe.contentWindow,
					data: {
						protocol: "magic-widget",
						version: 1,
						instanceId: iframeUrl.searchParams.get("magicWidgetInstanceId"),
						requestId: `test-header-action-${headerAction}`,
						type: "header_action",
						action: headerAction,
						context: {
							action: headerAction,
							topicId: "topic-fixture",
							topicName: "Topic fixture",
						},
					},
				})
				Object.defineProperty(event, "source", {
					configurable: true,
					value: iframe.contentWindow,
				})
				window.dispatchEvent(event)
			}, action)
			await expect(page.getByTestId("callback-result")).toHaveText(
				JSON.stringify({ action, hasTopicId: true, hasTopicName: true }),
			)
		}
	})

	test("applies Header visibility rules and keeps close inside the iframe", async ({ page }) => {
		await page.getByTestId("mount-selective-header").click()
		const frame = widgetFrame(page)
		await expectHeaderAction(page, "message-header-new-topic-button")
		for (const action of [
			"message-header-fullscreen-button",
			"message-header-pin-window-button",
			"message-header-history-button",
			"message-header-share-button",
			"message-header-close-button",
		]) {
			await expect(frame.getByTestId(action)).toHaveCount(0)
		}
		await expect(frame.getByTestId("message-header-new-topic-button")).toBeVisible()
		await expect(frame.getByTestId("message-header-menu-button")).toBeVisible()
		await expect(page.locator(".magic-widget-close")).toHaveCount(0)

		await page.getByTestId("mount-hidden-header").click()
		const hiddenConfig = await widgetConfig(page)
		expect(hiddenConfig.header).toEqual({ visible: false })
		await expect(frame.getByTestId("message-header-container")).toHaveCount(0)
	})

	test("serializes panel and bottom capability configuration into the iframe contract", async ({
		page,
	}) => {
		await page.getByTestId("mount-minimal-capabilities").click()
		const config = await widgetConfig(page)
		expect(config.panel).toEqual({
			projectFiles: false,
			uploadFiles: false,
			otherProjectFiles: false,
			digitalEmployees: false,
			microApps: false,
			workflows: false,
			connectors: false,
			skills: false,
			canvasElements: false,
		})
		expect(config.bottom).toEqual({
			internetSearch: { enabled: false, buttonVisible: false },
			plugin: { enabled: false, buttonVisible: false },
			upload: { enabled: false, buttonVisible: false },
			voice: { enabled: false, buttonVisible: false },
		})
	})

	test("serializes layout, conversation, responsive, Header, and window customization", async ({
		page,
	}) => {
		await page.getByTestId("mount-config-matrix").click()
		const config = await widgetConfig(page)

		expect(config.layout).toBe("desktop")
		expect(config.shell).toEqual({ appSidebar: true })
		expect(config.conversation).toEqual({
			projectFiles: true,
			topicHistory: false,
			autoHire: true,
			previewMode: "fullscreen",
		})
		expect(config.responsive).toEqual({ mobileDetection: "device-and-viewport" })
		expect(config.window).toEqual({ closable: false })
		expect(config.header).toEqual({
			visible: true,
			title: "Configured Mock Assistant",
			topicName: { mode: "static", text: "Configured Mock Topic" },
			actions: {
				fullscreen: true,
				pin: true,
				newTopic: true,
				history: true,
				share: true,
				more: true,
			},
		})
		await page.getByTestId("mount-mobile-config").click()
		const mobileConfig = await widgetConfig(page)
		expect(mobileConfig.layout).toBe("mobile")
		expect(mobileConfig.responsive).toEqual({ mobileDetection: "device-and-viewport" })
	})

	test("renders configured Header labels and applies topic and close visibility", async ({
		page,
	}) => {
		await page.getByTestId("mount-header-labels").click()
		const frame = widgetFrame(page)
		await expectHeaderAction(page, "message-header-fullscreen-button")
		await expect(frame.getByTestId("message-header-topic-name")).toContainText(
			"Configured Mock Assistant",
		)
		await expect(frame.getByTestId("message-header-topic-name")).toContainText(
			"Configured Mock Topic",
		)
		await expect(frame.getByTestId("message-header-history-button")).toHaveCount(0)
		await expect(frame.getByTestId("message-header-close-button")).toHaveCount(0)
	})

	test("supports floating open, close, and destroy lifecycle", async ({ page }) => {
		await page.getByTestId("mount-floating").click()
		const layer = page.locator("[data-magic-widget-panel-layer]")
		await expect(layer).toHaveAttribute("data-state", "closed")
		await page.getByTestId("open-widget").click()
		await expect(layer).toHaveAttribute("data-state", "open")
		await page.getByTestId("close-widget").click()
		await expect(layer).toHaveAttribute("data-state", "closed")
		await page.getByTestId("destroy-widget").click()
		await expect(page.locator("[data-magic-widget-root]")).toHaveCount(0)
	})

	test("closes inline after a successful host close callback", async ({ page }) => {
		await page.getByTestId("close-callback-success").click()
		await page.getByTestId("mount-inline").click()
		// Remount can land on the dev update boundary; wait until close is actually mounted before clicking.
		await expectHeaderAction(page, "message-header-close-button")
		const frame = widgetFrame(page)
		await frame.getByTestId("message-header-close-button").click({ force: true })
		await expect(page.getByTestId("callback-result")).toHaveText(
			JSON.stringify({ action: "close:success", hasTopicId: true, hasTopicName: true }),
		)
		await expect(page.locator("[data-magic-widget-panel-layer]")).toHaveAttribute(
			"data-state",
			"closed",
		)
	})

	test("closes inline even when the host close callback rejects", async ({ page }) => {
		await page.getByTestId("close-callback-failure").click()
		await page.getByTestId("mount-inline").click()
		// Remount can land on the dev update boundary; wait until close is actually mounted before clicking.
		await expectHeaderAction(page, "message-header-close-button")
		const frame = widgetFrame(page)
		await frame.getByTestId("message-header-close-button").click({ force: true })
		await expect(page.getByTestId("callback-result")).toHaveText(
			JSON.stringify({ action: "close:failure", hasTopicId: true, hasTopicName: true }),
		)
		await expect(page.locator("[data-magic-widget-panel-layer]")).toHaveAttribute(
			"data-state",
			"closed",
		)
	})

	test("forwards agent readiness and preview fullscreen state events to the host", async ({
		page,
	}) => {
		await expect(page.getByTestId("event-result")).toContainText("agent-ready")
		await page.getByTestId("emit-preview-fullscreen").click()
		await expect(page.getByTestId("event-result")).toContainText("preview-fullscreen:true")
		await page.getByTestId("emit-preview-inline").click()
		await expect(page.getByTestId("event-result")).toContainText("preview-fullscreen:false")
	})

	test("supports input commands without reloading the iframe", async ({ page }) => {
		const before = await page.locator("iframe").getAttribute("src")
		await page.getByTestId("update-config").click()
		await expect(page.locator("iframe")).toHaveAttribute("src", before ?? "")
		await expect(page.getByTestId("status")).toContainText("update-config:success")
		await expect(widgetFrame(page).getByTestId("message-header-share-button")).toHaveCount(0)
		await page.getByTestId("set-input").click()
		await expect(page.getByTestId("status")).toContainText("set-input:success")
		await page.getByTestId("append-input").click()
		await expect(page.getByTestId("status")).toContainText("append-input:success")
		await page.getByTestId("get-input").click()
		await expect(page.getByTestId("status")).toContainText(
			"get-input:Mock input from host + appended",
		)
		await page.getByTestId("clear-input").click()
		await expect(page.getByTestId("status")).toContainText("clear-input:success")
	})

	test("inserts, replaces, and rejects custom Mention groups without reloading", async ({
		page,
	}) => {
		const before = await page.locator("iframe").getAttribute("src")
		const frame = widgetFrame(page)

		await openBusinessChartsGroup(page)
		const initialItem = frame
			.getByTestId("mention-panel-menu-item")
			.filter({ hasText: "Chart A" })
		await expect(initialItem).toBeVisible()
		await initialItem.click()
		await expect(frame.getByTestId("super-message-editor-content")).toContainText("@Chart A")
		await expect(frame.getByTestId("super-message-editor-at-button")).toHaveAttribute(
			"data-visible",
			"false",
		)
		await expect(page.locator("iframe")).toHaveAttribute("src", before ?? "")

		await page.getByTestId("update-dynamic-content").click()
		await expect(page.getByTestId("status")).toHaveText("update-dynamic-content:success")
		await expect(page.locator("iframe")).toHaveAttribute("src", before ?? "")
		await page.getByTestId("clear-input").click()
		await expect(page.getByTestId("status")).toContainText("clear-input:success")

		await openBusinessChartsGroup(page)
		await frame.getByTestId("mention-panel-menu-item").filter({ hasText: "Chart B" }).click()
		await expect(frame.getByTestId("super-message-editor-content")).toContainText("@Chart B")
		await expect(page.locator("iframe")).toHaveAttribute("src", before ?? "")
		await page.getByTestId("append-input").click()
		await expect(page.getByTestId("status")).toContainText("append-input:success")
		await page.getByTestId("get-input").click()
		await expect(page.getByTestId("status")).toContainText("get-input:@Chart B + appended")

		await page.getByTestId("update-invalid-dynamic-content").click()
		await expect(page.getByTestId("status")).toHaveText(
			"update-invalid-dynamic-content:INVALID_CONFIG",
		)
		await expect(page.locator("iframe")).toHaveAttribute("src", before ?? "")

		// The rejected snapshot must keep the last valid replacement selectable.
		await page.getByTestId("clear-input").click()
		await expect(page.getByTestId("status")).toContainText("clear-input:success")
		await openBusinessChartsGroup(page)
		await frame.getByTestId("mention-panel-menu-item").filter({ hasText: "Chart B" }).click()
		await expect(frame.getByTestId("super-message-editor-content")).toContainText("@Chart B")
		await expect(page.locator("iframe")).toHaveAttribute("src", before ?? "")
	})

	test("finds a custom Mention by semantic text in global search", async ({ page }) => {
		const frame = widgetFrame(page)
		await frame.getByTestId("super-message-editor-at-button").click()
		const searchInput = frame
			.getByRole("searchbox", { name: "Search input area" })
			.locator("input")
		await searchInput.fill("sample quarter")

		const chart = frame.getByTestId("mention-panel-menu-item").filter({ hasText: "Chart A" })
		await expect(chart).toBeVisible()
		await expect(chart).toHaveCount(1)
		await expect(
			frame.getByTestId("mention-panel-menu-item").filter({ hasText: "Unknown business" }),
		).toHaveCount(0)
		await chart.click()
		await expect(frame.getByTestId("super-message-editor-content")).toContainText("@Chart A")
	})

	test("searches only the active custom Mention group by description", async ({ page }) => {
		const frame = widgetFrame(page)
		await openBusinessChartsGroup(page)
		await frame
			.getByRole("searchbox", { name: "Search input area" })
			.locator("input")
			.fill("Fixture description")

		const chart = frame.getByTestId("mention-panel-menu-item").filter({ hasText: "Chart A" })
		await expect(chart).toBeVisible()
		await expect(chart).toHaveCount(1)
		await expect(
			frame.getByTestId("mention-panel-menu-item").filter({ hasText: "Unknown business" }),
		).toHaveCount(0)
		await chart.click()
		await expect(frame.getByTestId("super-message-editor-content")).toContainText("@Chart A")
	})

	test("uses the host callback for global dynamic Mention search and preserves group identity", async ({
		page,
	}) => {
		const frame = widgetFrame(page)
		await frame.getByTestId("super-message-editor-at-button").click()
		const searchInput = frame
			.getByRole("searchbox", { name: "Search input area" })
			.locator("input")
		await searchInput.fill("dynamic report")

		const report = frame
			.getByTestId("mention-panel-menu-item")
			.filter({ hasText: "Dynamic Report" })
		await expect(report).toBeVisible()
		await expect(
			frame.getByTestId("mention-panel-menu-item").filter({ hasText: "Dynamic Chart" }),
		).toHaveCount(0)
		await report.click()
		await expect(frame.getByTestId("super-message-editor-content")).toContainText(
			"@Dynamic Report",
		)
	})

	test("does not surface an aborted search when a newer query supersedes it", async ({
		page,
	}) => {
		const frame = widgetFrame(page)
		await frame.getByTestId("super-message-editor-at-button").click()
		const searchInput = frame
			.getByRole("searchbox", { name: "Search input area" })
			.locator("input")

		// The fixture holds "slow" queries for 1.5s, so this request is still in flight below.
		await searchInput.fill("slow report")
		await expect(frame.getByText(/Loading\.\.\.|加载中\.\.\./).first()).toBeVisible()

		await searchInput.fill("dynamic report")

		const report = frame
			.getByTestId("mention-panel-menu-item")
			.filter({ hasText: "Dynamic Report" })
		await expect(report).toBeVisible()
		// The cancelled request must neither own the result list nor show its cancellation as a failure.
		await expect(
			frame.getByTestId("mention-panel-menu-item").filter({ hasText: "Slow Report" }),
		).toHaveCount(0)
		await expect(frame.getByText("Custom Mention search was aborted")).toHaveCount(0)

		await report.click()
		await expect(frame.getByTestId("super-message-editor-content")).toContainText(
			"@Dynamic Report",
		)
	})

	test("uses the host callback for dynamic search inside a custom Mention group", async ({
		page,
	}) => {
		const frame = widgetFrame(page)
		await openBusinessChartsGroup(page)
		const searchInput = frame
			.getByRole("searchbox", { name: "Search input area" })
			.locator("input")
		await searchInput.fill("dynamic chart")

		const chart = frame
			.getByTestId("mention-panel-menu-item")
			.filter({ hasText: "Dynamic Chart" })
		await expect(chart).toBeVisible()
		await expect(
			frame.getByTestId("mention-panel-menu-item").filter({ hasText: "Dynamic Report" }),
		).toHaveCount(0)
		await chart.click()
		await expect(frame.getByTestId("super-message-editor-content")).toContainText(
			"@Dynamic Chart",
		)
	})

	test("renders static and dynamic custom Mention items with iconUrl", async ({ page }) => {
		const frame = widgetFrame(page)
		await frame.getByTestId("super-message-editor-at-button").click()
		const scroller = frame.getByTestId("virtuoso-scroller")
		await expect(scroller).toBeVisible()
		await expect(frame.getByRole("option").first()).toBeVisible()
		await expect
			.poll(() => scroller.evaluate((element) => element.scrollHeight > element.clientHeight))
			.toBe(true)
		await scroller.evaluate((element) => {
			element.scrollTop = element.scrollHeight
		})
		const group = frame.getByRole("option").filter({ hasText: "Business charts" })
		await expect(group).toBeVisible()
		await expect(group.locator("img")).toHaveAttribute(
			"src",
			"https://example.com/icons/group.png",
		)

		// Enter group and verify static item iconUrl
		await group.locator("button").click()
		const chart = frame.getByTestId("mention-panel-menu-item").filter({ hasText: "Chart A" })
		await expect(chart).toBeVisible()
		await expect(chart.locator("img")).toHaveAttribute(
			"src",
			"https://example.com/icons/chart-a.png",
		)

		// Search dynamically and verify dynamic result iconUrl
		const searchInput = frame
			.getByRole("searchbox", { name: "Search input area" })
			.locator("input")
		await searchInput.fill("dynamic chart")
		const dynamicChart = frame
			.getByTestId("mention-panel-menu-item")
			.filter({ hasText: "Dynamic Chart" })
		await expect(dynamicChart).toBeVisible()
		await expect(dynamicChart.locator("img")).toHaveAttribute(
			"src",
			"https://example.com/icons/dynamic.png",
		)
	})

	test("filters custom Mention overflow without interrupting iframe rendering", async ({
		page,
	}) => {
		const before = await page.locator("iframe").getAttribute("src")
		const frame = widgetFrame(page)

		await page.getByTestId("update-overflow-custom-groups").click()
		await expect(page.getByTestId("status")).toHaveText("update-overflow-custom-groups:success")
		await expect(page.getByTestId("event-result")).toContainText(
			"config-warning:CUSTOM_MENTION_FILTERED:1:MAX_ITEMS_PER_GROUP",
		)
		await expect(page.locator("iframe")).toHaveAttribute("src", before ?? "")

		await frame.getByTestId("super-message-editor-at-button").click()
		const scroller = frame.getByTestId("virtuoso-scroller")
		await expect(scroller).toBeVisible()
		await expect(frame.getByRole("option").first()).toBeVisible()
		await expect
			.poll(() => scroller.evaluate((element) => element.scrollHeight > element.clientHeight))
			.toBe(true)
		await scroller.evaluate((element) => {
			element.scrollTop = element.scrollHeight
		})
		await expect(
			frame.getByRole("option").filter({ hasText: "Overflow fixtures" }),
		).toBeVisible()
	})

	test("sets structured text Mentions without reloading the iframe", async ({ page }) => {
		const before = await page.locator("iframe").getAttribute("src")
		const frame = widgetFrame(page)
		await expect(page.getByTestId("event-result")).toContainText("agent-ready")
		await page.getByTestId("set-structured-input").click()
		await expect(page.getByTestId("status")).toContainText("set-structured-input:success")
		await expect(frame.getByTestId("super-message-editor-content")).toContainText(
			"Interpret @Mock Chart",
		)
		await page.getByTestId("get-input").click()
		await expect(page.getByTestId("status")).toContainText("Interpret @Mock Chart")
		await expect(page.locator("iframe")).toHaveAttribute("src", before ?? "")
	})

	test("appends a structured text Mention without reloading the iframe", async ({ page }) => {
		const before = await page.locator("iframe").getAttribute("src")
		await page.getByTestId("clear-input").click()
		await expect(page.getByTestId("status")).toContainText("clear-input:success")
		await page.getByTestId("append-structured-input").click()
		await expect(page.getByTestId("status")).toContainText("append-structured-input:success")
		await expect(page.locator("iframe")).toHaveAttribute("src", before ?? "")
		await page.getByTestId("get-input").click()
		await expect(page.getByTestId("status")).toContainText("@Mock Table")
	})

	test("acknowledges structured sendMessage without replacing the current editor", async ({
		page,
	}) => {
		const frame = widgetFrame(page)
		await page.getByTestId("set-input").click()
		await expect(page.getByTestId("status")).toContainText("set-input:success")
		await expect(frame.getByTestId("super-message-editor-content")).toContainText(
			"Mock input from host",
		)
		await page.getByTestId("send-structured-input").click()
		await expect(page.getByTestId("status")).toContainText("send-structured-input:success")
		await page.getByTestId("get-input").click()
		await expect(page.getByTestId("status")).toContainText("get-input:Mock input from host")
	})

	test("places custom Mention groups with placement 'start' at the top of the root list", async ({
		page,
	}) => {
		const frame = widgetFrame(page)
		await frame.getByTestId("super-message-editor-at-button").click()
		const scroller = frame.getByTestId("virtuoso-scroller")
		await expect(scroller).toBeVisible()

		// The group configured with placement="start" should appear at the top of the root list
		const firstOption = frame.getByRole("option").first()
		await expect(firstOption).toBeVisible()
		await expect(firstOption).toContainText("Priority actions")
	})
})
