import { act, renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { Workspace } from "@/pages/superMagic/pages/Workspace/types"
import { TopicMode } from "@/pages/superMagic/pages/Workspace/TopicMode"
import { useTaskHomeContext } from "../useTaskHomeContext"

const mocks = vi.hoisted(() => ({
	detail: vi.fn(),
	list: vi.fn(),
	create: vi.fn(),
	navigate: vi.fn(),
	error: vi.fn(),
}))
vi.mock("@/apis", () => ({ SuperMagicApi: { getWorkspaces: mocks.list } }))
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
vi.mock("@/components/base/MagicToaster/utils", () => ({ default: { error: mocks.error } }))
vi.mock("@/pages/superMagic/services", () => ({
	default: {
		workspace: { getWorkspaceDetail: mocks.detail },
		project: { createProject: mocks.create },
		switchProjectInMobile: mocks.navigate,
	},
}))
vi.mock("@/pages/superMagic/stores/core", () => ({
	workspaceStore: { setSelectedWorkspace: vi.fn() },
}))

const workspace = (id: string, type = "default") =>
	({ id, name: id, workspace_type: type, is_archived: 0 }) as Workspace

describe("mobile task home destination", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		localStorage.clear()
		mocks.detail.mockImplementation(async (id: string) => workspace(id))
		mocks.list.mockResolvedValue({ list: [workspace("personal")], total: 1 })
		mocks.create.mockResolvedValue({
			project: { id: "project", workspace_id: "personal" },
			topic: { id: "topic" },
		})
	})

	it("does not read or change the remembered destination while chat is active", async () => {
		localStorage.setItem("MAGIC:mobile-task-workspace:org:user", "remembered")
		const { rerender } = renderHook(
			({ enabled }) => useTaskHomeContext("org:user", null, enabled),
			{ initialProps: { enabled: false } },
		)
		expect(mocks.detail).not.toHaveBeenCalled()
		expect(mocks.list).not.toHaveBeenCalled()
		expect(localStorage.getItem("MAGIC:mobile-task-workspace:org:user")).toBe("remembered")
		rerender({ enabled: true })
		await waitFor(() => expect(mocks.detail).toHaveBeenCalledWith("remembered"))
	})

	it("restores explicit before remembered before default, scoped to account and organization", async () => {
		localStorage.setItem("MAGIC:mobile-task-workspace:org:user", "remembered")
		const explicit = renderHook(() => useTaskHomeContext("org:user", "entry"))
		await waitFor(() => expect(explicit.result.current.workspace?.id).toBe("entry"))
		expect(mocks.list).not.toHaveBeenCalled()
		explicit.unmount()
		const remembered = renderHook(() => useTaskHomeContext("org:user", null))
		await waitFor(() => expect(remembered.result.current.workspace?.id).toBe("entry"))
		remembered.unmount()
		const otherAccount = renderHook(() => useTaskHomeContext("other:user", null))
		await waitFor(() => expect(otherAccount.result.current.workspace?.id).toBe("personal"))
		expect(mocks.create).not.toHaveBeenCalled()
	})

	it("does not silently substitute an inaccessible explicit workspace", async () => {
		mocks.detail.mockResolvedValue(null)
		const { result } = renderHook(() => useTaskHomeContext("org:user", "deleted"))
		await waitFor(() => expect(result.current.error).toBe(true))
		expect(result.current.workspace).toBeNull()
		expect(mocks.list).not.toHaveBeenCalled()
		await act(async () => expect(await result.current.context.beforeSend?.()).toBe(false))
		expect(mocks.create).not.toHaveBeenCalled()
	})

	it("ignores a remembered chat workspace and finds an ordinary workspace", async () => {
		localStorage.setItem("MAGIC:mobile-task-workspace:org:user", "chat")
		mocks.detail.mockResolvedValue(workspace("chat", "chat"))
		const { result } = renderHook(() => useTaskHomeContext("org:user", null))
		await waitFor(() => expect(result.current.workspace?.id).toBe("personal"))
	})

	it("revalidates the displayed destination on send, without falling back after deletion", async () => {
		const { result } = renderHook(() => useTaskHomeContext("org:user", null))
		await waitFor(() => expect(result.current.workspace?.id).toBe("personal"))
		mocks.detail.mockResolvedValue(null)
		await act(async () => expect(await result.current.context.beforeSend?.()).toBe(false))
		expect(result.current.workspace?.id).toBe("personal")
		expect(mocks.error).toHaveBeenCalledWith("mobileHome.workspaceUnavailable")
		expect(mocks.list).toHaveBeenCalledTimes(1)
	})

	it("keeps the task draft through workspace selection and sends to the selected workspace", async () => {
		const { result } = renderHook(() => useTaskHomeContext("org:user", null))
		await waitFor(() => expect(result.current.workspace?.id).toBe("personal"))
		const draftKey = result.current.context.draftKey
		act(() => result.current.selectWorkspace(workspace("chosen")))
		expect(result.current.context.draftKey).toEqual(draftKey)
		await act(async () => {
			expect(await result.current.context.beforeSend?.()).toBe(true)
			await result.current.context.createProject?.({
				projectMode: TopicMode.General,
				workdir: "uploads",
			})
			await result.current.context.createProject?.({ projectMode: TopicMode.General })
		})
		expect(mocks.create).toHaveBeenCalledExactlyOnceWith({
			workspaceId: "chosen",
			projectMode: TopicMode.General,
			workdir: "uploads",
		})
	})

	it("does not reuse a created project or its adopted directory after changing destinations", async () => {
		const { result } = renderHook(() => useTaskHomeContext("org:user", null))
		await waitFor(() => expect(result.current.workspace?.id).toBe("personal"))
		await act(async () => {
			await result.current.context.createProject?.({
				projectMode: TopicMode.General,
				workdir: "adopted-files",
			})
		})
		act(() => result.current.selectWorkspace(workspace("different")))
		await act(async () => {
			await result.current.context.createProject?.({ projectMode: TopicMode.General })
		})
		expect(mocks.create).toHaveBeenCalledTimes(2)
		expect(mocks.create).toHaveBeenLastCalledWith({
			workspaceId: "different",
			projectMode: TopicMode.General,
			workdir: undefined,
		})
	})

	it("does not let a late initial fetch overwrite an explicit selection", async () => {
		let finish!: (response: { list: Workspace[] }) => void
		mocks.list.mockReturnValue(
			new Promise((resolve) => {
				finish = resolve
			}),
		)
		const { result } = renderHook(() => useTaskHomeContext("org:user", null))
		act(() => result.current.selectWorkspace(workspace("chosen")))
		await act(async () => finish({ list: [workspace("personal")] }))
		expect(result.current.workspace?.id).toBe("chosen")
	})

	it("does not persist results after leaving the account", async () => {
		let finish!: (response: { list: Workspace[] }) => void
		mocks.list.mockReturnValue(
			new Promise((resolve) => {
				finish = resolve
			}),
		)
		const { unmount } = renderHook(() => useTaskHomeContext("org:user", null))
		unmount()
		await act(async () => finish({ list: [workspace("old-account")] }))
		expect(localStorage.getItem("MAGIC:mobile-task-workspace:org:user")).toBeNull()
	})

	it("opens the newly created topic instead of stopping at the project list", async () => {
		const { result } = renderHook(() => useTaskHomeContext("org:user", null))
		await waitFor(() => expect(result.current.workspace?.id).toBe("personal"))
		act(() =>
			result.current.context.onSendSuccess?.({
				currentProject: { id: "project", workspace_id: "personal" } as never,
				currentTopic: { id: "topic", project_id: "project" } as never,
			}),
		)
		expect(mocks.navigate).toHaveBeenCalledWith(
			expect.objectContaining({ id: "project" }),
			"topic",
		)
	})
})
