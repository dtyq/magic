import { act, renderHook } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { TopicMode } from "../../Workspace/TopicMode"
import { useChatHomeContext } from "../useChatHomeContext"

const mocks = vi.hoisted(() => ({
	ensureWorkspace: vi.fn(),
	createProject: vi.fn(),
	switchChatProject: vi.fn(),
	invalidate: vi.fn(),
	error: vi.fn(),
	takeRename: vi.fn(),
	updateTopicName: vi.fn(),
}))
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
vi.mock("@/components/base/MagicToaster/utils", () => ({ default: { error: mocks.error } }))
vi.mock("../../../hooks/useChatWorkspace", () => ({ ensureChatWorkspace: mocks.ensureWorkspace }))
vi.mock("../../../services", () => ({
	default: {
		project: { createProject: mocks.createProject },
		switchChatProject: mocks.switchChatProject,
	},
}))
vi.mock("../../../services/chatConversationListInvalidation", () => ({
	invalidateChatConversationList: mocks.invalidate,
}))
vi.mock("../../../services/messageSendRenameTask", () => ({
	takeProjectRenameTask: mocks.takeRename,
}))
vi.mock("../../../stores/core", () => ({ topicStore: { updateTopicName: mocks.updateTopicName } }))

const workspace = { id: "chat-workspace", workspace_type: "chat" }
const created = {
	project: { id: "chat-project", workspace_id: workspace.id },
	topic: { id: "chat-topic", project_id: "chat-project" },
}

describe("blank chat composer", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		mocks.ensureWorkspace.mockResolvedValue(workspace)
		mocks.createProject.mockResolvedValue(created)
		mocks.takeRename.mockReturnValue(null)
	})

	it("mounts empty with a separate draft and no creation or workspace request", () => {
		const { result } = renderHook(useChatHomeContext)
		expect(result.current.selectedProject).toBeNull()
		expect(result.current.selectedTopic).toBeNull()
		expect(result.current.selectedWorkspace).toBeNull()
		expect(result.current.draftKey?.workspaceId).toBe("chat-home")
		expect(result.current.deferProjectCreationUntilSend).toBe(true)
		expect(mocks.ensureWorkspace).not.toHaveBeenCalled()
		expect(mocks.createProject).not.toHaveBeenCalled()
	})

	it("creates in the chat workspace on first send and reuses creation after a preparation failure", async () => {
		const { result } = renderHook(useChatHomeContext)
		await act(async () => {
			await result.current.createProject?.({
				projectMode: TopicMode.General,
				workdir: "temp-files",
			})
			await result.current.createProject?.({ projectMode: TopicMode.General })
		})
		expect(mocks.createProject).toHaveBeenCalledExactlyOnceWith({
			workspaceId: workspace.id,
			projectMode: TopicMode.General,
			workdir: "temp-files",
		})
		expect(mocks.invalidate).toHaveBeenCalledTimes(1)
		expect(mocks.switchChatProject).not.toHaveBeenCalled()
		act(() =>
			result.current.onSendSuccess?.({
				currentProject: created.project as never,
				currentTopic: created.topic as never,
			}),
		)
		expect(mocks.switchChatProject).toHaveBeenCalledWith(created.project, created.topic, {
			chatWorkspace: workspace,
		})
	})

	it("keeps the temporary upload directory when creation needs a retry", async () => {
		mocks.createProject.mockResolvedValueOnce(null)
		const { result } = renderHook(useChatHomeContext)
		await act(async () => {
			expect(
				await result.current.createProject?.({
					projectMode: TopicMode.General,
					workdir: "temporary-files",
				}),
			).toBeNull()
			expect(
				await result.current.createProject?.({ projectMode: TopicMode.General }),
			).toEqual(created)
		})
		expect(mocks.createProject).toHaveBeenCalledTimes(2)
		expect(mocks.createProject).toHaveBeenLastCalledWith({
			workspaceId: workspace.id,
			projectMode: TopicMode.General,
			workdir: "temporary-files",
		})
		expect(mocks.error).toHaveBeenCalledTimes(1)
	})

	it("does not create when workspace lookup fails", async () => {
		mocks.ensureWorkspace.mockResolvedValue(null)
		const { result } = renderHook(useChatHomeContext)
		await act(async () => {
			await result.current.createProject?.({ projectMode: TopicMode.General })
		})
		expect(mocks.createProject).not.toHaveBeenCalled()
		expect(mocks.error).toHaveBeenCalledTimes(1)
	})
	it("updates the detail topic and sidebar when smart naming finishes after navigation", async () => {
		let finishRename!: (result: { topicId: string; topicName: string }) => void
		mocks.takeRename.mockReturnValue(
			new Promise((resolve) => {
				finishRename = resolve
			}),
		)
		const { result, unmount } = renderHook(useChatHomeContext)
		act(() =>
			result.current.onSendSuccess?.({
				currentProject: created.project as never,
				currentTopic: created.topic as never,
			}),
		)
		unmount()
		await act(async () => {
			finishRename({ topicId: created.topic.id, topicName: "First message" })
		})
		expect(mocks.updateTopicName).toHaveBeenCalledWith(created.topic.id, "First message")
		expect(mocks.invalidate).toHaveBeenCalledTimes(2)
	})

	it("does not send or navigate away from a new page when a pending creation completes", async () => {
		let complete!: (value: typeof created) => void
		mocks.createProject.mockReturnValue(
			new Promise((resolve) => {
				complete = resolve
			}),
		)
		const { result, unmount } = renderHook(useChatHomeContext)
		let pending: ReturnType<NonNullable<typeof result.current.createProject>> | undefined
		await act(async () => {
			pending = result.current.createProject?.({ projectMode: TopicMode.General })
		})
		unmount()
		complete(created)
		expect(await pending).toBeNull()
		result.current.onSendSuccess?.({
			currentProject: created.project as never,
			currentTopic: created.topic as never,
		})
		expect(mocks.switchChatProject).not.toHaveBeenCalled()
		expect(mocks.invalidate).toHaveBeenCalledTimes(1)
	})
})
