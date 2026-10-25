import { renderHook } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const pathnameState = vi.hoisted(() => ({
	current: "/cluster/super/chats",
}))

const matchRoutesMock = vi.hoisted(() => vi.fn())

vi.mock("@/routes/routes", () => ({
	registerRoutes: vi.fn(() => []),
}))

vi.mock("react-router", async (importOriginal) => {
	const actual = await importOriginal<typeof import("react-router")>()
	return {
		...actual,
		useLocation: () => ({
			pathname: pathnameState.current,
			search: "",
			hash: "",
			state: null,
			key: "default",
		}),
		matchRoutes: matchRoutesMock,
	}
})

vi.mock("@/hooks/i18n/useMainTranslation", () => ({
	useMainTranslation: () => ({
		t: (key: string) => {
			const labels: Record<string, string> = {
				"routes.super": "超级麦吉",
				"routes.superChats": "对话",
				"routes.superWorkspaces": "工作空间",
				"routes.workspace": "工作台",
				"meta.title": "超级麦吉 - 首个开源企业级 AI Agent 平台",
			}
			return labels[key] ?? key
		},
	}),
}))

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string, options?: { defaultValue?: string }) => {
			const labels: Record<string, string> = {
				"nav.capabilitySubMenu.oaApprovalManagement": "所有审批",
				"nav.capabilitySubMenu.oaApprovalDesign": "审批模板设计",
			}
			return labels[key] ?? options?.defaultValue ?? key
		},
	}),
}))
import useMetaSet from "@/routes/hooks/useRoutesMetaSet"

describe("useMetaSet", () => {
	beforeEach(() => {
		document.title = ""
		matchRoutesMock.mockReset()
	})

	it("sets document.title from route meta.title key", () => {
		pathnameState.current = "/cluster/super/chats"
		matchRoutesMock.mockReturnValue([{ route: { meta: { title: "routes.superChats" } } }])

		renderHook(() => useMetaSet())

		expect(document.title).toBe("对话 - 超级麦吉 - 首个开源企业级 AI Agent 平台")
	})

	it("sets document.title for Super mobile home route meta", () => {
		pathnameState.current = "/cluster/mobile-home"
		matchRoutesMock.mockReturnValue([{ route: { meta: { title: "routes.super" } } }])

		renderHook(() => useMetaSet())

		expect(document.title).toBe("超级麦吉 - 超级麦吉 - 首个开源企业级 AI Agent 平台")
	})

	it("sets document.title for workspaces list route meta", () => {
		pathnameState.current = "/cluster/super/workspaces"
		matchRoutesMock.mockReturnValue([{ route: { meta: { title: "routes.superWorkspaces" } } }])

		renderHook(() => useMetaSet())

		expect(document.title).toBe("工作空间 - 超级麦吉 - 首个开源企业级 AI Agent 平台")
	})

	it("uses the sidebar title when route meta title is absent", () => {
		pathnameState.current = "/admin/enterprise/oa-approval/approval-manage"
		matchRoutesMock.mockReturnValue([
			{ route: { title: "nav.capabilitySubMenu.oaApprovalManagement" } },
		])

		renderHook(() => useMetaSet())

		expect(document.title).toBe("所有审批 - 超级麦吉 - 首个开源企业级 AI Agent 平台")
	})

	it("uses the admin navigation translation for an admin route title", () => {
		pathnameState.current = "/admin/enterprise/oa-approval/design"
		matchRoutesMock.mockReturnValue([
			{ route: { title: "nav.capabilitySubMenu.oaApprovalDesign" } },
		])

		renderHook(() => useMetaSet())

		expect(document.title).toBe("审批模板设计 - 超级麦吉 - 首个开源企业级 AI Agent 平台")
	})

	it("does not use a route title fallback outside the admin", () => {
		pathnameState.current = "/cluster/super/chats"
		document.title = "动态页面标题"
		matchRoutesMock.mockReturnValue([{ route: { title: "routes.chat" } }])

		renderHook(() => useMetaSet())

		expect(document.title).toBe("动态页面标题")
	})

	it("does not reset document.title when route has no meta", () => {
		pathnameState.current = "/cluster/super/project/p-1"
		document.title = "演示项目 - 我的工作区 - 超级麦吉 - 首个开源企业级 AI Agent 平台"
		matchRoutesMock.mockReturnValue([{ route: {} }])

		renderHook(() => useMetaSet())

		expect(document.title).toBe(
			"演示项目 - 我的工作区 - 超级麦吉 - 首个开源企业级 AI Agent 平台",
		)
	})

	it("allows setMeta override for dynamic workspace title", () => {
		pathnameState.current = "/cluster/super/workspaces/ws-1"
		matchRoutesMock.mockReturnValue([{ route: { meta: { title: "routes.workspace" } } }])

		const { result } = renderHook(() => useMetaSet())

		result.current.setMeta({ title: "我的工作区" })

		expect(document.title).toBe("我的工作区 - 超级麦吉 - 首个开源企业级 AI Agent 平台")
	})
})
