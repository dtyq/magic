import { beforeEach, describe, expect, it, vi } from "vitest"
import type { ProjectListItem, Topic } from "@/pages/superMagic/pages/Workspace/types"
import {
	ensureProjectForMessageContext,
	preparePanelSend,
	prependImplicitMentions,
	processMessageMentions,
	releaseHtmlScreenshotsAfterSend,
	resolveMessageSendContext,
} from "@/pages/superMagic/services/messageSendPreparation"
import { mentionItemsProcessor } from "@/pages/superMagic/components/MessageEditor/services/MentionItemsProcessor"
import { TopicMode } from "@/pages/superMagic/pages/Workspace/TopicMode"
import { TopicStore } from "@/pages/superMagic/stores/core/topic"
import type { MentionListItem } from "@/components/business/MentionPanel/tiptap-plugin/types"
import type { JSONContent } from "@/infrastructure/editors/tiptap/react"
import { projectStore, topicStore, workspaceStore } from "@/pages/superMagic/stores/core"

const { createProjectApiMock, analyticsTrackMock } = vi.hoisted(() => ({
	createProjectApiMock: vi.fn(),
	analyticsTrackMock: vi.fn(),
}))

vi.mock("@/apis", () => ({
	SuperMagicApi: {
		createProject: createProjectApiMock,
	},
}))

vi.mock("@/services/analytics", () => ({
	analyticsService: { report: analyticsTrackMock },
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

const screenshotMocks = vi.hoisted(() => ({
	collectStorageIds: vi.fn(() => [] as string[]),
	releaseStoredScreenshots: vi.fn(),
}))

vi.mock("@/pages/superMagic/components/MessageEditor/services/MentionItemsProcessor", () => ({
	mentionItemsProcessor: {
		processMentionItems: vi.fn(async (content, mentionItems) => ({ content, mentionItems })),
	},
}))

vi.mock("@/pages/superMagic/components/MessageEditor/services/HtmlScreenshotUploadService", () => ({
	htmlScreenshotUploadService: {
		collectStorageIds: screenshotMocks.collectStorageIds,
		releaseStoredScreenshots: screenshotMocks.releaseStoredScreenshots,
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

const { modeServiceMock, isModeValidMock, isModeVisibleMock } = vi.hoisted(() => {
	const isModeValid = vi.fn(() => false)
	const isModeVisible = vi.fn(() => true)
	return {
		modeServiceMock: {
			defaultAgentCode: undefined as string | undefined,
			isModeValid,
			isModeVisible,
		},
		isModeValidMock: isModeValid,
		isModeVisibleMock: isModeVisible,
	}
})

vi.mock("@/services/superMagic/SuperMagicModeService", () => ({
	default: modeServiceMock,
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
	it("creates a blank scoped chat instead of reusing a previously selected task", async () => {
		const previousProject = projectStore.selectedProject
		const previousTopic = topicStore.selectedTopic
		const previousWorkspace = workspaceStore.selectedWorkspace
		projectStore.setSelectedProject({ id: "old-project" } as ProjectListItem)
		topicStore.setSelectedTopic({ id: "old-topic", project_id: "old-project" } as Topic)
		workspaceStore.setSelectedWorkspace({ id: "old-workspace" } as never)
		const project = { id: "new-chat", workspace_id: "chat-workspace" } as ProjectListItem
		const topic = { id: "new-topic", project_id: project.id } as Topic
		const createProject = vi.fn().mockResolvedValue({ project, topic })
		try {
			const result = await preparePanelSend({
				params: { value: { type: "doc" }, mentionItems: [] },
				context: {
					getTemporaryWorkdir: () => "chat-home-files",
					selectedProject: null,
					selectedTopic: null,
					selectedWorkspace: null,
					createProject,
					setSelectedProject: vi.fn(),
					setSelectedTopic: vi.fn(),
					topicStore: new TopicStore(),
				},
				tabPattern: TopicMode.General,
				messagesLength: 0,
			})
			expect(createProject).toHaveBeenCalledExactlyOnceWith({
				projectMode: TopicMode.General,
				workdir: "chat-home-files",
			})
			expect(result?.currentProject?.id).toBe("new-chat")
			expect(result?.currentTopic?.id).toBe("new-topic")
			expect(result?.context.workspaceId).toBe("chat-workspace")
			expect(projectStore.selectedProject?.id).toBe("old-project")
		} finally {
			projectStore.setSelectedProject(previousProject)
			topicStore.setSelectedTopic(previousTopic)
			workspaceStore.setSelectedWorkspace(previousWorkspace)
		}
	})
	beforeEach(() => {
		createProjectApiMock.mockReset()
		analyticsTrackMock.mockReset()
		modeServiceMock.defaultAgentCode = undefined
		isModeValidMock.mockReset()
		isModeValidMock.mockReturnValue(false)
		isModeVisibleMock.mockReset()
		isModeVisibleMock.mockReturnValue(true)
		screenshotMocks.collectStorageIds.mockReset()
		screenshotMocks.releaseStoredScreenshots.mockReset()
	})

	it("reports workspace creation when a workspace home uses an employee mode", async () => {
		createProjectApiMock.mockResolvedValue({
			project: {
				id: "project-workspace",
				workspace_id: "workspace-1",
				project_mode: "SMA-agent",
			},
			topic: {
				id: "topic-workspace",
				project_id: "project-workspace",
				workspace_id: "workspace-1",
			},
		})

		const context = resolveMessageSendContext({
			selectedWorkspace: { id: "workspace-1" } as never,
			creationScene: "workspace",
			setSelectedProject: vi.fn(),
			setSelectedTopic: vi.fn(),
		})

		await context.createProject({ projectMode: "SMA-agent" as TopicMode })

		expect(analyticsTrackMock).toHaveBeenCalledWith("project_create_attempted", {
			workspaceId: "workspace-1",
			sceneOverride: "workspace",
			mode: "SMA-agent",
		})
	})

	it("normalizes the configured non-SMA default employee for topic state and send params", async () => {
		modeServiceMock.defaultAgentCode = "agent-default"
		isModeValidMock.mockImplementation((mode) => mode === "agent-default")
		const setSelectedTopic = vi.fn()
		const selectedProject = {
			id: "project-1",
			workspace_id: "workspace-1",
		} as ProjectListItem
		const selectedTopic = {
			id: "topic-1",
			project_id: "project-1",
			chat_topic_id: "chat-topic-1",
			chat_conversation_id: "conversation-1",
			topic_mode: TopicMode.General,
		} as Topic

		const result = await preparePanelSend({
			params: {
				value: {
					type: "doc",
					content: [{ type: "paragraph", content: [{ type: "text", text: "hello" }] }],
				},
				mentionItems: [],
				topicMode: "agent-default" as TopicMode,
			},
			context: {
				selectedProject,
				selectedTopic,
				setSelectedTopic,
			},
			tabPattern: "agent-default" as TopicMode,
			messagesLength: 0,
		})

		expect(result?.currentTopic).toEqual(
			expect.objectContaining({
				topic_mode: "agent-default",
				agent_code: undefined,
			}),
		)
		expect(result?.params).toEqual(
			expect.objectContaining({
				topicMode: "agent-default",
				extra: undefined,
			}),
		)
	})

	it("keeps the employee code for direct crew creator sends", async () => {
		const selectedProject = {
			id: "project-1",
			workspace_id: "workspace-1",
		} as ProjectListItem
		const selectedTopic = {
			id: "topic-1",
			project_id: "project-1",
			chat_topic_id: "chat-topic-1",
			chat_conversation_id: "conversation-1",
			topic_mode: TopicMode.CrewCreator,
		} as Topic

		const result = await preparePanelSend({
			params: {
				value: {
					type: "doc",
					content: [{ type: "paragraph", content: [{ type: "text", text: "hello" }] }],
				},
				mentionItems: [],
				topicMode: TopicMode.CrewCreator,
				extra: { agent_code: "crew-123" },
			},
			context: { selectedProject, selectedTopic },
			tabPattern: TopicMode.CrewCreator,
			messagesLength: 1,
		})

		expect(result?.currentTopic).toEqual(
			expect.objectContaining({
				topic_mode: TopicMode.CrewCreator,
				agent_code: "crew-123",
			}),
		)
		expect(result?.params).toEqual(
			expect.objectContaining({
				topicMode: TopicMode.CrewCreator,
				extra: { agent_code: "crew-123" },
			}),
		)
	})

	it("processes inline mentions before direct micro-app sends", async () => {
		const content = {
			type: "doc",
			content: [
				{
					type: "paragraph",
					content: [{ type: "mention", attrs: { type: "project_file", data: {} } }],
				},
			],
		}
		const processedContent = { type: "doc", content: [{ type: "paragraph" }] }
		const processMentionItems = vi.mocked(mentionItemsProcessor.processMentionItems)
		processMentionItems.mockResolvedValueOnce({
			content: processedContent,
			mentionItems: [],
		})

		await expect(processMessageMentions(content, "project-1", "topic-1")).resolves.toEqual(
			processedContent,
		)
		expect(processMentionItems).toHaveBeenCalledWith(
			content,
			expect.arrayContaining([
				expect.objectContaining({
					attrs: expect.objectContaining({ type: "project_file" }),
				}),
			]),
			"project-1",
			"topic-1",
		)
	})

	it("releases uploaded region screenshots after send succeeds", () => {
		const mentionItems = [
			{
				type: "mention",
				attrs: {
					data: { is_html_screenshot: true, storage_id: "region-1" },
				},
			},
		]
		screenshotMocks.collectStorageIds.mockReturnValue(["region-1"])

		releaseHtmlScreenshotsAfterSend(mentionItems as never)

		expect(screenshotMocks.collectStorageIds).toHaveBeenCalledWith(mentionItems)
		expect(screenshotMocks.releaseStoredScreenshots).toHaveBeenCalledWith(["region-1"])
	})

	it("clears the previous agent_code when switching to a built-in mode", async () => {
		modeServiceMock.defaultAgentCode = "agent-default"
		isModeValidMock.mockImplementation((mode) => mode === "agent-default")
		const selectedProject = {
			id: "project-1",
			workspace_id: "workspace-1",
		} as ProjectListItem
		const selectedTopic = {
			id: "topic-1",
			project_id: "project-1",
			chat_topic_id: "chat-topic-1",
			chat_conversation_id: "conversation-1",
			topic_mode: "agent-default" as TopicMode,
		} as Topic

		const result = await preparePanelSend({
			params: {
				value: {
					type: "doc",
					content: [{ type: "paragraph", content: [{ type: "text", text: "hello" }] }],
				},
				mentionItems: [],
				topicMode: TopicMode.Chat,
				extra: { agent_code: "agent-default", source: "retry" },
			},
			context: { selectedProject, selectedTopic },
			tabPattern: TopicMode.Chat,
			messagesLength: 1,
		})

		expect(result?.currentTopic?.topic_mode).toBe(TopicMode.Chat)
		expect(result?.currentTopic?.agent_code).toBeUndefined()
		expect(result?.params.extra).toEqual({ source: "retry" })
	})

	it("uses the explicit target topic instead of the shared selected topic", async () => {
		const selectedProject = {
			id: "project-1",
			workspace_id: "workspace-1",
		} as ProjectListItem
		const selectedTopic = {
			id: "topic-shared",
			project_id: "project-1",
			chat_topic_id: "chat-shared",
			chat_conversation_id: "conversation-shared",
		} as Topic
		const targetTopic = {
			id: "topic-target",
			project_id: "project-1",
			chat_topic_id: "chat-target",
			chat_conversation_id: "conversation-target",
		} as Topic

		const result = await preparePanelSend({
			params: {
				value: {
					type: "doc",
					content: [{ type: "paragraph", content: [{ type: "text", text: "hello" }] }],
				},
				mentionItems: [],
				topicMode: TopicMode.Chat,
				targetTopic,
			},
			context: { selectedProject, selectedTopic },
			tabPattern: TopicMode.Chat,
			messagesLength: 1,
		})

		expect(result?.currentTopic?.id).toBe("topic-target")
		expect(result?.context.selectedTopic?.id).toBe("topic-target")
	})

	it("preserves the scoped topic store for the dispatch phase", async () => {
		const scopedTopicStore = new TopicStore()
		const selectedProject = {
			id: "project-1",
			workspace_id: "workspace-1",
		} as ProjectListItem
		const selectedTopic = {
			id: "topic-1",
			project_id: "project-1",
			chat_topic_id: "chat-topic-1",
			chat_conversation_id: "conversation-1",
		} as Topic

		const result = await preparePanelSend({
			params: {
				value: {
					type: "doc",
					content: [{ type: "paragraph", content: [{ type: "text", text: "hello" }] }],
				},
				mentionItems: [],
				topicMode: TopicMode.Chat,
			},
			context: { selectedProject, selectedTopic, topicStore: scopedTopicStore },
			tabPattern: TopicMode.Chat,
			messagesLength: 1,
		})

		expect(result?.context.topicStore).toBe(scopedTopicStore)
	})

	it("sends a configured built-in default as topic_pattern without agent_code", async () => {
		modeServiceMock.defaultAgentCode = TopicMode.PPT
		isModeValidMock.mockImplementation((mode) => mode === TopicMode.PPT)
		const selectedProject = {
			id: "project-1",
			workspace_id: "workspace-1",
		} as ProjectListItem
		const selectedTopic = {
			id: "topic-1",
			project_id: "project-1",
			chat_topic_id: "chat-topic-1",
			chat_conversation_id: "conversation-1",
			topic_mode: TopicMode.General,
		} as Topic

		const result = await preparePanelSend({
			params: {
				value: {
					type: "doc",
					content: [{ type: "paragraph", content: [{ type: "text", text: "hello" }] }],
				},
				mentionItems: [],
				topicMode: TopicMode.PPT,
				extra: { agent_code: "stale-agent" },
			},
			context: { selectedProject, selectedTopic },
			tabPattern: TopicMode.PPT,
			messagesLength: 0,
		})

		expect(result?.currentTopic).toEqual(
			expect.objectContaining({
				topic_mode: TopicMode.PPT,
				agent_code: undefined,
			}),
		)
		expect(result?.params.topicMode).toBe(TopicMode.PPT)
		expect(result?.params.extra).toBeUndefined()
	})

	it("keeps the employee identifier as project_mode while initializing topic state", async () => {
		modeServiceMock.defaultAgentCode = "agent-default"
		isModeValidMock.mockImplementation((mode) => mode === "agent-default")
		const createProject = vi.fn().mockResolvedValue({
			project: { id: "project-1", workspace_id: "workspace-1" },
			topic: { id: "topic-1", project_id: "project-1" },
		})
		const setSelectedTopic = vi.fn()

		const result = await ensureProjectForMessageContext({
			context: {
				createProject,
				setSelectedProject: vi.fn(),
				setSelectedTopic,
			},
			tabPattern: "agent-default" as TopicMode,
		})

		expect(createProject).toHaveBeenCalledWith(
			expect.objectContaining({ projectMode: "agent-default" }),
		)
		expect(result?.currentTopic).toEqual(
			expect.objectContaining({
				topic_mode: "agent-default",
				agent_code: undefined,
			}),
		)
	})

	it("updates both scoped topic projections after smart rename", async () => {
		const scopedTopicStore = new TopicStore()
		const topic = {
			id: "topic-scoped",
			project_id: "project-scoped",
			topic_name: "",
		} as Topic
		scopedTopicStore.setTopics([topic])
		scopedTopicStore.setSelectedTopic(topic)

		const context = resolveMessageSendContext({
			selectedTopic: topic,
			topicStore: scopedTopicStore,
		})
		await context.updateTopicName?.(topic.id, "Renamed mock topic")

		expect(scopedTopicStore.selectedTopic?.topic_name).toBe("Renamed mock topic")
		expect(scopedTopicStore.topics[0]?.topic_name).toBe("Renamed mock topic")
	})

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
				refreshProjectAfterTopicRename: true,
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
		expect(result?.context.refreshProjectAfterTopicRename).toBe(true)
		expect(setSelectedTopic).toHaveBeenCalledWith(
			expect.objectContaining({
				id: "topic-b",
				project_id: "project-b",
			}),
		)
	})
})

describe("prependImplicitMentions", () => {
	const canvasMention = {
		type: "mention",
		attrs: {
			type: "project_directory",
			data: {
				directory_id: "folder-1",
				directory_name: "Canvas",
				directory_path: "Canvas",
				directory_metadata: { type: "design" },
			},
		},
	} as MentionListItem
	const textContent: JSONContent = {
		type: "doc",
		content: [{ type: "paragraph", content: [{ type: "text", text: "draw a cat" }] }],
	}

	it("returns the original content when no implicit mention is provided", () => {
		const result = prependImplicitMentions(textContent, [], [])

		expect(result.content).toBe(textContent)
		expect(result.mentionItems).toEqual([])
	})

	it("prepends a missing canvas mention to the first paragraph", () => {
		const result = prependImplicitMentions(textContent, [], [canvasMention])

		expect(result.mentionItems).toEqual([canvasMention])
		expect(result.content.content?.[0]?.content).toEqual([
			{ type: "mention", attrs: canvasMention.attrs },
			{ type: "text", text: " " },
			{ type: "text", text: "draw a cat" },
		])
	})

	it("does not duplicate a canvas the user already referenced", () => {
		const userMention = {
			...canvasMention,
			attrs: {
				...canvasMention.attrs,
				data: { ...canvasMention.attrs.data, directory_path: "/Canvas" },
			},
		} as MentionListItem
		const result = prependImplicitMentions(textContent, [userMention], [canvasMention])

		expect(result.content).toBe(textContent)
		expect(result.mentionItems).toEqual([userMention])
	})

	it("binds implicit mentions after preparePanelSend resolves the project", async () => {
		const selectedProject = { id: "project-1", workspace_id: "workspace-1" } as ProjectListItem
		const selectedTopic = {
			id: "topic-1",
			project_id: "project-1",
			chat_topic_id: "chat-topic-1",
			chat_conversation_id: "conversation-1",
		} as Topic
		const getImplicitMentionItems = vi.fn(() => [canvasMention])

		const result = await preparePanelSend({
			params: { value: textContent, mentionItems: [], topicMode: TopicMode.Design },
			context: { selectedProject, selectedTopic, getImplicitMentionItems },
			tabPattern: TopicMode.Design,
			messagesLength: 1,
		})

		expect(getImplicitMentionItems).toHaveBeenCalledWith(selectedProject)
		expect(result?.params.mentionItems).toEqual([canvasMention])
		expect(result?.params.value?.content?.[0]?.content?.[0]).toEqual({
			type: "mention",
			attrs: canvasMention.attrs,
		})
	})
})
