import { render } from "@testing-library/react"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
	setMeta: vi.fn(),
	appId: "app-1",
	appName: "First App",
	isMobile: false,
}))

vi.mock("@/routes/hooks/useRoutesMetaSet", () => ({
	default: () => ({ setMeta: mocks.setMeta }),
}))
vi.mock("react-router", () => ({ useParams: () => ({ appId: mocks.appId }) }))
vi.mock("react-i18next", () => ({
	useTranslation: () => ({ t: (key: string) => key }),
}))
vi.mock("@/hooks/useIsMobile", () => ({ useIsMobile: () => mocks.isMobile }))
vi.mock("@/routes/hooks/useNavigate", () => ({ default: () => vi.fn() }))
vi.mock("@/pages/superMagic/providers/FileAccessProvider", () => ({
	FileAccessProvider: ({ children }: { children: ReactNode }) => children,
}))
vi.mock("../hooks/useMicroAppManifestLinks", () => ({ default: vi.fn() }))
vi.mock("../hooks/usePublishedMicroAppPreview", () => ({
	usePublishedMicroAppPreview: () => ({
		displayAppName: mocks.appName,
		fullScreen: false,
		displayModeResolved: true,
		hasConfirmedSafetyNotice: false,
		installFlow: { showInstall: false, dialog: {} },
	}),
}))
vi.mock("../components/PublishedMicroAppPreviewSurface", () => ({ default: () => null }))
vi.mock("../components/MicroAppInstallDialog", () => ({ default: () => null }))
vi.mock("../components/MicroAppShareHeader", () => ({ default: () => null }))

import MicroAppSharePage from "../index"

describe("published micro-app document title", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		mocks.appId = "app-1"
		mocks.appName = "First App"
		mocks.isMobile = false
	})

	it.each([false, true])("uses the current app name with mobile=%s", (isMobile) => {
		mocks.isMobile = isMobile
		const { rerender } = render(<MicroAppSharePage />)
		expect(mocks.setMeta).toHaveBeenLastCalledWith({ title: "First App" })
		mocks.appId = "app-2"
		mocks.appName = "Second App"
		rerender(<MicroAppSharePage />)
		expect(mocks.setMeta).toHaveBeenLastCalledWith({ title: "Second App" })
	})

	it("replaces the previous title while the app name loads", () => {
		mocks.appName = ""
		const { rerender } = render(<MicroAppSharePage />)
		expect(mocks.setMeta).toHaveBeenLastCalledWith({ title: "microAppsPage.unnamedApp" })
		mocks.appName = "Loaded App"
		rerender(<MicroAppSharePage />)
		expect(mocks.setMeta).toHaveBeenLastCalledWith({ title: "Loaded App" })
	})
})
