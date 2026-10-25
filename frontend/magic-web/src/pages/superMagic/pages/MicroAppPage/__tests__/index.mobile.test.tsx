import { forwardRef, useImperativeHandle, type ReactNode } from "react"
import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { RouteName } from "@/routes/constants"
import type { MicroAppProjectError } from "../hooks/useMicroAppProjectResolver"
import MicroAppPageMobile from "../index.mobile"

const previewPopupMocks = vi.hoisted(() => ({
	open: vi.fn(),
}))

const resolverMocks = vi.hoisted(() => ({
	result: {
		projectId: "project-1",
		loading: false,
		error: null as MicroAppProjectError | null,
	},
}))

const controllerMocks = vi.hoisted(() => ({
	initLoading: false,
	initError: null as string | null,
	isReadOnly: false,
	canUseDevelopment: true,
	checkAttachmentsNowDebounced: vi.fn(),
	handleBackToMicroApps: vi.fn(),
	handleConversationTypeChange: vi.fn(),
	ensureUsageProject: vi.fn(),
}))

const navigateMocks = vi.hoisted(() => ({
	navigate: vi.fn(),
}))

const mobileConversationMocks = vi.hoisted(() => ({
	render: vi.fn(),
}))

vi.mock("react-router", () => ({
	useParams: () => ({ appId: "app-1" }),
}))

vi.mock("react-i18next", () => ({
	initReactI18next: { type: "3rdParty", init: vi.fn() },
	useTranslation: () => ({ t: (key: string) => key }),
}))

vi.mock("@/routes/hooks/useNavigate", () => ({
	default: () => navigateMocks.navigate,
}))

vi.mock("@/pages/superMagic/providers/FileAccessProvider", async (importOriginal) => ({
	...(await importOriginal<typeof import("@/pages/superMagic/providers/FileAccessProvider")>()),
	FileAccessProvider: ({ children }: { children: ReactNode }) => children,
}))

vi.mock("@/pages/superMagic/hooks/useMobileFilePreviewPubSub", () => ({
	useMobileFilePreviewPubSub: vi.fn(),
}))

vi.mock("@/pages/superMagic/components/TopicFilesButton/hooks/useFileOpen", () => ({
	useFileOpen: ({ setUserSelectDetail }: { setUserSelectDetail: (detail: unknown) => void }) => ({
		handleOpenFile: (file: { file_id: string; file_name: string; file_extension: string }) =>
			setUserSelectDetail({
				type: file.file_extension,
				currentFileId: file.file_id,
				data: file,
			}),
	}),
}))

vi.mock("@/pages/superMagicMobile/components/PreviewDetailPopup", () => ({
	default: forwardRef((_props, ref) => {
		useImperativeHandle(ref, () => ({ open: previewPopupMocks.open }))
		return <div data-testid="mobile-file-preview-popup" />
	}),
}))

vi.mock("../context", () => ({
	AppStoreProvider: ({ children }: { children: ReactNode }) => children,
}))

vi.mock("../hooks/useMicroAppPageController", () => ({
	useMicroAppPageController: () => ({
		store: {
			initLoading: controllerMocks.initLoading,
			initError: controllerMocks.initError,
			mentionPanelStore: {},
			projectFilesStore: {},
		},
		conversation: {
			topicStore: {
				selectedTopic: { id: "topic-1", topic_name: "Topic" },
			},
		},
		selectedProject: { id: "project-1", project_name: "Micro App" },
		selectedTopic: { id: "topic-1", topic_name: "Topic" },
		hasRunningTopic: true,
		isReadOnly: controllerMocks.isReadOnly,
		canUseDevelopment: controllerMocks.canUseDevelopment,
		conversationType: "development",
		handleConversationTypeChange: controllerMocks.handleConversationTypeChange,
		ensureUsageProject: controllerMocks.ensureUsageProject,
		canEdit: false,
		canPublish: true,
		attachments: [
			{
				file_id: "entry-1",
				file_name: "index.html",
				file_extension: "html",
			},
			{
				file_id: "readme-1",
				file_name: "README.md",
				file_extension: "md",
			},
		],
		attachmentList: [
			{
				file_id: "entry-1",
				file_name: "index.html",
				file_extension: "html",
			},
			{
				file_id: "readme-1",
				file_name: "README.md",
				file_extension: "md",
			},
		],
		activeFileId: null,
		userSelectDetail: null,
		setUserSelectDetail: vi.fn(),
		defaultEntryFile: { file_id: "entry-1" },
		detailRef: { current: null },
		topicFilesProps: {},
		handleOpenFile: vi.fn(),
		handleActiveFileChange: vi.fn(),
		handleBackToMicroApps: controllerMocks.handleBackToMicroApps,
		handleOpenPublishDialog: vi.fn(),
		handleToggleDatabasePanel: vi.fn(),
		handleFileTabsCacheLoaded: vi.fn(),
		checkAttachmentsNowDebounced: controllerMocks.checkAttachmentsNowDebounced,
		publishDialogOpen: false,
		setPublishDialogOpen: vi.fn(),
		editDialogOpen: false,
		setEditDialogOpen: vi.fn(),
		editSubmitting: false,
		isDatabasePanelOpen: false,
		setIsDatabasePanelOpen: vi.fn(),
		CollaboratorUpdatePanel: null,
		canManageCollaborators: false,
		handleManageCollaborators: vi.fn(),
		handleProjectNameChange: vi.fn(),
		captureCoverReady: true,
		handleCaptureCover: vi.fn(),
		handleEditMicroApp: vi.fn(),
	}),
}))

vi.mock("../hooks/useMicroAppProjectResolver", () => ({
	useMicroAppProjectResolver: () => resolverMocks.result,
}))

vi.mock("@/pages/superMagic/components/TopicFilesButton", () => ({
	default: ({ onFileClick }: { onFileClick?: (file: unknown) => void }) => (
		<button
			type="button"
			data-testid="mobile-files-content"
			onClick={() =>
				onFileClick?.({
					file_id: "readme-1",
					file_name: "README.md",
					file_extension: "md",
				})
			}
		>
			open file
		</button>
	),
}))

vi.mock("../components/MicroAppMobileEntryPreview", () => ({
	default: ({
		entryFile,
		isBuilding,
	}: {
		entryFile?: { file_id?: string }
		isBuilding?: boolean
	}) => (
		<div
			data-testid="mobile-preview-content"
			data-entry-file-id={entryFile?.file_id}
			data-is-building={String(isBuilding)}
		/>
	),
}))

vi.mock("../components/MicroAppMobileHeader", () => ({
	default: () => <header data-testid="mobile-micro-app-header" />,
}))

vi.mock("../components/MicroAppPageOverlays", () => ({
	default: () => null,
}))

vi.mock("../components/MicroAppDatabasePanelMobile", () => ({
	default: () => <div data-testid="mobile-database-panel" />,
}))

vi.mock("../components/MicroAppMobileConversation", () => ({
	default: (props: { open: boolean; onSelectDetail?: (detail: unknown) => void }) => {
		mobileConversationMocks.render(props)
		return props.open ? (
			<div data-testid="mobile-conversation-popup">
				<button
					type="button"
					data-testid="mobile-conversation-tool"
					onClick={() =>
						props.onSelectDetail?.({
							type: "html",
							currentFileId: "admin-1",
							data: { file_id: "admin-1" },
						})
					}
				>
					tool
				</button>
			</div>
		) : null
	},
}))

describe("MicroAppPageMobile", () => {
	beforeEach(() => {
		resolverMocks.result = {
			projectId: "project-1",
			loading: false,
			error: null,
		}
		controllerMocks.initLoading = false
		controllerMocks.isReadOnly = false
		controllerMocks.canUseDevelopment = true
		controllerMocks.initError = null
		controllerMocks.checkAttachmentsNowDebounced.mockClear()
		controllerMocks.handleBackToMicroApps.mockClear()
		controllerMocks.handleConversationTypeChange.mockClear()
		controllerMocks.ensureUsageProject.mockClear()
		navigateMocks.navigate.mockClear()
		mobileConversationMocks.render.mockClear()
		previewPopupMocks.open.mockClear()
	})

	it("shows a readable fallback when project resolution has no display message", () => {
		resolverMocks.result = {
			projectId: "",
			loading: false,
			error: { kind: "load", message: "" },
		}

		render(<MicroAppPageMobile />)

		expect(screen.getByText("microAppPage.errors.loadFailed")).toBeInTheDocument()
		expect(screen.getByTestId("micro-app-fallback")).toHaveAttribute("data-mobile", "true")
		expect(screen.getByTestId("micro-app-load-fallback-illustration")).toHaveAttribute(
			"data-state",
			"retry",
		)
		expect(screen.queryByText("[object ArrayBuffer]")).not.toBeInTheDocument()
	})

	it("shows the mobile permission fallback and returns to the micro app list", () => {
		resolverMocks.result = {
			projectId: "",
			loading: false,
			error: { kind: "permission", message: "Access denied to this project" },
		}

		render(<MicroAppPageMobile />)

		expect(screen.getByText("microAppPage.errors.permissionTitle")).toBeInTheDocument()
		expect(screen.getByText("microAppPage.errors.permissionDescription")).toBeInTheDocument()
		expect(screen.getByTestId("micro-app-permission-fallback-illustration")).toHaveAttribute(
			"data-state",
			"permission",
		)

		fireEvent.click(screen.getByRole("button", { name: "microAppPage.header.backToApps" }))
		expect(navigateMocks.navigate).toHaveBeenCalledWith({ name: RouteName.MicroApps })
	})

	it("reuses the mobile fallback when project context initialization fails", () => {
		controllerMocks.initError = "Failed to load project"

		render(<MicroAppPageMobile />)

		expect(screen.getByText("microAppPage.errors.loadFailed")).toBeInTheDocument()
		fireEvent.click(screen.getByRole("button", { name: "microAppPage.header.backToApps" }))
		expect(controllerMocks.handleBackToMicroApps).toHaveBeenCalledTimes(1)
	})

	it("uses the loading illustration while resolving the project", () => {
		resolverMocks.result = {
			projectId: "",
			loading: true,
			error: null,
		}

		render(<MicroAppPageMobile />)

		expect(
			screen.getByTestId("micro-app-mobile-resolver-loading-illustration"),
		).toHaveAttribute("data-state", "loading")
	})

	it("keeps preview and files at the top level and opens conversation from a floating button", async () => {
		render(<MicroAppPageMobile />)

		expect(screen.getByTestId("micro-app-mobile-tab-preview")).toBeInTheDocument()
		expect(screen.getByTestId("micro-app-mobile-tab-files")).toBeInTheDocument()
		expect(
			screen.queryByRole("tab", { name: "microAppPage.mobileTabs.conversation" }),
		).toBeNull()
		const entryPreview = await screen.findByTestId("mobile-preview-content")
		expect(entryPreview).toBeInTheDocument()
		expect(entryPreview).toHaveAttribute("data-entry-file-id", "entry-1")
		expect(entryPreview).toHaveAttribute("data-is-building", "true")

		fireEvent.click(screen.getByTestId("micro-app-mobile-tab-files"))
		expect(screen.getByTestId("mobile-files-content")).toBeInTheDocument()

		fireEvent.click(screen.getByTestId("micro-app-mobile-conversation-button"))
		expect(await screen.findByTestId("mobile-conversation-popup")).toBeInTheDocument()
		expect(mobileConversationMocks.render).toHaveBeenLastCalledWith(
			expect.objectContaining({
				onTerminalTopicStatusChange: controllerMocks.checkAttachmentsNowDebounced,
			}),
		)
	})

	it("hides the conversation entry for read-only projects", async () => {
		controllerMocks.isReadOnly = true

		render(<MicroAppPageMobile />)
		await screen.findByTestId("mobile-preview-content")

		expect(screen.queryByTestId("micro-app-mobile-conversation-button")).not.toBeInTheDocument()
		expect(mobileConversationMocks.render).not.toHaveBeenCalled()
	})

	it("opens a mobile preview popup without replacing the entry preview", async () => {
		render(<MicroAppPageMobile />)
		await screen.findByTestId("mobile-preview-content")

		fireEvent.click(screen.getByTestId("micro-app-mobile-tab-files"))
		fireEvent.click(screen.getByTestId("mobile-files-content"))

		expect(previewPopupMocks.open).toHaveBeenCalledWith(
			expect.objectContaining({
				type: "md",
				currentFileId: "readme-1",
				data: expect.objectContaining({
					file_id: "readme-1",
					file_name: "README.md",
				}),
			}),
			expect.any(Array),
			expect.any(Array),
		)
		expect(screen.getByTestId("micro-app-mobile-files-panel")).toBeInTheDocument()
		expect(screen.getByTestId("mobile-preview-content")).toBeInTheDocument()
	})

	it("opens a preview popup from message tools on the preview panel", async () => {
		render(<MicroAppPageMobile />)
		await screen.findByTestId("mobile-preview-content")

		fireEvent.click(screen.getByTestId("micro-app-mobile-conversation-button"))
		fireEvent.click(await screen.findByTestId("mobile-conversation-tool"))

		expect(screen.getByTestId("mobile-conversation-popup")).toBeInTheDocument()
		expect(previewPopupMocks.open).toHaveBeenCalledWith(
			expect.objectContaining({
				type: "html",
				currentFileId: "admin-1",
			}),
			expect.any(Array),
			expect.any(Array),
		)
	})

	it("opens a preview popup from message tools in preview mode", async () => {
		render(<MicroAppPageMobile />)
		await screen.findByTestId("mobile-preview-content")

		fireEvent.click(screen.getByTestId("micro-app-mobile-mode-preview"))
		fireEvent.click(screen.getByTestId("micro-app-mobile-conversation-button"))
		fireEvent.click(await screen.findByTestId("mobile-conversation-tool"))

		expect(screen.getByTestId("mobile-conversation-popup")).toBeInTheDocument()
		expect(previewPopupMocks.open).toHaveBeenCalledWith(
			expect.objectContaining({
				type: "html",
				currentFileId: "admin-1",
			}),
			expect.any(Array),
			expect.any(Array),
		)
	})
})
