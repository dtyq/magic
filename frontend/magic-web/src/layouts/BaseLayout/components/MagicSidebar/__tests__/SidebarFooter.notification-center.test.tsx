import { act, fireEvent, render, screen, within } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import sidebar from "@/assets/locales/zh_CN/sidebar.json"
import SidebarFooter from "../SidebarFooter"

const notificationApi = vi.hoisted(() => ({
	listNotifications: vi.fn(),
	getNotificationCounts: vi.fn(),
	getNotificationTemplates: vi.fn(),
	markNotificationRead: vi.fn(),
	acceptNotification: vi.fn(),
	rejectNotification: vi.fn(),
}))

vi.mock("@/apis", () => ({
	NotificationApi: notificationApi,
}))

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) =>
			sidebar.footer[key.replace("footer.", "") as keyof typeof sidebar.footer] ?? key,
		i18n: { language: "zh_CN" },
	}),
}))

vi.mock("../components", async () => ({
	ActionButtons: (await import("../components/ActionButtons")).default,
	UserInfoCard: () => <div data-testid="mock-user-info-card" />,
}))

vi.mock("@/models/config/hooks", () => ({
	useTheme: () => ({ theme: "light", setTheme: vi.fn() }),
}))

vi.mock("@/utils/env", () => ({
	isDev: false,
	isInternationalEnv: () => false,
	isPrivateDeployment: () => false,
}))

vi.mock("@/routes/hooks/useNavigate", () => ({
	default: () => vi.fn(),
}))

vi.mock("@/components/base", () => ({
	MagicTooltip: ({ children }: { children: React.ReactNode }) => children,
}))

vi.mock("@/infrastructure/logger", () => ({
	logger: {
		createLogger: () => ({
			error: vi.fn(),
			warn: vi.fn(),
			log: vi.fn(),
			report: vi.fn(),
		}),
	},
}))

describe("SidebarFooter inbox entry", () => {
	afterEach(async () => {
		const { notificationCenterStore } =
			await import("@/components/business/NotificationCenter/store")
		await act(async () => notificationCenterStore.reset())
		vi.clearAllMocks()
	})

	it.each([false, true])(
		"renders three icon-only actions when collapsed=%s",
		async (collapsed) => {
			const { notificationCenterStore } =
				await import("@/components/business/NotificationCenter/store")
			notificationCenterStore.reset()
			notificationCenterStore.systemUnread = 11
			notificationCenterStore.authorizationPending = 3
			notificationApi.getNotificationCounts.mockResolvedValue({
				total: 14,
				system_unread: 11,
				authorization_pending: 3,
			})
			notificationApi.getNotificationTemplates.mockResolvedValue({
				locale: "zh-CN",
				catalog_version: 1,
				templates: {},
			})
			notificationApi.listNotifications.mockResolvedValue({
				items: [],
				page_size: 10,
				next_cursor: null,
				has_more: false,
			})
			await act(async () => {
				render(<SidebarFooter collapsed={collapsed} />)
			})

			const buttons = within(screen.getByTestId("sidebar-action-buttons")).getAllByRole(
				"button",
			)
			expect(buttons.map((button) => button.getAttribute("aria-label"))).toEqual([
				"站内信",
				"全局回收站",
				"帮助中心",
			])
			// Text labels must stay hidden even after merging updates to the action menu.
			for (const button of buttons) {
				expect(button.textContent).toBe("")
				expect(button.parentElement).toBe(buttons[0].parentElement)
			}
			expect(buttons[0].parentElement).toHaveClass(collapsed ? "flex-col" : "justify-around")
			expect(screen.getByTestId("inbox-sidebar-badge")).toBeEmptyDOMElement()
			await act(async () => fireEvent.click(buttons[0]))
			expect(notificationCenterStore.visible).toBe(true)
		},
	)
})
