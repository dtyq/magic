import { beforeEach, describe, expect, it, vi } from "vitest"
import { TopicMode } from "../../pages/Workspace/TopicMode"

const mocks = vi.hoisted(() => ({
	warning: vi.fn(),
	t: vi.fn(() => "当前无法使用指定员工"),
	isCachedChatWorkspaceProject: vi.fn(() => false),
}))

vi.mock("@/components/base/MagicToaster/utils", () => ({
	default: {
		warning: mocks.warning,
	},
}))

vi.mock("i18next", () => ({
	default: {
		t: mocks.t,
	},
}))

vi.mock("../isChatWorkspaceProject", () => ({
	isCachedChatWorkspaceProject: (project?: { workspace_id?: string } | null) =>
		mocks.isCachedChatWorkspaceProject(project),
}))

import { notifySpecifiedAgentUnavailable } from "../notifySpecifiedAgentUnavailable"

describe("notifySpecifiedAgentUnavailable", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		mocks.isCachedChatWorkspaceProject.mockReturnValue(false)
	})

	it("toasts when MagiClaw ignores a different agent", () => {
		notifySpecifiedAgentUnavailable(TopicMode.General, { project_mode: TopicMode.MagiClaw })

		expect(mocks.warning).toHaveBeenCalledWith(
			expect.objectContaining({
				key: "html-iframe-specified-agent-unavailable",
				content: "当前无法使用指定员工",
			}),
		)
	})

	it("does not toast when no agent is specified", () => {
		notifySpecifiedAgentUnavailable(undefined, { project_mode: TopicMode.MagiClaw })
		expect(mocks.warning).not.toHaveBeenCalled()
	})

	it("does not toast when the specified agent matches MagiClaw", () => {
		notifySpecifiedAgentUnavailable(TopicMode.MagiClaw, { project_mode: TopicMode.MagiClaw })
		expect(mocks.warning).not.toHaveBeenCalled()
	})

	it("does not toast on multi-topic hosts", () => {
		notifySpecifiedAgentUnavailable(TopicMode.General, { project_mode: TopicMode.MicroApp })
		expect(mocks.warning).not.toHaveBeenCalled()
	})
})
