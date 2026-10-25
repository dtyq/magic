import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import type { ProjectListItem, Workspace } from "@/pages/superMagic/pages/Workspace/types"
import { SHARE_WORKSPACE_ID } from "@/pages/superMagic/constants"
import ProjectResourceSelectorModal from "."

const apiMocks = vi.hoisted(() => ({
	getCollaborationProjects: vi.fn().mockResolvedValue({ list: [] }),
	getWorkspaces: vi.fn().mockResolvedValue({ list: [] }),
	getMicroApps: vi.fn().mockResolvedValue({ list: [], total: 0 }),
	getMicroAppWorkspace: vi.fn().mockResolvedValue({ id: "actual-micro-app-workspace" }),
}))

vi.mock("react-i18next", async (importOriginal) => ({
	...(await importOriginal<typeof import("react-i18next")>()),
	useTranslation: () => ({ t: (key: string) => key }),
}))

vi.mock("react-router", () => ({
	useMatch: () => null,
}))

vi.mock("@/hooks/useIsMobile", () => ({
	useIsMobile: () => false,
}))

vi.mock("@/apis", () => ({
	SuperMagicApi: {
		getCollaborationProjects: apiMocks.getCollaborationProjects,
		getWorkspaces: apiMocks.getWorkspaces,
		getMicroApps: apiMocks.getMicroApps,
		getMicroAppWorkspace: apiMocks.getMicroAppWorkspace,
	},
	MagicClawApi: {},
}))

vi.mock("@/components/base/MagicSpin", () => ({
	default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock("@/components/base/MagicEllipseWithTooltip/MagicEllipseWithTooltip", () => ({
	default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock("@/pages/superMagic/services", () => ({
	loadProjectAttachments: vi.fn().mockResolvedValue({ tree: [] }),
}))

vi.mock("@/pages/superMagic/hooks/useSingleDocumentStaticDependencies", () => ({
	useSingleDocumentStaticDependencies: () => ({
		isLoading: false,
		dependencyTransferFileIds: [],
	}),
}))

vi.mock("../../hooks/useCreateWorkspace", () => ({
	useCreateWorkspace: () => ({
		createWorkspaceShown: false,
		createWorkspaceName: "",
		createWorkspaceErrorMessage: "",
		showCreateWorkspace: vi.fn(),
		cancelCreateWorkspace: vi.fn(),
		onCreateWorkspaceInputChange: vi.fn(),
		onCreateWorkspaceInputFocus: vi.fn(),
		submitCreateWorkspace: vi.fn(),
		onCreateWorkspaceInputKeyDown: vi.fn(),
	}),
}))

vi.mock("../../hooks/useCreateProject", () => ({
	useCreateProject: () => ({
		createProjectShown: false,
		createProjectName: "",
		createProjectErrorMessage: "",
		showCreateProject: vi.fn(),
		cancelCreateProject: vi.fn(),
		submitCreateProject: vi.fn(),
		onCreateProjectInputChange: vi.fn(),
		onCreateProjectInputFocus: vi.fn(),
		onCreateProjectInputKeyDown: vi.fn(),
	}),
}))

vi.mock("../../hooks/useCreateDirectory", () => ({
	useCreateDirectory: () => ({
		loading: false,
		createDirectoryShown: false,
		createDirectoryName: "",
		createDirectoryErrorMessage: "",
		showCreateDirectory: vi.fn(),
		cancelCreateDirectory: vi.fn(),
		submitCreateDirectory: vi.fn(),
		onCreateDirectoryInputChange: vi.fn(),
		onCreateDirectoryInputFocus: vi.fn(),
		onCreateDirectoryInputKeyDown: vi.fn(),
	}),
}))

vi.mock("antd", () => ({
	Checkbox: (props: React.InputHTMLAttributes<HTMLInputElement>) => (
		<input type="checkbox" {...props} />
	),
	Dropdown: ({ children }: { children: React.ReactNode }) => children,
	Menu: Object.assign(({ children }: { children: React.ReactNode }) => <div>{children}</div>, {
		Item: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
	}),
}))

vi.mock("../BaseModal", () => ({
	default: ({ visible, content }: { visible: boolean; content: React.ReactNode }) =>
		visible ? <div>{content}</div> : null,
}))

const sharedWorkspace = {
	id: SHARE_WORKSPACE_ID,
	name: "Shared workspace",
} as Workspace

const sharedProject = {
	id: "shared-project",
	project_name: "Shared project",
	user_role: 1,
	tag: "collaboration",
} as ProjectListItem

function renderModal(props: { selectedProject?: ProjectListItem } = {}) {
	return render(
		<ProjectResourceSelectorModal
			visible
			title="Move to"
			operationType="move"
			selectedWorkspace={props.selectedProject ? sharedWorkspace : undefined}
			selectedProject={props.selectedProject}
			workspaces={[]}
			fileIds={["file-1"]}
			sourceAttachments={[]}
			onClose={vi.fn()}
			onSubmit={vi.fn()}
		/>,
	)
}

describe("ProjectResourceSelectorModal shared workspace creation", () => {
	it("hides the new project action after entering the shared workspace", async () => {
		renderModal()

		fireEvent.click(screen.getByText("workspace.shareWorkspaceName"))

		await waitFor(() => expect(apiMocks.getCollaborationProjects).toHaveBeenCalled())
		expect(
			screen.queryByTestId("cross-project-file-modal-create-project"),
		).not.toBeInTheDocument()
	})

	it("hides all new folder actions inside a shared project", async () => {
		renderModal({ selectedProject: sharedProject })

		await waitFor(() =>
			expect(screen.getByText("selectPathModal.emptyStorageDescription")).toBeInTheDocument(),
		)
		expect(
			screen.queryByTestId("cross-project-file-modal-create-directory"),
		).not.toBeInTheDocument()
		expect(
			screen.queryByTestId("cross-project-file-modal-empty-create-folder"),
		).not.toBeInTheDocument()
	})
})

describe("ProjectResourceSelectorModal micro apps", () => {
	it("shows created and collaborated micro apps from their own scopes", async () => {
		apiMocks.getMicroApps.mockImplementation(({ scope }) => ({
			list: [
				{
					app_id: scope,
					project_id: `${scope}-project`,
					app_name: `${scope} app`,
					user_role: "editor",
				},
			],
			total: 1,
		}))
		renderModal()
		fireEvent.click(screen.getByText("selectPathModal.microApps"))
		await waitFor(() => expect(screen.getByText("created app")).toBeInTheDocument())
		expect(
			screen
				.getByText("created app")
				.closest('[data-testid="handle-project-click"]')
				?.querySelector('svg[viewBox="0 0 16 16"]'),
		).toBeInTheDocument()
		fireEvent.click(screen.getByText("selectPathModal.collaboratedMicroApps"))
		await waitFor(() => expect(screen.getByText("collaborated app")).toBeInTheDocument())
		expect(screen.queryByText("created app")).not.toBeInTheDocument()
		expect(apiMocks.getMicroApps).toHaveBeenCalledWith(
			expect.objectContaining({ scope: "collaborated" }),
		)
	})
})
