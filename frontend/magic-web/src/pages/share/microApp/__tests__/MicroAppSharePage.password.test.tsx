import { fireEvent, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import {
	MICRO_APP_SHARE_PASSWORD_KEY_PREFIX,
	rememberMicroAppShareResource,
} from "../utils/microAppSharePasswordStore"
import {
	getMicroAppSharePageMocks,
	renderPage,
	resetMicroAppSharePageMocks,
} from "./MicroAppSharePage.testUtils"

const mocks = getMicroAppSharePageMocks()
const passwordStorageKey = `${MICRO_APP_SHARE_PASSWORD_KEY_PREFIX}resource-1`

function saveRememberedPassword(password = "remembered") {
	localStorage.setItem(
		passwordStorageKey,
		JSON.stringify({ password, expiresAt: Date.now() + 60_000 }),
	)
}

function dispatchInstallPrompt() {
	fireEvent(
		window,
		Object.assign(new Event("beforeinstallprompt"), {
			prompt: vi.fn().mockResolvedValue(undefined),
			userChoice: Promise.resolve({ outcome: "accepted" as const }),
		}),
	)
}

describe("MicroAppSharePage password storage", () => {
	beforeEach(resetMicroAppSharePageMocks)

	it("uses the URL password and removes only that query parameter after validation", async () => {
		mocks.checkShareResourcePassword.mockResolvedValue({ has_password: true })
		window.history.replaceState({}, "", "/micro-app/app-1?password=abcd1234&source=share")

		renderPage("/micro-app/app-1?password=abcd1234&source=share")

		await waitFor(() => {
			expect(mocks.getShareResource).toHaveBeenCalledWith({
				resource_id: "resource-1",
				password: "abcd1234",
			})
		})
		expect(await screen.findByTestId("micro-app-share-safety-notice")).toBeInTheDocument()
		expect(screen.queryByTestId("mock-html-preview")).not.toBeInTheDocument()
		expect(window.location.search).toBe("?source=share")
		expect(localStorage.getItem(passwordStorageKey)).toBeNull()
	})

	it("automatically validates a remembered micro app password", async () => {
		mocks.checkShareResourcePassword.mockResolvedValue({ has_password: true })
		saveRememberedPassword()

		renderPage()

		await waitFor(() => {
			expect(mocks.getShareResource).toHaveBeenCalledWith({
				resource_id: "resource-1",
				password: "remembered",
			})
		})
		expect(await screen.findByTestId("micro-app-share-safety-notice")).toBeInTheDocument()
	})

	it("removes a remembered password for the password-error business code", async () => {
		mocks.checkShareResourcePassword.mockResolvedValue({ has_password: true })
		mocks.getShareResource.mockRejectedValue({ code: 51306 })
		saveRememberedPassword("outdated")

		renderPage()

		expect(await screen.findByTestId("mock-password-verification")).toBeInTheDocument()
		expect(localStorage.getItem(passwordStorageKey)).toBeNull()
	})

	it("keeps a remembered password after a temporary request failure", async () => {
		mocks.checkShareResourcePassword.mockResolvedValue({ has_password: true })
		mocks.getShareResource.mockRejectedValue({ response: { status: 500 } })
		saveRememberedPassword()

		renderPage()

		expect(await screen.findByTestId("mock-password-verification")).toBeInTheDocument()
		expect(localStorage.getItem(passwordStorageKey)).not.toBeNull()
	})

	it.each([51200, 51302, 51305])(
		"removes a remembered password when the share fails with business code %s",
		async (code) => {
			saveRememberedPassword()
			rememberMicroAppShareResource("app-1", "resource-1")
			mocks.resolvePublishedMicroApp.mockRejectedValue({ code })

			renderPage()

			expect(await screen.findByTestId("mock-error-display")).toBeInTheDocument()
			expect(localStorage.getItem(passwordStorageKey)).toBeNull()
		},
	)

	it("offers to remember a URL password before triggering installation", async () => {
		mocks.checkShareResourcePassword.mockResolvedValue({ has_password: true })
		window.history.replaceState({}, "", "/micro-app/app-1?password=abcd1234")
		renderPage("/micro-app/app-1?password=abcd1234")

		expect(await screen.findByTestId("micro-app-share-safety-notice")).toBeInTheDocument()
		dispatchInstallPrompt()
		fireEvent.click(screen.getByTestId("micro-app-share-safety-confirm"))
		fireEvent.click(await screen.findByTestId("micro-app-share-install"))

		expect(await screen.findByTestId("micro-app-install-dialog")).toBeInTheDocument()
		fireEvent.click(screen.getByTestId("micro-app-install-remember-password"))
		fireEvent.click(screen.getByTestId("micro-app-install-confirm"))

		await waitFor(() => {
			expect(JSON.parse(localStorage.getItem(passwordStorageKey) || "{}").password).toBe(
				"abcd1234",
			)
		})
	})
})
