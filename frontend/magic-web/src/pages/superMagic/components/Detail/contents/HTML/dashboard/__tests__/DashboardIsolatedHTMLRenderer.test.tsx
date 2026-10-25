import { act, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import DashboardIsolatedHTMLRenderer from "../DashboardIsolatedHTMLRenderer"

vi.mock("@/utils/env", () => ({
	env: vi.fn(() => ""),
}))

vi.mock("@/pages/superMagic/fileAccess/fileApi", () => ({
	useFileApi: () => ({ getTemporaryDownloadUrl: vi.fn() }),
}))

vi.mock("antd-style", () => ({
	createStyles: () => () => ({
		styles: {
			rendererContainer: "renderer-container",
			iframe: "iframe",
			loadingContainer: "loading-container",
		},
		cx: (...classes: Array<string | undefined>) => classes.filter(Boolean).join(" "),
	}),
}))

vi.mock("@/components/base/MagicSpin", () => ({
	default: () => null,
}))

vi.mock("../utils", () => ({
	findDataJsFile: vi.fn(async () => null),
	extractCardsFromDataJs: vi.fn(() => []),
	saveDashboardAndDataJs: vi.fn(async () => undefined),
	validateDashboardCards: vi.fn(() => true),
	injectDashboardHTMLScript: (content: string) => content,
}))

vi.mock("../../utils/full-content", () => ({
	decodeHTMLEntities: (content: string) => content,
}))

vi.mock("../../utils/virtual-storage", () => ({
	buildHtmlVirtualStorageNamespace: () => "dashboard:test",
	createVirtualStorageContext: vi.fn(async () => ({
		protocol: "magic-html-virtual-storage",
		renderId: "render-1",
		token: "token-1",
		namespace: "dashboard:test",
		targetOrigin: window.location.origin,
		snapshot: {
			localStorage: {},
			sessionStorage: {},
			cookies: {},
			indexedDB: {},
		},
	})),
	getVirtualStorageBridgeScript: () => "",
	virtualStorageRegistry: {
		register: vi.fn(),
		unregister: vi.fn(),
	},
}))

describe("DashboardIsolatedHTMLRenderer iframe permissions", () => {
	it("enables presentation and low-risk media capabilities", async () => {
		render(<DashboardIsolatedHTMLRenderer content="<html><body>dashboard</body></html>" />)
		await act(async () => {
			await Promise.resolve()
			await Promise.resolve()
		})

		const iframe = screen.getByTestId("html-content-iframe")
		const sandboxTokens = iframe.getAttribute("sandbox")?.split(/\s+/) ?? []
		const allowedFeatures = iframe
			.getAttribute("allow")
			?.split(";")
			.map((feature) => feature.trim())
			.filter(Boolean)

		expect(sandboxTokens).toEqual(
			expect.arrayContaining(["allow-orientation-lock", "allow-presentation"]),
		)
		expect(allowedFeatures).toEqual(
			expect.arrayContaining([
				"fullscreen",
				"autoplay",
				"picture-in-picture",
				"encrypted-media",
				"web-share",
				"clipboard-write",
			]),
		)
	})
})
