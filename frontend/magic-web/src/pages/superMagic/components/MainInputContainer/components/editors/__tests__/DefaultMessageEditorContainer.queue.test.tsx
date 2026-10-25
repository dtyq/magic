import { forwardRef, useImperativeHandle } from "react"
import { act, render } from "@testing-library/react"
import type { JSONContent } from "@/infrastructure/editors/tiptap/core"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { TopicMode } from "@/pages/superMagic/pages/Workspace/TopicMode"

const mocks = vi.hoisted(() => ({
	ensureProject: vi.fn(),
	editorProps:
		{} as import("@/pages/superMagic/components/MessageEditor/types").MessageEditorProps,
	addToQueue: vi.fn(),
	clearContentAfterSend: vi.fn(),
	setContent: vi.fn(),
	preparePanelSend: vi.fn(),
	sendPanelMessage: vi.fn(),
	releaseHtmlScreenshotsAfterSend: vi.fn(),
	handleSend: undefined as
		| ((params: {
				value: JSONContent
				mentionItems: []
				topicMode: TopicMode
				shouldClearEditorAfterSend?: boolean
		  }) => Promise<boolean>)
		| undefined,
}))

vi.mock("@/pages/superMagic/components/MessageEditor/MessageEditor", () => ({
	default: forwardRef((props, ref) => {
		mocks.editorProps = props
		useImperativeHandle(ref, () => ({
			clearContentAfterSend: mocks.clearContentAfterSend,
			setContent: mocks.setContent,
			getQueueDraft: () => null,
		}))
		return null
	}),
}))

vi.mock("react-i18next", () => ({
	initReactI18next: { type: "3rdParty", init: () => undefined },
	useTranslation: () => ({
		t: (key: string) => key,
		i18n: { language: "zh_CN" },
	}),
}))

vi.mock("@/hooks/useIsMobile", () => ({
	useIsMobile: () => false,
}))

vi.mock("@/pages/superMagic/stores", () => ({
	roleStore: {
		currentRole: TopicMode.Default,
		setCurrentRole: vi.fn(),
	},
}))

vi.mock("@/pages/superMagic/stores/core", () => ({
	projectStore: { selectedProject: null },
	topicStore: { selectedTopic: null, topics: [] },
	workspaceStore: { selectedWorkspace: null, firstWorkspace: null },
}))

vi.mock("@/pages/superMagic/hooks/useSharedProjectMode", () => ({
	default: vi.fn(),
}))

vi.mock("@/services/superMagic/SuperMagicModeService", () => ({
	default: {
		defaultAgentCode: undefined,
		getModePlaceholderWithLegacy: () => "",
		isModeValid: () => true,
	},
}))

vi.mock("@/pages/superMagic/components/MessagePanel/hooks/useSandboxPreWarm", () => ({
	default: vi.fn(),
}))

vi.mock("@/pages/superMagic/hooks/useOfficialPromptsPayload", () => ({
	useOfficialPromptsPayload: vi.fn(),
}))

vi.mock("@/pages/superMagic/hooks/useTopicExamplesPortal", () => ({
	default: () => null,
}))

vi.mock("@/components/business/MentionPanel/builtin-store", () => ({
	default: {},
}))

vi.mock("../../../stores", () => ({
	useOptionalSceneStateStore: () => null,
	useOptionalScenePanelVariant: () => undefined,
}))

vi.mock("@/pages/superMagic/services/messageSendFlowService", () => ({
	createMessageSendService: () => ({ sendPanelMessage: mocks.sendPanelMessage }),
}))

vi.mock("@/pages/superMagic/services/messageSendPreparation", () => ({
	createTopicForMessageContext: vi.fn(),
	ensureProjectForMessageContext: mocks.ensureProject,
	preparePanelSend: mocks.preparePanelSend,
	releaseHtmlScreenshotsAfterSend: mocks.releaseHtmlScreenshotsAfterSend,
}))

vi.mock("@/pages/superMagic/components/MessageEditor/utils", () => ({
	generateTextFromJSONContent: () => "queued message",
}))

import DefaultMessageEditorContainer from "../DefaultMessageEditorContainer"

describe("DefaultMessageEditorContainer queue sending", () => {
	it("passes the current composer employee to the historical chat model picker", () => {
		render(
			<DefaultMessageEditorContainer
				editorContext={{
					selectedProject: { id: "project-1" } as never,
					selectedTopic: { id: "topic-1", agent_code: "SMA-history" } as never,
					topicMode: TopicMode.CustomAgent,
					agentCode: "SMA-default",
				}}
			/>,
		)

		expect(mocks.editorProps.agentCode).toBe("SMA-default")
		expect(mocks.editorProps.selectedTopic?.agent_code).toBe("SMA-history")
	})

	it("keeps long pasted text on temporary uploads until a blank chat is sent", async () => {
		render(
			<DefaultMessageEditorContainer
				editorContext={{
					selectedProject: null,
					selectedTopic: null,
					selectedWorkspace: null,
					topicMode: TopicMode.General,
					deferProjectCreationUntilSend: true,
				}}
			/>,
		)
		await act(async () => {
			expect(await mocks.editorProps.onEnsureProject?.()).toBeNull()
		})
		expect(mocks.ensureProject).not.toHaveBeenCalled()
	})
	beforeEach(() => {
		vi.clearAllMocks()
		mocks.handleSend = undefined
		mocks.addToQueue.mockResolvedValue("queue-1")
		mocks.preparePanelSend.mockReset()
		mocks.sendPanelMessage.mockReset()
	})

	it.each([
		["微应用", TopicMode.MicroApp],
		["Skill 编辑", TopicMode.SkillCreator],
		["员工编辑", TopicMode.CrewCreator],
		["员工对话", TopicMode.CustomAgent],
		["MagiClaw", TopicMode.MagiClaw],
	])("%s 任务运行中加入队列时也应用 mergeSendParams", async (_scene, mergedTopicMode) => {
		render(
			<DefaultMessageEditorContainer
				editorContext={{
					selectedProject: { id: "project-1" } as never,
					selectedTopic: { id: "topic-1" } as never,
					topicMode: TopicMode.Default,
					showLoading: true,
					mergeSendParams: ({ defaultParams }) => ({
						...defaultParams,
						topicMode: mergedTopicMode,
					}),
					queueContext: {
						editorRef: { current: null },
						queueDraft: null,
						cancelEditQueueItem: vi.fn(async () => undefined),
						onEditorReady: vi.fn(),
						retryQueueDraftRemoval: vi.fn(async () => undefined),
						isQueueOperationPending: false,
						editingQueueItem: null,
						addToQueue: mocks.addToQueue,
						finishEditQueueItem: vi.fn(),
					},
					onMessageSendReady: (sendMessage) => {
						mocks.handleSend = sendMessage as typeof mocks.handleSend
					},
				}}
			/>,
		)

		const value: JSONContent = {
			type: "doc",
			content: [{ type: "paragraph", content: [{ type: "text", text: "你好" }] }],
		}

		await act(async () => {
			await mocks.handleSend?.({
				value,
				mentionItems: [],
				topicMode: TopicMode.Default,
			})
		})

		expect(mocks.addToQueue).toHaveBeenCalledWith(
			expect.objectContaining({ topicMode: mergedTopicMode }),
		)
	})

	it("keeps the employee code when a crew creator message enters the queue", async () => {
		render(
			<DefaultMessageEditorContainer
				editorContext={{
					selectedProject: { id: "project-1" } as never,
					selectedTopic: { id: "topic-1" } as never,
					topicMode: TopicMode.Default,
					showLoading: true,
					mergeSendParams: ({ defaultParams }) => ({
						...defaultParams,
						topicMode: TopicMode.CrewCreator,
						extra: { agent_code: "crew-123" },
					}),
					queueContext: {
						editingQueueItem: null,
						addToQueue: mocks.addToQueue,
						finishEditQueueItem: vi.fn(),
					},
					onMessageSendReady: (sendMessage) => {
						mocks.handleSend = sendMessage as typeof mocks.handleSend
					},
				}}
			/>,
		)

		const value: JSONContent = {
			type: "doc",
			content: [{ type: "paragraph", content: [{ type: "text", text: "你好" }] }],
		}

		await act(async () => {
			await mocks.handleSend?.({
				value,
				mentionItems: [],
				topicMode: TopicMode.Default,
			})
		})

		expect(mocks.addToQueue).toHaveBeenCalledWith(
			expect.objectContaining({
				topicMode: TopicMode.CrewCreator,
				agentCode: "crew-123",
			}),
		)
	})

	it("only passes queue-supported fields after merging send params", async () => {
		render(
			<DefaultMessageEditorContainer
				editorContext={{
					selectedProject: { id: "project-1" } as never,
					selectedTopic: { id: "topic-1" } as never,
					topicMode: TopicMode.Default,
					showLoading: true,
					mergeSendParams: ({ defaultParams }) => ({
						...defaultParams,
						topicMode: TopicMode.MicroApp,
						extra: { micro_app_id: "app-1" },
						queueId: "send-only-queue-id",
						throwOnError: true,
					}),
					queueContext: {
						editorRef: { current: null },
						queueDraft: null,
						cancelEditQueueItem: vi.fn(async () => undefined),
						onEditorReady: vi.fn(),
						retryQueueDraftRemoval: vi.fn(async () => undefined),
						isQueueOperationPending: false,
						editingQueueItem: null,
						addToQueue: mocks.addToQueue,
						finishEditQueueItem: vi.fn(),
					},
					onMessageSendReady: (sendMessage) => {
						mocks.handleSend = sendMessage as typeof mocks.handleSend
					},
				}}
			/>,
		)

		const value: JSONContent = {
			type: "doc",
			content: [{ type: "paragraph", content: [{ type: "text", text: "你好" }] }],
		}

		await act(async () => {
			await mocks.handleSend?.({
				value,
				mentionItems: [],
				topicMode: TopicMode.Default,
			})
		})

		expect(mocks.addToQueue).toHaveBeenCalledWith({
			content: value,
			mentionItems: [],
			selectedModel: undefined,
			selectedImageModel: undefined,
			selectedVideoModel: undefined,
			topicMode: TopicMode.MicroApp,
			agentCode: null,
			dynamicParams: undefined,
		})
	})

	it("passes the post-rename project refresh policy into send preparation", async () => {
		const currentProject = { id: "project-1" }
		const currentTopic = { id: "topic-1" }
		mocks.preparePanelSend.mockResolvedValue({
			params: {
				value: { type: "doc" },
				mentionItems: [],
			},
			context: { refreshProjectAfterTopicRename: true },
			currentProject,
			currentTopic,
		})
		mocks.sendPanelMessage.mockResolvedValue({ currentProject, currentTopic })

		render(
			<DefaultMessageEditorContainer
				editorContext={{
					selectedProject: currentProject as never,
					selectedTopic: currentTopic as never,
					topicMode: TopicMode.MicroApp,
					refreshProjectAfterTopicRename: true,
					onMessageSendReady: (sendMessage) => {
						mocks.handleSend = sendMessage as typeof mocks.handleSend
					},
				}}
			/>,
		)

		await act(async () => {
			await mocks.handleSend?.({
				value: { type: "doc" },
				mentionItems: [],
				topicMode: TopicMode.MicroApp,
			})
		})

		expect(mocks.preparePanelSend).toHaveBeenCalledWith(
			expect.objectContaining({
				context: expect.objectContaining({ refreshProjectAfterTopicRename: true }),
			}),
		)
	})

	it("releases screenshot blobs only after send succeeds", async () => {
		const currentProject = { id: "project-1" }
		const currentTopic = { id: "topic-1" }
		const mentionItems = [
			{
				type: "mention",
				attrs: {
					data: { is_html_screenshot: true, storage_id: "region-1" },
				},
			},
		]
		mocks.preparePanelSend.mockResolvedValue({
			params: { value: { type: "doc" }, mentionItems },
			context: {},
			currentProject,
			currentTopic,
		})
		mocks.sendPanelMessage.mockResolvedValue({ currentProject, currentTopic })

		render(
			<DefaultMessageEditorContainer
				editorContext={{
					selectedProject: currentProject as never,
					selectedTopic: currentTopic as never,
					topicMode: TopicMode.MicroApp,
					onMessageSendReady: (sendMessage) => {
						mocks.handleSend = sendMessage as typeof mocks.handleSend
					},
				}}
			/>,
		)

		await act(async () => {
			await mocks.handleSend?.({
				value: { type: "doc" },
				mentionItems: mentionItems as never,
				topicMode: TopicMode.MicroApp,
			})
		})

		expect(mocks.releaseHtmlScreenshotsAfterSend).toHaveBeenCalledWith(mentionItems)
	})

	it("keeps screenshot blobs when send preparation fails", async () => {
		mocks.preparePanelSend.mockResolvedValue(null)

		render(
			<DefaultMessageEditorContainer
				editorContext={{
					selectedProject: { id: "project-1" } as never,
					selectedTopic: { id: "topic-1" } as never,
					topicMode: TopicMode.MicroApp,
					onMessageSendReady: (sendMessage) => {
						mocks.handleSend = sendMessage as typeof mocks.handleSend
					},
				}}
			/>,
		)

		await act(async () => {
			await mocks.handleSend?.({
				value: { type: "doc" },
				mentionItems: [] as never,
				topicMode: TopicMode.MicroApp,
			})
		})

		expect(mocks.releaseHtmlScreenshotsAfterSend).not.toHaveBeenCalled()
	})
})

it.each(["queue-1", undefined])(
	"preserves the editor draft for programmatic queue requests (%s)",
	async (queueId) => {
		mocks.clearContentAfterSend.mockClear()
		mocks.setContent.mockClear()
		mocks.addToQueue.mockResolvedValue(queueId)
		render(
			<DefaultMessageEditorContainer
				editorContext={{
					selectedProject: { id: "project-1" } as never,
					selectedTopic: { id: "topic-1" } as never,
					topicMode: TopicMode.Default,
					showLoading: true,
					queueContext: {
						addToQueue: mocks.addToQueue,
						queueDraft: null,
						onEditorReady: vi.fn(),
						finishEditQueueItem: vi.fn(),
					},
					onMessageSendReady: (send) => {
						mocks.handleSend = send as typeof mocks.handleSend
					},
				}}
			/>,
		)
		await act(async () => {
			const accepted = await mocks.handleSend?.({
				value: {
					type: "doc",
					content: [
						{ type: "paragraph", content: [{ type: "text", text: "Create a skill" }] },
					],
				},
				mentionItems: [],
				topicMode: TopicMode.Default,
				shouldClearEditorAfterSend: false,
			})
			expect(accepted).toBe(Boolean(queueId))
		})
		expect(mocks.clearContentAfterSend).not.toHaveBeenCalled()
		expect(mocks.setContent).not.toHaveBeenCalled()
	},
)

it("queues a message while the topic remains running after loading briefly clears", async () => {
	render(
		<DefaultMessageEditorContainer
			editorContext={{
				selectedProject: { id: "project-1" } as never,
				selectedTopic: { id: "topic-1", task_status: "running" } as never,
				topicMode: TopicMode.Default,
				showLoading: false,
				isTaskRunning: true,
				queueContext: {
					editorRef: { current: null },
					editingQueueItem: null,
					queueDraft: null,
					cancelEditQueueItem: vi.fn(async () => undefined),
					onEditorReady: vi.fn(),
					retryQueueDraftRemoval: vi.fn(async () => undefined),
					isQueueOperationPending: false,
					addToQueue: mocks.addToQueue,
					finishEditQueueItem: vi.fn(),
				},
				onMessageSendReady: (send) => {
					mocks.handleSend = send as typeof mocks.handleSend
				},
			}}
		/>,
	)

	await act(async () => {
		await mocks.handleSend?.({
			value: { type: "doc" },
			mentionItems: [],
			topicMode: TopicMode.Default,
		})
	})

	expect(mocks.addToQueue).toHaveBeenCalled()
})
