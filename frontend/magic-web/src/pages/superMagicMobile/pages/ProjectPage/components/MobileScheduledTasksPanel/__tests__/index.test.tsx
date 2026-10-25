import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { ScheduledTask } from "@/types/scheduledTask"

import MobileScheduledTasksPanel from ".."

const mocks = vi.hoisted(() => ({
	useScheduleTask: vi.fn(),
	useDropdown: vi.fn(),
	openCreateModal: vi.fn(),
	onSaveTask: vi.fn(),
	onTaskDelete: vi.fn(),
	onTaskRunningRecord: vi.fn(),
	onTaskEdit: vi.fn(),
	onStatusChange: vi.fn(),
	runNow: vi.fn(),
	setParams: vi.fn(),
	run: vi.fn(),
}))

vi.mock("react-i18next", () => ({
	useTranslation: () => ({ t: (key: string) => key }),
}))

vi.mock("@/components/business/AccountSetting/pages/ScheduledTasks/hooks/useScheduleTask", () => ({
	useScheduleTask: mocks.useScheduleTask,
}))

vi.mock("@/pages/superMagic/components/SuperMagicDropdown/useSuperMagicDropdown", () => ({
	default: mocks.useDropdown,
}))

vi.mock("@/components/base-mobile/MagicPullToRefresh", () => ({
	default: ({
		children,
		onRefresh,
	}: {
		children: React.ReactNode
		onRefresh: () => Promise<void>
	}) => (
		<div data-testid="mobile-scheduled-tasks-pull-to-refresh">
			<button
				type="button"
				data-testid="mobile-scheduled-tasks-refresh-trigger"
				onClick={() => void onRefresh()}
			>
				refresh
			</button>
			{children}
		</div>
	),
}))

vi.mock("@/components/base-mobile/ScrollEdgeFade", () => ({
	ScrollEdgeFadeContainer: ({
		children,
		onScroll,
	}: {
		children: React.ReactNode
		onScroll?: React.UIEventHandler<HTMLDivElement>
	}) => (
		<div data-testid="mobile-scheduled-tasks-scroll-port" onScroll={onScroll}>
			{children}
		</div>
	),
}))

/** Creates deterministic synthetic task data for panel behavior tests. */
function createMockTask(): ScheduledTask.Task {
	return {
		id: "mock-task-id",
		enabled: 1,
		task_name: "Mock scheduled task",
		time_config: { type: ScheduledTask.ScheduleType.Daily, time: "09:30" },
		topic_name: "Mock topic",
	} as ScheduledTask.Task
}

/** Configures the shared hook mock with optional list overrides. */
function setupScheduleTaskHook(overrides: Partial<ReturnType<typeof mocks.useScheduleTask>> = {}) {
	mocks.useScheduleTask.mockReturnValue({
		tasks: [],
		total: 0,
		params: { page: 1, page_size: 20 },
		setParams: mocks.setParams,
		run: mocks.run,
		loading: false,
		hasFetched: false,
		openCreateModal: mocks.openCreateModal,
		content: null,
		onSaveTask: mocks.onSaveTask,
		onTaskDelete: mocks.onTaskDelete,
		onTaskRunningRecord: mocks.onTaskRunningRecord,
		onTaskEdit: mocks.onTaskEdit,
		onStatusChange: mocks.onStatusChange,
		preloadDeleteDangerModal: vi.fn(),
		preloadRunningRecordModal: vi.fn(),
		runNow: mocks.runNow,
		...overrides,
	})
}

describe("MobileScheduledTasksPanel", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		setupScheduleTaskHook()
		mocks.useDropdown.mockReturnValue({ dropdownContent: null, delegateProps: {} })
	})

	it("queries the current project and prefills its context when creating", () => {
		render(
			<MobileScheduledTasksPanel
				selectWorkspaceId="mock-workspace-id"
				selectProjectId="mock-project-id"
				selectTopicId="mock-topic-id"
			/>,
		)

		expect(mocks.useScheduleTask).toHaveBeenCalledWith(
			expect.objectContaining({
				options: {
					page_size: 20,
					workspace_id: "mock-workspace-id",
					project_id: "mock-project-id",
				},
				isScroll: true,
			}),
		)

		const createButton = screen.getByTestId("mobile-scheduled-tasks-create-button")
		// Keep the create FAB visually aligned with the project-detail files add button.
		expect(createButton).toHaveClass("h-12", "w-12", "rounded-full", "bg-foreground")
		fireEvent.click(createButton)

		expect(mocks.openCreateModal).toHaveBeenCalledWith(mocks.onSaveTask, {
			workspace_id: "mock-workspace-id",
			project_id: "mock-project-id",
			topic_id: "mock-topic-id",
		})
	})

	it("opens editing from a card and loads the next page near the bottom", () => {
		const task = createMockTask()
		setupScheduleTaskHook({
			tasks: [task],
			total: 2,
			params: { page: 1, page_size: 20 },
			hasFetched: true,
		})

		render(
			<MobileScheduledTasksPanel
				selectWorkspaceId="mock-workspace-id"
				selectProjectId="mock-project-id"
			/>,
		)

		fireEvent.click(screen.getByTestId("mobile-scheduled-task-card"))
		expect(mocks.onTaskEdit).toHaveBeenCalledWith(task)
		// Bottom padding lets the last card scroll above the floating add button.
		expect(screen.getByTestId("mobile-scheduled-tasks-list")).toHaveClass("pb-24")

		const scrollPort = screen.getByTestId("mobile-scheduled-tasks-scroll-port")
		Object.defineProperties(scrollPort, {
			scrollTop: { configurable: true, value: 80 },
			scrollHeight: { configurable: true, value: 200 },
			clientHeight: { configurable: true, value: 120 },
		})
		fireEvent.scroll(scrollPort)

		expect(mocks.setParams).toHaveBeenCalledWith({ page: 2, page_size: 20 })
		expect(mocks.run).toHaveBeenCalledWith({ page: 2, page_size: 20 })
	})

	it("exposes the same action menu as the PC project task panel", () => {
		const task = createMockTask()
		setupScheduleTaskHook({ tasks: [task], total: 1, hasFetched: true })

		render(
			<MobileScheduledTasksPanel
				selectWorkspaceId="mock-workspace-id"
				selectProjectId="mock-project-id"
			/>,
		)

		const dropdownOptions = mocks.useDropdown.mock.calls[0][0]
		const menuItems = dropdownOptions.getMenuItems(task)
		const actionKeys = menuItems
			.filter((item: { key?: string }) => item.key)
			.map((item: { key: string }) => item.key)

		expect(actionKeys).toEqual(["run", "pause", "config", "runningRecord", "delete"])
	})

	it("shows loading instead of empty before the first request finishes", () => {
		setupScheduleTaskHook({
			tasks: [],
			total: 0,
			loading: false,
			hasFetched: false,
		})

		render(
			<MobileScheduledTasksPanel
				selectWorkspaceId="mock-workspace-id"
				selectProjectId="mock-project-id"
			/>,
		)

		expect(screen.getByTestId("mobile-scheduled-tasks-loading")).toBeInTheDocument()
		expect(screen.queryByTestId("mobile-scheduled-tasks-empty")).not.toBeInTheDocument()
	})

	it("shows empty only after a finished request returns no tasks", () => {
		setupScheduleTaskHook({
			tasks: [],
			total: 0,
			loading: false,
			hasFetched: true,
		})

		render(
			<MobileScheduledTasksPanel
				selectWorkspaceId="mock-workspace-id"
				selectProjectId="mock-project-id"
			/>,
		)

		expect(screen.getByTestId("mobile-scheduled-tasks-empty")).toBeInTheDocument()
		expect(screen.queryByTestId("mobile-scheduled-tasks-loading")).not.toBeInTheDocument()
	})

	it("keeps the card list visible while a refresh is in flight", () => {
		const task = createMockTask()
		setupScheduleTaskHook({
			tasks: [task],
			total: 1,
			loading: true,
			hasFetched: true,
		})

		render(
			<MobileScheduledTasksPanel
				selectWorkspaceId="mock-workspace-id"
				selectProjectId="mock-project-id"
			/>,
		)

		expect(screen.getByTestId("mobile-scheduled-task-card")).toBeInTheDocument()
		expect(screen.queryByTestId("mobile-scheduled-tasks-loading")).not.toBeInTheDocument()
		expect(screen.queryByTestId("mobile-scheduled-tasks-empty")).not.toBeInTheDocument()
	})

	it("reloads the first page when pull-to-refresh runs", () => {
		const task = createMockTask()
		mocks.run.mockResolvedValue({ list: [task], total: 1 })
		setupScheduleTaskHook({
			tasks: [task],
			total: 1,
			params: { page: 2, page_size: 20 },
			hasFetched: true,
		})

		render(
			<MobileScheduledTasksPanel
				selectWorkspaceId="mock-workspace-id"
				selectProjectId="mock-project-id"
			/>,
		)

		fireEvent.click(screen.getByTestId("mobile-scheduled-tasks-refresh-trigger"))

		expect(mocks.setParams).toHaveBeenCalledWith({
			page: 1,
			page_size: 20,
			workspace_id: "mock-workspace-id",
			project_id: "mock-project-id",
		})
		expect(mocks.run).toHaveBeenCalledWith({
			page: 1,
			page_size: 20,
			workspace_id: "mock-workspace-id",
			project_id: "mock-project-id",
		})
	})
})
