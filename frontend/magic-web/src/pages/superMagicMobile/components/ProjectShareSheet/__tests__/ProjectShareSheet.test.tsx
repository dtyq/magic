import { render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { describe, expect, it, vi } from "vitest"
import { ShareMode } from "@/pages/superMagic/components/Share/types"
import ProjectShareSheet from "../index"
import type { ProjectShareSheetView } from "../types"

const { mockViewRef } = vi.hoisted(() => ({
	mockViewRef: { current: "manage" as ProjectShareSheetView },
}))

interface MockCommonPopupProps {
	children: ReactNode
	popupProps?: {
		visible?: boolean
		className?: string
		bodyStyle?: {
			background?: string
		}
	}
}

vi.mock("@/pages/superMagicMobile/components/CommonPopup", () => ({
	default: ({ children, popupProps }: MockCommonPopupProps) =>
		popupProps?.visible ? (
			<div
				data-testid="mock-common-popup"
				data-popup-classname={popupProps.className}
				data-popup-background={popupProps.bodyStyle?.background}
			>
				{children}
			</div>
		) : null,
}))

vi.mock("@/pages/superMagic/components/Share/Modal", () => ({
	default: () => <div data-testid="project-share-edit-modal" />,
}))

vi.mock("../components/ProjectShareSheetHeader", () => ({
	default: () => <div data-testid="project-share-sheet-header" />,
}))

vi.mock("../components/ProjectShareCreateView", () => ({
	default: () => <div data-testid="project-share-sheet-create-view" />,
}))

vi.mock("../components/ProjectShareLinkDetailView", () => ({
	default: () => <div data-testid="project-share-sheet-detail-view" />,
}))

vi.mock("../components/ProjectShareExpiryView", () => ({
	default: () => <div data-testid="project-share-sheet-expiry-view" />,
}))

vi.mock("../components/ProjectShareDeleteConfirmView", () => ({
	default: () => <div data-testid="project-share-sheet-delete-confirm-view" />,
}))

vi.mock("../hooks/useProjectShareSheet", () => ({
	useProjectShareSheet: () => ({
		open: true,
		mode: "project",
		shareMode: ShareMode.Project,
		view: mockViewRef.current,
		viewStack: ["create"],
		projectName: "Demo Project",
		projectId: "project-1",
		formState: {
			shareName: "Demo Project",
			shareType: 5,
			shareExpiry: null,
			password: "abc123",
			shareRange: "all",
			shareTargets: [],
			advancedSettings: {},
		},
		filteredShareItems: [],
		selectedShare: null,
		loading: false,
		saving: false,
		isCheckingShare: false,
		advancedOpen: false,
		defaultSelectedFileIds: ["file-1"],
		selectedFileItems: [],
		selectedFileHierarchy: [],
		selectedFileCount: 0,
		memberSelectorOpen: false,
		selectedMemberNodes: [],
		setShareName: vi.fn(),
		setShareType: vi.fn(),
		setShareExpiry: vi.fn(),
		setPassword: vi.fn(),
		resetPassword: vi.fn(),
		setShareRange: vi.fn(),
		setShareTargets: vi.fn(),
		setAdvancedSettings: vi.fn(),
		setAdvancedOpen: vi.fn(),
		openMemberSelector: vi.fn(),
		closeMemberSelector: vi.fn(),
		setSelectedMemberNodes: vi.fn(),
		confirmMemberSelector: vi.fn(),
		goToManage: vi.fn(),
		goToExpiry: vi.fn(),
		goToDeleteConfirm: vi.fn(),
		goToLinkDetail: vi.fn(),
		goBack: vi.fn(),
		close: vi.fn(),
		refreshShareList: vi.fn(),
		copySelectedShareUrl: vi.fn(),
		copySelectedSharePassword: vi.fn(),
		submitCreateShare: vi.fn(),
		openEditSelectedShare: vi.fn(),
		confirmCancelShare: vi.fn(),
		editResourceId: undefined,
		closeEditModal: vi.fn(),
	}),
}))

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => {
			const labels: Record<string, string> = {
				"projectShare.empty": "暂无分享链接",
				"projectShare.manageTitle": "分享管理",
				"common.close": "关闭",
			}
			return labels[key] || key
		},
	}),
}))

function renderProjectShareSheet() {
	return render(
		<ProjectShareSheet
			open
			projectName="Demo Project"
			projectId="project-1"
			attachments={[]}
			onClose={vi.fn()}
		/>,
	)
}

describe("ProjectShareSheet", () => {
	it("applies scroll safe-bottom padding on views without a fixed footer", () => {
		mockViewRef.current = "manage"
		renderProjectShareSheet()

		expect(screen.getByTestId("project-share-sheet-scroll").className).toContain(
			"safe-area-inset-bottom",
		)
	})

	it("does not add scroll safe-bottom padding when the fixed footer owns bottom inset", () => {
		mockViewRef.current = "create"
		renderProjectShareSheet()

		expect(screen.getByTestId("project-share-sheet-scroll").className).not.toContain(
			"safe-area-inset-bottom",
		)
	})

	it("管理页为空时展示空态", () => {
		mockViewRef.current = "manage"
		renderProjectShareSheet()

		expect(screen.getByTestId("project-share-sheet-root")).toBeInTheDocument()
		expect(screen.getByTestId("mock-common-popup")).toHaveAttribute(
			"data-popup-classname",
			expect.stringContaining("bg-[#F7F7F6]"),
		)
		expect(screen.getByTestId("mock-common-popup")).toHaveAttribute(
			"data-popup-background",
			"#F7F7F6",
		)
		expect(screen.getByTestId("project-share-sheet-manage-empty")).toHaveTextContent(
			"暂无分享链接",
		)
	})
})
