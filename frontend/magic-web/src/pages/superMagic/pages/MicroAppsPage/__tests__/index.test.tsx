import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { RouteName } from "@/routes/constants"
import MicroAppsPage from "../index"

const mocks = vi.hoisted(() => ({
	navigate: vi.fn(),
	setScope: vi.fn(),
	setKeyword: vi.fn(),
	refresh: vi.fn(),
	loadMore: vi.fn(),
	renameApp: vi.fn(),
	deleteApp: vi.fn(),
	createMicroAppProject: vi.fn(),
	useMicroAppsPage: vi.fn(),
	t: vi.fn((key: string) => (key === "microAppsPage.heroTitlePrefix" ? "一句话，" : key)),
}))

vi.mock("@/apis", () => ({
	SuperMagicApi: { createMicroAppProject: mocks.createMicroAppProject },
}))

vi.mock("react-i18next", () => ({
	useTranslation: () => ({ t: mocks.t }),
}))

vi.mock("@/routes/hooks/useNavigate", () => ({
	default: () => mocks.navigate,
}))

/**
 * The page hosts the onboarding tour, which reaches into the account store and the real i18n
 * instance. This suite is about the page's own layout, so the tour is stubbed out.
 */
vi.mock("@/pages/superMagic/components/LazyGuideTour", () => ({
	default: () => null,
}))

vi.mock("../hooks/useMicroAppsPage", () => ({
	useMicroAppsPage: mocks.useMicroAppsPage,
	shouldOpenPublishedShare: (scope: string, publishStatus: string) =>
		scope === "accessible" || (scope === "recent" && publishStatus === "published"),
}))

vi.mock("../components/MicroAppCreatePrompt", () => ({
	default: ({
		onCreated,
		onFocusChange,
		keyboardPortRef,
		keyboardConnectorVisible = true,
	}: any) => (
		<>
			{keyboardConnectorVisible ? (
				<span ref={keyboardPortRef} data-testid="micro-apps-keyboard-port" />
			) : null}
			<button
				type="button"
				data-testid="mock-create-prompt"
				onClick={() => onCreated("app-new")}
				onFocus={() => onFocusChange?.(true)}
				onBlur={() => onFocusChange?.(false)}
			>
				create
			</button>
		</>
	),
}))

vi.mock("../components/MicroAppFloatingBackdrop", () => ({
	default: ({ active }: { active?: boolean }) => (
		<div data-testid="mock-floating-backdrop" data-active={active} />
	),
}))

vi.mock("../components/MicroAppCard", () => ({
	default: ({
		title,
		description,
		coverUrl,
		statusLabel,
		canDelete,
		canRename,
		canManageCollaborators,
		onClick,
		testId,
	}: any) => (
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
			<span>{statusLabel}</span>
		</button>
	),
}))

vi.mock("@/components/shadcn-ui/tabs", async () => {
	const React = await import("react")
	const TabsContext = React.createContext<{ onValueChange?: (value: string) => void }>({})

	return {
		Tabs: ({ children, onValueChange, ...props }: any) =>
			React.createElement(
				TabsContext.Provider,
				{ value: { onValueChange } },
				React.createElement("div", props, children),
			),
		TabsList: ({ children, ...props }: any) => React.createElement("div", props, children),
		TabsTrigger: ({ children, value, ...props }: any) => {
			const context = React.useContext(TabsContext)
			return React.createElement(
				"button",
				{ type: "button", ...props, onClick: () => context.onValueChange?.(value) },
				children,
			)
		},
	}
})

describe("MicroAppsPage", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		mocks.createMicroAppProject.mockResolvedValue({ app_id: "app-direct" })
		mocks.t.mockImplementation((key: string) =>
			key === "microAppsPage.heroTitlePrefix" ? "一句话，" : key,
		)
		mocks.useMicroAppsPage.mockReturnValue({
			workspace: { id: "workspace-1", name: "Micro Apps" },
			apps: [
				{
					app_id: "app-1",
					app_name: "客户跟进助手",
					app_description: "客户跟进与提醒工具",
					creator_id: "user-1",
					cover_url: "https://example.com/cover.png",
					publish_status: "published",
					updated_at: "2026-07-24 10:30:00",
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

	it.each(["micro-apps-direct-create", "micro-apps-gallery-create"])(
		"creates and opens an empty app from %s even in recent scope",
		async (testId) => {
			mocks.useMicroAppsPage.mockReturnValue({ ...mocks.useMicroAppsPage(), scope: "recent" })
			render(<MicroAppsPage />)
			fireEvent.click(screen.getByTestId(testId))
			await waitFor(() =>
				expect(mocks.navigate).toHaveBeenCalledWith({
					name: RouteName.MicroApp,
					params: { appId: "app-direct" },
				}),
			)
			expect(mocks.createMicroAppProject).toHaveBeenCalledExactlyOnceWith({
				workspace_id: "workspace-1",
			})
		},
	)

	it("disables both entry points while creating", async () => {
		let finish: (value: { app_id: string }) => void = () => {}
		mocks.createMicroAppProject.mockReturnValue(
			new Promise((resolve) => {
				finish = resolve
			}),
		)
		render(<MicroAppsPage />)
		fireEvent.click(screen.getByTestId("micro-apps-direct-create"))
		expect(screen.getByTestId("micro-apps-direct-create")).toBeDisabled()
		expect(screen.getByTestId("micro-apps-gallery-create")).toBeDisabled()
		fireEvent.click(screen.getByTestId("micro-apps-gallery-create"))
		finish({ app_id: "app-direct" })
		await waitFor(() => expect(mocks.navigate).toHaveBeenCalled())
		expect(mocks.createMicroAppProject).toHaveBeenCalledTimes(1)
	})

	it("hides collaborator management when the public hook is disabled", () => {
		render(<MicroAppsPage />)

		expect(screen.getByTestId("micro-apps-app-app-1")).toHaveAttribute(
			"data-can-manage-collaborators",
			"false",
		)
	})

	it("hides rename for read-only micro apps", () => {
		mocks.useMicroAppsPage.mockReturnValueOnce({
			...mocks.useMicroAppsPage(),
			apps: [
				{
					app_id: "app-viewer",
					app_name: "只读应用",
					app_description: "",
					creator_id: "user-1",
					cover_url: "",
					publish_status: "published",
					updated_at: null,
					can_delete: false,
					project_id: "project-viewer",
					user_role: "viewer",
				},
			],
		})

		render(<MicroAppsPage />)

		expect(screen.getByTestId("micro-apps-app-app-viewer")).toHaveAttribute(
			"data-can-rename",
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
					publish_status: "published",
					updated_at: null,
					can_delete: false,
					project_id: "project-unknown-role",
				},
			],
		})

		render(<MicroAppsPage />)

		expect(screen.getByTestId("micro-apps-app-app-unknown-role")).toHaveAttribute(
			"data-can-rename",
			"false",
		)
	})

	it("opens an app directly by app_id", async () => {
		render(<MicroAppsPage />)

		expect(screen.getByTestId("micro-apps-keyboard-cable")).toBeInTheDocument()
		expect(screen.getByTestId("micro-apps-keyboard-port")).toBeInTheDocument()
		expect(screen.getByTestId("micro-apps-page")).toHaveAttribute("data-slot", "scroll-area")
		expect(
			screen
				.getByTestId("micro-apps-page")
				.querySelector('[data-slot="scroll-area-viewport"]'),
		).toBeInTheDocument()
		const appCard = screen.getByTestId("micro-apps-app-app-1")
		expect(appCard).toHaveAttribute("data-cover-url", "https://example.com/cover.png")
		expect(appCard).toHaveAttribute("data-can-delete", "false")
		expect(within(appCard).getByText("客户跟进与提醒工具")).toBeInTheDocument()
		expect(within(appCard).getByText("microAppsPage.statusPublished")).toBeInTheDocument()
		fireEvent.click(appCard)

		await waitFor(() => {
			expect(mocks.navigate).toHaveBeenCalledWith({
				name: RouteName.MicroApp,
				params: { appId: "app-1" },
			})
		})
	})

	it("hides the keyboard cable when the translated title has no visible anchor", () => {
		mocks.t.mockImplementation((key: string) =>
			key === "microAppsPage.heroTitlePrefix" ? "Turn one prompt" : key,
		)

		render(<MicroAppsPage />)

		expect(screen.queryByTestId("micro-apps-keyboard-cable")).not.toBeInTheDocument()
		expect(screen.queryByTestId("micro-app-hero-cable-anchor")).not.toBeInTheDocument()
		expect(screen.queryByTestId("micro-apps-keyboard-port")).not.toBeInTheDocument()
	})

	it("changes scope, searches, and loads more", () => {
		render(<MicroAppsPage />)

		fireEvent.click(screen.getByTestId("micro-apps-scope-collaborated"))
		fireEvent.change(screen.getByTestId("micro-apps-search"), {
			target: { value: "客户" },
		})
		fireEvent.click(screen.getByTestId("micro-apps-search-results-load-more"))

		expect(mocks.setScope).toHaveBeenCalledWith("collaborated")
		expect(mocks.setKeyword).not.toHaveBeenCalled()
		expect(mocks.useMicroAppsPage).toHaveBeenCalledWith(
			expect.objectContaining({ searchAll: true, keyword: "客户", enabled: true }),
		)
		expect(screen.getByTestId("micro-apps-scroll")).not.toBeVisible()
		expect(screen.getByTestId("micro-apps-search-results-scroll")).toBeVisible()
		fireEvent.keyDown(screen.getByTestId("micro-apps-search"), { key: "Escape" })
		expect(screen.getByTestId("micro-apps-scroll")).toBeVisible()
		expect(screen.queryByTestId("micro-apps-search-results-scroll")).not.toBeInTheDocument()
		expect(mocks.loadMore).toHaveBeenCalled()
	})

	it("keeps existing apps visible and retries only the failing panel", () => {
		const development = { ...mocks.useMicroAppsPage(), loadMoreError: new Error("offline") }
		const access = { ...development, loadMoreError: null, loadMore: vi.fn() }
		mocks.useMicroAppsPage.mockImplementation((options?: { initialScope?: string }) =>
			options?.initialScope === "recent" ? access : development,
		)
		render(<MicroAppsPage />)
		expect(screen.getByTestId("micro-apps-app-app-1")).toBeVisible()
		expect(screen.getByRole("alert")).toHaveTextContent("microAppsPage.loadMoreFailed")
		fireEvent.click(screen.getByTestId("micro-apps-load-more"))
		expect(mocks.loadMore).toHaveBeenCalledTimes(1)
		expect(access.loadMore).not.toHaveBeenCalled()
		expect(screen.getByTestId("micro-apps-scroll")).toHaveAttribute("data-slot", "scroll-area")
		expect(screen.getByTestId("micro-apps-access-scroll")).toHaveAttribute(
			"data-slot",
			"scroll-area",
		)
	})

	it("hides redundant development filters in a personal organization", () => {
		mocks.useMicroAppsPage.mockReturnValue({
			...mocks.useMicroAppsPage(),
			availableScopes: ["all", "created", "accessible", "recent"],
		})

		render(<MicroAppsPage />)

		expect(screen.queryByTestId("micro-apps-scope-collaborated")).not.toBeInTheDocument()
		expect(screen.queryByTestId("micro-apps-scope-all")).not.toBeInTheDocument()
		expect(screen.queryByTestId("micro-apps-scope-created")).not.toBeInTheDocument()
		expect(screen.getByTestId("micro-apps-access-scope-accessible")).toBeInTheDocument()
		expect(screen.getByTestId("micro-apps-access-scope-recent")).toBeInTheDocument()
	})

	it("switches to the accessible scope tab", () => {
		render(<MicroAppsPage />)

		fireEvent.click(screen.getByTestId("micro-apps-access-scope-accessible"))

		expect(mocks.setScope).toHaveBeenCalledWith("accessible")
	})

	it.each([
		[
			"accessible",
			"microAppsPage.publishedEmptyTitle",
			"microAppsPage.publishedEmptyDescription",
		],
		["recent", "microAppsPage.recentEmptyTitle", "microAppsPage.recentEmptyDescription"],
	])("shows distinct empty content for the %s tab", (scope, title, description) => {
		mocks.useMicroAppsPage.mockReturnValue({
			...mocks.useMicroAppsPage(),
			scope,
			apps: [],
		})

		render(<MicroAppsPage />)
		expect(
			within(screen.getByRole("region", { name: "microAppsPage.accessTitle" })).queryByTestId(
				"micro-app-state-empty",
			),
		).not.toBeInTheDocument()

		expect(
			within(screen.getByRole("region", { name: "microAppsPage.accessTitle" })).getByText(
				title,
			),
		).toBeInTheDocument()
		expect(
			within(screen.getByRole("region", { name: "microAppsPage.accessTitle" })).getByText(
				description,
			),
		).toBeInTheDocument()
	})

	it("opens an accessible app in the published share window", () => {
		const openSpy = vi.spyOn(window, "open").mockImplementation(() => null)
		mocks.useMicroAppsPage.mockReturnValue({
			...mocks.useMicroAppsPage(),
			scope: "accessible",
		})

		render(<MicroAppsPage />)
		fireEvent.click(screen.getByTestId("micro-apps-app-app-1"))

		expect(openSpy).toHaveBeenCalledWith("/micro-app/app-1", "_blank", "noopener,noreferrer")
		expect(mocks.navigate).not.toHaveBeenCalled()
		openSpy.mockRestore()
	})

	it("opens an unpublished recent app in the editor", () => {
		const openSpy = vi.spyOn(window, "open").mockImplementation(() => null)
		mocks.useMicroAppsPage.mockReturnValue({
			...mocks.useMicroAppsPage(),
			scope: "recent",
			apps: [
				{
					...mocks.useMicroAppsPage().apps[0],
					publish_status: "unpublished",
				},
			],
		})

		render(<MicroAppsPage />)
		fireEvent.click(screen.getByTestId("micro-apps-app-app-1"))

		expect(mocks.navigate).toHaveBeenCalledWith({
			name: RouteName.MicroApp,
			params: { appId: "app-1" },
		})
		expect(openSpy).not.toHaveBeenCalled()
		openSpy.mockRestore()
	})

	it("enters the new app after the creation prompt returns app_id", async () => {
		render(<MicroAppsPage />)

		fireEvent.click(screen.getByTestId("mock-create-prompt"))

		await waitFor(() => {
			expect(mocks.navigate).toHaveBeenCalledWith({
				name: RouteName.MicroApp,
				params: { appId: "app-new" },
			})
		})
	})
})
