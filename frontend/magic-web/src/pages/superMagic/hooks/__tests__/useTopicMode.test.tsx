import { act, renderHook } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { ProjectListItem, Topic } from "../../pages/Workspace/types"
import { TaskStatus } from "../../pages/Workspace/types"
import { TopicMode } from "../../pages/Workspace/TopicMode"
import useTopicMode from "../useTopicMode"

const {
	syncTopicFrontendModePatchMock,
	getProjectDefaultTopicModeMock,
	setProjectDefaultTopicModeMock,
} = vi.hoisted(() => ({
	syncTopicFrontendModePatchMock: vi.fn(),
	getProjectDefaultTopicModeMock: vi.fn(),
	setProjectDefaultTopicModeMock: vi.fn(),
}))

vi.mock("@/hooks/useIsMobile", () => ({
	useIsMobile: () => false,
}))

vi.mock("@/services/superMagic/ProjectTopicService", () => ({
	default: {
		getProjectDefaultTopicMode: getProjectDefaultTopicModeMock,
		setProjectDefaultTopicMode: setProjectDefaultTopicModeMock,
	},
}))

vi.mock("@/pages/superMagic/services", () => ({
	default: {
		topic: {
			syncTopicFrontendModePatch: syncTopicFrontendModePatchMock,
		},
	},
}))

function createTopic(id: string): Topic {
	return {
		id,
		user_id: "user-1",
		chat_topic_id: `chat-${id}`,
		chat_conversation_id: `conversation-${id}`,
		topic_name: "Topic",
		task_status: TaskStatus.FINISHED,
		task_mode: "chat",
		project_id: "project-1",
		topic_mode: TopicMode.CustomAgent,
		agent_code: "SMA-agent-1",
		updated_at: "2026-04-08T00:00:00Z",
		workspace_id: "workspace-1",
		token_used: null,
	}
}

describe("useTopicMode", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("syncs the frontend topic patch when user manually changes mode", () => {
		const selectedTopic = createTopic("topic-1")
		const selectedProject = {
			id: "project-1",
			workspace_id: "workspace-1",
		} as ProjectListItem

		const { result } = renderHook(() =>
			useTopicMode({
				selectedTopic,
				selectedProject,
			}),
		)

		act(() => {
			result.current.setTopicMode("SMA-agent-2" as TopicMode)
		})

		expect(setProjectDefaultTopicModeMock).toHaveBeenCalledWith(
			"workspace-1",
			"project-1",
			"SMA-agent-2",
		)
		expect(syncTopicFrontendModePatchMock).toHaveBeenCalledWith({
			topic: selectedTopic,
			mode: "SMA-agent-2",
		})
	})
})
