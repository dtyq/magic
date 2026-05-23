import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { ShareMode, ShareType } from "@/pages/superMagic/components/Share/types"
import { ProjectShareSheetFooter } from "../components/ProjectShareSheetFooter"
import type { ProjectShareSheetController } from "../types"

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => key,
	}),
}))

/**
 * Builds a minimal controller for footer interaction tests.
 */
function createController(
	overrides: Partial<ProjectShareSheetController> = {},
): ProjectShareSheetController {
	return {
		open: true,
		view: "create",
		viewStack: [],
		mode: "project",
		shareMode: ShareMode.Project,
		projectName: "Demo Project",
		projectId: "project-1",
		formState: {
			shareName: "Demo Project",
			shareType: ShareType.Public,
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
		defaultSelectedFileIds: [],
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
		...overrides,
	}
}

describe("ProjectShareSheetFooter", () => {
	it("renders create footer with safe-area padding outside the scroll area", () => {
		render(<ProjectShareSheetFooter controller={createController()} />)

		const bar = screen.getByTestId("project-share-sheet-create-floating-bar")
		expect(bar.className).toContain("pb-[max(var(--safe-area-inset-bottom),16px)]")
		expect(bar.className).not.toContain("sticky")
	})

	it("submits create share from the fixed footer", () => {
		const submitCreateShare = vi.fn()
		render(
			<ProjectShareSheetFooter controller={createController({ submitCreateShare })} />,
		)

		fireEvent.click(screen.getByTestId("project-share-sheet-create-submit-button"))
		expect(submitCreateShare).toHaveBeenCalledTimes(1)
	})

	it("renders link detail dual actions", () => {
		const copySelectedShareUrl = vi.fn()
		const goToDeleteConfirm = vi.fn()

		render(
			<ProjectShareSheetFooter
				controller={createController({
					view: "linkDetail",
					copySelectedShareUrl,
					goToDeleteConfirm,
				})}
			/>,
		)

		fireEvent.click(screen.getByTestId("project-share-sheet-copy-link-button"))
		fireEvent.click(screen.getByTestId("project-share-sheet-delete-button"))
		expect(copySelectedShareUrl).toHaveBeenCalledTimes(1)
		expect(goToDeleteConfirm).toHaveBeenCalledTimes(1)
	})

	it("renders nothing for views without a bottom action bar", () => {
		const { container } = render(
			<ProjectShareSheetFooter controller={createController({ view: "manage" })} />,
		)

		expect(container).toBeEmptyDOMElement()
	})
})
