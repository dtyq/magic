import { beforeEach, describe, expect, it, vi } from "vitest"
import { TopicMode } from "../../pages/Workspace/TopicMode"

const mocks = vi.hoisted(() => ({
	isCachedChatWorkspaceProject: vi.fn(() => false),
}))

vi.mock("../isChatWorkspaceProject", () => ({
	isCachedChatWorkspaceProject: (project?: { workspace_id?: string } | null) =>
		mocks.isCachedChatWorkspaceProject(project),
}))

import { isSingleTopicHostProject, resolveIframeHostTopicMode } from "../isSingleTopicHostProject"

describe("isSingleTopicHostProject", () => {
	beforeEach(() => {
		mocks.isCachedChatWorkspaceProject.mockReset()
		mocks.isCachedChatWorkspaceProject.mockReturnValue(false)
	})

	it("treats MagiClaw and Chat hosts as single-topic", () => {
		expect(isSingleTopicHostProject({ project_mode: TopicMode.MagiClaw })).toBe(true)
		expect(isSingleTopicHostProject({ project_mode: TopicMode.Chat })).toBe(true)
	})

	it("treats cached chat workspace projects as single-topic", () => {
		mocks.isCachedChatWorkspaceProject.mockImplementation(
			(project?: { workspace_id?: string } | null) => project?.workspace_id === "chat-ws",
		)

		expect(
			isSingleTopicHostProject({
				project_mode: TopicMode.General,
				workspace_id: "chat-ws",
			}),
		).toBe(true)
		expect(
			isSingleTopicHostProject({
				project_mode: TopicMode.General,
				workspace_id: "other-ws",
			}),
		).toBe(false)
	})

	it("does not treat multi-topic hosts as single-topic", () => {
		expect(isSingleTopicHostProject({ project_mode: TopicMode.MicroApp })).toBe(false)
		expect(isSingleTopicHostProject({ project_mode: TopicMode.General })).toBe(false)
		expect(isSingleTopicHostProject(null)).toBe(false)
		expect(isSingleTopicHostProject(undefined)).toBe(false)
	})
})

describe("resolveIframeHostTopicMode", () => {
	beforeEach(() => {
		mocks.isCachedChatWorkspaceProject.mockReset()
		mocks.isCachedChatWorkspaceProject.mockReturnValue(false)
	})

	it("keeps the host agent pattern for single-topic projects", () => {
		expect(resolveIframeHostTopicMode({ project_mode: TopicMode.MagiClaw })).toBe(
			TopicMode.MagiClaw,
		)
		expect(resolveIframeHostTopicMode({ project_mode: TopicMode.Chat })).toBe(TopicMode.Chat)
	})

	it("keeps MagiClaw even when the project is in the chat workspace cache", () => {
		mocks.isCachedChatWorkspaceProject.mockReturnValue(true)
		expect(resolveIframeHostTopicMode({ project_mode: TopicMode.MagiClaw })).toBe(
			TopicMode.MagiClaw,
		)
	})

	it("uses Chat when the project belongs to the chat workspace", () => {
		mocks.isCachedChatWorkspaceProject.mockReturnValue(true)
		expect(resolveIframeHostTopicMode({ project_mode: TopicMode.General })).toBe(TopicMode.Chat)
	})

	it("falls back to MicroApp for other hosts", () => {
		expect(resolveIframeHostTopicMode({ project_mode: TopicMode.General })).toBe(
			TopicMode.MicroApp,
		)
		expect(resolveIframeHostTopicMode(null)).toBe(TopicMode.MicroApp)
	})
})
