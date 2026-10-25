import { act, fireEvent, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import {
	HTML_PERMISSION_ANCHOR_ATTRIBUTE,
	requestHtmlPermissionCodeChangeConfirm,
} from "../CodeChangeConfirmPopover"

vi.mock("react-i18next", () => {
	const t = (key: string, options?: Record<string, string>) =>
		options?.scope ? `${key}:${options.scope}` : key
	return { useTranslation: () => ({ t, i18n: { language: "zh_CN" } }) }
})

const REQUEST = { appName: "Demo", scopes: ["fs.project.write" as const] }

afterEach(() => {
	document.body.innerHTML = ""
	vi.unstubAllGlobals()
})

describe("requestHtmlPermissionCodeChangeConfirm", () => {
	it("restores the initiating focus after Escape dismisses the bubble", async () => {
		const trigger = document.createElement("button")
		document.body.appendChild(trigger)
		trigger.focus()
		const pending = requestHtmlPermissionCodeChangeConfirm(REQUEST)
		await screen.findByTestId("html-permission-code-change-confirm")
		expect(document.activeElement).not.toBe(trigger)
		fireEvent.keyDown(window, { key: "Escape" })
		await pending
		await vi.waitFor(() => expect(document.activeElement).toBe(trigger))
	})

	it("keeps an anchored bubble inside a 320px viewport", async () => {
		vi.stubGlobal("innerWidth", 320)
		const anchor = document.createElement("button")
		anchor.setAttribute(HTML_PERMISSION_ANCHOR_ATTRIBUTE, "")
		anchor.getBoundingClientRect = () =>
			({ left: 270, right: 310, top: 20, bottom: 52, width: 40, height: 32 }) as DOMRect
		document.body.appendChild(anchor)
		const pending = requestHtmlPermissionCodeChangeConfirm(REQUEST)
		const bubble = await screen.findByTestId("html-permission-code-change-confirm")
		expect(bubble.style.left).toBe("12px")
		expect(bubble.style.width).toBe("296px")
		fireEvent.keyDown(window, { key: "Escape" })
		await pending
		await vi.waitFor(() => expect(bubble.isConnected).toBe(false))
	})
	it.each([
		["htmlEditor.codeChangeConfirm.deny", "deny"],
		["htmlEditor.codeChangeConfirm.once", "once"],
		["htmlEditor.codeChangeConfirm.remember", "remember"],
	])("resolves with the chosen action: %s", async (label, expected) => {
		const pending = requestHtmlPermissionCodeChangeConfirm(REQUEST)

		fireEvent.click(await screen.findByRole("button", { name: label }))

		await expect(pending).resolves.toBe(expected)
	})

	it("shows the app and the affected permission", async () => {
		const pending = requestHtmlPermissionCodeChangeConfirm(REQUEST)

		const bubble = await screen.findByTestId("html-permission-code-change-confirm")
		expect(bubble).toHaveTextContent("htmlEditor.codeChangeConfirm.title")
		expect(bubble).toHaveTextContent("htmlEditor.codeChangeConfirm.content")
		fireEvent.click(screen.getByRole("button", { name: "htmlEditor.codeChangeConfirm.deny" }))
		await pending
	})

	it("denies when Escape is pressed", async () => {
		const pending = requestHtmlPermissionCodeChangeConfirm(REQUEST)
		await screen.findByTestId("html-permission-code-change-confirm")

		fireEvent.keyDown(window, { key: "Escape" })

		await expect(pending).resolves.toBe("deny")
	})

	it("closes the bubble and denies when the request is aborted", async () => {
		const controller = new AbortController()
		const pending = requestHtmlPermissionCodeChangeConfirm({
			...REQUEST,
			signal: controller.signal,
		})
		await screen.findByTestId("html-permission-code-change-confirm")

		act(() => controller.abort())

		await expect(pending).resolves.toBe("deny")
		await vi.waitFor(() =>
			expect(screen.queryByTestId("html-permission-code-change-confirm")).toBeNull(),
		)
	})

	it("denies immediately for an already aborted request without rendering", async () => {
		const controller = new AbortController()
		controller.abort()

		await expect(
			requestHtmlPermissionCodeChangeConfirm({ ...REQUEST, signal: controller.signal }),
		).resolves.toBe("deny")
		expect(screen.queryByTestId("html-permission-code-change-confirm")).toBeNull()
	})

	it("positions itself under the permission button when one is on screen", async () => {
		const anchor = document.createElement("button")
		anchor.setAttribute(HTML_PERMISSION_ANCHOR_ATTRIBUTE, "")
		anchor.getBoundingClientRect = () =>
			({ left: 700, right: 740, top: 20, bottom: 52, width: 40, height: 32 }) as DOMRect
		document.body.appendChild(anchor)

		const pending = requestHtmlPermissionCodeChangeConfirm(REQUEST)
		const bubble = await screen.findByTestId("html-permission-code-change-confirm")

		expect(bubble.style.top).toBe("62px")
		fireEvent.click(screen.getByRole("button", { name: "htmlEditor.codeChangeConfirm.deny" }))
		await pending
	})
})
