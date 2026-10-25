import { useState, type ComponentProps } from "react"
import { userStore } from "@/models/user"
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { SuperMagicApi } from "@/apis"
import MagicModal from "@/components/base/MagicModal"
import magicToast from "@/components/base/MagicToaster/utils"
import { authEventBus } from "@/services/auth/AuthEventBus"
import { loadProjectAttachments } from "@/pages/superMagic/services/projectAttachmentsLoader"
import { FileAccessProvider, useFileAccess } from "@/pages/superMagic/fileAccess/FileAccessProvider"
import { createShareFileAccess } from "@/pages/superMagic/fileAccess/fileAccessContext"
import { useHostConversation } from "@/pages/superMagic/contexts/HostConversationContext"
import { AppStoreProvider, useAppStore } from "@/pages/superMagic/pages/MicroAppPage/context"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import type { ProjectFilesStore } from "@/stores/projectFiles"
import BasePublishedMicroAppConversationProvider from "../PublishedMicroAppConversationProvider"
import { useDefaultModeModelListRefreshOnMount } from "@/pages/superMagic/hooks/useFeaturedModeListRefresh"

function PublishedMicroAppConversationProvider(
	props: Omit<
		ComponentProps<typeof BasePublishedMicroAppConversationProvider>,
		"sourceOrganizationCode"
	>,
) {
	return <BasePublishedMicroAppConversationProvider sourceOrganizationCode="org-1" {...props} />
}

interface TestLayoutProps extends Record<string, unknown> {
	detailPanel: React.ReactNode
	isReadOnly: boolean
	renderMessagePanel: (props: Record<string, unknown>) => React.ReactNode
	historyLayout: {
		renderPanel: (props: Record<string, unknown>) => React.ReactNode
	}
}

const layoutMocks = vi.hoisted(() => ({
	props: null as TestLayoutProps | null,
	messagePanelProps: null as Record<string, unknown> | null,
	mobileProps: null as Record<string, unknown> | null,
	historyPanelProps: null as Record<string, unknown> | null,
	tasksProps: null as Record<string, unknown> | null,
	expand: () => undefined,
}))

const responsiveMocks = vi.hoisted(() => ({ isMobile: false }))

vi.mock("@/components/base/MagicModal", () => ({
	default: { confirm: vi.fn(() => ({ destroy: vi.fn() })) },
}))
vi.mock("@/components/base/MagicToaster/utils", () => ({
	default: { error: vi.fn() },
}))
vi.mock("@/services/auth/AuthEventBus", () => ({ authEventBus: { emit: vi.fn() } }))

vi.mock("@/hooks/useIsMobile", () => ({
	useIsMobile: () => responsiveMocks.isMobile,
}))

vi.mock("react-i18next", () => ({
	initReactI18next: { type: "3rdParty", init: vi.fn() },
	useTranslation: () => ({ t: (key: string) => key }),
}))

vi.mock("@/pages/superMagic/pages/MicroAppPage/components/AppConversationPanel", () => ({
	default: function MockAppConversationPanel(props: Record<string, unknown>) {
		layoutMocks.messagePanelProps = props
		return (
			<div
				data-testid="app-conversation-panel"
				data-file-access={JSON.stringify(useFileAccess())}
			>
				<input aria-label="draft" />
				{props.trailingActions as React.ReactNode}
			</div>
		)
	},
}))

vi.mock("@/pages/superMagic/pages/MicroAppPage/components/MicroAppMobileConversation", () => ({
	default: function MockMicroAppMobileConversation(props: Record<string, unknown>) {
		layoutMocks.mobileProps = props
		const fileAccess = useFileAccess()
		return props.open ? (
			<div
				data-testid="published-micro-app-mobile-conversation"
				data-lock-to-micro-app-mode={String(props.lockToMicroAppMode)}
				data-file-access={JSON.stringify(fileAccess)}
			/>
		) : null
	},
}))

vi.mock("@/pages/superMagic/pages/TopicPage/components/TopicDesktopPanels", () => ({
	default: function MockTopicDesktopPanels(props: TestLayoutProps) {
		const [collapsed, setCollapsed] = useState(true)
		layoutMocks.props = props
		layoutMocks.expand = () => setCollapsed(false)
		return (
			<div data-testid="topic-desktop-panels">
				{props.detailPanel as React.ReactNode}
				{props.isReadOnly
					? null
					: props.renderMessagePanel({
							isConversationPanelCollapsed: collapsed,
							isDraggingPanel: false,
							onToggleConversationPanel: () => setCollapsed((value) => !value),
							onExpandConversationPanel: () => setCollapsed(false),
							historyTriggerMode: "layout",
							isHistoryPanelOpen: false,
							onToggleHistoryPanel: vi.fn(),
						})}
			</div>
		)
	},
}))

vi.mock("@/pages/superMagic/hooks/useScopedMessageHeaderTopicActions", () => ({
	useScopedMessageHeaderTopicActions: () => ({}),
}))

vi.mock("@/pages/superMagic/hooks/useFeaturedModeListRefresh", () => ({
	useDefaultModeModelListRefreshOnMount: vi.fn(),
}))

vi.mock("@/pages/superMagic/components/MessageHeader", () => ({
	MessageHeaderTopicHistoryPanel: (props: Record<string, unknown>) => {
		layoutMocks.historyPanelProps = props
		return <div data-testid="message-header-topic-history-panel" />
	},
}))

vi.mock(
	"@/pages/superMagic/pages/MicroAppPage/components/MicroAppScheduledTasksPanel/MicroAppScheduledTasksPanel",
	() => ({
		default: function MockScheduledTasksPanel(props: Record<string, unknown>) {
			layoutMocks.tasksProps = props
			return (
				<div
					data-testid="runtime-tasks"
					data-file-access={JSON.stringify(useFileAccess())}
				/>
			)
		},
	}),
)

vi.mock("@/pages/superMagic/components/UserSpace/UserSpacePanel", () => ({
	default: function MockUserSpacePanel(props: { projectId?: string }) {
		return <div data-testid="runtime-user-space" data-project-id={props.projectId} />
	},
}))

vi.mock("@/pages/superMagic/components/ShareManagement/ShareManagementPanel", () => ({
	default: function MockShareManagementPanel(props: { projectId?: string }) {
		return <div data-testid="runtime-share-management" data-project-id={props.projectId} />
	},
}))

vi.mock("@/pages/superMagic/components/TopicFilesButton", () => ({
	default: function MockTopicFilesButton() {
		return <div data-testid="runtime-files" />
	},
}))

vi.mock("@/routes", () => ({
	history: { push: vi.fn(), replace: vi.fn() },
}))

vi.mock("@dtyq/magic-admin-v2", () => ({
	createRouteObjects: () => [],
	RuntimeMode: { OpenSource: "open-source" },
}))
vi.mock("@dtyq/magic-admin", () => ({
	RouteName: {
		Admin: "admin",
		AdminPlatformAIModel: "admin-platform-ai-model",
	},
	PlatformPackageRoutes: {},
	AiManageRoutes: {},
	EnterpriseManageRoutes: {},
	otherRoutes: [],
}))
vi.mock("@dtyq/magic-admin/components", () => ({}))
vi.mock("@dtyq/magic-admin/provider", () => ({}))

vi.mock("@/models/user", async () => {
	const { makeAutoObservable } = await import("mobx")

	class MockUserState {
		authorization = "test-token"
		organizationCode = "org-1"

		constructor() {
			makeAutoObservable(this, {}, { autoBind: true })
		}

		setAuthorization(authorization: string) {
			this.authorization = authorization
		}

		setOrganizationCode(organizationCode: string) {
			this.organizationCode = organizationCode
		}
	}

	return {
		userStore: {
			user: new MockUserState(),
		},
	}
})

vi.mock("@/apis", () => ({
	SuperMagicApi: {
		getMicroAppRuntimeProject: vi.fn(),
		ensureMicroAppRuntimeProject: vi.fn(),
		getProjectDetail: vi.fn(),
		getTopicsByProjectId: vi.fn(),
	},
}))

vi.mock("@/pages/superMagic/services/projectAttachmentsLoader", () => ({
	loadProjectAttachments: vi.fn().mockResolvedValue({ tree: [], list: [] }),
}))

vi.mock("@/pages/share/microApp/hooks/usePublishedRuntimePreview", () => ({
	usePublishedRuntimePreview: () => ({
		handleSelectDetail: vi.fn(),
		handleOpenFile: vi.fn(),
		openPreviewDetail: vi.fn(),
		previewPopup: null,
		fileManagerPopup: null,
	}),
}))

describe("PublishedMicroAppConversationProvider", () => {
	beforeEach(() => {
		responsiveMocks.isMobile = false
		vi.mocked(MagicModal.confirm).mockClear()
		vi.mocked(magicToast.error).mockClear()
		vi.mocked(authEventBus.emit).mockClear()
		userStore.user.setAuthorization("test-token")
		userStore.user.setOrganizationCode("org-1")
		layoutMocks.tasksProps = null
		layoutMocks.props = null
		layoutMocks.messagePanelProps = null
		layoutMocks.mobileProps = null
		layoutMocks.historyPanelProps = null
		vi.mocked(loadProjectAttachments).mockClear()
		vi.mocked(SuperMagicApi.getMicroAppRuntimeProject).mockReset()
		vi.mocked(SuperMagicApi.ensureMicroAppRuntimeProject).mockReset()
		vi.mocked(SuperMagicApi.getProjectDetail).mockReset()
		vi.mocked(SuperMagicApi.getTopicsByProjectId).mockReset()
		vi.mocked(SuperMagicApi.getMicroAppRuntimeProject).mockResolvedValue({ exists: false })
		vi.mocked(useDefaultModeModelListRefreshOnMount).mockClear()
	})

	it("does not crash while legacy share data has no source organization", () => {
		expect(() =>
			render(
				<BasePublishedMicroAppConversationProvider
					appId="app-1"
					sourceOrganizationCode={undefined as never}
				>
					<div data-testid="preview-child" />
				</BasePublishedMicroAppConversationProvider>,
			),
		).not.toThrow()
		expect(screen.getByTestId("preview-child")).toBeInTheDocument()
		expect(SuperMagicApi.getMicroAppRuntimeProject).not.toHaveBeenCalled()
	})

	it("renders children without AppStoreProvider when conversation is disabled", () => {
		render(
			<PublishedMicroAppConversationProvider appId="app-1" enabled={false}>
				<div data-testid="preview-child" />
			</PublishedMicroAppConversationProvider>,
		)

		expect(screen.getByTestId("preview-child")).toBeInTheDocument()
		expect(screen.queryByTestId("topic-desktop-panels")).not.toBeInTheDocument()
	})

	it("prefetches the default model catalog for the runtime conversation", async () => {
		render(
			<PublishedMicroAppConversationProvider appId="app-1">
				<div data-testid="preview-child" />
			</PublishedMicroAppConversationProvider>,
		)

		expect(useDefaultModeModelListRefreshOnMount).toHaveBeenCalled()
		await waitFor(() => {
			expect(SuperMagicApi.getMicroAppRuntimeProject).toHaveBeenCalled()
		})
	})

	it("hides the sidebar when the runtime project does not exist", async () => {
		render(
			<PublishedMicroAppConversationProvider appId="app-1">
				<div data-testid="preview-child" />
			</PublishedMicroAppConversationProvider>,
		)

		expect(screen.getByTestId("preview-child")).toBeInTheDocument()
		expect(screen.getByTestId("topic-desktop-panels")).toBeInTheDocument()
		await waitFor(() => {
			expect(SuperMagicApi.getMicroAppRuntimeProject).toHaveBeenCalledWith("app-1", {
				enableErrorMessagePrompt: false,
			})
		})
		expect(layoutMocks.props?.isReadOnly).toBe(true)
		expect(
			screen.queryByTestId("published-micro-app-conversation-panel"),
		).not.toBeInTheDocument()
		expect(SuperMagicApi.ensureMicroAppRuntimeProject).not.toHaveBeenCalled()
	})

	it("keeps the sidebar hidden while checking the runtime project and after failure", async () => {
		const runtimeLookup = createDeferred<{ exists: boolean }>()
		vi.mocked(SuperMagicApi.getMicroAppRuntimeProject).mockReturnValue(
			runtimeLookup.promise as never,
		)

		render(
			<PublishedMicroAppConversationProvider appId="app-1">
				<div data-testid="preview-child" />
			</PublishedMicroAppConversationProvider>,
		)

		expect(screen.getByTestId("preview-child")).toBeInTheDocument()
		expect(layoutMocks.props?.isReadOnly).toBe(true)
		expect(
			screen.queryByTestId("published-micro-app-conversation-panel"),
		).not.toBeInTheDocument()

		await act(async () => runtimeLookup.reject(new Error("lookup failed")))
		expect(layoutMocks.props?.isReadOnly).toBe(true)
		expect(
			screen.queryByTestId("published-micro-app-conversation-panel"),
		).not.toBeInTheDocument()
	})

	it("uses a mobile floating entry and popup for an authorized runtime project", async () => {
		responsiveMocks.isMobile = true
		vi.mocked(SuperMagicApi.getMicroAppRuntimeProject).mockResolvedValue({
			exists: true,
			project: { id: "runtime-project-1" },
		} as never)
		vi.mocked(SuperMagicApi.getProjectDetail).mockResolvedValue({
			id: "runtime-project-1",
		} as never)
		vi.mocked(SuperMagicApi.getTopicsByProjectId).mockResolvedValue({ list: [] } as never)

		render(
			<FileAccessProvider
				value={createShareFileAccess({
					token: "origin-share-token",
					projectId: "origin-project",
				})}
			>
				<PublishedMicroAppConversationProvider appId="app-1">
					<div data-testid="preview-child" />
				</PublishedMicroAppConversationProvider>
			</FileAccessProvider>,
		)

		expect(screen.queryByTestId("topic-desktop-panels")).not.toBeInTheDocument()
		expect(await screen.findByTestId("micro-app-mobile-conversation-button")).toBeVisible()
		fireEvent.click(screen.getByTestId("micro-app-mobile-conversation-button"))

		expect(
			await screen.findByTestId("published-micro-app-mobile-conversation"),
		).toHaveAttribute("data-lock-to-micro-app-mode", "false")
		expect(
			JSON.parse(
				screen
					.getByTestId("published-micro-app-mobile-conversation")
					.getAttribute("data-file-access") ?? "null",
			),
		).toEqual({ kind: "session", projectId: "runtime-project-1", topicId: "" })
	})

	it("uses the shared desktop layout and history panel for a runtime project", async () => {
		vi.mocked(SuperMagicApi.getMicroAppRuntimeProject).mockResolvedValue({
			exists: true,
			project: { id: "runtime-project-1" },
		} as never)
		vi.mocked(SuperMagicApi.getProjectDetail).mockResolvedValue({
			id: "runtime-project-1",
		} as never)
		vi.mocked(SuperMagicApi.getTopicsByProjectId).mockResolvedValue({ list: [] } as never)

		render(
			<FileAccessProvider
				value={createShareFileAccess({
					token: "origin-share-token",
					projectId: "origin-project",
				})}
			>
				<PublishedMicroAppConversationProvider appId="app-1">
					<div data-testid="preview-child" />
				</PublishedMicroAppConversationProvider>
			</FileAccessProvider>,
		)

		await waitFor(() => {
			expect(screen.getByTestId("app-conversation-panel")).toBeVisible()
			expect(screen.getByTestId("published-micro-app-attachments-button")).toBeVisible()
		})
		expect(screen.getByTestId("published-micro-app-conversation-panel")).toHaveClass(
			"bg-sidebar",
		)
		expect(screen.getByTestId("published-micro-app-conversation-panel")).not.toHaveClass(
			"border-l",
			"border-border",
		)
		expect(
			JSON.parse(
				screen.getByTestId("app-conversation-panel").getAttribute("data-file-access") ??
					"null",
			),
		).toEqual({ kind: "session", projectId: "runtime-project-1", topicId: "" })
		expect(loadProjectAttachments).toHaveBeenCalledWith({
			projectId: "runtime-project-1",
			enableErrorMessagePrompt: false,
		})

		expect(layoutMocks.props).toEqual(
			expect.objectContaining({
				showProjectSidebar: false,
				showProjectResizeHandle: false,
				initialConversationPanelCollapsed: true,
				collapsedConversationPanelWidth: 40,
				persistConversationPanelState: false,
				detailResizeHandleClassName: "border-l border-border",
				historyOverlayScope: "container",
				shouldShowDetailPanel: true,
				isReadOnly: false,
				autoExpandConversationWhenDetailVisible: false,
			}),
		)
		expect(layoutMocks.messagePanelProps).toEqual(
			expect.objectContaining({
				historyTriggerMode: "layout",
				isConversationPanelCollapsed: true,
				onSelectDetail: expect.any(Function),
				onFileClick: expect.any(Function),
			}),
		)

		const collapseConversationPanel = vi.fn()
		const expandedPanel = layoutMocks.props?.renderMessagePanel({
			isConversationPanelCollapsed: false,
			isDraggingPanel: false,
			onToggleConversationPanel: collapseConversationPanel,
			onExpandConversationPanel: vi.fn(),
			historyTriggerMode: "layout",
			isHistoryPanelOpen: false,
			onToggleHistoryPanel: vi.fn(),
		})
		const expandedPanelRender = render(expandedPanel)
		expect(
			within(expandedPanelRender.container).getByTestId(
				"published-micro-app-conversation-header",
			),
		).toHaveTextContent("microAppPage.conversation.title")
		expect(
			within(expandedPanelRender.container).getByTestId(
				"published-micro-app-attachments-button",
			),
		).toBeVisible()
		const header = within(expandedPanelRender.container).getByTestId(
			"published-micro-app-conversation-header",
		)
		expect(
			within(header).getByRole("button", {
				name: "microAppPage.conversation.collapse",
			}),
		).toBeVisible()
		expect(layoutMocks.messagePanelProps).toEqual(
			expect.objectContaining({
				hideConversationPanelToggle: true,
				isConversationPanelCollapsed: false,
				trailingActions: undefined,
			}),
		)
		fireEvent.click(
			expandedPanelRender.getByRole("button", {
				name: "microAppPage.conversation.collapse",
			}),
		)
		expect(collapseConversationPanel).toHaveBeenCalledTimes(1)
		expandedPanelRender.unmount()

		const historyPanel = layoutMocks.props?.historyLayout.renderPanel({
			mode: "fixed",
			onClose: vi.fn(),
			isConversationPanelCollapsed: false,
			onExpandConversationPanel: vi.fn(),
		})
		const { unmount } = render(historyPanel)
		expect(screen.getByTestId("message-header-topic-history-panel")).toBeInTheDocument()
		expect(layoutMocks.historyPanelProps?.hideTopicListModeIcon).toBeUndefined()
		unmount()
	})

	it("switches tasks, files and conversation in the same area and keeps the draft", async () => {
		vi.mocked(SuperMagicApi.getMicroAppRuntimeProject).mockResolvedValue({
			exists: true,
			project: { id: "runtime-project" },
		} as never)
		vi.mocked(SuperMagicApi.getProjectDetail).mockResolvedValue({
			id: "runtime-project",
			workspace_id: "runtime-workspace",
			project_name: "Runtime",
		} as never)
		vi.mocked(SuperMagicApi.getTopicsByProjectId).mockResolvedValue({ list: [] } as never)
		render(
			<PublishedMicroAppConversationProvider appId="app-1" appName="My app">
				<div />
			</PublishedMicroAppConversationProvider>,
		)
		await waitFor(() =>
			expect(layoutMocks.messagePanelProps?.selectedProject).toMatchObject({
				id: "runtime-project",
			}),
		)
		expect(layoutMocks.messagePanelProps).toMatchObject({
			microAppId: "app-1",
			microAppName: "My app",
			lockToMicroAppMode: false,
		})
		fireEvent.change(screen.getByLabelText("draft"), { target: { value: "Unsent message" } })
		fireEvent.click(screen.getByTestId("published-micro-app-tasks-button"))
		expect(await screen.findByTestId("runtime-tasks")).toBeVisible()
		expect(screen.getByTestId("published-micro-app-conversation-header")).not.toHaveTextContent(
			"scheduleTask.title",
		)
		expect(layoutMocks.tasksProps).toMatchObject({
			selectProjectId: "runtime-project",
			selectWorkspaceId: "runtime-workspace",
			microAppId: "app-1",
			microAppName: "My app",
			compact: true,
		})
		expect(
			JSON.parse(
				screen.getByTestId("runtime-tasks").getAttribute("data-file-access") ?? "null",
			),
		).toMatchObject({ kind: "session", projectId: "runtime-project" })
		expect(screen.getByLabelText("draft")).not.toBeVisible()
		fireEvent.click(screen.getByTestId("published-micro-app-attachments-button"))
		expect(screen.getByTestId("published-micro-app-attachments-panel")).toBeVisible()
		expect(screen.getByTestId("published-micro-app-conversation-header")).not.toHaveTextContent(
			"attachmentList.projectFiles",
		)
		expect(screen.queryByTestId("runtime-tasks")).not.toBeInTheDocument()
		fireEvent.click(screen.getByTestId("published-micro-app-conversation-button"))
		expect(screen.getByLabelText("draft")).toBeVisible()
		expect(screen.getByLabelText("draft")).toHaveValue("Unsent message")
		expect(screen.getByTestId("published-micro-app-conversation-header")).toHaveTextContent(
			"microAppPage.conversation.title",
		)
		fireEvent.click(screen.getByTestId("published-micro-app-user-space-button"))
		expect(await screen.findByTestId("runtime-user-space")).toHaveAttribute(
			"data-project-id",
			"runtime-project",
		)
		expect(screen.getByTestId("published-micro-app-conversation-header")).not.toHaveTextContent(
			"userSpace.title",
		)
		fireEvent.click(screen.getByTestId("published-micro-app-share-button"))
		expect(await screen.findByTestId("runtime-share-management")).toHaveAttribute(
			"data-project-id",
			"runtime-project",
		)
		expect(screen.getByTestId("published-micro-app-conversation-header")).not.toHaveTextContent(
			"shareManagement.title",
		)
		expect(SuperMagicApi.ensureMicroAppRuntimeProject).not.toHaveBeenCalled()
	})

	it.each(["tasks", "attachments"])(
		"returns from collapsed %s to conversation through history",
		async (panel) => {
			vi.mocked(SuperMagicApi.getMicroAppRuntimeProject).mockResolvedValue({
				exists: true,
				project: { id: "runtime-project" },
			} as never)
			vi.mocked(SuperMagicApi.getProjectDetail).mockResolvedValue({
				id: "runtime-project",
				workspace_id: "workspace",
			} as never)
			vi.mocked(SuperMagicApi.getTopicsByProjectId).mockResolvedValue({ list: [] } as never)
			render(
				<PublishedMicroAppConversationProvider appId="app-1">
					<div />
				</PublishedMicroAppConversationProvider>,
			)
			await waitFor(() =>
				expect(layoutMocks.messagePanelProps?.selectedProject).toMatchObject({
					id: "runtime-project",
				}),
			)
			fireEvent.click(screen.getByTestId(`published-micro-app-${panel}-button`))
			expect(screen.getByLabelText("draft")).not.toBeVisible()
			fireEvent.click(
				screen.getByRole("button", { name: "microAppPage.conversation.collapse" }),
			)
			const historyPanel = layoutMocks.props?.historyLayout.renderPanel({
				isConversationPanelCollapsed: true,
				onExpandConversationPanel: layoutMocks.expand,
				onClose: vi.fn(),
			}) as React.ReactElement<{ onExpandConversationPanel: () => void }>
			act(() => {
				historyPanel.props.onExpandConversationPanel()
			})
			expect(screen.getByLabelText("draft")).toBeVisible()
		},
	)

	it("shows the sidebar after a host action creates the runtime project", async () => {
		vi.mocked(SuperMagicApi.ensureMicroAppRuntimeProject)
			.mockRejectedValueOnce(new Error("failed"))
			.mockResolvedValueOnce({ project: { id: "runtime-new" } } as never)
		vi.mocked(SuperMagicApi.getProjectDetail).mockResolvedValue({
			id: "runtime-new",
			workspace_id: "runtime-workspace",
		} as never)
		vi.mocked(SuperMagicApi.getTopicsByProjectId).mockResolvedValue({ list: [] } as never)
		function EnsureButton() {
			const { ensureConversation } = useHostConversation()
			return (
				<button
					type="button"
					onClick={() => void ensureConversation?.().catch(() => undefined)}
				>
					Start
				</button>
			)
		}

		render(
			<PublishedMicroAppConversationProvider appId="app-1">
				<EnsureButton />
			</PublishedMicroAppConversationProvider>,
		)
		await act(() => Promise.resolve())
		expect(
			screen.queryByTestId("published-micro-app-conversation-panel"),
		).not.toBeInTheDocument()
		fireEvent.click(screen.getByText("Start"))
		await waitFor(() =>
			expect(SuperMagicApi.ensureMicroAppRuntimeProject).toHaveBeenCalledTimes(1),
		)
		expect(
			screen.queryByTestId("published-micro-app-conversation-panel"),
		).not.toBeInTheDocument()

		fireEvent.click(screen.getByText("Start"))
		await waitFor(() => {
			expect(screen.getByTestId("published-micro-app-conversation-panel")).toBeVisible()
		})
		expect(SuperMagicApi.ensureMicroAppRuntimeProject).toHaveBeenCalledTimes(2)
		expect(SuperMagicApi.ensureMicroAppRuntimeProject).toHaveBeenLastCalledWith("app-1")
		expect(layoutMocks.messagePanelProps?.selectedProject).toMatchObject({ id: "runtime-new" })
	})

	it("keeps runtime controls hidden for unauthenticated visitors", async () => {
		userStore.user.setAuthorization("")
		render(
			<PublishedMicroAppConversationProvider appId="app-1">
				<div />
			</PublishedMicroAppConversationProvider>,
		)
		await act(() => Promise.resolve())
		expect(screen.queryByTestId("published-micro-app-tasks-button")).not.toBeInTheDocument()
		expect(SuperMagicApi.getMicroAppRuntimeProject).not.toHaveBeenCalled()
		expect(SuperMagicApi.ensureMicroAppRuntimeProject).not.toHaveBeenCalled()
	})

	it("blocks cross-organization conversations before runtime creation", async () => {
		userStore.user.setOrganizationCode("org-2")
		const errors: string[] = []
		function StartButton() {
			const { ensureConversation } = useHostConversation()
			return (
				<button
					onClick={() =>
						void ensureConversation?.().catch((error: Error) =>
							errors.push(error.message),
						)
					}
				>
					Start
				</button>
			)
		}

		render(
			<BasePublishedMicroAppConversationProvider appId="app-1" sourceOrganizationCode="org-1">
				<StartButton />
			</BasePublishedMicroAppConversationProvider>,
		)
		await act(() => Promise.resolve())
		fireEvent.click(screen.getByText("Start"))

		await waitFor(() => {
			expect(errors).toEqual(["microAppShare.crossOrganizationConversationUnsupported"])
		})
		expect(magicToast.error).toHaveBeenCalledWith(
			"microAppShare.crossOrganizationConversationUnsupported",
		)
		expect(SuperMagicApi.getMicroAppRuntimeProject).not.toHaveBeenCalled()
		expect(SuperMagicApi.ensureMicroAppRuntimeProject).not.toHaveBeenCalled()
		expect(SuperMagicApi.getProjectDetail).not.toHaveBeenCalled()
	})

	it("starts runtime lookup only after the current organization is available", async () => {
		userStore.user.setOrganizationCode("")
		render(
			<BasePublishedMicroAppConversationProvider appId="app-1" sourceOrganizationCode="org-1">
				<div />
			</BasePublishedMicroAppConversationProvider>,
		)
		await act(() => Promise.resolve())
		expect(SuperMagicApi.getMicroAppRuntimeProject).not.toHaveBeenCalled()

		act(() => userStore.user.setOrganizationCode("org-1"))
		await waitFor(() => {
			expect(SuperMagicApi.getMicroAppRuntimeProject).toHaveBeenCalledTimes(1)
		})
	})

	it("discards a pending runtime lookup after switching organizations", async () => {
		const query = createDeferred<{ exists: boolean; project: { id: string } }>()
		vi.mocked(SuperMagicApi.getMicroAppRuntimeProject).mockReturnValue(query.promise as never)
		render(
			<BasePublishedMicroAppConversationProvider appId="app-1" sourceOrganizationCode="org-1">
				<div />
			</BasePublishedMicroAppConversationProvider>,
		)
		await waitFor(() => {
			expect(SuperMagicApi.getMicroAppRuntimeProject).toHaveBeenCalledTimes(1)
		})

		act(() => userStore.user.setOrganizationCode("org-2"))
		await act(async () => query.resolve({ exists: true, project: { id: "old-runtime" } }))

		expect(SuperMagicApi.getProjectDetail).not.toHaveBeenCalled()
		expect(SuperMagicApi.ensureMicroAppRuntimeProject).not.toHaveBeenCalled()
		expect(layoutMocks.props?.isReadOnly).toBe(true)
	})

	it("hides an existing runtime sidebar immediately after logout", async () => {
		vi.mocked(SuperMagicApi.getMicroAppRuntimeProject).mockResolvedValue({
			exists: true,
			project: { id: "runtime-project" },
		} as never)
		vi.mocked(SuperMagicApi.getProjectDetail).mockResolvedValue({
			id: "runtime-project",
		} as never)
		vi.mocked(SuperMagicApi.getTopicsByProjectId).mockResolvedValue({ list: [] } as never)
		render(
			<PublishedMicroAppConversationProvider appId="app-1">
				<div data-testid="preview-child" />
			</PublishedMicroAppConversationProvider>,
		)
		await waitFor(() => {
			expect(screen.getByTestId("published-micro-app-conversation-panel")).toBeVisible()
		})

		act(() => userStore.user.setAuthorization(""))

		expect(screen.getByTestId("preview-child")).toBeInTheDocument()
		expect(layoutMocks.props?.isReadOnly).toBe(true)
		expect(
			screen.queryByTestId("published-micro-app-conversation-panel"),
		).not.toBeInTheDocument()
	})

	it("returns the hydrated project from ensureConversation", async () => {
		const hydratedProject = {
			id: "runtime-project-1",
			project_status: "active",
			project_name: "Runtime",
		}
		vi.mocked(SuperMagicApi.ensureMicroAppRuntimeProject).mockResolvedValue({
			project: { id: hydratedProject.id },
			is_existing: false,
		} as never)
		vi.mocked(SuperMagicApi.getProjectDetail).mockResolvedValue(hydratedProject as never)
		vi.mocked(SuperMagicApi.getTopicsByProjectId).mockResolvedValue({ list: [] } as never)

		let ensured: { selectedProject: unknown } | null | undefined
		function EnsureButton() {
			const { ensureConversation } = useHostConversation()
			return (
				<button
					type="button"
					data-testid="ensure-conversation"
					onClick={async () => {
						ensured = await ensureConversation?.()
					}}
				/>
			)
		}

		render(
			<PublishedMicroAppConversationProvider appId="app-1">
				<EnsureButton />
			</PublishedMicroAppConversationProvider>,
		)
		await waitFor(() => {
			expect(SuperMagicApi.getMicroAppRuntimeProject).toHaveBeenCalled()
		})

		fireEvent.click(screen.getByTestId("ensure-conversation"))
		await waitFor(() => {
			expect(ensured?.selectedProject).toEqual(hydratedProject)
		})
		expect(ensured?.selectedProject).not.toEqual({ id: hydratedProject.id })
	})

	it.each(["onCancel", "onOk"] as const)(
		"does not create a runtime project when an anonymous action chooses %s",
		async (choice) => {
			userStore.user.setAuthorization("")
			const errors: string[] = []
			function StartButton() {
				const { ensureConversation } = useHostConversation()
				return (
					<button
						onClick={() =>
							void ensureConversation?.().catch((error: Error) => {
								errors.push(error.message)
							})
						}
					>
						Start
					</button>
				)
			}
			render(
				<PublishedMicroAppConversationProvider appId="app-1">
					<StartButton />
				</PublishedMicroAppConversationProvider>,
			)
			fireEvent.click(screen.getByText("Start"))
			fireEvent.click(screen.getByText("Start"))
			expect(MagicModal.confirm).toHaveBeenCalledTimes(1)
			expect(authEventBus.emit).not.toHaveBeenCalled()
			await act(async () => {
				vi.mocked(MagicModal.confirm).mock.calls[0][0][choice]?.()
			})
			expect(errors).toEqual(["Authentication required", "Authentication required"])
			expect(authEventBus.emit).toHaveBeenCalledTimes(choice === "onOk" ? 1 : 0)
			expect(SuperMagicApi.getMicroAppRuntimeProject).not.toHaveBeenCalled()
			expect(SuperMagicApi.ensureMicroAppRuntimeProject).not.toHaveBeenCalled()
		},
	)

	it("does not render a stale runtime project after switching apps", async () => {
		const appA = createDeferred<{ exists: boolean; project?: { id: string } }>()
		const appB = createDeferred<{ exists: boolean; project?: { id: string } }>()
		vi.mocked(SuperMagicApi.getMicroAppRuntimeProject).mockImplementation(
			(id) => (id === "app-1" ? appA.promise : appB.promise) as never,
		)
		vi.mocked(SuperMagicApi.getTopicsByProjectId).mockResolvedValue({ list: [] } as never)

		const { rerender } = render(
			<PublishedMicroAppConversationProvider appId="app-1">
				<div data-testid="preview-child" />
			</PublishedMicroAppConversationProvider>,
		)
		await waitFor(() =>
			expect(SuperMagicApi.getMicroAppRuntimeProject).toHaveBeenCalledWith(
				"app-1",
				expect.anything(),
			),
		)

		rerender(
			<PublishedMicroAppConversationProvider appId="app-2">
				<div data-testid="preview-child" />
			</PublishedMicroAppConversationProvider>,
		)
		appB.resolve({ exists: false })
		await waitFor(() =>
			expect(SuperMagicApi.getMicroAppRuntimeProject).toHaveBeenCalledWith(
				"app-2",
				expect.anything(),
			),
		)

		appA.resolve({ exists: true, project: { id: "project-a" } })
		await act(async () => {
			await new Promise((resolve) => setTimeout(resolve, 0))
		})
		expect(SuperMagicApi.getProjectDetail).not.toHaveBeenCalled()
		expect(layoutMocks.messagePanelProps).toBeNull()
		expect(layoutMocks.props?.isReadOnly).toBe(true)
	})

	it("reuses one creation request for concurrent actions", async () => {
		const creation = createDeferred<{ project: { id: string } }>()
		vi.mocked(SuperMagicApi.ensureMicroAppRuntimeProject).mockReturnValue(
			creation.promise as never,
		)
		vi.mocked(SuperMagicApi.getProjectDetail).mockResolvedValue({ id: "runtime-new" } as never)
		vi.mocked(SuperMagicApi.getTopicsByProjectId).mockResolvedValue({ list: [] } as never)
		const results: unknown[] = []
		function StartButton() {
			const { ensureConversation } = useHostConversation()
			return (
				<button
					onClick={() =>
						void ensureConversation?.().then((result) => results.push(result))
					}
				>
					Start
				</button>
			)
		}
		render(
			<PublishedMicroAppConversationProvider appId="app-1">
				<StartButton />
			</PublishedMicroAppConversationProvider>,
		)
		await act(() => Promise.resolve())
		expect(SuperMagicApi.ensureMicroAppRuntimeProject).not.toHaveBeenCalled()
		fireEvent.click(screen.getByText("Start"))
		fireEvent.click(screen.getByText("Start"))
		await waitFor(() =>
			expect(SuperMagicApi.ensureMicroAppRuntimeProject).toHaveBeenCalledTimes(1),
		)
		await act(async () => creation.resolve({ project: { id: "runtime-new" } }))
		await waitFor(() => expect(results).toHaveLength(2))
		expect(results[0]).toBe(results[1])
	})

	it("discards a pending project query after logout without querying anonymously", async () => {
		const query = createDeferred<{ exists: boolean; project: { id: string } }>()
		vi.mocked(SuperMagicApi.getMicroAppRuntimeProject).mockReturnValue(query.promise as never)
		const { rerender } = render(
			<PublishedMicroAppConversationProvider appId="app-1">
				<div />
			</PublishedMicroAppConversationProvider>,
		)
		userStore.user.setAuthorization("")
		rerender(
			<PublishedMicroAppConversationProvider appId="app-1">
				<div />
			</PublishedMicroAppConversationProvider>,
		)
		await act(async () => query.resolve({ exists: true, project: { id: "old-runtime" } }))
		expect(SuperMagicApi.getMicroAppRuntimeProject).toHaveBeenCalledTimes(1)
		expect(SuperMagicApi.getProjectDetail).not.toHaveBeenCalled()
		expect(SuperMagicApi.ensureMicroAppRuntimeProject).not.toHaveBeenCalled()
	})

	it("does not start creation if the preview unmounts during authentication", async () => {
		let errorMessage = ""
		function StartButton() {
			const { ensureConversation } = useHostConversation()
			return (
				<button
					onClick={() =>
						void ensureConversation?.().catch((error: Error) => {
							errorMessage = error.message
						})
					}
				>
					Start
				</button>
			)
		}
		const { unmount } = render(
			<PublishedMicroAppConversationProvider appId="app-1">
				<StartButton />
			</PublishedMicroAppConversationProvider>,
		)
		await act(() => Promise.resolve())
		fireEvent.click(screen.getByText("Start"))
		unmount()
		await act(() => Promise.resolve())
		expect(errorMessage).toBe("Runtime project load superseded")
		expect(SuperMagicApi.ensureMicroAppRuntimeProject).not.toHaveBeenCalled()
	})

	it("reuses the editor usage conversation instead of a nested runtime store", async () => {
		vi.mocked(SuperMagicApi.getMicroAppRuntimeProject).mockResolvedValue({
			exists: true,
			project: { id: "runtime-project-1" },
		} as never)
		vi.mocked(SuperMagicApi.getProjectDetail).mockResolvedValue({
			id: "runtime-project-1",
		} as never)
		vi.mocked(SuperMagicApi.getTopicsByProjectId).mockResolvedValue({ list: [] } as never)

		let usageTopicStore: unknown
		function EditorPreviewHarness() {
			const store = useAppStore()
			useState(() => {
				store.setConversationType("usage")
				usageTopicStore = store.usageConversation.topicStore
				return null
			})
			return (
				<PublishedMicroAppConversationProvider appId="app-1">
					<div />
				</PublishedMicroAppConversationProvider>
			)
		}

		render(
			<AppStoreProvider>
				<EditorPreviewHarness />
			</AppStoreProvider>,
		)

		await waitFor(() => {
			expect(layoutMocks.messagePanelProps?.selectedProject).toMatchObject({
				id: "runtime-project-1",
			})
		})
		expect(layoutMocks.messagePanelProps?.topicStore).toBe(usageTopicStore)
	})

	it("provides onTerminalTopicStatusChange and updates projectFilesStore on attachment changes", async () => {
		const initialFile = {
			file_id: "file-1",
			file_name: "index.html",
			file_key: "index.html",
			type: "file",
		}
		const generatedFile = {
			file_id: "file-2",
			file_name: "result.xlsx",
			file_key: "output/result.xlsx",
			type: "file",
		}

		vi.mocked(SuperMagicApi.getMicroAppRuntimeProject).mockResolvedValue({
			exists: true,
			project: { id: "runtime-project-1" },
		} as never)
		vi.mocked(SuperMagicApi.getProjectDetail).mockResolvedValue({
			id: "runtime-project-1",
		} as never)
		vi.mocked(SuperMagicApi.getTopicsByProjectId).mockResolvedValue({ list: [] } as never)
		vi.mocked(loadProjectAttachments).mockResolvedValue({
			tree: [initialFile],
			list: [initialFile],
		} as never)

		render(
			<PublishedMicroAppConversationProvider appId="app-1">
				<div />
			</PublishedMicroAppConversationProvider>,
		)

		await waitFor(() => {
			expect(layoutMocks.messagePanelProps?.selectedProject).toMatchObject({
				id: "runtime-project-1",
			})
		})

		const filesStore = layoutMocks.messagePanelProps?.projectFilesStore as ProjectFilesStore
		expect(filesStore).toBeDefined()
		expect(filesStore.workspaceFilesList).toEqual(
			expect.arrayContaining([expect.objectContaining({ file_id: "file-1" })]),
		)
		expect(layoutMocks.messagePanelProps?.onTerminalTopicStatusChange).toBeTypeOf("function")

		// Simulate new files generated and Update_Attachments event published
		vi.mocked(loadProjectAttachments).mockResolvedValue({
			tree: [initialFile, generatedFile],
			list: [initialFile, generatedFile],
		} as never)

		await act(async () => {
			pubsub.publish(PubSubEvents.Update_Attachments, { projectId: "runtime-project-1" })
		})

		await waitFor(() => {
			expect(filesStore.workspaceFilesList).toEqual(
				expect.arrayContaining([
					expect.objectContaining({ file_id: "file-1" }),
					expect.objectContaining({ file_id: "file-2", file_name: "result.xlsx" }),
				]),
			)
		})
	})

	it("forwards onTerminalTopicStatusChange and projectFilesStore to mobile conversation", async () => {
		responsiveMocks.isMobile = true
		vi.mocked(SuperMagicApi.getMicroAppRuntimeProject).mockResolvedValue({
			exists: true,
			project: { id: "runtime-project-1" },
		} as never)
		vi.mocked(SuperMagicApi.getProjectDetail).mockResolvedValue({
			id: "runtime-project-1",
		} as never)
		vi.mocked(SuperMagicApi.getTopicsByProjectId).mockResolvedValue({ list: [] } as never)
		vi.mocked(loadProjectAttachments).mockResolvedValue({
			tree: [],
			list: [],
		} as never)

		render(
			<PublishedMicroAppConversationProvider appId="app-1">
				<div />
			</PublishedMicroAppConversationProvider>,
		)

		await waitFor(() => {
			expect(screen.getByTestId("published-micro-app-mobile-surface")).toBeInTheDocument()
		})

		// Open mobile conversation drawer
		fireEvent.click(screen.getByRole("button"))

		await waitFor(() => {
			expect(layoutMocks.mobileProps?.open).toBe(true)
		})

		expect(layoutMocks.mobileProps?.onTerminalTopicStatusChange).toBeTypeOf("function")
		expect(layoutMocks.mobileProps?.projectFilesStore).toBeDefined()
	})

	it("syncs attachments to appStore.runtimeProjectFilesStore in editor preview mode", async () => {
		const generatedFile = {
			file_id: "file-99",
			file_name: "export.csv",
			file_key: "export.csv",
			type: "file",
		}

		vi.mocked(SuperMagicApi.getMicroAppRuntimeProject).mockResolvedValue({
			exists: true,
			project: { id: "runtime-project-1" },
		} as never)
		vi.mocked(SuperMagicApi.getProjectDetail).mockResolvedValue({
			id: "runtime-project-1",
		} as never)
		vi.mocked(SuperMagicApi.getTopicsByProjectId).mockResolvedValue({ list: [] } as never)
		vi.mocked(loadProjectAttachments).mockResolvedValue({
			tree: [generatedFile],
			list: [generatedFile],
		} as never)

		let rootStore: ReturnType<typeof useAppStore> | undefined
		function EditorPreviewHarness() {
			const store = useAppStore()
			rootStore = store
			return (
				<PublishedMicroAppConversationProvider appId="app-1">
					<div />
				</PublishedMicroAppConversationProvider>
			)
		}

		render(
			<AppStoreProvider>
				<EditorPreviewHarness />
			</AppStoreProvider>,
		)

		await waitFor(() => {
			expect(layoutMocks.messagePanelProps?.selectedProject).toMatchObject({
				id: "runtime-project-1",
			})
		})

		expect(layoutMocks.messagePanelProps?.projectFilesStore).toBe(
			rootStore?.runtimeProjectFilesStore,
		)
		expect(rootStore?.runtimeProjectFilesStore.workspaceFilesList).toEqual(
			expect.arrayContaining([expect.objectContaining({ file_id: "file-99" })]),
		)
	})

	it("does not invoke the update callback when the event targets another project", async () => {
		vi.mocked(SuperMagicApi.getMicroAppRuntimeProject).mockResolvedValue({
			exists: true,
			project: { id: "runtime-project-1" },
		} as never)
		vi.mocked(SuperMagicApi.getProjectDetail).mockResolvedValue({
			id: "runtime-project-1",
		} as never)
		vi.mocked(SuperMagicApi.getTopicsByProjectId).mockResolvedValue({ list: [] } as never)
		vi.mocked(loadProjectAttachments).mockResolvedValue({
			tree: [],
			list: [],
		} as never)

		render(
			<PublishedMicroAppConversationProvider appId="app-1">
				<div />
			</PublishedMicroAppConversationProvider>,
		)

		await waitFor(() => {
			expect(layoutMocks.messagePanelProps?.selectedProject).toMatchObject({
				id: "runtime-project-1",
			})
		})

		const loadCount = vi.mocked(loadProjectAttachments).mock.calls.length
		const callback = vi.fn()

		await act(async () => {
			pubsub.publish(PubSubEvents.Update_Attachments, {
				projectId: "other-project",
				callback,
			})
		})

		expect(callback).not.toHaveBeenCalled()
		expect(vi.mocked(loadProjectAttachments)).toHaveBeenCalledTimes(loadCount)
	})

	it("ignores stale attachment refreshes after unmount", async () => {
		const refresh = createDeferred<{ tree: unknown[]; list: unknown[] }>()
		vi.mocked(SuperMagicApi.getMicroAppRuntimeProject).mockResolvedValue({
			exists: true,
			project: { id: "runtime-project-1" },
		} as never)
		vi.mocked(SuperMagicApi.getProjectDetail).mockResolvedValue({
			id: "runtime-project-1",
		} as never)
		vi.mocked(SuperMagicApi.getTopicsByProjectId).mockResolvedValue({ list: [] } as never)
		vi.mocked(loadProjectAttachments)
			.mockResolvedValueOnce({
				tree: [{ file_id: "file-1", file_name: "index.html", type: "file" }],
				list: [{ file_id: "file-1", file_name: "index.html", type: "file" }],
			} as never)
			.mockReturnValueOnce(refresh.promise as never)

		const view = render(
			<PublishedMicroAppConversationProvider appId="app-1">
				<div />
			</PublishedMicroAppConversationProvider>,
		)

		await waitFor(() => {
			expect(layoutMocks.messagePanelProps?.selectedProject).toMatchObject({
				id: "runtime-project-1",
			})
		})

		const filesStore = layoutMocks.messagePanelProps?.projectFilesStore as ProjectFilesStore

		await act(async () => {
			pubsub.publish(PubSubEvents.Update_Attachments, { projectId: "runtime-project-1" })
		})

		view.unmount()
		await act(async () => {
			refresh.resolve({
				tree: [{ file_id: "stale-file", file_name: "stale.html", type: "file" }],
				list: [{ file_id: "stale-file", file_name: "stale.html", type: "file" }],
			})
			await refresh.promise
		})

		expect(filesStore.workspaceFilesList).not.toEqual(
			expect.arrayContaining([expect.objectContaining({ file_id: "stale-file" })]),
		)
	})
})

function createDeferred<T>() {
	let resolve!: (value: T) => void
	let reject!: (reason?: unknown) => void
	const promise = new Promise<T>((resolvePromise, rejectPromise) => {
		resolve = resolvePromise
		reject = rejectPromise
	})

	return { promise, resolve, reject }
}
