import { render } from "@testing-library/react"
import { useEffect, useState, type ReactNode } from "react"
import { MemoryRouter, Route, Routes, useNavigate } from "react-router"
import { vi } from "vitest"
import { resetMicroAppInstallPromptCapture } from "@/services/microAppInstallPrompt"
import MicroAppSharePage from "../index"

interface TestUserInfo {
	user_id: string
	magic_id: string
	nickname: string
	real_name: string
	avatar: string
	status: number
	organization_code: string
}

interface TestTeamshareOrganization {
	organization_code: string
	organization_name: string
}

interface TestOrganizationMeta {
	organizations: TestTeamshareOrganization[]
	organizationCode: string
	magicOrganizationMap: Record<string, { organization_name?: string }>
	teamshareOrganizationCode: string
	organizationListReady: boolean
}

interface TestPreviewFile {
	file_id?: string
	file_name?: string
}

interface TestHtmlPreviewProps {
	data: TestPreviewFile
	projectId?: string
	openFileTab?: (file: TestPreviewFile) => void
	virtualStorageMarkerId?: string
	isSharePreview?: boolean
	onHtmlPermissionManagerChange?: (manager: { open: () => void } | null) => void
}

interface TestMagicDropdownProps {
	children: ReactNode
	popupRender?: () => ReactNode
	open?: boolean
	onOpenChange?: (open: boolean) => void
	overlayClassName?: string
}

const mocks = vi.hoisted(() => ({
	resolvePublishedMicroApp: vi.fn(),
	checkShareResourcePassword: vi.fn(),
	getShareResource: vi.fn(),
	loadShareFilesV2: vi.fn(),
	getTemporaryDownloadUrl: vi.fn(),
	historyReplace: vi.fn(),
	openOrganizationSwitch: vi.fn(),
	openHtmlPermissionManager: vi.fn(),
	hasHtmlPermissionDeclarations: { current: false },
	isMobile: { current: false },
	authorization: { current: "" },
	userInfo: { current: null as TestUserInfo | null },
	organizationMeta: {
		current: {
			organizations: [] as TestTeamshareOrganization[],
			organizationCode: "",
			magicOrganizationMap: {} as Record<string, { organization_name?: string }>,
			teamshareOrganizationCode: "",
			organizationListReady: true,
		} as TestOrganizationMeta,
	},
}))

export function getMicroAppSharePageMocks() {
	return mocks
}

vi.mock("@/apis", () => ({
	// The share-permission hooks read these codes at module scope, so the mock must expose them.
	FUNCTION_PERMISSION_CODE: {
		MicroAppSharePassword: "micro_app.share_password",
		MicroAppSharePublic: "micro_app.share_public",
		MicroAppShareTeam: "micro_app.share_team",
		ProjectSharePassword: "project.share_password",
		ProjectSharePublic: "project.share_public",
		ProjectShareTeam: "project.share_team",
		TopicSharePassword: "topic.share_password",
		TopicSharePublic: "topic.share_public",
	},
	SuperMagicApi: {
		resolvePublishedMicroApp: mocks.resolvePublishedMicroApp,
		checkShareResourcePassword: mocks.checkShareResourcePassword,
		getShareResource: mocks.getShareResource,
		getMicroAppRuntimeProject: vi.fn().mockResolvedValue({ exists: false }),
		ensureMicroAppRuntimeProject: vi.fn(),
	},
}))

vi.mock("@/pages/share/services/shareFilesLoader", () => ({
	loadShareFilesV2: mocks.loadShareFilesV2,
}))

vi.mock("react-i18next", () => ({
	initReactI18next: {
		type: "3rdParty",
		init: vi.fn(),
	},
	useTranslation: () => ({
		t: (key: string) => key,
	}),
}))

vi.mock("@/models/user/hooks", () => ({
	useAuthorization: () => ({ authorization: mocks.authorization.current }),
	useOrganization: () => mocks.organizationMeta.current,
	useUserInfo: () => ({ userInfo: mocks.userInfo.current }),
}))

vi.mock("@/models/user/hooks/useAccount", () => ({
	useAccount: () => ({ accounts: [] }),
}))

vi.mock("@/models/user", () => ({
	userStore: {
		user: {
			get authorization() {
				return mocks.authorization.current
			},
			get userInfo() {
				return mocks.userInfo.current
			},
			get organizationCode() {
				return mocks.organizationMeta.current.organizationCode
			},
			get organizations() {
				return mocks.organizationMeta.current.organizations
			},
		},
	},
}))

vi.mock("@/services/chat/dots/OrganizationDotsDbService", () => ({
	default: {
		getPersistenceData: vi.fn(() => ({})),
		getDotSeqIdData: vi.fn(() => ({})),
		setPersistenceData: vi.fn(),
		setDotSeqIdData: vi.fn(),
	},
}))

vi.mock("@/routes/history", () => ({
	history: {
		push: vi.fn(),
		replace: mocks.historyReplace,
	},
}))

vi.mock("@/routes/routes", () => ({
	registerRoutes: () => [],
}))

vi.mock("@/pages/superMagic/utils/api", () => ({
	getTemporaryDownloadUrl: mocks.getTemporaryDownloadUrl,
}))

vi.mock("@/hooks/account/useSwitchOrganization", () => ({
	useSwitchOrganization: () => vi.fn(),
}))

vi.mock("@/hooks/useIsMobile", () => ({
	useIsMobile: () => mocks.isMobile.current,
}))

vi.mock("@/stores/display/GlobalSidebarStore", () => ({
	default: {
		openOrganizationSwitch: mocks.openOrganizationSwitch,
	},
}))

vi.mock("@/layouts/BaseLayoutMobile/components/OrganizationSwitch", () => ({
	OrganizationSwitchPanel: () => <div data-testid="mock-mobile-organization-switch" />,
}))

vi.mock("@/layouts/BaseLayout/components/Header/components/Logo", () => ({
	default: () => <div data-testid="mock-logo" />,
}))

vi.mock("@/components/business/UserAvatarRender", () => ({
	default: ({ userInfo }: { userInfo?: TestUserInfo | null }) => (
		<div data-testid="mock-user-avatar">{userInfo?.nickname || "avatar"}</div>
	),
}))

vi.mock("@/components/base/MagicDropdown", () => ({
	default: ({
		children,
		popupRender,
		open,
		onOpenChange,
		overlayClassName,
	}: TestMagicDropdownProps) => (
		<div data-testid="mock-magic-dropdown" data-overlay-class-name={overlayClassName}>
			<div data-testid="mock-magic-dropdown-trigger" onClick={() => onOpenChange?.(!open)}>
				{children}
			</div>
			{open ? popupRender?.() : null}
		</div>
	),
}))

vi.mock("@/hooks/account/useLogout", () => ({
	default: () => vi.fn(),
}))

vi.mock(
	"@/layouts/BaseLayout/components/Sider/components/OrganizationSwitch/OrganizationList",
	() => ({
		default: () => <div data-testid="mock-organization-list" />,
	}),
)

vi.mock("@/pages/share/components/WorkspaceButton", () => ({
	default: () => <button type="button">workspace</button>,
}))

vi.mock("@/pages/share/components", () => ({
	// 与真实 ErrorDisplay 的契约一致：只有传了 onBack 才会渲染「返回」按钮。
	ErrorDisplay: ({
		errorMessage,
		illustration,
		onBack,
	}: {
		errorMessage?: string
		illustration?: ReactNode
		onBack?: () => void
	}) => (
		<div data-testid="mock-error-display">
			{illustration}
			{errorMessage}
			{onBack ? (
				<button type="button" data-testid="error-display-retry-button" onClick={onBack}>
					back
				</button>
			) : null}
		</div>
	),
	PasswordVerification: () => <div data-testid="mock-password-verification" />,
	ShareEmptyState: () => <div data-testid="mock-share-empty-state" />,
}))

vi.mock("@/pages/superMagic/pages/MicroAppPage/components/AppConversationPanel", () => ({
	default: () => <div data-testid="app-conversation-panel" />,
}))

vi.mock("@/pages/superMagic/components/Detail/contents/HTML", () => ({
	default: function MockHtmlPreview({
		data,
		projectId,
		openFileTab,
		virtualStorageMarkerId,
		isSharePreview,
		onHtmlPermissionManagerChange,
	}: TestHtmlPreviewProps) {
		const [mountedFileId] = useState(data.file_id)

		useEffect(() => {
			const hasPermissionDeclarations = mocks.hasHtmlPermissionDeclarations.current
			onHtmlPermissionManagerChange?.(
				hasPermissionDeclarations ? { open: mocks.openHtmlPermissionManager } : null,
			)
			return () => {
				onHtmlPermissionManagerChange?.(null)
			}
		}, [onHtmlPermissionManagerChange])

		return (
			<div
				data-testid="mock-html-preview"
				data-project-id={projectId}
				data-virtual-storage-marker-id={virtualStorageMarkerId}
				data-is-share-preview={isSharePreview ? "true" : "false"}
			>
				<span>{data.file_name}</span>
				<span data-testid="mock-mounted-file-id">{mountedFileId}</span>
				<button
					type="button"
					onClick={() => openFileTab?.({ file_id: "file-2", file_name: "admin.html" })}
				>
					navigate-admin
				</button>
				<button
					type="button"
					onClick={() => openFileTab?.({ file_id: "file-1", file_name: "index.html" })}
				>
					navigate-index
				</button>
			</div>
		)
	},
}))

export function renderPage(path = "/micro-app/app-1") {
	window.history.replaceState({}, "", path)
	function TestRouteControls() {
		const navigate = useNavigate()
		return (
			<button
				type="button"
				onClick={() => navigate("/micro-app/app-2")}
				data-testid="navigate-to-second-micro-app"
			>
				navigate-second-app
			</button>
		)
	}

	return render(
		<MemoryRouter initialEntries={[path]}>
			<TestRouteControls />
			<Routes>
				<Route path="/micro-app/:appId" element={<MicroAppSharePage />} />
			</Routes>
		</MemoryRouter>,
	)
}

export function resetMicroAppSharePageMocks() {
	vi.clearAllMocks()
	localStorage.clear()
	sessionStorage.clear()
	resetMicroAppInstallPromptCapture()
	window.history.replaceState({}, "", "/")
	document.head.querySelectorAll("link[data-micro-app-install]").forEach((link) => link.remove())
	mocks.authorization.current = ""
	mocks.isMobile.current = false
	mocks.hasHtmlPermissionDeclarations.current = false
	mocks.userInfo.current = null
	mocks.organizationMeta.current = {
		organizations: [],
		organizationCode: "",
		magicOrganizationMap: {},
		teamshareOrganizationCode: "",
		organizationListReady: true,
	}
	mocks.resolvePublishedMicroApp.mockResolvedValue({
		app_id: "app-1",
		resource_id: "resource-1",
		share_code: "resource-1",
		cover_url: "https://example.com/cover.webp",
	})
	mocks.checkShareResourcePassword.mockResolvedValue({ has_password: false })
	mocks.getShareResource.mockResolvedValue({
		temporary_token: "token-1",
		data: {
			project_id: "project-1",
			project_name: "Demo App",
		},
	})
	mocks.loadShareFilesV2.mockResolvedValue({
		tree: [
			{
				file_id: "app-json-1",
				file_name: "app.json",
				file_extension: "json",
				relative_file_path: "app.json",
			},
			{
				file_id: "file-1",
				file_name: "index.html",
				file_extension: "html",
				relative_file_path: "index.html",
			},
		],
		list: [
			{
				file_id: "app-json-1",
				file_name: "app.json",
				file_extension: "json",
				relative_file_path: "app.json",
			},
			{
				file_id: "file-1",
				file_name: "index.html",
				file_extension: "html",
				relative_file_path: "index.html",
			},
		],
	})
	mocks.getTemporaryDownloadUrl.mockResolvedValue([{ url: "https://example.com/app.json" }])
	vi.stubGlobal(
		"fetch",
		vi.fn().mockResolvedValue({
			ok: true,
			json: vi.fn().mockResolvedValue({ type: "micro-app", anonymous: true }),
		}),
	)
}
