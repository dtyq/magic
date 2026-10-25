import { act, renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { SuperMagicApi } from "@/apis"
import { CollaboratorPermissionEnum } from "@/pages/superMagic/types/collaboration"

import { useMicroAppPageController } from "../useMicroAppPageController"

const mocks = vi.hoisted(() => {
	const setWorkspaceFileTree = vi.fn()
	const projectFilesStore = {
		workspaceFileTree: [],
		workspaceFilesList: [],
		setWorkspaceFileTree,
	}
	const selectedProject: {
		id: string
		workspace_id: string
		project_name: string
		user_role?: string
	} = {
		id: "project-1",
		workspace_id: "workspace-1",
		project_name: "Micro App",
	}
	const usageSelectedProject = {
		id: "runtime-project-1",
		workspace_id: "workspace-1",
		project_name: "Published App",
	}
	const developmentTopicStore = {
		selectedTopic: null,
		topics: [],
	}
	const usageTopicStore = {
		selectedTopic: null,
		topics: [],
	}

	return {
		setMeta: vi.fn(),
		setWorkspaceFileTree,
		projectFilesStore,
		selectedProject,
		usageSelectedProject,
		developmentTopicStore,
		usageTopicStore,
		checkAttachmentsNowDebounced: vi.fn(),
		useProjectAttachmentsChangeRealtime: vi.fn(),
		useCollaboratorUpdatePanel: vi.fn(),
		loadRuntimeProject: vi.fn(),
		resetRuntimeProjectContext: vi.fn(),
		ensureUsageProject: vi.fn(),
		organizationCode: { current: "org-1" },
		pubsub: {
			publish: vi.fn(),
			subscribe: vi.fn(),
			unsubscribe: vi.fn(),
		},
	}
})

vi.mock("@/routes/hooks/useRoutesMetaSet", () => ({
	default: () => ({ setMeta: mocks.setMeta }),
}))

vi.mock("react-i18next", () => ({
	initReactI18next: { type: "3rdParty", init: vi.fn() },
	useTranslation: () => ({ t: (key: string) => key }),
}))

vi.mock("@/routes/hooks/useNavigate", () => ({
	default: () => vi.fn(),
}))

vi.mock("@/models/user/hooks/useOrganization", () => ({
	useOrganization: () => ({ organizationCode: mocks.organizationCode.current }),
}))

vi.mock("@/components/base/MagicToaster/utils", () => ({
	default: { error: vi.fn() },
}))

vi.mock("../../context", () => ({
	useAppStore: () => ({
		projectId: "project-1",
		initLoading: false,
		initError: null,
		initFromProjectId: vi.fn(),
		developmentConversation: {
			selectedProject: mocks.selectedProject,
			topicStore: mocks.developmentTopicStore,
			setSelectedProject: vi.fn(),
		},
		conversation: {
			selectedProject: mocks.usageSelectedProject,
			topicStore: mocks.usageTopicStore,
		},
		conversationType: "usage",
		setConversationType: vi.fn(),
		loadRuntimeProject: mocks.loadRuntimeProject,
		resetRuntimeProjectContext: mocks.resetRuntimeProjectContext,
		ensureUsageProject: mocks.ensureUsageProject,
		projectFilesStore: mocks.projectFilesStore,
		mentionPanelStore: {
			initLoadAttachments: vi.fn(),
			finishLoadAttachmentsPromise: vi.fn(),
			clearInitLoadAttachmentsPromise: vi.fn(),
		},
	}),
}))

vi.mock("@/pages/superMagic/hooks", () => ({
	useDefaultModeModelListRefreshOnMount: vi.fn(),
}))

vi.mock("@/pages/superMagic/components/TopicMode", () => ({
	useCreateTopicListener: vi.fn(),
}))

vi.mock("@/pages/superMagic/hooks/useAttachmentsPolling", () => ({
	useAttachmentsPolling: () => ({
		checkNowDebounced: mocks.checkAttachmentsNowDebounced,
	}),
}))

vi.mock("@/pages/superMagic/hooks/useProjectAttachmentsChangeRealtime", () => ({
	useProjectAttachmentsChangeRealtime: mocks.useProjectAttachmentsChangeRealtime,
}))

vi.mock("../useMicroAppSelectedProjectSync", () => ({
	useMicroAppSelectedProjectSync: vi.fn(),
}))

vi.mock("../../utils/captureMicroAppCover", () => ({
	captureMicroAppCover: vi.fn(),
}))

vi.mock("@/pages/superMagic/components/WithCollaborators/hooks/useCollaboratorUpdatePanel", () => ({
	default: (params: unknown) => {
		mocks.useCollaboratorUpdatePanel(params)
		return {
			openManageModal: vi.fn(),
			CollaboratorUpdatePanel: null,
			canManageCollaborators: false,
		}
	},
}))

vi.mock("@/pages/superMagic/utils/attachmentDataProcessor", () => ({
	AttachmentDataProcessor: {
		processAttachmentData: ({ tree, list }: { tree: unknown[]; list: unknown[] }) => ({
			tree,
			list,
		}),
	},
}))

vi.mock("@/utils/pubsub", () => ({
	default: mocks.pubsub,
	PubSubEvents: {
		Update_Attachments_Loading: "Update_Attachments_Loading",
		Update_Attachments: "Update_Attachments",
		Update_Project_Name: "Update_Project_Name",
	},
}))

vi.mock("@/apis", () => ({
	SuperMagicApi: {
		getAttachmentsByProjectId: vi.fn(() => new Promise(() => undefined)),
		getMicroAppProject: vi.fn().mockResolvedValue({
			organization_code: "org-1",
			publish: {},
		}),
		updateMicroApp: vi.fn(),
	},
}))

describe("useMicroAppPageController attachment synchronization", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		mocks.organizationCode.current = "org-1"
		mocks.selectedProject.project_name = "Micro App"
		delete mocks.selectedProject.user_role
		vi.mocked(SuperMagicApi.getMicroAppProject).mockResolvedValue({
			organization_code: "org-1",
			publish: {},
		} as never)
	})

	it("uses the development app title during usage and synchronizes renames", () => {
		const { rerender } = renderHook(() => useMicroAppPageController("app-1", "project-1"))
		expect(mocks.setMeta).toHaveBeenLastCalledWith({ title: "Micro App" })
		mocks.selectedProject.project_name = "Renamed App"
		rerender()
		expect(mocks.setMeta).toHaveBeenLastCalledWith({ title: "Renamed App" })
	})

	it("does not reuse the previous app title while a different project loads", () => {
		renderHook(() => useMicroAppPageController("app-2", "project-2"))
		expect(mocks.setMeta).toHaveBeenLastCalledWith({ title: "microAppsPage.unnamedApp" })
	})

	it("applies realtime project file changes to the MicroApp attachment store", () => {
		renderHook(() => useMicroAppPageController("app-1", "project-1"))

		expect(mocks.useProjectAttachmentsChangeRealtime).toHaveBeenCalledWith(
			expect.objectContaining({
				projectId: "project-1",
				store: mocks.projectFilesStore,
			}),
		)

		const options = mocks.useProjectAttachmentsChangeRealtime.mock.calls[0]?.[0] as {
			onAttachmentsChange?: (data: { tree: unknown[]; list: unknown[] }) => void
		}
		const entry = { file_id: "entry-1", file_name: "index.html" }
		act(() => {
			options.onAttachmentsChange?.({ tree: [entry], list: [entry] })
		})

		expect(mocks.setWorkspaceFileTree).toHaveBeenCalledWith([entry])
	})

	it("向协作者面板传入微应用 app_id", () => {
		renderHook(() => useMicroAppPageController("app-1", "project-1"))

		expect(mocks.useCollaboratorUpdatePanel).toHaveBeenCalledWith({
			selectedProject: expect.objectContaining({
				id: "project-1",
				app_id: "app-1",
			}),
		})
	})

	it("loads the runtime project only after confirming the source organization", async () => {
		renderHook(() => useMicroAppPageController("app-1", "project-1"))

		await waitFor(() => {
			expect(mocks.loadRuntimeProject).toHaveBeenCalledWith("app-1")
		})
	})

	it("blocks usage project creation for another organization", async () => {
		mocks.organizationCode.current = "org-2"
		const { result } = renderHook(() => useMicroAppPageController("app-1", "project-1"))

		await waitFor(() => {
			expect(mocks.resetRuntimeProjectContext).toHaveBeenCalled()
		})
		await expect(result.current.ensureUsageProject()).rejects.toThrow(
			"microAppShare.crossOrganizationConversationUnsupported",
		)
		expect(mocks.loadRuntimeProject).not.toHaveBeenCalled()
		expect(mocks.ensureUsageProject).not.toHaveBeenCalled()
	})

	it("does not block developers while the source organization is still loading", async () => {
		mocks.selectedProject.user_role = CollaboratorPermissionEnum.OWNER
		vi.mocked(SuperMagicApi.getMicroAppProject).mockReturnValue(
			new Promise(() => undefined) as never,
		)
		mocks.ensureUsageProject.mockResolvedValue(undefined)
		const { result } = renderHook(() => useMicroAppPageController("app-1", "project-1"))

		await waitFor(() => {
			expect(mocks.loadRuntimeProject).toHaveBeenCalledWith("app-1")
		})
		await expect(result.current.ensureUsageProject()).resolves.toBeUndefined()
		expect(mocks.ensureUsageProject).toHaveBeenCalledWith("app-1")
		expect(result.current.sourceOrganizationCode).toBe("org-1")
	})
})
