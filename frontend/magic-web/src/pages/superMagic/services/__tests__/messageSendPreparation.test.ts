import { describe, expect, it, vi } from "vitest"
import type { ProjectListItem, Topic } from "@/pages/superMagic/pages/Workspace/types"
import { preparePanelSend } from "@/pages/superMagic/services/messageSendPreparation"
import { TopicMode } from "@/pages/superMagic/pages/Workspace/TopicMode"

vi.mock("@/apis", () => ({
	SuperMagicApi: {},
}))

vi.mock("@/components/Agent/MCP/service/MCPStorageService", () => ({
	ProjectStorage: class {
		async getMCP() {
			return []
		}

		async saveMCP() {
			return undefined
		}
	},
}))

vi.mock("@/pages/superMagic/components/MessageEditor/services/MentionItemsProcessor", () => ({
	mentionItemsProcessor: {
		processMentionItems: vi.fn(async (content, mentionItems) => ({ content, mentionItems })),
	},
}))

vi.mock("@/pages/superMagic/components/MessageEditor/services/UploadTokenService", () => ({
	superMagicUploadTokenService: {
		getLastWorkDir: vi.fn(() => undefined),
	},
}))

vi.mock("@/services/superMagic/topicModel", () => ({
	DEFAULT_TOPIC_ID: "default-topic",
	superMagicTopicModelCacheService: {
		getTopicModel: vi.fn(async () => null),
	},
	superMagicTopicModelService: {},
}))

vi.mock("@/services/superMagic/SuperMagicModeService", () => ({
	default: {},
}))

vi.mock("@/pages/superMagic/services/topicService", () => ({
	default: class {},
}))

vi.mock("@/pages/superMagic/services", () => ({
	default: {
		handleCreateTopic: vi.fn(),
		project: {
			renameProject: vi.fn(),
		},
	},
}))

describe("messageSendPreparation", () => {
	it("should create a fresh topic when the selected topic belongs to another project", async () => {
		const createTopic = vi.fn().mockResolvedValue({
			id: "topic-b",
			project_id: "project-b",
			chat_topic_id: "chat-topic-b",
			chat_conversation_id: "conversation-b",
			topic_name: "",
			task_status: "waiting",
			task_mode: "",
			topic_mode: TopicMode.Chat,
			updated_at: "",
			user_id: "user-1",
			workspace_id: "workspace-1",
			token_used: null,
		})
		const setSelectedTopic = vi.fn()
		const selectedProject = {
			id: "project-b",
			workspace_id: "workspace-1",
		} as unknown as ProjectListItem
		const staleTopic = {
			id: "topic-a",
			project_id: "project-a",
			chat_topic_id: "chat-topic-a",
			chat_conversation_id: "conversation-a",
		} as unknown as Topic

		const result = await preparePanelSend({
			params: {
				value: {
					type: "doc",
					content: [{ type: "paragraph", content: [{ type: "text", text: "hello" }] }],
				},
				mentionItems: [],
				topicMode: TopicMode.Chat,
			},
			context: {
				selectedProject,
				selectedTopic: staleTopic,
				createTopic,
				setSelectedTopic,
			},
			tabPattern: TopicMode.Chat,
			messagesLength: 0,
		})

		expect(createTopic).toHaveBeenCalledWith({
			selectedProject: expect.objectContaining({ id: "project-b" }),
		})
		expect(result?.currentTopic?.id).toBe("topic-b")
		expect(setSelectedTopic).toHaveBeenCalledWith(
			expect.objectContaining({
				id: "topic-b",
				project_id: "project-b",
			}),
		)
	})
})
