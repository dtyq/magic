import { beforeEach, describe, expect, it, vi } from "vitest"
import { INIT_DOMAINS } from "@/models/user/stores/initialization.store"

const { mockInitializeState, mockRefreshState, mockRunInitialization, mockUserStore } = vi.hoisted(
	() => ({
		mockInitializeState: vi.fn(),
		mockRefreshState: vi.fn(),
		mockRunInitialization: vi.fn(),
		mockUserStore: {
			user: {
				userInfo: {
					magic_id: "magic-id",
					organization_code: "org-code",
				} as { magic_id?: string; organization_code?: string } | null,
			},
			initialization: {
				runInitialization: undefined as unknown as typeof vi.fn,
			},
		},
	}),
)

mockUserStore.initialization.runInitialization = mockRunInitialization

vi.mock("@/models/user", () => ({
	userStore: mockUserStore,
}))

vi.mock("../index", () => ({
	default: {
		initializeState: mockInitializeState,
		refreshState: mockRefreshState,
	},
}))

import { initializeSuperMagicIfNeeded } from "../utils"
import workspaceStore from "../../stores/core/workspace"

describe("initializeSuperMagicIfNeeded", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		mockUserStore.user.userInfo = {
			magic_id: "magic-id",
			organization_code: "org-code",
		}
		workspaceStore.setWorkspaces([])
		workspaceStore.setSelectedWorkspace(null)
		mockRunInitialization.mockImplementation(
			async (_key: unknown, initializer: () => Promise<unknown>) => initializer(),
		)
	})

	it("skips initialization when user context is not ready", () => {
		mockUserStore.user.userInfo = null

		initializeSuperMagicIfNeeded({
			isMobile: false,
			workspaceId: "workspace-1",
		})

		expect(mockRunInitialization).not.toHaveBeenCalled()
		expect(mockInitializeState).not.toHaveBeenCalled()
		expect(mockRefreshState).not.toHaveBeenCalled()
	})

	it("reuses sidebar workspace state on desktop only when selection exists", async () => {
		workspaceStore.setWorkspaces([{ id: "workspace-1" } as never])
		workspaceStore.setSelectedWorkspace({ id: "workspace-1" } as never)

		initializeSuperMagicIfNeeded({
			isMobile: false,
			workspaceId: "workspace-1",
		})

		await vi.waitFor(() => {
			expect(mockRefreshState).toHaveBeenCalledWith({
				workspaceId: "workspace-1",
				projectId: undefined,
				topicId: undefined,
			})
		})
		expect(mockInitializeState).not.toHaveBeenCalled()
		expect(mockRunInitialization).toHaveBeenCalledWith(
			{
				magicId: "magic-id",
				organizationCode: "org-code",
				domain: INIT_DOMAINS.super,
			},
			expect.any(Function),
		)
	})

	it("falls back to full initialization when only workspace list exists", async () => {
		workspaceStore.setWorkspaces([{ id: "workspace-1" } as never])

		initializeSuperMagicIfNeeded({
			isMobile: false,
			workspaceId: "workspace-1",
		})

		await vi.waitFor(() => {
			expect(mockInitializeState).toHaveBeenCalledWith({
				workspaceId: "workspace-1",
				projectId: undefined,
				topicId: undefined,
			})
		})
		expect(mockRefreshState).not.toHaveBeenCalled()
	})
})
