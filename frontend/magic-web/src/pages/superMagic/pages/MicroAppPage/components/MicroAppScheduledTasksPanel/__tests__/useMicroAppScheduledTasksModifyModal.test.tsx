import { act, render, renderHook, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { ScheduledTask } from "@/types/scheduledTask"

const mocks = vi.hoisted(() => ({
	saveMCP: vi.fn(),
	setSelectedProject: vi.fn(),
	toastError: vi.fn(),
}))

vi.mock("react-i18next", async (importOriginal) => ({
	...(await importOriginal<typeof import("react-i18next")>()),
	useTranslation: () => ({ t: (key: string) => key }),
}))

vi.mock("@/components/base/MagicToaster/utils", () => ({
	default: { error: mocks.toastError },
}))

vi.mock("@/components/shadcn-ui/spinner", () => ({ Spinner: () => null }))

vi.mock("../MicroAppScheduledTasksModify", () => ({
	MicroAppScheduledTasksModify: () => <div data-testid="scheduled-tasks-modify" />,
}))

vi.mock("@/stores/projectFiles", () => ({
	default: { setSelectedProject: mocks.setSelectedProject },
}))

vi.mock("@/components/business/AccountSetting/pages/ScheduledTasks/store/MCPTempStorage", () => ({
	default: { saveMCP: mocks.saveMCP },
}))

import { useMicroAppScheduledTasksModifyModal } from "../useMicroAppScheduledTasksModifyModal"

describe("useMicroAppScheduledTasksModifyModal", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		mocks.saveMCP.mockResolvedValue(undefined)
	})

	it("does not overwrite the outer project when the modal closes", async () => {
		const { result } = renderHook(() =>
			useMicroAppScheduledTasksModifyModal({
				workspaceId: "workspace-1",
				projectId: "micro-app-project",
			}),
		)

		act(() => {
			result.current.openCreateModal(vi.fn())
		})
		render(result.current.content)
		await screen.findByTestId("scheduled-tasks-modify")
		await act(async () => {
			await result.current.closeModal()
		})

		expect(mocks.setSelectedProject).not.toHaveBeenCalled()
		expect(mocks.saveMCP).toHaveBeenCalledWith([])
	})

	it("can close before the lazy modal content mounts without writing project state", async () => {
		const { result } = renderHook(() =>
			useMicroAppScheduledTasksModifyModal({
				workspaceId: "workspace-1",
				projectId: "micro-app-project",
			}),
		)

		act(() => {
			result.current.openCreateModal(vi.fn())
		})
		await act(async () => {
			await result.current.closeModal()
		})

		expect(mocks.setSelectedProject).not.toHaveBeenCalled()
		expect(result.current.state.visible).toBe(false)
	})

	it("rejects editing a task from another project without opening the modal", () => {
		const { result } = renderHook(() =>
			useMicroAppScheduledTasksModifyModal({
				workspaceId: "workspace-1",
				projectId: "micro-app-project",
			}),
		)

		act(() => {
			result.current.openEditModal(
				{
					workspace_id: "workspace-1",
					project_id: "other-project",
				} as ScheduledTask.UpdateTask,
				vi.fn(),
			)
		})

		expect(result.current.state.visible).toBe(false)
		expect(mocks.toastError).toHaveBeenCalledWith(
			"accountPanel.timedTasks.microAppContextMismatch",
		)
	})
})

vi.mock("antd", async (importOriginal) => ({
	...(await importOriginal<typeof import("antd")>()),
}))
