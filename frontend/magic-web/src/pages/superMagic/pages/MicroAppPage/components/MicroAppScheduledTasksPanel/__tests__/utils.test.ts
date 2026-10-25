import type { TFunction } from "i18next"
import { describe, expect, it } from "vitest"
import { TopicMode } from "@/pages/superMagic/pages/Workspace/TopicMode"
import { ScheduledTask } from "@/types/scheduledTask"
import { serializeScheduledTaskModel } from "@/components/business/AccountSetting/pages/ScheduledTasks/utils"
import { applyMicroAppScheduledTaskContext, formatTaskSchedule } from "../utils"

const t = ((key: string, options?: Record<string, unknown>) => {
	if (key.startsWith("format.weekDay.")) return `weekday-${key.at(-1)}`
	return `${key}:${JSON.stringify(options || {})}`
}) as TFunction

describe("serializeScheduledTaskModel", () => {
	it("keeps only runtime identity and edit-time display fields", () => {
		expect(
			serializeScheduledTaskModel({
				id: "database-id",
				group_id: "group-id",
				model_id: "video-model",
				model_name: "Video model",
				provider_model_id: "provider-model",
				model_description: "Description",
				model_icon: "https://example.com/model.png",
				model_status: "normal",
				sort: 1,
				tags: [],
			}),
		).toEqual({
			model_id: "video-model",
			model_name: "Video model",
			model_icon: "https://example.com/model.png",
		})
	})

	it("omits optional display fields when they are empty", () => {
		expect(
			serializeScheduledTaskModel({
				id: "database-id",
				group_id: "group-id",
				model_id: "image-model",
				model_name: "",
				provider_model_id: "provider-model",
				model_description: "",
				model_icon: "",
				model_status: "normal",
				sort: 0,
			}),
		).toEqual({ model_id: "image-model" })
	})
})

describe("formatTaskSchedule", () => {
	it("binds runtime tasks and prepends one trusted mention on every save", () => {
		const existingMention = {
			type: "mention" as const,
			attrs: { type: "micro_app" as const, data: { app_id: "app-1", app_name: "Old name" } },
		}
		const otherMention = {
			type: "mention" as const,
			attrs: { type: "micro_app" as const, data: { app_id: "app-2", app_name: "Other app" } },
		}
		const originalContent = {
			type: "doc",
			content: [
				{
					type: "paragraph",
					content: [
						{ type: "text", text: "Run report" },
						existingMention,
						otherMention,
						existingMention,
					],
				},
			],
		}
		const task: ScheduledTask.UpdateTask = {
			task_name: "Report",
			message_type: "rich_text",
			enabled: 1,
			workspace_id: "source-workspace",
			project_id: "source-project",
			topic_id: "",
			time_config: { type: ScheduledTask.ScheduleType.Daily, time: "09:00" },
			message_content: {
				content: JSON.stringify(originalContent),
				extra: {
					super_agent: {
						mentions: [existingMention, otherMention, existingMention],
						model: null,
					},
				},
			},
		}
		const context = {
			workspaceId: "runtime-workspace",
			projectId: "runtime-project",
			microAppId: "app-1",
			microAppName: "Current app",
		}
		const result = applyMicroAppScheduledTaskContext(task, context)
		const expectedMention = {
			...existingMention,
			attrs: { ...existingMention.attrs, data: { app_id: "app-1", app_name: "Current app" } },
		}
		expect(JSON.parse(result.message_content.content as string).content[0].content).toEqual([
			expectedMention,
			{ type: "text", text: "Run report" },
			otherMention,
		])
		expect(result.message_content.extra?.super_agent.mentions).toEqual([
			expectedMention,
			otherMention,
		])
		expect(result).toMatchObject({
			workspace_id: "runtime-workspace",
			project_id: "runtime-project",
		})
		expect(applyMicroAppScheduledTaskContext(result, context)).toEqual(result)
		expect(JSON.parse(task.message_content.content as string)).toEqual(originalContent)
	})

	it("puts the mention before a leading heading when creating a runtime task", () => {
		const task = {
			message_content: {
				content: {
					type: "doc",
					content: [{ type: "heading", content: [{ type: "text", text: "Report" }] }],
				},
			},
		} as ScheduledTask.UpdateTask
		const result = applyMicroAppScheduledTaskContext(task, {
			workspaceId: "w",
			projectId: "p",
			microAppId: "app-1",
		})
		const content = JSON.parse(result.message_content.content as string)
		expect(content.content[0]).toMatchObject({
			type: "paragraph",
			content: [{ type: "mention", attrs: { data: { app_id: "app-1", app_name: "app-1" } } }],
		})
		expect(content.content[1]).toEqual(
			(task.message_content.content as { content: unknown[] }).content[0],
		)
	})

	it("formats weekly tasks with a localized weekday", () => {
		expect(
			formatTaskSchedule(
				{
					type: ScheduledTask.ScheduleType.Weekly,
					day: "0",
					time: "09:30",
				},
				t,
			),
		).toBe('scheduleTask.weeklyAt:{"day":"weekday-7","time":"09:30"}')
	})

	it("falls back when the schedule is missing", () => {
		expect(formatTaskSchedule(undefined, t)).toBe("scheduleTask.noSchedule:{}")
	})

	it("forces legacy task payloads to use the micro-app mode", () => {
		const imageModel = { model_id: "image-model" }
		const videoModel = { model_id: "video-model" }
		const task = {
			message_content: {
				content: "{}",
				extra: {
					super_agent: {
						topic_pattern: TopicMode.General,
						chat_mode: "normal",
						image_model: imageModel,
						video_model: videoModel,
					},
				},
			},
			message_type: "rich_text",
			enabled: 1,
			task_name: "Task",
			time_config: { type: ScheduledTask.ScheduleType.Once, time: "10:00" },
			topic_id: "",
			workspace_id: "old-workspace",
			project_id: "old-project",
		}

		expect(
			applyMicroAppScheduledTaskContext(task, {
				workspaceId: "workspace-1",
				projectId: "project-1",
			}),
		).toMatchObject({
			workspace_id: "workspace-1",
			project_id: "project-1",
			message_content: {
				extra: {
					super_agent: {
						topic_pattern: TopicMode.MicroApp,
						chat_mode: "normal",
						image_model: imageModel,
						video_model: videoModel,
					},
				},
			},
		})
	})
})
