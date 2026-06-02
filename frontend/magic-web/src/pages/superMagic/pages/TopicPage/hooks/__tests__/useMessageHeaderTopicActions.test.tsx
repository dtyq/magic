import { renderHook } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import type { ProjectListItem, Topic } from "../../../Workspace/types"
import { TaskStatus } from "../../../Workspace/types"
import { TopicMode } from "../../../Workspace/TopicMode"
import SuperMagicService from "../../../../services"
import { useMessageHeaderTopicActions } from "../useMessageHeaderTopicActions"

vi.mock("../../../../services", () => ({
	default: {
		handleCreateTopic: vi.fn(),
		topic: {
			updateTopicName: vi.fn(),
		},
		deleteTopic: vi.fn(),
	},
}))

vi.mock("../../../../services/routeManageService", () => ({
	default: {
		navigateToState: vi.fn(),
	},
}))

vi.mock("@/apis", () => ({
	SuperMagicApi: {
		editTopic: vi.fn(),
		pinTopic: vi.fn(),
		unpinTopic: vi.fn(),
		archiveTopic: vi.fn(),
		unarchiveTopic: vi.fn(),
	},
}))

function createTopic(id: string, topicName: string): Topic {
	return {
		id,
		user_id: "user-1",
		chat_topic_id: `chat-${id}`,
		chat_conversation_id: `conversation-${id}`,
		topic_name: topicName,
		task_status: TaskStatus.FINISHED,
		task_mode: "chat",
		project_id: "project-1",
		topic_mode: TopicMode.CustomAgent,
		agent_code: "employee-code-1",
		updated_at: "2026-04-08T00:00:00Z",
		workspace_id: "workspace-1",
		token_used: null,
	}
}

describe("useMessageHeaderTopicActions", () => {
	it("passes the current topic when creating a topic", async () => {
		const selectedProject = { id: "project-1" } as ProjectListItem
		const selectedTopic = createTopic("topic-1", "Existing Topic")
		const topicStore = {
			setSelectedTopic: vi.fn(),
			mergeTopic: vi.fn(),
		}

		const { result } = renderHook(() =>
			useMessageHeaderTopicActions({
				selectedProject,
				selectedTopic,
				topicStore: topicStore as never,
			}),
		)

		await result.current.createTopic()

		expect(SuperMagicService.handleCreateTopic).toHaveBeenCalledWith({
			selectedProject,
			sourceTopic: selectedTopic,
		})
	})
})
