import { describe, expect, it, vi } from "vitest"
import { RouteName } from "@/routes/constants"

const routesMatchMock = vi.fn()

vi.mock("@/routes/history/helpers", () => ({
	routesMatch: (...args: unknown[]) => routesMatchMock(...args),
}))

const canvasState = vi.hoisted(() => ({
	selectedTopic: null as { id: string; project_id: string } | null,
	cachedTopicId: null as string | null,
}))

vi.mock("@/models/user", () => ({ userStore: { user: { userInfo: { user_id: "u-1" } } } }))
vi.mock("../../stores/core", () => ({
	topicStore: {
		get selectedTopic() {
			return canvasState.selectedTopic
		},
	},
}))
vi.mock("../superMagicCache", () => ({
	ProjectTopicMapCache: { get: () => canvasState.cachedTopicId },
}))

import { resolveSuperPopRefreshParams } from "../resolve-super-pop-refresh-params"

describe("resolveSuperPopRefreshParams", () => {
	it("returns null when pathname is outside super routes", () => {
		expect(resolveSuperPopRefreshParams("/global/home")).toBeNull()
		expect(routesMatchMock).not.toHaveBeenCalled()
	})

	it("maps chat project route with projectId and topicId", () => {
		routesMatchMock.mockReturnValue({
			route: { name: RouteName.SuperChatProjectState },
			params: { projectId: "project-1", topicId: "topic-1" },
		})

		expect(resolveSuperPopRefreshParams("/global/super/chat/project-1/topic-1")).toEqual({
			projectId: "project-1",
			topicId: "topic-1",
		})
	})

	it("clears project context on chats list route", () => {
		routesMatchMock.mockReturnValue({
			route: { name: RouteName.SuperChatsList },
			params: {},
		})

		expect(resolveSuperPopRefreshParams("/global/super/chats")).toEqual({
			projectId: undefined,
			topicId: undefined,
		})
	})

	it("maps workspace project topic route", () => {
		routesMatchMock.mockReturnValue({
			route: { name: RouteName.SuperWorkspaceProjectTopicState },
			params: { projectId: "project-2", topicId: "topic-2" },
		})

		expect(resolveSuperPopRefreshParams("/global/super/project-2/topic-2")).toEqual({
			projectId: "project-2",
			topicId: "topic-2",
		})
	})

	it("keeps the open topic of a canvas project, whose address has no topic", () => {
		routesMatchMock.mockReturnValue({
			route: { name: RouteName.AiCanvasProjectState },
			params: { projectId: "canvas-1" },
		})
		canvasState.selectedTopic = { id: "topic-open", project_id: "canvas-1" }
		canvasState.cachedTopicId = "topic-cached"

		expect(resolveSuperPopRefreshParams("/global/super/ai-canvas/canvas-1")).toEqual({
			projectId: "canvas-1",
			topicId: "topic-open",
		})
	})

	it("falls back to the last topic of a canvas project", () => {
		routesMatchMock.mockReturnValue({
			route: { name: RouteName.AiCanvasProjectState },
			params: { projectId: "canvas-1" },
		})
		canvasState.selectedTopic = { id: "topic-other", project_id: "project-9" }
		canvasState.cachedTopicId = "topic-cached"

		expect(resolveSuperPopRefreshParams("/global/super/ai-canvas/canvas-1")).toEqual({
			projectId: "canvas-1",
			topicId: "topic-cached",
		})
	})
})
