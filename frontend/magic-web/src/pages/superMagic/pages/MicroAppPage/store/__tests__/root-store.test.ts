import { beforeEach, describe, expect, it, vi } from "vitest"
import { SuperMagicApi } from "@/apis"
import { AppRootStore } from "../root-store"

vi.mock("@/apis", () => ({
	SuperMagicApi: {
		getMicroAppRuntimeProject: vi.fn(),
		ensureMicroAppRuntimeProject: vi.fn(),
		getProjectDetail: vi.fn(),
		getTopicsByProjectId: vi.fn(),
	},
}))

describe("AppRootStore runtime conversation", () => {
	beforeEach(() => {
		vi.mocked(SuperMagicApi.getMicroAppRuntimeProject).mockReset()
		vi.mocked(SuperMagicApi.ensureMicroAppRuntimeProject).mockReset()
		vi.mocked(SuperMagicApi.getProjectDetail).mockReset()
		vi.mocked(SuperMagicApi.getTopicsByProjectId).mockReset()
	})

	it("hydrates the usage conversation without replacing the development project", async () => {
		const runtimeProject = { id: "runtime-project", project_name: "Published app" }
		vi.mocked(SuperMagicApi.getMicroAppRuntimeProject).mockResolvedValue({
			exists: true,
			project: { id: runtimeProject.id },
		} as never)
		vi.mocked(SuperMagicApi.getProjectDetail).mockResolvedValue(runtimeProject as never)
		vi.mocked(SuperMagicApi.getTopicsByProjectId).mockResolvedValue({ list: [] } as never)

		const store = new AppRootStore()
		await store.loadRuntimeProject("app-1")

		expect(store.runtimeProject).toEqual(runtimeProject)
		expect(store.usageConversation.selectedProject).toEqual(runtimeProject)
		expect(store.developmentConversation.selectedProject).toBeNull()
		expect(store.conversationType).toBe("development")
	})

	it("creates the first usage topic context without touching developmentConversation", async () => {
		const runtimeProject = { id: "runtime-project", project_name: "Published app" }
		vi.mocked(SuperMagicApi.ensureMicroAppRuntimeProject).mockResolvedValue({
			project: runtimeProject,
		} as never)
		vi.mocked(SuperMagicApi.getProjectDetail).mockResolvedValue(runtimeProject as never)
		vi.mocked(SuperMagicApi.getTopicsByProjectId).mockResolvedValue({ list: [] } as never)

		const store = new AppRootStore()
		const result = await store.ensureUsageProject("app-1")

		expect(result.selectedProject).toEqual(runtimeProject)
		expect(result.topicStore).toBe(store.usageConversation.topicStore)
		expect(store.developmentConversation.selectedProject).toBeNull()
		expect(store.conversationType).toBe("usage")
	})

	it("ignores a stale runtime project when a newer app load wins", async () => {
		const appA = createDeferred<{ exists: boolean; project?: { id: string } }>()
		const appB = createDeferred<{ exists: boolean; project?: { id: string } }>()
		const projectA = createDeferred<{ id: string; project_name: string }>()

		vi.mocked(SuperMagicApi.getMicroAppRuntimeProject)
			.mockReturnValueOnce(appA.promise as never)
			.mockReturnValueOnce(appB.promise as never)
		vi.mocked(SuperMagicApi.getProjectDetail).mockReturnValue(projectA.promise as never)
		vi.mocked(SuperMagicApi.getTopicsByProjectId).mockResolvedValue({ list: [] } as never)

		const store = new AppRootStore()
		const staleLoad = store.loadRuntimeProject("app-a")
		appA.resolve({ exists: true, project: { id: "project-a" } })
		await vi.waitFor(() => {
			expect(SuperMagicApi.getProjectDetail).toHaveBeenCalledWith({ id: "project-a" })
		})

		store.reset()
		const currentLoad = store.loadRuntimeProject("app-b")
		appB.resolve({ exists: false })
		await currentLoad

		projectA.resolve({ id: "project-a", project_name: "旧项目" })
		await staleLoad

		expect(store.runtimeProject).toBeNull()
		expect(store.runtimeProjectState).toBe("absent")
		expect(store.usageConversation.selectedProject).toBeNull()
	})

	it("does not reuse an in-flight usage project for another app", async () => {
		const appA = createDeferred<{ project: { id: string } }>()
		const appB = createDeferred<{ project: { id: string } }>()

		vi.mocked(SuperMagicApi.ensureMicroAppRuntimeProject)
			.mockReturnValueOnce(appA.promise as never)
			.mockReturnValueOnce(appB.promise as never)
		vi.mocked(SuperMagicApi.getProjectDetail).mockImplementation(
			({ id }) => Promise.resolve({ id, project_name: id }) as never,
		)
		vi.mocked(SuperMagicApi.getTopicsByProjectId).mockResolvedValue({ list: [] } as never)

		const store = new AppRootStore()
		const staleEnsure = store.ensureUsageProject("app-a")
		const currentEnsure = store.ensureUsageProject("app-b")

		appB.resolve({ project: { id: "project-b" } })
		await expect(currentEnsure).resolves.toMatchObject({
			selectedProject: { id: "project-b" },
		})

		appA.resolve({ project: { id: "project-a" } })
		await expect(staleEnsure).rejects.toThrow("superseded")
		expect(store.runtimeProject).toMatchObject({ id: "project-b" })
	})

	it("invalidates an in-flight usage project when runtime access is reset", async () => {
		const creation = createDeferred<{ project: { id: string } }>()
		vi.mocked(SuperMagicApi.ensureMicroAppRuntimeProject).mockReturnValue(
			creation.promise as never,
		)
		const store = new AppRootStore()
		const pending = store.ensureUsageProject("app-1")

		store.resetRuntimeProjectContext()
		creation.resolve({ project: { id: "stale-runtime" } })

		await expect(pending).rejects.toThrow("superseded")
		expect(SuperMagicApi.getProjectDetail).not.toHaveBeenCalled()
		expect(store.runtimeProject).toBeNull()
		expect(store.conversationType).toBe("development")
	})

	it("clears stale runtime files before ensuring a different app", async () => {
		const creation = createDeferred<{ project: { id: string } }>()
		vi.mocked(SuperMagicApi.ensureMicroAppRuntimeProject).mockReturnValue(
			creation.promise as never,
		)
		vi.mocked(SuperMagicApi.getProjectDetail).mockResolvedValue({
			id: "project-2",
			project_name: "App 2",
		} as never)
		vi.mocked(SuperMagicApi.getTopicsByProjectId).mockResolvedValue({ list: [] } as never)

		const store = new AppRootStore()
		store.runtimeProjectFilesStore.setWorkspaceFileTree([
			{
				file_id: "old-file",
				file_name: "old.html",
				file_key: "old.html",
				type: "file",
			} as never,
		])
		expect(store.runtimeProjectFilesStore.workspaceFilesList).toEqual(
			expect.arrayContaining([expect.objectContaining({ file_id: "old-file" })]),
		)

		const pending = store.ensureUsageProject("app-2")
		expect(store.runtimeProjectFilesStore.workspaceFileTree).toEqual([])

		creation.resolve({ project: { id: "project-2" } })
		await pending
	})
})

function createDeferred<T>() {
	let resolve!: (value: T) => void
	const promise = new Promise<T>((resolvePromise) => {
		resolve = resolvePromise
	})

	return { promise, resolve }
}
