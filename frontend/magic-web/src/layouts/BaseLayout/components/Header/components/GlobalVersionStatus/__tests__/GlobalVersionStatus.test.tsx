import { act, render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import GlobalVersionStatus from "../index"

const toastInfo = vi.hoisted(() => vi.fn())

vi.mock("sonner", () => ({ toast: { info: toastInfo } }))
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
vi.mock("../services/VersionService", () => ({
	VersionService: class {
		setCallbacks() {}
		start() {}
		destroy() {}
	},
}))
vi.mock("@/workers/service-worker/register", () => ({
	activateWaitingServiceWorkerAndReload: vi.fn(),
	getAppServiceWorkerRegistration: vi.fn(),
}))

describe("GlobalVersionStatus", () => {
	afterEach(() => toastInfo.mockClear())

	it("shows the new-version toast right away when a lazy chunk fails to preload", () => {
		render(<GlobalVersionStatus />)
		expect(toastInfo).not.toHaveBeenCalled()

		act(() => {
			window.dispatchEvent(new Event("vite:preloadError"))
		})

		expect(toastInfo).toHaveBeenCalledWith(
			"globalServiceStatus.newVersion",
			expect.objectContaining({ id: "global-new-version" }),
		)
	})
})
