import { describe, expect, it, vi } from "vitest"
import { RouteName } from "@/routes/constants"

const routesMatchMock = vi.fn()

vi.mock("@/routes/history/helpers", () => ({
	routesMatch: (...args: unknown[]) => routesMatchMock(...args),
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
})
