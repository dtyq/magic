import type { ButtonHTMLAttributes, HTMLAttributes, PropsWithChildren, ReactNode } from "react"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { RouteName } from "@/routes/constants"
import MicroAppsListPageMobile from "../list.mobile"

const mocks = vi.hoisted(() => ({
	navigate: vi.fn(),
	setScope: vi.fn(),
	setKeyword: vi.fn(),
	refresh: vi.fn(),
	loadMore: vi.fn(),
	renameApp: vi.fn(),
	deleteApp: vi.fn(),
	useMicroAppsPage: vi.fn(),
	t: (key: string) => key,
}))

interface MockMicroAppCardProps {
	title: string
	description?: string
	meta?: string
	coverUrl?: string
	statusLabel?: string
	canDelete?: boolean
	canRename?: boolean
	canManageCollaborators?: boolean
	onClick: () => void
	testId: string
}

vi.mock("react-i18next", () => ({
	useTranslation: () => ({ t: mocks.t }),
}))

vi.mock("@/routes/hooks/useNavigate", () => ({
	default: () => mocks.navigate,
}))

vi.mock("../hooks/useMicroAppsPage", () => ({
	useMicroAppsPage: mocks.useMicroAppsPage,
	shouldOpenPublishedShare: (scope: string, publishStatus: string) =>
		scope === "accessible" || (scope === "recent" && publishStatus === "published"),
}))

vi.mock("../components/MicroAppCard", () => ({
	default: ({
		title,
		description,
		meta,
		coverUrl,
		statusLabel,
		canDelete,
		canRename,
		canManageCollaborators,
		onClick,
		testId,
	}: MockMicroAppCardProps) => (
		<button
			type="button"
			data-testid={testId}
			data-cover-url={coverUrl}
			data-can-delete={canDelete}
			data-can-rename={canRename}
			data-can-manage-collaborators={canManageCollaborators}
			onClick={onClick}
		>
			{title}
			<span>{description}</span>
			<span>{meta}</span>
			<span>{statusLabel}</span>
		</button>
	),
}))

vi.mock("@/components/shadcn-ui/tabs", async () => {
	const React = await import("react")
	const TabsContext = React.createContext<{ onValueChange?: (value: string) => void }>({})
	return {
		Tabs: ({
			children,
			onValueChange,
			...props
		}: PropsWithChildren<
			HTMLAttributes<HTMLDivElement> & { onValueChange?: (value: string) => void }
		>) => (
			<TabsContext.Provider value={{ onValueChange }}>
				<div {...props}>{children}</div>
			</TabsContext.Provider>
		),
		TabsList: ({ children, ...props }: PropsWithChildren<HTMLAttributes<HTMLDivElement>>) => (
			<div {...props}>{children}</div>
		),
		TabsTrigger: ({
			children,
			value,
			...props
		}: PropsWithChildren<ButtonHTMLAttributes<HTMLButtonElement> & { value: string }>) => {
			const context = React.useContext(TabsContext)
			return (
				<button type="button" {...props} onClick={() => context.onValueChange?.(value)}>
					{children}
				</button>
			)
		},
	}
})

vi.mock("@/components/base-mobile/ScrollEdgeFade", () => ({
	ScrollEdgeFadeContainer: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}))

describe("MicroAppsListPageMobile", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		mocks.useMicroAppsPage.mockReturnValue({
			workspace: { id: "workspace-1", name: "Micro Apps" },
			apps: [
				{
					app_id: "app-1",
					app_name: "客户跟进助手",
					app_description: "客户跟进与提醒工具",
					creator_id: "user-1",
					cover_url: "",
					publish_status: "unpublished",
					updated_at: null,
					can_delete: false,
					project_id: "project-1",
					user_role: "manage",
				},
			],
			scope: "all",
			availableScopes: ["all", "created", "collaborated", "accessible", "recent"],
			setScope: mocks.setScope,
			keyword: "",
			setKeyword: mocks.setKeyword,
			loading: false,
			loadingMore: false,
			hasMore: true,
			error: null,
			refresh: mocks.refresh,
			loadMore: mocks.loadMore,
			renameApp: mocks.renameApp,
			deleteApp: mocks.deleteApp,
		})
	})

	it("hides collaborator management when the public hook is disabled", () => {
		render(<MicroAppsListPageMobile />)

		expect(screen.getByTestId("micro-apps-mobile-app-app-1")).toHaveAttribute(
			"data-can-manage-collaborators",
			"false",
		)
	})

	it("hides rename when the app role is missing", () => {
		mocks.useMicroAppsPage.mockReturnValueOnce({
			...mocks.useMicroAppsPage(),
			apps: [
				{
					app_id: "app-unknown-role",
					app_name: "未知权限应用",
					app_description: "",
					creator_id: "user-1",
					cover_url: "",
					publish_status: "unpublished",
					updated_at: null,
					can_delete: false,
					project_id: "project-unknown-role",
				},
			],
		})

		render(<MicroAppsListPageMobile />)

		expect(screen.getByTestId("micro-apps-mobile-app-app-unknown-role")).toHaveAttribute(
			"data-can-rename",
			"false",
		)
	})

	it("opens an app directly by app_id", async () => {
		render(<MicroAppsListPageMobile />)

		expect(screen.getByTestId("micro-apps-list-scroll-area")).toHaveAttribute(
			"data-slot",
			"scroll-area",
		)
		expect(screen.getByTestId("micro-apps-mobile-toolbar")).toHaveClass("sticky", "top-0")
		expect(screen.getByTestId("micro-apps-mobile-list")).toHaveClass("grid-cols-1")
		const appCard = screen.getByTestId("micro-apps-mobile-app-app-1")
		expect(appCard).toHaveAttribute("data-can-delete", "false")
		expect(screen.getByText("客户跟进与提醒工具")).toBeInTheDocument()
		expect(screen.getByText("microAppsPage.statusUnpublished")).toBeInTheDocument()
		fireEvent.click(appCard)

		await waitFor(() => {
			expect(mocks.navigate).toHaveBeenCalledWith({
				name: RouteName.MicroApp,
				params: { appId: "app-1" },
				viewTransition: false,
			})
		})
	})

	it("opens an unpublished recent app in the editor", () => {
		const openSpy = vi.spyOn(window, "open").mockImplementation(() => null)
		mocks.useMicroAppsPage.mockReturnValue({
			...mocks.useMicroAppsPage(),
			scope: "recent",
		})

		render(<MicroAppsListPageMobile />)
		fireEvent.click(screen.getByTestId("micro-apps-mobile-app-app-1"))

		expect(mocks.navigate).toHaveBeenCalledWith({
			name: RouteName.MicroApp,
			params: { appId: "app-1" },
			viewTransition: false,
		})
		expect(openSpy).not.toHaveBeenCalled()
		openSpy.mockRestore()
	})

	it("changes scope, searches, and loads more", () => {
		render(<MicroAppsListPageMobile />)

		fireEvent.click(screen.getByTestId("micro-apps-mobile-scope-collaborated"))
		fireEvent.change(screen.getByTestId("micro-apps-mobile-search"), {
			target: { value: "客户" },
		})
		fireEvent.click(screen.getByTestId("micro-apps-mobile-load-more"))

		expect(mocks.setScope).toHaveBeenCalledWith("collaborated")
		expect(mocks.setKeyword).toHaveBeenCalledWith("客户")
		expect(mocks.loadMore).toHaveBeenCalled()
	})

	it("hides the collaborated scope in a personal organization", () => {
		mocks.useMicroAppsPage.mockReturnValue({
			...mocks.useMicroAppsPage(),
			availableScopes: ["all", "created", "accessible", "recent"],
		})

		render(<MicroAppsListPageMobile />)

		expect(screen.queryByTestId("micro-apps-mobile-scope-collaborated")).not.toBeInTheDocument()
		expect(screen.getByTestId("micro-apps-mobile-scope-all")).toBeInTheDocument()
		expect(screen.getByTestId("micro-apps-mobile-scope-created")).toBeInTheDocument()
		expect(screen.getByTestId("micro-apps-mobile-scope-accessible")).toBeInTheDocument()
		expect(screen.getByTestId("micro-apps-mobile-scope-recent")).toBeInTheDocument()
	})

	it("switches to the accessible scope tab", () => {
		render(<MicroAppsListPageMobile />)

		fireEvent.click(screen.getByTestId("micro-apps-mobile-scope-accessible"))

		expect(mocks.setScope).toHaveBeenCalledWith("accessible")
	})

	it("returns to the creation page through history with a route fallback", () => {
		render(<MicroAppsListPageMobile />)

		fireEvent.click(screen.getByTestId("micro-apps-mobile-list-back"))

		expect(mocks.navigate).toHaveBeenCalledWith({
			delta: -1,
			viewTransition: { type: "slide", direction: "right" },
		})
	})
})
