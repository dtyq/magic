import React from "react"
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { TopicMode } from "@/pages/superMagic/pages/Workspace/TopicMode"
import { beforeEach, describe, expect, it, vi } from "vitest"
import globalMentionPanelStore from "@/components/business/MentionPanel/builtin-store"
import type {
	MessageEditorProps,
	MessageEditorRef,
} from "@/components/business/AccountSetting/pages/ScheduledTasks/components/MessageEditor"
import globalProjectFilesStore, { ProjectFilesStore } from "@/stores/projectFiles"
import { ScheduledTask } from "@/types/scheduledTask"
import { MicroAppScheduledTasksModify } from "../MicroAppScheduledTasksModify"
import { applyMicroAppScheduledTaskContext } from "../utils"

const mocks = vi.hoisted(() => ({
	useAttachments: vi.fn(),
	messageEditorProps: [] as MessageEditorProps[],
	setSelectedImageModel: vi.fn(),
	setSelectedVideoModel: vi.fn(),
	editorModels: {
		language: null as MessageEditorRef["selectedModel"],
		image: null as MessageEditorRef["selectedImageModel"],
		video: null as MessageEditorRef["selectedVideoModel"],
	},
}))

vi.mock("antd", async (importOriginal) => {
	const actual = await importOriginal<typeof import("antd")>()
	return { Form: actual.Form }
})

vi.mock("react-i18next", async (importOriginal) => {
	const actual = await importOriginal<typeof import("react-i18next")>()
	return {
		...actual,
		useTranslation: () => ({ t: (key: string) => key }),
	}
})

vi.mock("@/hooks/useIsMobile", () => ({
	useIsMobile: () => false,
}))

vi.mock("@/components/base", () => ({
	MagicDatePicker: () => <div data-testid="date-picker" />,
}))

vi.mock("@/components/business/AccountSetting/pages/ScheduledTasks/components/FormSwitch", () => ({
	FormSwitch: ({
		checked,
		onChange,
	}: {
		checked?: boolean
		onChange?: (value: boolean) => void
	}) => (
		<input
			type="checkbox"
			checked={checked}
			onChange={(event) => onChange?.(event.target.checked)}
		/>
	),
}))

vi.mock("@/components/base/MagicToaster/utils", () => ({
	default: { error: vi.fn() },
}))

vi.mock(
	"@/pages/superMagic/components/MessageList/components/Text/components/RichText/utils",
	() => ({ parseContent: () => null }),
)

vi.mock("@/components/business/AccountSetting/pages/ScheduledTasks/store/MCPTempStorage", () => ({
	default: { mcpList: [] },
}))

vi.mock("@/components/business/AccountSetting/pages/ScheduledTasks/hooks/useAttachments", () => ({
	useAttachments: mocks.useAttachments,
}))

vi.mock(
	"@/components/business/AccountSetting/pages/ScheduledTasks/components/MessageEditor",
	() => ({
		default: React.forwardRef<MessageEditorRef, MessageEditorProps>(
			function MockMessageEditor(props, ref) {
				mocks.messageEditorProps.push(props)
				React.useImperativeHandle(ref, () => ({
					editor: {
						getText: () => "test prompt",
						getJSON: () => ({
							type: "doc",
							content: [
								{
									type: "paragraph",
									content: [{ type: "text", text: "test prompt" }],
								},
							],
						}),
					},
					mentionItems: [],
					get selectedModel() {
						return mocks.editorModels.language
					},
					get selectedImageModel() {
						return mocks.editorModels.image
					},
					get selectedVideoModel() {
						return mocks.editorModels.video
					},
					setContent: vi.fn(),
					setSelectedModel: vi.fn(),
					setSelectedImageModel: mocks.setSelectedImageModel,
					setSelectedVideoModel: mocks.setSelectedVideoModel,
				}))
				return <div data-testid="micro-app-message-editor" />
			},
		),
	}),
)

vi.mock(
	"@/components/business/AccountSetting/pages/ScheduledTasks/components/ScheduledItem",
	() => ({
		ScheduledItem: () => <div data-testid="scheduled-item" />,
	}),
)

vi.mock(
	"@/components/business/AccountSetting/pages/ScheduledTasks/components/ProjectTopicItem",
	() => ({
		default: () => <div data-testid="project-topic-item" />,
	}),
)

describe("MicroAppScheduledTasksModify", () => {
	beforeEach(() => {
		mocks.messageEditorProps.length = 0
		mocks.useAttachments.mockReset()
		mocks.useAttachments.mockReturnValue({ attachments: [], updateAttachments: vi.fn() })
		mocks.setSelectedImageModel.mockReset()
		mocks.setSelectedVideoModel.mockReset()
		mocks.editorModels.language = null
		mocks.editorModels.image = null
		mocks.editorModels.video = null
	})

	it("renders the current workspace and project instead of stale task context", () => {
		const context = {
			workspaceId: "hidden-workspace",
			projectId: "micro-app-project",
			workspaceName: "微应用工作区",
			projectName: "当前微应用",
		}
		const staleTask: Partial<ScheduledTask.UpdateTask> = {
			task_name: "每日汇报",
			workspace_id: "old-workspace",
			project_id: "old-project",
			topic_id: "",
			time_config: {
				type: ScheduledTask.ScheduleType.Once,
				day: "2026-08-03",
				time: "10:00",
			},
			enabled: 1,
			message_type: "rich_text",
			message_content: { content: "{}" },
		}

		render(
			<MicroAppScheduledTasksModify
				mode="edit"
				context={context}
				initialValues={staleTask}
			/>,
		)

		expect(screen.getByText("当前微应用")).toBeInTheDocument()
		expect(screen.queryByText("微应用工作区")).not.toBeInTheDocument()
		expect(screen.queryByText("old-workspace")).not.toBeInTheDocument()
		expect(screen.queryByText("old-project")).not.toBeInTheDocument()
	})

	it("uses modal-scoped project and mention stores for attachments and the editor", () => {
		render(
			<MicroAppScheduledTasksModify
				mode="edit"
				context={{
					workspaceId: "workspace-1",
					projectId: "micro-app-project",
				}}
			/>,
		)

		const attachmentOptions = mocks.useAttachments.mock.calls.at(-1)?.[0]
		const editorProps = mocks.messageEditorProps.at(-1)

		expect(attachmentOptions.projectFilesStore).toBeInstanceOf(ProjectFilesStore)
		expect(attachmentOptions.projectFilesStore).not.toBe(globalProjectFilesStore)
		expect(attachmentOptions.mentionPanelStore).not.toBe(globalMentionPanelStore)
		expect(editorProps?.projectFilesStore).toBe(attachmentOptions.projectFilesStore)
		expect(editorProps?.mentionPanelStore).toBe(attachmentOptions.mentionPanelStore)
	})

	it("uses the default mode catalog for the micro-app task editor", () => {
		render(
			<MicroAppScheduledTasksModify
				mode="edit"
				context={{ workspaceId: "workspace-1", projectId: "micro-app-project" }}
				initialValues={{
					message_content: {
						content: "{}",
						extra: { super_agent: { topic_pattern: "general" } },
					},
				}}
			/>,
		)

		const editorProps = mocks.messageEditorProps.at(-1)
		expect(editorProps?.topicMode).toBe("default")
		expect(editorProps?.setTopicMode).toBeUndefined()
		expect(editorProps?.showModeToggle).toBeUndefined()
	})

	it("restores image and video models when editing a task", async () => {
		const imageModel = { model_id: "image-model" }
		const videoModel = { model_id: "video-model" }

		render(
			<MicroAppScheduledTasksModify
				mode="edit"
				context={{ workspaceId: "workspace-1", projectId: "project-1" }}
				initialValues={{
					message_content: {
						content: "{}",
						extra: {
							super_agent: { image_model: imageModel, video_model: videoModel },
						},
					},
				}}
			/>,
		)

		await waitFor(() => {
			expect(mocks.setSelectedImageModel).toHaveBeenCalledWith(imageModel)
			expect(mocks.setSelectedVideoModel).toHaveBeenCalledWith(videoModel)
		})
	})

	it("submits a runtime task with its app mention before the editor message", async () => {
		const onSubmit = vi.fn()
		render(
			<MicroAppScheduledTasksModify
				mode="create"
				context={{
					workspaceId: "runtime-workspace",
					projectId: "runtime-project",
					microAppId: "app-1",
					microAppName: "My app",
				}}
				initialValues={{
					task_name: "Daily report",
					topic_id: "0",
					time_config: { type: ScheduledTask.ScheduleType.Daily, time: "10:00" },
				}}
				onSubmit={onSubmit}
			/>,
		)
		fireEvent.click(screen.getByTestId("micro-app-scheduled-task-submit"))
		await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))
		const submitted = onSubmit.mock.calls[0][0] as ScheduledTask.UpdateTask
		expect(submitted).toMatchObject({
			project_id: "runtime-project",
			workspace_id: "runtime-workspace",
		})
		expect(JSON.parse(submitted.message_content.content as string).content[0].content).toEqual([
			{
				type: "mention",
				attrs: { type: "micro_app", data: { app_id: "app-1", app_name: "My app" } },
			},
			{ type: "text", text: "test prompt" },
		])
		expect(submitted.message_content.extra?.super_agent.mentions).toHaveLength(1)
		expect(submitted.message_content.extra?.super_agent.topic_pattern).toBe(TopicMode.General)
	})

	it("lets runtime tasks switch employees without exposing workspace or project controls", async () => {
		const onSubmit = vi.fn()
		render(
			<MicroAppScheduledTasksModify
				mode="create"
				context={{
					workspaceId: "runtime-workspace",
					projectId: "runtime-project",
					microAppId: "app-1",
				}}
				initialValues={{
					task_name: "Report",
					time_config: { type: ScheduledTask.ScheduleType.Daily, time: "10:00" },
				}}
				onSubmit={onSubmit}
			/>,
		)
		expect(screen.queryByText("scheduleTask.projectScope")).not.toBeInTheDocument()
		expect(screen.queryByText("scheduleTask.agentScope")).not.toBeInTheDocument()
		expect(screen.queryByText("runtime-workspace")).not.toBeInTheDocument()
		expect(screen.queryByText("runtime-project")).not.toBeInTheDocument()
		expect(mocks.messageEditorProps.at(-1)).toMatchObject({
			showModeToggle: true,
			allowChangeMode: true,
		})
		act(() => mocks.messageEditorProps.at(-1)?.setTopicMode?.("SMA-test" as TopicMode))
		fireEvent.click(screen.getByTestId("micro-app-scheduled-task-submit"))
		await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))
		expect(onSubmit.mock.calls[0][0]).toMatchObject({
			workspace_id: "runtime-workspace",
			project_id: "runtime-project",
			message_content: {
				extra: {
					super_agent: { topic_pattern: TopicMode.CustomAgent, agent_code: "SMA-test" },
				},
			},
		})
		act(() => mocks.messageEditorProps.at(-1)?.setTopicMode?.(TopicMode.General))
		fireEvent.click(screen.getByTestId("micro-app-scheduled-task-submit"))
		await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(2))
		const extra = onSubmit.mock.calls[1][0].message_content.extra.super_agent
		expect(extra.topic_pattern).toBe(TopicMode.General)
		expect(extra.agent_code).toBeUndefined()
		expect(extra.mentions[0].attrs.data.app_id).toBe("app-1")
	})

	it("restores the saved runtime employee when editing a scheduled task", () => {
		render(
			<MicroAppScheduledTasksModify
				mode="edit"
				context={{ workspaceId: "w", projectId: "p", microAppId: "app-1" }}
				initialValues={{
					message_content: {
						content: "{}",
						extra: {
							super_agent: {
								topic_pattern: TopicMode.CustomAgent,
								agent_code: "SMA-saved",
							},
						},
					},
				}}
			/>,
		)
		expect(mocks.messageEditorProps.at(-1)).toMatchObject({
			topicMode: "SMA-saved",
			agentCode: "SMA-saved",
			showModeToggle: true,
		})
	})

	it("forces the submitted task to use the current micro app context", () => {
		const task = {
			task_name: "每日汇报",
			workspace_id: "old-workspace",
			project_id: "old-project",
			topic_id: "topic-1",
			time_config: { type: ScheduledTask.ScheduleType.Daily, time: "10:00" },
			enabled: 1,
			message_type: "rich_text",
			message_content: { content: "{}" },
		}

		expect(
			applyMicroAppScheduledTaskContext(task, {
				workspaceId: "hidden-workspace",
				projectId: "micro-app-project",
			}),
		).toMatchObject({
			workspace_id: "hidden-workspace",
			project_id: "micro-app-project",
			topic_id: "topic-1",
		})
	})
})
