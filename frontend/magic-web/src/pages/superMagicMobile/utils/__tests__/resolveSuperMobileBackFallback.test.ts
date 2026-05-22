import { describe, expect, it } from "vitest"
import { RouteName } from "@/routes/constants"
import {
	resolveSuperMobileBackFallbackByRoute,
	resolveSuperMobileProjectDetailBackFallback,
} from "../resolveSuperMobileBackFallback"

describe("resolveSuperMobileProjectDetailBackFallback", () => {
	it("returns shared workspace list for collaboration projects", () => {
		expect(
			resolveSuperMobileProjectDetailBackFallback({
				workspaceId: "ws-1",
				isSharedProjectDetail: true,
			}),
		).toEqual({ name: RouteName.SuperSharedWorkspace })
	})

	it("returns workspace projects for normal projects", () => {
		expect(
			resolveSuperMobileProjectDetailBackFallback({
				workspaceId: "ws-1",
				isSharedProjectDetail: false,
			}),
		).toEqual({
			name: RouteName.SuperWorkspaceProjects,
			params: { workspaceId: "ws-1" },
		})
	})

	it("returns null without workspace id", () => {
		expect(
			resolveSuperMobileProjectDetailBackFallback({
				workspaceId: "",
				isSharedProjectDetail: false,
			}),
		).toBeNull()
	})
})

describe("resolveSuperMobileBackFallbackByRoute", () => {
	it("resolves chat detail to chats list", () => {
		expect(
			resolveSuperMobileBackFallbackByRoute({
				routeName: RouteName.SuperChatProjectState,
			}),
		).toEqual({ name: RouteName.SuperChatsList })
	})

	it("resolves workspace projects to workspaces list", () => {
		expect(
			resolveSuperMobileBackFallbackByRoute({
				routeName: RouteName.SuperWorkspaceProjects,
				workspaceId: "ws-1",
			}),
		).toEqual({ name: RouteName.SuperWorkspacesList })
	})
})
