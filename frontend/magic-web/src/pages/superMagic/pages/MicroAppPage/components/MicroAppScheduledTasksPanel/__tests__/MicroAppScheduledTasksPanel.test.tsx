import { render, screen } from "@testing-library/react"
import { vi } from "vitest"
import MicroAppScheduledTasksPanel from "../MicroAppScheduledTasksPanel"

const mocks = vi.hoisted(() => ({
	modifyModal: {
		state: { visible: false, mode: "create" as const },
		openCreateModal: vi.fn(),
		openEditModal: vi.fn(),
		closeModal: vi.fn(async () => undefined),
		content: null,
	},
	useModifyModal: vi.fn(),
	useScheduleTaskWithModal: vi.fn(),
}))

vi.mock("react-i18next", async (importOriginal) => {
	const actual = await importOriginal<typeof import("react-i18next")>()
	return {
		...actual,
		useTranslation: () => ({ t: (key: string) => key }),
	}
})

vi.mock("../useMicroAppScheduledTasksModifyModal", () => ({
	useMicroAppScheduledTasksModifyModal: mocks.useModifyModal,
}))

vi.mock("@/components/business/AccountSetting/pages/ScheduledTasks/hooks/useScheduleTask", () => ({
	useScheduleTaskWithModal: mocks.useScheduleTaskWithModal,
}))

vi.mock("@/pages/superMagic/components/SuperMagicDropdown/useSuperMagicDropdown", () => ({
	default: () => ({ dropdownContent: null, delegateProps: {} }),
}))

describe("MicroAppScheduledTasksPanel", () => {
	beforeEach(() => {
		mocks.useModifyModal.mockReturnValue(mocks.modifyModal)
		mocks.useScheduleTaskWithModal.mockReturnValue({
			tasks: [],
			total: 0,
			params: { page: 1, page_size: 20 },
			setParams: vi.fn(),
			run: vi.fn(),
			loading: false,
			openCreateModal: vi.fn(),
			content: null,
			onSaveTask: vi.fn(),
			onTaskDelete: vi.fn(),
			onTaskRunningRecord: vi.fn(),
			onTaskEdit: vi.fn(),
			onStatusChange: vi.fn(),
			preloadDeleteDangerModal: vi.fn(),
			preloadRunningRecordModal: vi.fn(),
			runNow: vi.fn(),
		})
	})

	it("passes the current micro app context to the dedicated modal", () => {
		render(
			<MicroAppScheduledTasksPanel
				selectWorkspaceId="hidden-workspace"
				selectProjectId="project-1"
				selectTopicId="topic-1"
				workspaceName="微应用工作区"
				projectName="当前微应用"
			/>,
		)

		expect(mocks.useModifyModal).toHaveBeenCalledWith({
			workspaceId: "hidden-workspace",
			projectId: "project-1",
			topicId: "topic-1",
			workspaceName: "微应用工作区",
			projectName: "当前微应用",
		})
		expect(mocks.useScheduleTaskWithModal).toHaveBeenCalledWith(
			expect.objectContaining({ modifyModal: mocks.modifyModal }),
		)
		expect(
			screen.getByRole("button", { name: /scheduleTask.createScheduleTask/ }),
		).toBeEnabled()
	})

	it("shows a loading state until workspace and project context are ready", () => {
		render(<MicroAppScheduledTasksPanel />)

		expect(screen.getByTestId("micro-app-scheduled-tasks-context-loading")).toHaveTextContent(
			"scheduleTask.contextLoading",
		)
		expect(
			screen.getByRole("button", { name: /scheduleTask.createScheduleTask/ }),
		).toBeDisabled()
	})

	it("passes the preview identity to the form while querying only the runtime project", () => {
		render(
			<MicroAppScheduledTasksPanel
				selectWorkspaceId="runtime-workspace"
				selectProjectId="runtime-project"
				microAppId="app-1"
				microAppName="My app"
				compact
			/>,
		)
		expect(mocks.useModifyModal).toHaveBeenLastCalledWith(
			expect.objectContaining({
				workspaceId: "runtime-workspace",
				projectId: "runtime-project",
				microAppId: "app-1",
				microAppName: "My app",
			}),
		)
		expect(mocks.useScheduleTaskWithModal).toHaveBeenLastCalledWith(
			expect.objectContaining({
				options: {
					page_size: 20,
					workspace_id: "runtime-workspace",
					project_id: "runtime-project",
				},
			}),
		)
		expect(screen.getByRole("heading", { name: "scheduleTask.title" })).toBeVisible()
		expect(screen.queryByText("scheduleTask.workspaceDescription")).not.toBeInTheDocument()
	})
})
