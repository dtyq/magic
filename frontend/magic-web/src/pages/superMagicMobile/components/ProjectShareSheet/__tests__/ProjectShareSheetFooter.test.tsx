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
		projectMode: "",
		isFreePlan: false,
		shareMode: ShareMode.Project,
		projectName: "Fictional Project",
		projectId: "fictional-project-1",
		formState: {
			shareName: "Fictional Project",
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
		selectedFileIds: [],
		groupedShareItems: [],
		enableInlineFileSelection: false,
		selectedFileItems: [],
		selectedFileHierarchy: [],
		selectedFileCount: 0,
		memberSelectorOpen: false,
		selectedMemberNodes: [],
		detailMemberNodes: [],
		detailMemberLoading: false,
		selectedShareMessageText: "",
		canNativeShare: false,
		shareSelectedShareToSystem: vi.fn(),
		setShareName: vi.fn(),
		setShareType: vi.fn(),
		setShareExpiry: vi.fn(),
		setPassword: vi.fn(),
		resetPassword: vi.fn(),
		setShareRange: vi.fn(),
		setShareTargets: vi.fn(),
		setAdvancedSettings: vi.fn(),
		setAdvancedOpen: vi.fn(),
		setSelectedFileIds: vi.fn(),
		toggleShareFileId: vi.fn(),
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
		render(<ProjectShareSheetFooter controller={createController({ submitCreateShare })} />)

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
					selectedShareMessageText: "Fictional share text",
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

	it("keeps copy disabled until the prefetched message is ready", () => {
		const copySelectedShareUrl = vi.fn()

		const { rerender } = render(
			<ProjectShareSheetFooter
				controller={createController({
					view: "linkDetail",
					selectedShareMessageText: "",
					copySelectedShareUrl,
				})}
			/>,
		)

		const button = screen.getByTestId("project-share-sheet-copy-link-button")
		expect(button).toBeDisabled()
		fireEvent.click(button)
		expect(copySelectedShareUrl).not.toHaveBeenCalled()

		rerender(
			<ProjectShareSheetFooter
				controller={createController({
					view: "linkDetail",
					selectedShareMessageText: "Fictional share text",
					copySelectedShareUrl,
				})}
			/>,
		)

		expect(screen.getByTestId("project-share-sheet-copy-link-button")).toBeEnabled()
	})

	it("keeps only the native share icon in the link detail actions", () => {
		render(
			<ProjectShareSheetFooter
				controller={createController({
					view: "linkDetail",
					canNativeShare: true,
					selectedShareMessageText: "Fictional share text",
				})}
			/>,
		)

		// The system share affordance keeps its icon, while the text-only actions align visually.
		expect(
			screen.getByTestId("project-share-sheet-native-share-button").querySelector("svg"),
		).toBeInTheDocument()
		expect(
			screen.getByTestId("project-share-sheet-copy-link-button").querySelector("svg"),
		).not.toBeInTheDocument()
		expect(
			screen.getByTestId("project-share-sheet-delete-button").querySelector("svg"),
		).not.toBeInTheDocument()
	})

	it("renders and triggers native share action only when supported", () => {
		const shareSelectedShareToSystem = vi.fn()

		const { rerender } = render(
			<ProjectShareSheetFooter
				controller={createController({
					view: "linkDetail",
					canNativeShare: false,
					shareSelectedShareToSystem,
				})}
			/>,
		)

		expect(
			screen.queryByTestId("project-share-sheet-native-share-button"),
		).not.toBeInTheDocument()

		rerender(
			<ProjectShareSheetFooter
				controller={createController({
					view: "linkDetail",
					canNativeShare: true,
					selectedShareMessageText: "Fictional share text",
					shareSelectedShareToSystem,
				})}
			/>,
		)

		fireEvent.click(screen.getByTestId("project-share-sheet-native-share-button"))
		expect(shareSelectedShareToSystem).toHaveBeenCalledTimes(1)
	})

	it("keeps native share disabled until the prebuilt message is ready", () => {
		const shareSelectedShareToSystem = vi.fn()

		const { rerender } = render(
			<ProjectShareSheetFooter
				controller={createController({
					view: "linkDetail",
					canNativeShare: true,
					selectedShareMessageText: "",
					shareSelectedShareToSystem,
				})}
			/>,
		)

		const button = screen.getByTestId("project-share-sheet-native-share-button")
		expect(button).toBeDisabled()

		fireEvent.click(button)
		expect(shareSelectedShareToSystem).not.toHaveBeenCalled()

		rerender(
			<ProjectShareSheetFooter
				controller={createController({
					view: "linkDetail",
					canNativeShare: true,
					selectedShareMessageText: "Fictional share text",
					shareSelectedShareToSystem,
				})}
			/>,
		)

		const readyButton = screen.getByTestId("project-share-sheet-native-share-button")
		expect(readyButton).toBeEnabled()

		fireEvent.click(readyButton)
		expect(shareSelectedShareToSystem).toHaveBeenCalledTimes(1)
	})

	it("renders nothing for views without a bottom action bar", () => {
		const { container } = render(
			<ProjectShareSheetFooter controller={createController({ view: "manage" })} />,
		)

		expect(container).toBeEmptyDOMElement()
	})

	it("disables create and edit submission when the selected share type is unavailable", () => {
		const { rerender } = render(
			<ProjectShareSheetFooter
				controller={createController({ isSelectedShareTypePermitted: false })}
			/>,
		)

		expect(screen.getByTestId("project-share-sheet-create-submit-button")).toBeDisabled()

		rerender(
			<ProjectShareSheetFooter
				controller={createController({
					view: "edit",
					isEditing: true,
					isSelectedShareTypePermitted: false,
				})}
			/>,
		)

		expect(screen.getByTestId("project-share-sheet-edit-submit-button")).toBeDisabled()
	})
})
