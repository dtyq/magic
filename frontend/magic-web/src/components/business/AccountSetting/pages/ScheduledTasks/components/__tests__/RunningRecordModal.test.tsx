import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { ScheduledTask } from "@/types/scheduledTask"

const isMobileMock = vi.hoisted(() => ({ value: true }))

vi.mock("react-i18next", () => ({
	useTranslation: () => ({ t: (key: string) => key }),
}))

vi.mock("@/hooks/useIsMobile", () => ({
	useIsMobile: () => isMobileMock.value,
}))

vi.mock("@/components/base/InfiniteList", () => ({
	default: function MockInfiniteList({
		list,
		renderItem,
		isLoading,
		loadMore,
	}: {
		list: unknown[]
		renderItem: (item: unknown, index: number) => React.ReactNode
		isLoading: boolean
		loadMore: () => void
	}) {
		if (isLoading) return <div data-testid="running-record-loading" />

		return (
			<div data-testid="running-record-list">
				<button onClick={loadMore}>Load more</button>
				{list.map((item, index) => (
					<div key={index}>{renderItem(item, index)}</div>
				))}
			</div>
		)
	},
}))

vi.mock("@dtyq/magic-admin", () => ({
	RouteName: {},
	PlatformPackageRoutes: {},
	AiManageRoutes: {},
	otherRoutes: [],
}))

vi.mock("@dtyq/magic-admin/components", () => ({
	StatusTag: ({ children }: { children: React.ReactNode }) => (
		<span data-testid="running-record-status">{children}</span>
	),
}))

vi.mock("@dtyq/magic-admin/provider", () => ({}))

vi.mock("@/pages/superMagic/utils/project", () => ({
	generateProjectTopicUrl: vi.fn(() => "https://mock.example/project"),
}))

vi.mock("@/providers/ThemeProvider/colors", () => ({
	colorUsages: {
		text: ["#000", "#111", "#666"],
	},
}))

vi.mock("@/components/business/AccountSetting/pages/ScheduledTasks/styles", () => ({
	useStyles: () => ({
		styles: {
			headerWrapper: "header-wrapper",
			listItem: "list-item",
			listWrapper: "list-wrapper",
			itemWrapper: "item-wrapper",
			tag: "tag",
			ellipsisText: "ellipsis-text",
			statusTag: "status-tag",
			footer: "footer",
			timeCol: "time-col",
			infoCol: "info-col",
			resultCol: "result-col",
			taskName: "task-name",
			mobileListWrapper: "mobile-list-wrapper",
			mobileListItem: "mobile-list-item",
			mobileItemWrapper: "mobile-item-wrapper",
			mobileMetaRow: "mobile-meta-row",
			mobileTime: "mobile-time",
			mobileStatus: "mobile-status",
			mobileTaskName: "mobile-task-name",
			mobilePath: "mobile-path",
			mobilePathText: "mobile-path-text",
			tagIcon: "tag-icon",
		},
	}),
}))

vi.mock("@/apis", () => ({
	ScheduledTaskApi: {
		getScheduledTaskRunningRecord: vi.fn(),
	},
}))

import { ScheduledTaskApi } from "@/apis"
import RunningRecordModal from "../RunningRecordModal"

/** Builds synthetic running-record data without real workspace or project values. */
function createMockRecord(): ScheduledTask.RunningRecord {
	return {
		executed_at: "2026-08-13 15:00:00",
		task_name: "Mock scheduled task",
		workspace_id: "mock-workspace-id",
		workspace_name: "Mock workspace",
		project_id: "mock-project-id",
		project_name: "Mock project",
		topic_id: "mock-topic-id",
		topic_name: "Mock topic",
		status: ScheduledTask.RunningRecordStatus.Success,
		error_message: "",
	}
}

describe("RunningRecordModal", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		isMobileMock.value = true
		vi.mocked(ScheduledTaskApi.getScheduledTaskRunningRecord).mockResolvedValue({
			total: 1,
			list: [createMockRecord()],
		} as never)
	})

	it("stacks each record on mobile instead of squeezing three table columns", async () => {
		render(<RunningRecordModal taskId="mock-task-id" />)

		const item = await screen.findByTestId("running-record-item")

		expect(item).toHaveAttribute("data-layout", "stacked")
		expect(screen.getByRole("link")).toHaveAttribute("href", "https://mock.example/project")
		expect(screen.getByRole("link")).toHaveAttribute("target", "_blank")
		expect(screen.queryByTestId("running-record-header")).not.toBeInTheDocument()
		expect(screen.getByText("Mock scheduled task")).toBeInTheDocument()
		expect(screen.getByText("Mock workspace / Mock project / Mock topic")).toBeInTheDocument()
		expect(screen.getByTestId("running-record-status")).toBeInTheDocument()
		expect(screen.getByText("2026/08/13 15:00")).toBeInTheDocument()
		expect(screen.getByTestId("running-record-path")).toHaveAttribute("data-path-layout", "bar")
	})

	it("keeps the three-column table layout on desktop", async () => {
		isMobileMock.value = false

		render(<RunningRecordModal taskId="mock-task-id" />)

		await waitFor(() => {
			expect(screen.getByTestId("running-record-header")).toBeInTheDocument()
		})

		expect(screen.getByTestId("running-record-item")).toHaveAttribute("data-layout", "table")
		expect(screen.getByRole("link")).toHaveAttribute("href", "https://mock.example/project")
		expect(screen.getByTestId("running-record-path")).toHaveAttribute(
			"data-path-layout",
			"chip",
		)
		expect(screen.getByText("accountPanel.timedTasks.runningTime")).toBeInTheDocument()
		expect(screen.getByText("accountPanel.timedTasks.runningInfo")).toBeInTheDocument()
		expect(screen.getByText("accountPanel.timedTasks.runningResult")).toBeInTheDocument()
	})
})

it("renders a static path instead of a link when the record has no project", async () => {
	vi.clearAllMocks()
	vi.mocked(ScheduledTaskApi.getScheduledTaskRunningRecord).mockResolvedValue({
		total: 1,
		list: [{ ...createMockRecord(), project_id: "0" }],
	} as never)
	render(<RunningRecordModal taskId="mock-task-id" />)

	const path = await screen.findByTestId("running-record-path")

	expect(path.tagName).toBe("SPAN")
	expect(path).not.toHaveAttribute("href")
	expect(screen.queryByRole("link")).not.toBeInTheDocument()
})

it("keeps records mounted while the next page is pending", async () => {
	vi.clearAllMocks()
	const api = vi.mocked(ScheduledTaskApi.getScheduledTaskRunningRecord)
	let finish!: (value: never) => void
	api.mockResolvedValueOnce({
		total: 2,
		list: [createMockRecord()],
	} as never).mockImplementationOnce(
		() =>
			new Promise((resolve) => {
				finish = resolve
			}),
	)
	render(<RunningRecordModal taskId="mock-task-id" />)
	const row = await screen.findByTestId("running-record-item")
	fireEvent.click(screen.getByText("Load more"))
	await waitFor(() =>
		expect(api).toHaveBeenLastCalledWith("mock-task-id", { page: 2, page_size: 10 }),
	)
	expect(screen.getByTestId("running-record-item")).toBe(row)
	expect(screen.queryByTestId("running-record-loading")).not.toBeInTheDocument()
	fireEvent.click(screen.getByText("Load more"))
	expect(api).toHaveBeenCalledTimes(2)
	await act(async () => {
		finish({ total: 2, list: [{ ...createMockRecord(), task_name: "Second run" }] } as never)
	})
	expect(screen.getAllByTestId("running-record-item")).toHaveLength(2)
})

vi.mock("antd", async (importOriginal) => ({
	...(await importOriginal<typeof import("antd")>()),
}))
