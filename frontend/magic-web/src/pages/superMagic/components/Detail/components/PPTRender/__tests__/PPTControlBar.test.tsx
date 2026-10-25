import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { PPTControlBar } from "../PPTControlBar"

vi.mock("react-i18next", () => ({
	initReactI18next: { type: "3rdParty", init: () => undefined },
	useTranslation: () => ({ t: (key: string) => key }),
}))
vi.mock("ahooks", () => ({ useSize: () => ({ width: 1200, height: 40 }) }))
vi.mock("../../FileSaveSyncBadge", () => ({ FileSaveSyncBadge: () => null }))
vi.mock("../PPTControlBar/PPTZoomControl", () => ({
	PPTZoomControl: () => <div data-testid="zoom" />,
}))
vi.mock("@/components/base", () => ({
	MagicTooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
	MagicDropdown: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

const noop = () => undefined
const props = {
	activeIndex: 1,
	totalSlides: 5,
	isTransitioning: false,
	isMobile: false,
	isFullscreen: false,
	isRefreshingCurrentSlide: false,
	onPrevSlide: noop,
	onNextSlide: noop,
	onGoToFirstSlide: noop,
	onRefreshSlides: noop,
	onJumpToPage: noop,
	onToggleFullscreen: noop,
	onReplaceTemplate: noop,
	scaleRatio: 1,
	isAutoScale: true,
	portalContainer: null,
	onScaleChange: noop,
	onResetScale: noop,
}

describe("PPTControlBar", () => {
	it("keeps secondary actions in the more menu on desktop", () => {
		render(<PPTControlBar {...props} />)
		expect(screen.getByTestId("ppt-control-bar-more-button")).toBeInTheDocument()
		for (const id of [
			"ppt-control-bar-refresh-button",
			"ppt-control-bar-refresh-current-button",
			"ppt-control-bar-first-button",
			"ppt-control-bar-template-button",
		])
			expect(screen.queryByTestId(id)).toBeNull()
	})

	it("keeps the home shortcut on mobile and has no more menu", () => {
		render(<PPTControlBar {...props} isMobile />)
		expect(screen.getByTestId("ppt-control-bar-first-button")).toBeInTheDocument()
		expect(screen.queryByTestId("ppt-control-bar-more-button")).toBeNull()
	})

	it("stays clear of a docked side panel", () => {
		render(<PPTControlBar {...props} rightInset="296px" />)
		expect(screen.getByTestId("ppt-control-bar").style.right).toBe("296px")
	})
})
