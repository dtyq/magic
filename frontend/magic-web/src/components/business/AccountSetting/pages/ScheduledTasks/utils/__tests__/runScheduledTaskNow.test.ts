import { beforeEach, describe, expect, it, vi } from "vitest"
import { TopicMode } from "@/pages/superMagic/pages/Workspace/TopicMode"
import type { ScheduledTask } from "@/types/scheduledTask"
import { buildScheduledTaskRunNowPayload, prepareScheduledTaskRunNow } from "../runScheduledTaskNow"

const projectState = vi.hoisted(() => ({
	selectedProject: { id: "project-current" } as { id: string } | null,
}))

const { saveMcp } = vi.hoisted(() => ({
	saveMcp: vi.fn(),
}))

vi.mock("@/pages/superMagic/stores/core", () => ({
	projectStore: {
		get selectedProject() {
			return projectState.selectedProject
		},
	},
}))

vi.mock("@/components/Agent/MCP/store/mcp-access", () => ({
	getMCPAccess: vi.fn(() => ({
		save: saveMcp,
	})),
}))

vi.mock("@/services/superMagic/DefaultAgentSelectionService", () => ({
	resolveAgentSelection: vi.fn((_topicPattern?: TopicMode, agentCode?: string) => ({
		modeIdentifier: agentCode ? "SMA001" : TopicMode.General,
		topicPattern: agentCode ? TopicMode.CustomAgent : TopicMode.General,
		agentCode,
	})),
}))

function createTask(overrides: Partial<ScheduledTask.Task> = {}): ScheduledTask.Task {
	return {
		id: "task-1",
		message_content: {
			content: JSON.stringify({
				type: "doc",
				content: [{ type: "paragraph", content: [{ type: "text", text: "hello" }] }],
			}),
			extra: {
				super_agent: {
					topic_pattern: TopicMode.General,
					model: { model_id: "gpt-4" } as ScheduledTask.ModelSelection & {
						model_id: string
					},
					mentions: [],
				},
			},
		},
		message_type: "rich_text",
		organization_code: "org",
		project_id: "project-current",
		enabled: 1,
		completed: 0,
		task_name: "Daily report",
		task_scheduler_crontab_id: "cron-1",
		time_config: { type: "daily_repeat" as ScheduledTask.ScheduleType, time: "09:00" },
		topic_id: "0",
		updated_at: "",
		user_id: "user-1",
		workspace_id: "workspace-1",
		workspace_name: "Workspace",
		project_name: "Project",
		topic_name: "",
		deadline: "",
		plugins: {
			servers: [{ id: "mcp-1" }],
		},
		...overrides,
	}
}

describe("runScheduledTaskNow", () => {
	beforeEach(() => {
		projectState.selectedProject = { id: "project-current" }
		saveMcp.mockReset()
	})

	it("builds create-new-topic payload from scheduled task detail", () => {
		const payload = buildScheduledTaskRunNowPayload(createTask())

		expect(payload?.topicName).toBe("Daily report")
		expect(payload?.topicMode).toBe(TopicMode.General)
		expect(payload?.afterCreate?.content).toMatchObject({ type: "doc" })
		expect(payload?.afterCreate?.send).toBe(true)
		expect(payload?.afterCreate?.selectedModel).toMatchObject({ model_id: "gpt-4" })
	})

	it("syncs MCP plugins to the current selected project", async () => {
		await prepareScheduledTaskRunNow(createTask())

		expect(saveMcp).toHaveBeenCalledWith({
			selectedIds: new Set(["mcp-1"]),
			items: [{ id: "mcp-1" }],
		})
	})
})
