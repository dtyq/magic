import { fireEvent, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
	getMicroAppSharePageMocks,
	renderPage,
	resetMicroAppSharePageMocks,
} from "./MicroAppSharePage.testUtils"

const mocks = getMicroAppSharePageMocks()
const originalUserAgent = navigator.userAgent
const originalPlatform = navigator.platform
const originalMaxTouchPoints = navigator.maxTouchPoints
const originalMatchMedia = window.matchMedia

function setNavigatorValue(key: string, value: unknown) {
	Object.defineProperty(navigator, key, { configurable: true, value })
}

function dispatchInstallPrompt(outcome: "accepted" | "dismissed" = "accepted") {
	const prompt = vi.fn().mockResolvedValue(undefined)
	fireEvent(
		window,
		Object.assign(new Event("beforeinstallprompt"), {
			prompt,
			userChoice: Promise.resolve({ outcome }),
		}),
	)
	return prompt
}

async function confirmSafetyNotice() {
	expect(await screen.findByTestId("micro-app-share-safety-notice")).toBeInTheDocument()
	fireEvent.click(screen.getByTestId("micro-app-share-safety-confirm"))
}

describe("MicroAppSharePage installation", () => {
	beforeEach(() => {
		resetMicroAppSharePageMocks()
		window.matchMedia = vi.fn().mockReturnValue({ matches: false })
	})

	afterEach(() => {
		setNavigatorValue("userAgent", originalUserAgent)
		setNavigatorValue("platform", originalPlatform)
		setNavigatorValue("maxTouchPoints", originalMaxTouchPoints)
		window.matchMedia = originalMatchMedia
	})

	it("shows the install action only after safety confirmation and hides it after installation", async () => {
		renderPage()
		expect(await screen.findByTestId("micro-app-share-safety-notice")).toBeInTheDocument()
		const prompt = dispatchInstallPrompt()
		expect(screen.queryByTestId("micro-app-share-install")).not.toBeInTheDocument()

		fireEvent.click(screen.getByTestId("micro-app-share-safety-confirm"))
		fireEvent.click(await screen.findByTestId("micro-app-share-install"))

		await waitFor(() => expect(prompt).toHaveBeenCalledTimes(1))
		await waitFor(() => {
			expect(screen.queryByTestId("micro-app-share-install")).not.toBeInTheDocument()
		})
	})

	it("shows iOS manual installation instructions", async () => {
		setNavigatorValue(
			"userAgent",
			"Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1",
		)
		renderPage()

		await confirmSafetyNotice()
		fireEvent.click(await screen.findByTestId("micro-app-share-install"))

		expect(await screen.findByTestId("micro-app-install-dialog")).toHaveTextContent(
			"microAppShare.installIosDescription",
		)
		expect(screen.getByText("microAppShare.installIosStepShare")).toBeInTheDocument()
		expect(screen.getByText("microAppShare.installIosStepHome")).toBeInTheDocument()
	})

	it("shows browser and copy actions inside an embedded WebView", async () => {
		setNavigatorValue(
			"userAgent",
			"Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/UQ1A; wv) AppleWebKit/537.36 Version/4.0 Chrome/124.0 Mobile Safari/537.36 MicroMessenger/8.0",
		)
		renderPage()

		await confirmSafetyNotice()
		fireEvent.click(await screen.findByTestId("micro-app-share-install"))

		expect(await screen.findByTestId("micro-app-install-dialog")).toHaveTextContent(
			"microAppShare.installWebViewDescription",
		)
		expect(screen.getByText("microAppShare.copyLink")).toBeInTheDocument()
		expect(screen.getByText("microAppShare.openInBrowser")).toBeInTheDocument()
	})

	it("hides the install action in standalone mode", async () => {
		window.matchMedia = vi.fn().mockReturnValue({ matches: true })
		renderPage()

		await confirmSafetyNotice()

		expect(screen.queryByTestId("micro-app-share-install")).not.toBeInTheDocument()
		expect(mocks.getShareResource).toHaveBeenCalledTimes(1)
	})
})
