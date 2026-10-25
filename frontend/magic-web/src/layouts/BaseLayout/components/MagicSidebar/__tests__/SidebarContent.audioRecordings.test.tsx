import { fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { ReactNode } from "react"
import SidebarContent from "../SidebarContent"

const {
	envMock,
	mockIsMagicApp,
	navigateMock,
	changeBottomTabMock,
	useSlidesTemplateStatisticsMock,
} = vi.hoisted(() => ({
	envMock: {
		isPrivateDeployment: false,
	},
	mockIsMagicApp: vi.fn(),
	navigateMock: vi.fn(),
	changeBottomTabMock: vi.fn(),
	useSlidesTemplateStatisticsMock: vi.fn(),
}))
const animatedNumberTextMock = vi.hoisted(() => vi.fn())

afterEach(() => {
	vi.unstubAllGlobals()
	vi.unstubAllEnvs()
})

beforeEach(() => {
	envMock.isPrivateDeployment = false
	vi.stubEnv("MAGIC_MICRO_APP_ENABLED", undefined)
})

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string, options?: Record<string, string | number>) => {
			switch (key) {
				case "slidesTemplates.compactCount":
					return `${options?.value} 套`
				case "slidesTemplates.todayAddedCount":
					return `今日新增 ${options?.value} 套`
				case "slidesTemplates.templateTotalCount":
					return `模板总数 ${options?.value} 套`
				case "slidesTemplates.statisticsTooltip":
					return `${options?.title} · 今日新增 ${options?.todayAdded} 套 · 模板总数 ${options?.total} 套`
				case "slidesTemplates.statisticsTooltipWithoutToday":
					return `${options?.title} · 模板总数 ${options?.total} 套`
				default:
					return key
			}
		},
	}),
	initReactI18next: {
		type: "3rdParty",
		init: () => undefined,
	},
}))

vi.mock("@/assets/locales/locale-adapters", () => ({
	getLocaleModules: () => ({}),
	getAdminLocaleModules: () => ({}),
	loadMagicFlowLocale: vi.fn(),
	loadFallbackLocale: vi.fn(),
}))

vi.mock("react-router", async (importOriginal) => ({
	...(await importOriginal<typeof import("react-router")>()),
	useLocation: () => ({ pathname: "/mock-route" }),
}))

vi.mock("mobx-react-lite", () => ({
	observer: <T,>(component: T) => component,
}))

vi.mock("@/utils/devices", () => ({
	get isMagicApp() {
		return mockIsMagicApp()
	},
}))

vi.mock("@/utils/env", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/utils/env")>()

	return {
		...actual,
		isPrivateDeployment: () => envMock.isPrivateDeployment,
	}
})

vi.mock("@/platform/native", () => ({
	getNativePort: () => ({
		navigation: {
			changeBottomTab: changeBottomTabMock,
		},
	}),
}))

vi.mock("@/pages/superMagic/stores/core/workspace", () => ({
	__esModule: true,
	default: {
		workspaces: [],
		selectedWorkspace: null,
	},
}))

vi.mock("@/pages/superMagic/constants", () => ({
	isCollaborationWorkspace: () => false,
}))

vi.mock("@/routes/hooks/useNavigate", () => ({
	__esModule: true,
	default: () => navigateMock,
}))

vi.mock("@/routes/constants", () => ({
	RouteName: {
		Super: "Super",
		AudioRecordings: "AudioRecordings",
		SuperSlidesTemplates: "SuperSlidesTemplates",
		MicroApps: "MicroApps",
		MicroApp: "MicroApp",
	},
}))

vi.mock("@/routes/history/helpers", () => ({
	getRoutePath: () => "/recordings",
	routesMatch: () => undefined,
	routesPathMatch: () => false,
}))

vi.mock("@/pages/superMagic/utils/clawBrand", () => ({
	getClawBrandTranslationValues: () => ({}),
}))

vi.mock("@/pages/superMagic/hooks/useResourceStatusPolling", () => ({
	__esModule: true,
	default: () => undefined,
}))

vi.mock("@/pages/superMagic/hooks/useSlidesTemplateTotal", () => ({
	useSlidesTemplateStatistics: useSlidesTemplateStatisticsMock,
	useSlidesTemplateTotal: () => useSlidesTemplateStatisticsMock()?.templateTotal,
}))

vi.mock("@/pages/superMagic/components/AnimatedNumberText", () => ({
	AnimatedNumberText: ({ value }: { value: number }) => {
		animatedNumberTextMock(value)
		return <>{value.toLocaleString("en-US")}</>
	},
}))

vi.mock("../hooks/useNavigateToSuperHome", () => ({
	useNavigateToSuperHome: () => ({
		superRouteUrl: "/super",
		handleNavigateToSuperHome: vi.fn(),
	}),
}))

vi.mock("../hooks/useSidebarMarketMenuItems", () => ({
	useSidebarMarketMenuItems: () => [
		{
			titleKey: "sidebar:slidesTemplates.title",
			routeName: "SuperSlidesTemplates",
			testId: "sidebar-content-slides-templates-button",
			Icon: () => <span data-testid="mock-slides-templates-icon" />,
		},
		{
			titleKey: "sidebar:audioRecordings.title",
			routeName: "AudioRecordings",
			testId: "sidebar-content-audio-recordings-button",
			Icon: () => <span data-testid="mock-audio-icon" />,
		},
	],
}))

vi.mock("../WorkspaceList", () => ({
	WorkspaceList: () => <div data-testid="mock-workspace-list" />,
}))

vi.mock("../CollapsedWorkspaceMenu", () => ({
	__esModule: true,
	default: () => <div data-testid="mock-collapsed-menu" />,
}))

vi.mock("../AppsSubMenu", () => ({
	__esModule: true,
	default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}))

vi.mock("../ChatsSubMenu", () => ({
	__esModule: true,
	default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}))

vi.mock("@/components/other/Divider", () => ({
	__esModule: true,
	default: () => <div data-testid="mock-divider" />,
}))

vi.mock("@/components/shadcn-ui/sidebar", () => ({
	SidebarGroup: ({ children, ...props }: { children: ReactNode }) => (
		<div {...props}>{children}</div>
	),
	SidebarGroupContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
	SidebarMenu: ({ children }: { children: ReactNode }) => <div>{children}</div>,
	SidebarMenuItem: ({ children }: { children: ReactNode }) => <div>{children}</div>,
	SidebarMenuButton: (inputProps: {
		children: ReactNode
		asChild?: boolean
		onClick?: () => void
		isActive?: boolean
		tooltip?: string | { children?: ReactNode }
	}) => {
		const { children, asChild, onClick, isActive, tooltip, ...props } = inputProps
		const tooltipContent = typeof tooltip === "string" ? tooltip : tooltip?.children

		void isActive

		return asChild ? (
			<div {...props}>
				{children}
				{tooltipContent}
			</div>
		) : (
			<button type="button" onClick={onClick} {...props}>
				{children}
				{tooltipContent}
			</button>
		)
	},
}))

/**
 * 使用完整 SidebarContent 组件做行为断言，确保录音入口只改点击分流，不改菜单结构。
 */
function renderSidebarContent(collapsed = false) {
	return render(<SidebarContent collapsed={collapsed} />)
}

/**
 * 读取录音入口中的真实 anchor，避免在断言里使用非空断言。
 */
function getAudioRecordingsAnchor() {
	const anchor = screen
		.getByTestId("sidebar-content-audio-recordings-button")
		.querySelector<HTMLAnchorElement>("a")

	if (!anchor) {
		throw new Error("Expected audio recordings anchor to exist")
	}

	return anchor
}

describe("SidebarContent audio recordings entry", () => {
	beforeEach(() => {
		mockIsMagicApp.mockReset()
		mockIsMagicApp.mockReturnValue(false)
		navigateMock.mockReset()
		changeBottomTabMock.mockReset()
	})

	it("keeps desktop route navigation outside Magic App", () => {
		renderSidebarContent()

		fireEvent.click(getAudioRecordingsAnchor())

		expect(navigateMock).toHaveBeenCalledWith({ name: "AudioRecordings" })
		expect(changeBottomTabMock).not.toHaveBeenCalled()
	})

	it("opens the native recording tab inside Magic App instead of navigating to the web page", () => {
		mockIsMagicApp.mockReturnValue(true)

		renderSidebarContent()

		fireEvent.click(getAudioRecordingsAnchor())

		expect(changeBottomTabMock).toHaveBeenCalledWith({
			tab: "ai_recording",
			bottomTabHeight: 0,
		})
		expect(navigateMock).not.toHaveBeenCalled()
	})
})

describe("SidebarContent micro apps entry", () => {
	beforeEach(() => {
		navigateMock.mockReset()
	})

	it("shows the entry outside private deployment", () => {
		renderSidebarContent()

		expect(screen.getByTestId("sidebar-content-micro-apps-button")).toBeVisible()
	})

	it("navigates to the micro apps list", () => {
		renderSidebarContent()

		const anchor = screen
			.getByTestId("sidebar-content-micro-apps-button")
			.querySelector<HTMLAnchorElement>("a")
		if (!anchor) throw new Error("Expected micro apps anchor to exist")

		fireEvent.click(anchor)

		expect(navigateMock).toHaveBeenCalledWith({ name: "MicroApps" })
	})

	it("hides the entry in private deployment", () => {
		envMock.isPrivateDeployment = true

		renderSidebarContent()

		expect(screen.queryByTestId("sidebar-content-micro-apps-button")).toBeNull()
	})

	it("hides the entry when explicitly disabled outside private deployment", () => {
		vi.stubEnv("MAGIC_MICRO_APP_ENABLED", "false")
		renderSidebarContent()
		expect(screen.queryByTestId("sidebar-content-micro-apps-button")).toBeNull()
	})

	it("shows the entry when explicitly enabled in private deployment", () => {
		envMock.isPrivateDeployment = true
		vi.stubEnv("MAGIC_MICRO_APP_ENABLED", "true")
		renderSidebarContent()
		expect(screen.getByTestId("sidebar-content-micro-apps-button")).toBeVisible()
	})
})

describe("SidebarContent slides templates count", () => {
	beforeEach(() => {
		animatedNumberTextMock.mockClear()
		useSlidesTemplateStatisticsMock.mockReset()
		useSlidesTemplateStatisticsMock.mockReturnValue({
			templateTotal: 101582,
			templateCountTodayGrowth: 512,
		})
	})

	it("shows the highlighted template count in the collapsed tooltip", () => {
		renderSidebarContent(true)

		const menuButton = screen.getByTestId("sidebar-content-slides-templates-button")
		expect(menuButton).toHaveClass("!text-[#ff6a1f]", "hover:!bg-[#fff2ec]")
		expect(screen.getByTestId("mock-slides-templates-icon")).toBeVisible()
		expect(menuButton.querySelector("[data-slides-template-label]")).toBeNull()
		expect(screen.queryByTestId("sidebar-content-slides-templates-count")).toBeNull()
		expect(
			screen.getByTestId("sidebar-content-slides-templates-tooltip-title"),
		).toHaveTextContent("sidebar:slidesTemplates.title")
		expect(
			screen.getByTestId("sidebar-content-slides-templates-tooltip-today"),
		).toHaveTextContent("今日新增 512 套")
		expect(
			screen.getByTestId("sidebar-content-slides-templates-tooltip-total"),
		).toHaveTextContent("模板总数 101,582 套")
	})

	it("shows today's growth first and allows the complete count to wrap below the title", () => {
		renderSidebarContent()

		expect(screen.getByTestId("sidebar-content-slides-templates-count")).toHaveTextContent(
			"今日新增512套",
		)
		expect(screen.getByTestId("sidebar-content-slides-templates-count-value")).toBeVisible()
		expect(animatedNumberTextMock).toHaveBeenCalledWith(512)
		const title = screen
			.getByTestId("sidebar-content-slides-templates-button")
			.querySelector<HTMLElement>("[data-slides-template-label]")
		if (!title) throw new Error("Expected the visible slides template title to exist")
		const countBadge = screen.getByTestId("sidebar-content-slides-templates-count")
		const menuButton = screen.getByTestId("sidebar-content-slides-templates-button")
		const row = title.closest("[data-slides-template-row]")
		const content = title.closest("[data-slides-template-content]")
		expect(countBadge.className).not.toMatch(/scale|translate|rotate/)
		expect(countBadge).toHaveClass("rounded-full", "bg-[#fff2ec]")
		expect(title).toHaveClass("shrink-0", "whitespace-nowrap")
		expect(title).not.toHaveClass("flex-1")
		expect(row).not.toHaveClass("flex-wrap")
		expect(content).toHaveClass("flex-wrap", "content-center", "gap-y-0", "min-w-0", "flex-1")
		expect(menuButton).toHaveClass("!h-8", "py-0")
		expect(
			content?.querySelector("[data-testid='sidebar-content-slides-templates-count']"),
		).toBe(countBadge)
		expect(menuButton).not.toHaveClass("!bg-[#fff2ec]")
		expect(screen.queryByTestId("sidebar-content-slides-templates-tooltip")).toBeNull()
	})

	it("restores the count badge after expanding the collapsed sidebar", () => {
		const { rerender } = renderSidebarContent(true)

		rerender(<SidebarContent collapsed={false} />)

		expect(screen.getByTestId("sidebar-content-slides-templates-count")).toHaveTextContent(
			"今日新增512套",
		)
		expect(screen.getByTestId("sidebar-content-slides-templates-count-value")).toBeVisible()
	})

	it("falls back to the total when today's growth is unavailable", () => {
		useSlidesTemplateStatisticsMock.mockReturnValue({ templateTotal: 101582 })

		renderSidebarContent()

		expect(screen.getByTestId("sidebar-content-slides-templates-count")).toHaveTextContent(
			"模板总数101,582套",
		)
		expect(animatedNumberTextMock).toHaveBeenCalledWith(101582)
	})

	it("omits today's growth from the collapsed tooltip when the field is unavailable", () => {
		useSlidesTemplateStatisticsMock.mockReturnValue({ templateTotal: 101582 })

		renderSidebarContent(true)

		expect(
			screen.getByTestId("sidebar-content-slides-templates-tooltip-title"),
		).toHaveTextContent("sidebar:slidesTemplates.title")
		expect(
			screen.getByTestId("sidebar-content-slides-templates-tooltip-total"),
		).toHaveTextContent("模板总数 101,582 套")
		expect(screen.queryByTestId("sidebar-content-slides-templates-tooltip-today")).toBeNull()
		expect(
			screen.getByTestId("sidebar-content-slides-templates-tooltip"),
		).not.toHaveTextContent("今日新增")
	})
})
