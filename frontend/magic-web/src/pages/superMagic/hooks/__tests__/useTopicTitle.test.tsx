import { renderHook } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const setMetaMock = vi.hoisted(() => vi.fn())
const pathnameState = vi.hoisted(() => ({ current: "/cluster/super/p-1" }))

vi.mock("@/routes/hooks/useRoutesMetaSet", () => ({
	default: () => ({ setMeta: setMetaMock }),
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
	}
})

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => {
			const labels: Record<string, string> = {
				"project.unnamedProject": "未命名项目",
				"workspace.unnamedWorkspace": "未命名工作区",
				"chat.unnamedChat": "未命名对话",
			}
			return labels[key] ?? key
		},
	}),
}))

const workspaceStoreState = vi.hoisted(() => ({
	selectedWorkspace: null as { id: string; name: string } | null,
	selectedProject: null as { project_name: string; workspace_id?: string } | null,
}))

vi.mock("@/pages/superMagic/stores/core", () => ({
	workspaceStore: workspaceStoreState,
	projectStore: workspaceStoreState,
}))

vi.mock("@/pages/superMagic/utils/isChatWorkspaceProject", () => ({
	isCachedChatWorkspaceProject: (project?: { workspace_id?: string } | null) =>
		project?.workspace_id === "chat-ws",
}))

import {
	resolveSuperPageDocumentTitle,
	useProjectTitle,
} from "@/pages/superMagic/hooks/useTopicTitle"

const t = (key: string) => {
	const labels: Record<string, string> = {
		"project.unnamedProject": "未命名项目",
		"workspace.unnamedWorkspace": "未命名工作区",
		"chat.unnamedChat": "未命名对话",
	}
	return labels[key] ?? key
}

describe("resolveSuperPageDocumentTitle", () => {
	it("uses conversation name only for chat workspace projects", () => {
		expect(
			resolveSuperPageDocumentTitle({
				project: {
					project_name: "产品讨论",
					workspace_id: "chat-ws",
				} as never,
				workspace: { name: "对话工作区" } as never,
				isChatRoute: false,
				t: t as never,
			}),
		).toBe("产品讨论")
	})

	it("uses conversation name only on Super chat route", () => {
		expect(
			resolveSuperPageDocumentTitle({
				project: { project_name: "周会纪要", workspace_id: "ws-1" } as never,
				workspace: { name: "设计空间" } as never,
				isChatRoute: true,
				t: t as never,
			}),
		).toBe("周会纪要")
	})

	it("keeps project and workspace for non-chat Super pages", () => {
		expect(
			resolveSuperPageDocumentTitle({
				project: { project_name: "营销方案", workspace_id: "ws-1" } as never,
				workspace: { name: "设计空间" } as never,
				isChatRoute: false,
				t: t as never,
			}),
		).toBe("营销方案 - 设计空间")
	})
})

describe("useProjectTitle", () => {
	beforeEach(() => {
		setMetaMock.mockReset()
		pathnameState.current = "/cluster/super/p-1"
		workspaceStoreState.selectedWorkspace = null
		workspaceStoreState.selectedProject = null
	})

	it("syncs document title immediately on mount when project and workspace are selected", () => {
		workspaceStoreState.selectedWorkspace = { id: "ws-1", name: "设计空间" }
		workspaceStoreState.selectedProject = {
			project_name: "营销方案",
			workspace_id: "ws-1",
		}

		renderHook(() => useProjectTitle())

		expect(setMetaMock).toHaveBeenCalledWith({
			title: "营销方案 - 设计空间",
		})
	})

	it("syncs chat conversation title without workspace name", () => {
		pathnameState.current = "/cluster/super/chat/p-chat/topic-1"
		workspaceStoreState.selectedWorkspace = { id: "chat-ws", name: "对话工作区" }
		workspaceStoreState.selectedProject = {
			project_name: "需求评审",
			workspace_id: "chat-ws",
		}

		renderHook(() => useProjectTitle())

		expect(setMetaMock).toHaveBeenCalledWith({
			title: "需求评审",
		})
	})

	it("syncs workspace-only title when no project is selected", () => {
		workspaceStoreState.selectedWorkspace = { id: "ws-1", name: "设计空间" }

		renderHook(() => useProjectTitle())

		expect(setMetaMock).toHaveBeenCalledWith({
			title: "设计空间",
		})
	})
})
