import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import MicroAppPreviewContent from "../MicroAppPreviewContent"

const shareDataState = vi.hoisted(() => ({
	loading: false,
	error: null as Error | null,
	isNeedPassword: false,
	shareData: null as Record<string, unknown> | null,
	attachmentList: [] as Array<{ file_id: string; file_name: string; file_extension?: string }>,
	hasConfirmedSafetyNotice: true,
	emptyStateInfo: null as Record<string, unknown> | null,
}))

vi.mock("react-i18next", () => ({
	initReactI18next: { type: "3rdParty", init: vi.fn() },
	useTranslation: () => ({
		t: (key: string) => key,
	}),
}))

vi.mock("@/pages/share/microApp/hooks/useMicroAppShareData", () => ({
	default: () => ({
		shareData: shareDataState.shareData,
		resourceId: "resource-1",
		coverUrl: "",
		shareMeta: { projectId: "project-1", projectName: "内购", temporaryToken: "share-token" },
		attachmentsTree: [],
		attachmentList: shareDataState.attachmentList,
		loading: shareDataState.loading,
		error: shareDataState.error,
		isNeedPassword: shareDataState.isNeedPassword,
		passwordFromUrl: "",
		verifiedPassword: undefined,
		emptyStateInfo: shareDataState.emptyStateInfo,
		handleSwitchOrganization: vi.fn(),
		isSwitching: false,
		getShareData: vi.fn(),
		setError: vi.fn(),
		setVerifiedPassword: vi.fn(),
		reload: vi.fn(),
	}),
}))

vi.mock("@/pages/share/microApp/hooks/useMicroAppInstallFlow", () => ({
	default: () => ({
		rememberVerifiedPassword: vi.fn(),
		rememberPasswordControl: {
			enabled: true,
			checked: false,
			onCheckedChange: vi.fn(),
		},
	}),
}))

vi.mock("@/pages/share/microApp/hooks/useMicroAppSafetyNoticeConfirmation", () => ({
	default: () => ({
		hasConfirmedSafetyNotice: shareDataState.hasConfirmedSafetyNotice,
		confirmSafetyNotice: vi.fn(),
	}),
}))

vi.mock("@/pages/share/components", () => ({
	// 与真实 ErrorDisplay 的契约一致：只有传了 onBack 才会渲染「返回」按钮。
	ErrorDisplay: ({ errorMessage, onBack }: { errorMessage: string; onBack?: () => void }) => (
		<div data-testid="micro-app-tab-error">
			{errorMessage}
			{onBack ? <button type="button" data-testid="micro-app-tab-error-back" /> : null}
		</div>
	),
	PasswordVerification: () => <div data-testid="micro-app-tab-password" />,
	ShareEmptyState: () => <div data-testid="micro-app-tab-org-empty" />,
}))

vi.mock("@/pages/share/microApp/components/MicroAppSafetyNotice", () => ({
	default: ({ onLeave }: { onLeave: () => void }) => (
		<div>
			<div data-testid="micro-app-share-safety-notice" />
			<button type="button" data-testid="micro-app-share-safety-leave" onClick={onLeave} />
		</div>
	),
}))

vi.mock("@/pages/superMagic/components/Detail/contents/HTML", () => ({
	default: (props: {
		projectId?: string
		microAppId?: string
		microAppName?: string
		selectedProject?: { id?: string } | null
		topicStore?: unknown
		isSharePreview?: boolean
	}) => (
		<div
			data-testid="mock-html-preview"
			data-project-id={props.projectId}
			data-micro-app-id={props.microAppId}
			data-micro-app-name={props.microAppName}
			data-host-project-id={props.selectedProject?.id}
			data-has-topic-store={props.topicStore ? "true" : "false"}
			data-is-share-preview={props.isSharePreview ? "true" : "false"}
		/>
	),
}))

vi.mock("@/pages/share/microApp/components/PublishedMicroAppConversationProvider", () => ({
	default: ({ children }: { children: React.ReactNode }) => children,
}))

vi.mock("@/pages/superMagic/components/MicroAppSkillsPanel", () => ({
	default: () => <div data-testid="micro-app-skills-panel" />,
}))

vi.mock("@/pages/superMagic/components/MicroAppStateIllustration", () => ({
	MicroAppPermissionIllustration: () => <div data-testid="micro-app-tab-error-illustration" />,
}))

vi.mock("@/pages/superMagic/pages/MicroAppPage/utils/microAppFiles", () => ({
	resolveSelectedHtmlEntry: ({
		items,
	}: {
		items: Array<{ file_id: string; file_name: string }>
	}) => items[0] || null,
}))

describe("MicroAppPreviewContent", () => {
	beforeEach(() => {
		shareDataState.loading = false
		shareDataState.error = null
		shareDataState.isNeedPassword = false
		shareDataState.shareData = { default_open_file_id: "file-1" }
		shareDataState.attachmentList = [
			{ file_id: "file-1", file_name: "index.html", file_extension: "html" },
		]
		shareDataState.hasConfirmedSafetyNotice = true
		shareDataState.emptyStateInfo = null
	})

	it("renders published html preview without share chrome", () => {
		render(<MicroAppPreviewContent appId="app-1" appName="内购" />)

		expect(screen.getByTestId("micro-app-tab-preview")).toBeInTheDocument()
		expect(screen.getByTestId("mock-html-preview")).toBeInTheDocument()
		expect(screen.getByTestId("mock-html-preview")).toHaveAttribute(
			"data-is-share-preview",
			"true",
		)
		expect(screen.queryByTestId("micro-app-share-page")).not.toBeInTheDocument()
		expect(screen.getByTestId("mock-html-preview")).toHaveAttribute(
			"data-micro-app-id",
			"app-1",
		)
		expect(screen.getByTestId("mock-html-preview")).toHaveAttribute(
			"data-micro-app-name",
			"内购",
		)
	})

	it("shows loading, password, and error states inside the tab", () => {
		shareDataState.loading = true
		const { rerender } = render(<MicroAppPreviewContent appId="app-1" />)
		expect(screen.getByTestId("micro-app-tab-loading")).toBeInTheDocument()

		shareDataState.loading = false
		shareDataState.shareData = null
		shareDataState.attachmentList = []
		shareDataState.isNeedPassword = true
		rerender(<MicroAppPreviewContent appId="app-1" />)
		expect(screen.getByTestId("micro-app-tab-password")).toBeInTheDocument()

		shareDataState.isNeedPassword = false
		shareDataState.error = new Error("denied")
		rerender(<MicroAppPreviewContent appId="app-1" />)
		expect(screen.getByTestId("micro-app-tab-error")).toBeInTheDocument()
		// 应用内标签页有自己的外层导航，错误态不该再给一个「返回」。
		expect(screen.queryByTestId("micro-app-tab-error-back")).not.toBeInTheDocument()
	})

	it("shows the safety notice before previewing", () => {
		shareDataState.hasConfirmedSafetyNotice = false
		render(<MicroAppPreviewContent appId="app-1" appName="内购" />)

		expect(screen.getByTestId("micro-app-share-safety-notice")).toBeInTheDocument()
		expect(screen.queryByTestId("mock-html-preview")).not.toBeInTheDocument()
	})

	it("calls onLeave when the safety notice leave action is clicked", () => {
		shareDataState.hasConfirmedSafetyNotice = false
		const onLeave = vi.fn()
		render(<MicroAppPreviewContent appId="app-1" appName="内购" onLeave={onLeave} />)

		fireEvent.click(screen.getByTestId("micro-app-share-safety-leave"))
		expect(onLeave).toHaveBeenCalledTimes(1)
	})

	it("keeps origin projectId on html preview without host props", () => {
		render(<MicroAppPreviewContent appId="app-1" appName="内购" />)

		const preview = screen.getByTestId("mock-html-preview")
		expect(preview).toHaveAttribute("data-project-id", "project-1")
		expect(preview).not.toHaveAttribute("data-host-project-id")
		expect(preview).toHaveAttribute("data-has-topic-store", "false")
	})
})
