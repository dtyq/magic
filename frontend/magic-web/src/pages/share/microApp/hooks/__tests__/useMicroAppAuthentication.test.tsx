import { act, renderHook } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import MagicModal from "@/components/base/MagicModal"
import { userStore } from "@/models/user"
import { authEventBus } from "@/services/auth/AuthEventBus"
import { AuthEventName } from "@/services/auth/AuthEvents"
import { useMicroAppAuthentication } from "../useMicroAppAuthentication"

const dialog = vi.hoisted(() => ({ destroy: vi.fn() }))
vi.mock("@/components/base/MagicModal", () => ({
	default: { confirm: vi.fn(() => dialog) },
}))
vi.mock("@/models/user", () => ({ userStore: { user: { authorization: "" } } }))
vi.mock("@/services/auth/AuthEventBus", () => ({ authEventBus: { emit: vi.fn() } }))
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }))

describe("useMicroAppAuthentication", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		userStore.user.authorization = ""
	})

	it("allows an authenticated action without a dialog", async () => {
		userStore.user.authorization = "token"
		const { result } = renderHook(useMicroAppAuthentication)
		await expect(result.current()).resolves.toBeUndefined()
		expect(MagicModal.confirm).not.toHaveBeenCalled()
		expect(authEventBus.emit).not.toHaveBeenCalled()
	})

	it("keeps the page on cancellation and allows another attempt", async () => {
		const { result } = renderHook(useMicroAppAuthentication)
		const attempt = result.current().catch((error: Error) => error.message)
		expect(authEventBus.emit).not.toHaveBeenCalled()
		act(() => vi.mocked(MagicModal.confirm).mock.calls[0][0].onCancel?.())
		expect(await attempt).toBe("Authentication required")
		expect(authEventBus.emit).not.toHaveBeenCalled()
		const retry = result.current().catch((error: Error) => error.message)
		expect(MagicModal.confirm).toHaveBeenCalledTimes(2)
		act(() => vi.mocked(MagicModal.confirm).mock.calls[1][0].onCancel?.())
		await retry
	})

	it("shares confirmation across concurrent actions and redirects only after confirmation", async () => {
		const { result } = renderHook(useMicroAppAuthentication)
		const attempts = [result.current(), result.current()].map((request) =>
			request.catch((error: Error) => error.message),
		)
		expect(MagicModal.confirm).toHaveBeenCalledTimes(1)
		expect(authEventBus.emit).not.toHaveBeenCalled()
		act(() => vi.mocked(MagicModal.confirm).mock.calls[0][0].onOk?.())
		expect(await Promise.all(attempts)).toEqual([
			"Authentication required",
			"Authentication required",
		])
		expect(authEventBus.emit).toHaveBeenCalledExactlyOnceWith(AuthEventName.RequestLogin, {
			reason: "manual",
			source: "share",
			returnTo: window.location.href,
			preserveQuery: true,
		})
	})

	it("closes an unmounted app's dialog without navigating or leaving pending actions", async () => {
		const { result, unmount } = renderHook(useMicroAppAuthentication)
		const attempt = result.current().catch((error: Error) => error.message)
		const onOk = vi.mocked(MagicModal.confirm).mock.calls[0][0].onOk
		unmount()
		expect(await attempt).toBe("Authentication required")
		expect(dialog.destroy).toHaveBeenCalledTimes(1)
		onOk?.()
		expect(authEventBus.emit).not.toHaveBeenCalled()
	})
})
