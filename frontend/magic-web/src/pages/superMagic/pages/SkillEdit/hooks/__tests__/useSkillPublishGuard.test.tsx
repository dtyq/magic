import { act, renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { useSkillPublishGuard } from "../useSkillPublishGuard"

const { ensureSkillConfigYamlForPublishMock } = vi.hoisted(() => ({
	ensureSkillConfigYamlForPublishMock: vi.fn(),
}))

vi.mock("ahooks", () => ({
	useMemoizedFn: <T extends (...args: unknown[]) => unknown>(fn: T) => fn,
}))

vi.mock("../../utils/ensureSkillConfigYaml", () => ({
	ensureSkillConfigYamlForPublish: ensureSkillConfigYamlForPublishMock,
}))

type PublishGuardParams = Parameters<typeof useSkillPublishGuard>[0]

function createStoreMock({ hasName = true }: { hasName?: boolean } = {}) {
	return {
		skill: {
			name: hasName ? "Skill Name" : "",
		},
		skillWorkspaceManifest: null,
		project: {
			id: "project-1",
		},
		projectFilesStore: {
			workspaceFilesList: [],
			workspaceFileTree: [],
		},
	}
}

describe("useSkillPublishGuard", () => {
	beforeEach(() => {
		ensureSkillConfigYamlForPublishMock.mockReset()
	})

	it("opens identity dialog when publish name is missing", async () => {
		const store = createStoreMock({ hasName: false })
		const onPublishReady = vi.fn()
		const { result } = renderHook(() =>
			useSkillPublishGuard({
				store: store as unknown as PublishGuardParams["store"],
				t: ((key: string) => key) as PublishGuardParams["t"],
				onPublishReady,
			}),
		)

		await act(async () => {
			await result.current.handleOpenPublishPanel()
		})

		expect(result.current.isPublishIdentityDialogOpen).toBe(true)
		expect(onPublishReady).not.toHaveBeenCalled()
		expect(ensureSkillConfigYamlForPublishMock).not.toHaveBeenCalled()
	})

	it("continues publish preparation after identity dialog saves", async () => {
		ensureSkillConfigYamlForPublishMock.mockResolvedValueOnce(true)
		const store = createStoreMock({ hasName: false })
		const onPublishReady = vi.fn()
		const { result } = renderHook(() =>
			useSkillPublishGuard({
				store: store as unknown as PublishGuardParams["store"],
				t: ((key: string) => key) as PublishGuardParams["t"],
				onPublishReady,
			}),
		)

		await act(async () => {
			await result.current.handlePublishIdentitySaved()
		})

		await waitFor(() => {
			expect(ensureSkillConfigYamlForPublishMock).toHaveBeenCalledWith({
				projectId: "project-1",
				getWorkspaceFilesList: expect.any(Function),
				getWorkspaceFileTree: expect.any(Function),
				getSkillName: expect.any(Function),
				t: expect.any(Function),
			})
			expect(onPublishReady).toHaveBeenCalledTimes(1)
		})
		expect(result.current.isPublishIdentityDialogOpen).toBe(false)
	})

	it("waits for the publish-ready action to finish", async () => {
		ensureSkillConfigYamlForPublishMock.mockResolvedValueOnce(true)
		let resolvePublishReady: (() => void) | undefined
		const onPublishReady = vi.fn(
			() =>
				new Promise<void>((resolve) => {
					resolvePublishReady = resolve
				}),
		)
		const { result } = renderHook(() =>
			useSkillPublishGuard({
				store: createStoreMock() as unknown as PublishGuardParams["store"],
				t: ((key: string) => key) as PublishGuardParams["t"],
				onPublishReady,
			}),
		)

		let preparePromise: Promise<void> | undefined
		act(() => {
			preparePromise = result.current.handleOpenPublishPanel()
		})
		await waitFor(() => expect(onPublishReady).toHaveBeenCalledTimes(1))
		expect(result.current.isEnsuringSkillConfigForPublish).toBe(true)

		resolvePublishReady?.()
		await act(async () => {
			await preparePromise
		})
		expect(result.current.isEnsuringSkillConfigForPublish).toBe(false)
	})
})
