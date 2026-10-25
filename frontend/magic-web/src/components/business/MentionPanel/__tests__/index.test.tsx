import { forwardRef, useImperativeHandle } from "react"
import type { MouseEvent, ReactNode } from "react"
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import MentionPanel from "../index"
import { defaultMentionPanelCatalogBehavior } from "../catalogBehavior"
import { MentionItemType, MentionPanelViewMode, PanelState } from "../types"
import type { MentionItem, MentionPanelCatalogBehavior } from "../types"
import type { ProjectResourceSelection } from "@/pages/superMagic/components/SelectPathModal/types"

const { mockFilePreviewById, mockPrepareMentionItemForPending, mockMobileState } = vi.hoisted(
	() => ({
		mockFilePreviewById: {} as Record<string, string>,
		mockPrepareMentionItemForPending: vi.fn(),
		mockMobileState: { isMobile: false },
	}),
)

const mockSelectItem = vi.fn()
const mockConfirmSelection = vi.fn()
const mockReset = vi.fn()
interface UseMentionPanelMockProps {
	onSelect?: (item: MentionItem) => void
	onKeyboardConfirm?: () => boolean | void
	onKeyboardMetaEnter?: () => boolean | void
	onKeyboardNavigateBack?: () => void
	onKeyboardEnterFolder?: () => boolean | void
}

let latestUseMentionPanelProps: UseMentionPanelMockProps | undefined

const mockState = {
	currentState: PanelState.DEFAULT,
	items: [] as MentionItem[],
	selectedIndex: -1,
	searchQuery: "",
	navigationStack: [] as Array<{
		id: string
		name: string
		state: PanelState
		catalogId?: string
	}>,
}

// Mock all dependencies to prevent complex interactions
vi.mock("../hooks/useMentionPanel", () => ({
	useMentionPanel: (props: UseMentionPanelMockProps) => {
		latestUseMentionPanelProps = props
		return {
			state: mockState,
			actions: {
				selectItem: mockSelectItem,
				confirmSelection: mockConfirmSelection,
				search: vi.fn(),
				navigateBack: vi.fn(),
				navigateToBreadcrumb: vi.fn(),
				enterFolder: vi.fn(),
				exit: vi.fn(),
				reset: mockReset,
				deleteHistoryItem: vi.fn(),
			},
			computed: {
				canNavigateBack: false,
				canEnterFolder: false,
				hasSelection: false,
			},
			dataSource: {
				loading: false,
				error: undefined,
				refreshData: vi.fn(),
			},
			focus: {
				shouldFocusSearch: false,
				clearFocusTrigger: vi.fn(),
			},
		}
	},
}))

vi.mock("../runtime/builtin/domains/file-preview/useMentionPanelFilePreviewById", () => ({
	useMentionPanelFilePreviewById: () => mockFilePreviewById,
}))

vi.mock("@/components/base/MagicImagePreview", () => ({
	default: ({ children }: { children?: ReactNode }) => (
		<div data-testid="magic-image-preview">{children}</div>
	),
}))

vi.mock("@/components/other/SmartTooltip", () => ({
	default: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
}))

vi.mock("@/assets/locales/locale-adapters", () => ({
	getAdminLocaleModules: () => ({}),
	getLocaleModules: () => ({ zhCNModules: {}, enUSModules: {} }),
	loadFallbackLocale: vi.fn(),
	loadMagicFlowLocale: vi.fn(),
}))

vi.mock("../runtime/default-runtime", () => ({
	resolveMentionPanelRuntime: (props: {
		dataService?: unknown
		catalogBehavior?: unknown
		buildStoreRequest?: unknown
	}) => ({
		dataService: props.dataService,
		catalogBehavior: props.catalogBehavior ?? {},
		buildStoreRequest: props.buildStoreRequest,
		getItemRenderer: vi.fn(() => ({})),
		getCatalogHeaderMeta: vi.fn(() => ({
			hint: null,
			icon: null,
		})),
	}),
}))

vi.mock("react-virtuoso", () => ({
	Virtuoso: forwardRef<
		{ scrollToIndex: ReturnType<typeof vi.fn> },
		{
			totalCount: number
			itemContent: (index: number) => ReactNode
		}
	>(({ totalCount, itemContent }, ref) => {
		useImperativeHandle(ref, () => ({
			scrollToIndex: vi.fn(),
		}))

		return (
			<div data-testid="virtuoso-list">
				{Array.from({ length: totalCount }, (_, index) => itemContent(index))}
			</div>
		)
	}),
	VirtuosoGrid: ({
		totalCount,
		itemContent,
	}: {
		totalCount: number
		itemContent: (index: number) => ReactNode
	}) => (
		<div data-testid="virtuoso-grid">
			{Array.from({ length: totalCount }, (_, index) => itemContent(index))}
		</div>
	),
}))

vi.mock("../hooks/useI18n", () => ({
	useI18nStatic: () => ({
		loading: "Loading...",
		empty: "No results found",
		retry: "Retry",
		searchPlaceholder: "Search",
		searchResults: "Search Results",
		multiSelectActions: {
			enter: "多选",
			complete: "完成",
		},
		selectionSummary: {
			selected: "已选",
			image: "图片",
			video: "视频",
			audio: "音频",
		},
		ariaLabels: {
			panel: "Mention panel",
			retryButton: "Retry loading",
			menuItem: "Menu item",
			previewImage: "Preview image",
			viewMode: "View mode",
			listView: "List view",
			galleryView: "Gallery view",
		},
		keyboardHints: {
			navigate: "Navigate",
			confirm: "Confirm",
			goBack: "Go back",
			goForward: "Go forward",
		},
		navigationActions: {
			enter: "Enter",
		},
	}),
}))

vi.mock("@/hooks/useIsMobile", () => ({
	useIsMobile: () => mockMobileState.isMobile,
}))

vi.mock("../MentionPanelMobile", () => ({
	default: ({
		visible,
		onSelect,
	}: {
		visible: boolean
		onSelect?: (item: MentionItem) => void
	}) =>
		visible ? (
			<button
				type="button"
				data-testid="mock-mention-panel-mobile"
				onClick={() =>
					onSelect?.({
						id: "other-project-files",
						name: "Other Projects/Files",
						type: "other_project_files",
					})
				}
			>
				Open other projects
			</button>
		) : null,
}))

vi.mock("@/styles/fonts/geist", () => ({
	default: () => undefined,
}))

vi.mock("../utils/multiSelectValidation", () => ({
	prepareMentionItemForPending: mockPrepareMentionItemForPending,
}))

vi.mock("../components/MenuItem", () => ({
	default: ({
		item,
		onClick,
		showCheckbox,
		checkboxChecked,
	}: {
		item: MentionItem
		onClick?: (event?: MouseEvent) => void
		showCheckbox?: boolean
		checkboxChecked?: boolean
	}) => (
		<div data-testid="menu-item" onClick={onClick}>
			<span>{item.name}</span>
			{showCheckbox ? (
				<span
					data-testid="menu-item-checkbox"
					data-checked={checkboxChecked ? "true" : "false"}
				/>
			) : null}
			<button data-testid="menu-item-arrow" data-right-arrow>
				<span data-testid="menu-item-arrow-icon">Arrow</span>
			</button>
		</div>
	),
}))

vi.mock("../components/OtherProjectFileMentionModal", () => ({
	default: ({
		visible,
		onSelect,
	}: {
		visible: boolean
		onSelect: (selections: ProjectResourceSelection[]) => void
	}) =>
		visible ? (
			<div data-testid="other-project-file-mention-modal">
				<button
					type="button"
					data-testid="other-project-file-mention-submit"
					onClick={() =>
						onSelect([
							{
								level: "project",
								workspace: { id: "workspace-2", name: "Workspace Two" },
								project: {
									id: "project-2",
									project_name: "Project Two",
									work_dir: "/project-two",
								},
							},
							{
								level: "attachment",
								workspace: { id: "workspace-2", name: "Workspace Two" },
								project: {
									id: "project-2",
									project_name: "Project Two",
									work_dir: "/project-two",
								},
								attachment: {
									file_id: "file-2",
									file_name: "File Two.txt",
									file_extension: "txt",
									relative_file_path: "File Two.txt",
								},
							},
						] as ProjectResourceSelection[])
					}
				>
					Submit
				</button>
			</div>
		) : null,
}))

describe("MentionPanel", () => {
	const setCatalogState = (items: MentionItem[], selectedIndex = 0) => {
		mockState.currentState = PanelState.CATALOG
		mockState.navigationStack = [
			{ id: "project-files", name: "Project", state: PanelState.DEFAULT },
		]
		mockState.items = items
		mockState.selectedIndex = selectedIndex
	}

	const enterMultiSelectMode = () => {
		act(() => {
			latestUseMentionPanelProps?.onKeyboardMetaEnter?.()
		})
	}

	beforeEach(() => {
		mockMobileState.isMobile = false
		mockState.currentState = PanelState.DEFAULT
		mockState.items = []
		mockState.selectedIndex = -1
		mockState.searchQuery = ""
		mockState.navigationStack = []
		mockSelectItem.mockReset()
		mockConfirmSelection.mockReset()
		mockReset.mockReset()
		Object.keys(mockFilePreviewById).forEach((key) => {
			delete mockFilePreviewById[key]
		})
		mockPrepareMentionItemForPending.mockReset()
		mockPrepareMentionItemForPending.mockResolvedValue({
			canSelect: true,
			mcpValidated: false,
		})
		latestUseMentionPanelProps = undefined
	})

	it("should not render when not visible", () => {
		const { container } = render(
			<MentionPanel visible={false} catalogBehavior={defaultMentionPanelCatalogBehavior} />,
		)
		expect(container.firstChild).toBeNull()
	})

	it("should render when visible", () => {
		const { container } = render(
			<MentionPanel visible={true} catalogBehavior={defaultMentionPanelCatalogBehavior} />,
		)
		expect(container.firstChild).toBeTruthy()
	})

	it("should render with default props", () => {
		const { container } = render(
			<MentionPanel catalogBehavior={defaultMentionPanelCatalogBehavior} />,
		)
		expect(container.firstChild).toBeTruthy()
	})

	it("should keep list mode as the default item layout", () => {
		setCatalogState([
			{
				id: "file-1",
				name: "File 1",
				type: MentionItemType.PROJECT_FILE,
			},
		])

		render(<MentionPanel visible={true} catalogBehavior={defaultMentionPanelCatalogBehavior} />)

		expect(screen.getByTestId("virtuoso-list")).toBeInTheDocument()
		expect(screen.queryByTestId("mention-panel-gallery-item")).not.toBeInTheDocument()
		expect(screen.queryByTestId("mention-panel-view-mode-switcher")).not.toBeInTheDocument()
	})

	it("should switch between gallery and list layouts when gallery mode is enabled", () => {
		setCatalogState([
			{
				id: "image-1",
				name: "Image 1",
				type: MentionItemType.PROJECT_FILE,
				extension: "png",
				data: {
					file_id: "image-1",
					file_name: "Image 1",
					file_path: "/Image 1.png",
					file_extension: "png",
				},
			},
		])

		render(
			<MentionPanel
				visible={true}
				viewMode={MentionPanelViewMode.GALLERY}
				catalogBehavior={defaultMentionPanelCatalogBehavior}
			/>,
		)

		expect(screen.getByTestId("mention-panel-view-mode-switcher")).toBeInTheDocument()
		expect(screen.getByTestId("virtuoso-grid")).toBeInTheDocument()
		expect(screen.queryByTestId("virtuoso-list")).not.toBeInTheDocument()
		expect(screen.getByTestId("mention-panel-view-mode-gallery")).toHaveAttribute(
			"aria-pressed",
			"true",
		)

		fireEvent.click(screen.getByTestId("mention-panel-view-mode-list"))

		expect(screen.getByTestId("virtuoso-list")).toBeInTheDocument()
		expect(screen.queryByTestId("virtuoso-grid")).not.toBeInTheDocument()
		expect(screen.getByTestId("mention-panel-view-mode-list")).toHaveAttribute(
			"aria-pressed",
			"true",
		)

		fireEvent.click(screen.getByTestId("mention-panel-view-mode-gallery"))

		expect(screen.getByTestId("virtuoso-grid")).toBeInTheDocument()
		expect(screen.queryByTestId("virtuoso-list")).not.toBeInTheDocument()
	})

	it("should render gallery cards without hiding disabled files", () => {
		setCatalogState([
			{
				id: "image-1",
				name: "Image 1",
				type: MentionItemType.PROJECT_FILE,
				extension: "png",
				data: {
					file_id: "image-1",
					file_name: "Image 1",
					file_path: "/Image 1.png",
					file_extension: "png",
				},
			},
			{
				id: "doc-1",
				name: "Doc 1",
				type: MentionItemType.PROJECT_FILE,
				unSelectable: true,
				extension: "pdf",
				data: {
					file_id: "doc-1",
					file_name: "Doc 1",
					file_path: "/Doc 1.pdf",
					file_extension: "pdf",
				},
			},
		])
		mockFilePreviewById["image-1"] = "https://example.com/image.png"

		render(
			<MentionPanel
				visible={true}
				viewMode={MentionPanelViewMode.GALLERY}
				galleryOptions={{ enablePreviewModal: true }}
				catalogBehavior={defaultMentionPanelCatalogBehavior}
			/>,
		)

		expect(screen.queryByTestId("virtuoso-list")).not.toBeInTheDocument()
		expect(screen.getByTestId("virtuoso-grid")).toBeInTheDocument()
		const cards = screen.getAllByTestId("mention-panel-gallery-item")
		expect(cards).toHaveLength(2)
		expect(within(cards[1]).getByText("Doc 1")).toBeInTheDocument()
		expect(cards[1]).toHaveAttribute("aria-disabled", "true")
	})

	it("should select a gallery image by card click and keep preview click isolated", async () => {
		setCatalogState([
			{
				id: "image-1",
				name: "Image 1",
				type: MentionItemType.PROJECT_FILE,
				extension: "png",
				data: {
					file_id: "image-1",
					file_name: "Image 1",
					file_path: "/Image 1.png",
					file_extension: "png",
				},
			},
		])
		mockFilePreviewById["image-1"] = "https://example.com/image.png"

		render(
			<MentionPanel
				visible={true}
				viewMode={MentionPanelViewMode.GALLERY}
				galleryOptions={{ enablePreviewModal: true }}
				catalogBehavior={defaultMentionPanelCatalogBehavior}
			/>,
		)

		fireEvent.click(screen.getByTestId("mention-panel-gallery-preview-button"))

		expect(mockSelectItem).not.toHaveBeenCalled()
		expect(mockConfirmSelection).not.toHaveBeenCalled()
		expect(await screen.findByTestId("magic-image-preview")).toBeInTheDocument()

		fireEvent.click(screen.getByTestId("mention-panel-gallery-item"))

		await waitFor(() => {
			expect(mockSelectItem).toHaveBeenCalledWith(0)
			expect(mockConfirmSelection).toHaveBeenCalledWith({ enterFolder: false })
		})
	})

	it("should enter a gallery folder from the arrow trigger", () => {
		vi.useFakeTimers()
		try {
			setCatalogState([
				{
					id: "folder-1",
					name: "Folder 1",
					type: MentionItemType.FOLDER,
					hasChildren: true,
					isFolder: true,
				},
			])

			render(
				<MentionPanel
					visible={true}
					viewMode={MentionPanelViewMode.GALLERY}
					catalogBehavior={defaultMentionPanelCatalogBehavior}
				/>,
			)

			fireEvent.click(screen.getByTestId("mention-panel-gallery-enter-folder-trigger"))
			vi.runAllTimers()

			expect(mockSelectItem).toHaveBeenCalledWith(0)
			expect(mockConfirmSelection).toHaveBeenCalledWith({ enterFolder: true })
		} finally {
			vi.useRealTimers()
		}
	})

	it("should fall back to a file icon when a gallery thumbnail fails to load", () => {
		setCatalogState([
			{
				id: "image-1",
				name: "Image 1",
				type: MentionItemType.PROJECT_FILE,
				extension: "png",
				data: {
					file_id: "image-1",
					file_name: "Image 1",
					file_path: "/Image 1.png",
					file_extension: "png",
				},
			},
		])
		mockFilePreviewById["image-1"] = "https://example.com/broken.png"

		render(
			<MentionPanel
				visible={true}
				viewMode={MentionPanelViewMode.GALLERY}
				galleryOptions={{ enablePreviewModal: true }}
				catalogBehavior={defaultMentionPanelCatalogBehavior}
			/>,
		)

		fireEvent.error(screen.getByTestId("mention-panel-gallery-preview-image"))

		expect(screen.queryByTestId("mention-panel-gallery-preview-image")).not.toBeInTheDocument()
		expect(screen.queryByTestId("mention-panel-gallery-preview-button")).not.toBeInTheDocument()
		expect(screen.getByText("PNG")).toBeInTheDocument()
	})

	it("should not select a disabled gallery file", () => {
		vi.useFakeTimers()
		try {
			setCatalogState([
				{
					id: "doc-1",
					name: "Doc 1",
					type: MentionItemType.PROJECT_FILE,
					unSelectable: true,
				},
			])

			render(
				<MentionPanel
					visible={true}
					viewMode={MentionPanelViewMode.GALLERY}
					catalogBehavior={defaultMentionPanelCatalogBehavior}
				/>,
			)

			fireEvent.click(screen.getByTestId("mention-panel-gallery-item"))
			vi.runAllTimers()

			expect(mockSelectItem).not.toHaveBeenCalled()
			expect(mockConfirmSelection).not.toHaveBeenCalled()
		} finally {
			vi.useRealTimers()
		}
	})

	it("should open the other-project selector instead of submitting the root action item", async () => {
		render(<MentionPanel visible catalogBehavior={defaultMentionPanelCatalogBehavior} />)

		act(() => {
			latestUseMentionPanelProps?.onSelect?.({
				id: "other-project-files",
				name: "Other Projects/Files",
				type: "other_project_files",
			})
		})

		expect(await screen.findByTestId("other-project-file-mention-modal")).toBeInTheDocument()
	})

	it("should insert all selected other-project resources as one batch", async () => {
		const onSelect = vi.fn()
		render(
			<MentionPanel
				visible
				onSelect={onSelect}
				catalogBehavior={defaultMentionPanelCatalogBehavior}
			/>,
		)

		act(() => {
			latestUseMentionPanelProps?.onSelect?.({
				id: "other-project-files",
				name: "Other Projects/Files",
				type: "other_project_files",
			})
		})
		fireEvent.click(await screen.findByTestId("other-project-file-mention-submit"))

		await waitFor(() => expect(onSelect).toHaveBeenCalledTimes(2))
		expect(onSelect.mock.calls[0][0]).toMatchObject({
			type: MentionItemType.PROJECT,
			data: { project_id: "project-2" },
		})
		expect(onSelect.mock.calls[0][1]).toMatchObject({
			batch: { index: 0, total: 2 },
		})
		expect(onSelect.mock.calls[1][0]).toMatchObject({
			type: MentionItemType.PROJECT_FILE,
			data: { project_id: "project-2", file_id: "file-2" },
		})
		expect(onSelect.mock.calls[1][1]).toMatchObject({
			batch: { index: 1, total: 2 },
		})
		expect(typeof onSelect.mock.calls[1][1].reset).toBe("function")
	})

	it("should keep the mobile other-project selector open after the mention panel loses visibility", async () => {
		mockMobileState.isMobile = true
		const { rerender } = render(
			<MentionPanel visible catalogBehavior={defaultMentionPanelCatalogBehavior} />,
		)

		fireEvent.click(await screen.findByTestId("mock-mention-panel-mobile"))

		expect(await screen.findByTestId("other-project-file-mention-modal")).toBeInTheDocument()
		expect(screen.queryByTestId("mock-mention-panel-mobile")).not.toBeInTheDocument()

		rerender(
			<MentionPanel visible={false} catalogBehavior={defaultMentionPanelCatalogBehavior} />,
		)

		expect(screen.getByTestId("other-project-file-mention-modal")).toBeInTheDocument()
	})

	it("should enter folder when clicking right arrow icon", () => {
		vi.useFakeTimers()
		mockState.items = [
			{
				id: "folder-1",
				name: "Folder 1",
				type: MentionItemType.FOLDER,
			},
		]

		render(<MentionPanel visible={true} catalogBehavior={defaultMentionPanelCatalogBehavior} />)

		fireEvent.click(screen.getByTestId("menu-item-arrow-icon"))
		vi.runAllTimers()

		expect(mockSelectItem).toHaveBeenCalledWith(0)
		expect(mockConfirmSelection).toHaveBeenCalledWith({ enterFolder: true })
		vi.useRealTimers()
	})

	it("should show multi-select hint before entering mode and checkboxes after entering", () => {
		setCatalogState([
			{
				id: "file-1",
				name: "File 1",
				type: MentionItemType.PROJECT_FILE,
			},
		])

		render(<MentionPanel visible={true} catalogBehavior={defaultMentionPanelCatalogBehavior} />)

		expect(screen.getByText("多选")).toBeInTheDocument()
		expect(screen.queryByTestId("menu-item-checkbox")).not.toBeInTheDocument()

		enterMultiSelectMode()

		expect(screen.getByText("完成")).toBeInTheDocument()
		expect(screen.getByLabelText("完成 Ctrl Enter")).toHaveClass("text-primary")
		expect(screen.getByText("Confirm")).toBeInTheDocument()
		expect(screen.getByTestId("menu-item-checkbox")).toHaveAttribute("data-checked", "false")
	})

	it("should show live asset counts below the list in multi-select mode", async () => {
		const image: MentionItem = {
			id: "image-1",
			name: "Image 1",
			type: MentionItemType.PROJECT_FILE,
			data: {
				file_id: "image-1",
				file_name: "Image 1.png",
				file_path: "Image 1.png",
				file_extension: "png",
			},
		}
		const video: MentionItem = {
			id: "video-1",
			name: "Video 1",
			type: MentionItemType.PROJECT_FILE,
			data: {
				file_id: "video-1",
				file_name: "Video 1.mp4",
				file_path: "Video 1.mp4",
				file_extension: "mp4",
			},
		}
		setCatalogState([image, video])

		render(
			<MentionPanel
				visible={true}
				selectionSummary={{
					currentCounts: { image: 0, video: 0, audio: 0 },
					limits: { image: 15, video: 1, audio: Infinity },
					getItemAssetType: (item) => (item.id === "image-1" ? "image" : "video"),
				}}
				catalogBehavior={defaultMentionPanelCatalogBehavior}
			/>,
		)

		expect(screen.queryByTestId("mention-panel-selection-summary")).not.toBeInTheDocument()
		enterMultiSelectMode()
		const selectionSummary = screen.getByTestId("mention-panel-selection-summary")
		expect(selectionSummary).toHaveTextContent("已选 0")
		expect(screen.getByRole("listbox").nextElementSibling).toBe(selectionSummary)

		fireEvent.click(screen.getAllByTestId("menu-item")[0])
		await waitFor(() => {
			expect(screen.getByTestId("mention-panel-selection-summary")).toHaveTextContent(
				/已选 1.*图片 1\/15.*视频 0\/1/,
			)
		})

		fireEvent.click(screen.getAllByTestId("menu-item")[1])
		await waitFor(() => {
			expect(screen.getByTestId("mention-panel-selection-summary")).toHaveTextContent(
				/已选 2.*图片 1\/15.*视频 1\/1/,
			)
		})

		fireEvent.click(screen.getAllByTestId("menu-item")[0])
		await waitFor(() => {
			expect(screen.getByTestId("mention-panel-selection-summary")).toHaveTextContent(
				/已选 1.*图片 0\/15.*视频 1\/1/,
			)
		})
		expect(screen.getByTestId("mention-panel-selected-item")).toBeInTheDocument()

		fireEvent.click(screen.getByTestId("mention-panel-selected-item-remove"))
		await waitFor(() => {
			expect(screen.getByTestId("mention-panel-selection-summary")).toHaveTextContent(
				"已选 0",
			)
		})
		expect(screen.queryByTestId("mention-panel-selected-items")).not.toBeInTheDocument()
	})

	it("should not count a resource that is already referenced", async () => {
		const image: MentionItem = {
			id: "image-1",
			name: "Image 1",
			type: MentionItemType.PROJECT_FILE,
			data: {
				file_id: "image-1",
				file_name: "Image 1.png",
				file_path: "Image 1.png",
				file_extension: "png",
			},
		}
		setCatalogState([image])

		render(
			<MentionPanel
				visible={true}
				selectionSummary={{
					currentCounts: { image: 1, video: 0, audio: 0 },
					limits: { image: 15 },
					getItemAssetType: () => "image",
					isItemAlreadySelected: () => true,
				}}
				catalogBehavior={defaultMentionPanelCatalogBehavior}
			/>,
		)

		enterMultiSelectMode()
		fireEvent.click(screen.getByTestId("menu-item"))
		await waitFor(() => {
			expect(screen.getByTestId("mention-panel-selection-summary")).toHaveTextContent(
				/已选 1.*图片 1\/15/,
			)
		})
	})

	it("should enter multi-select mode with keyboard meta enter", () => {
		setCatalogState([
			{
				id: "file-1",
				name: "File 1",
				type: MentionItemType.PROJECT_FILE,
			},
		])

		render(<MentionPanel visible={true} catalogBehavior={defaultMentionPanelCatalogBehavior} />)

		enterMultiSelectMode()

		expect(screen.getByText("完成")).toBeInTheDocument()
		expect(screen.getByTestId("menu-item-checkbox")).toHaveAttribute("data-checked", "false")
	})

	it("should not show or enter multi-select mode when current list has no selectable items", () => {
		setCatalogState([
			{
				id: "disabled-file",
				name: "Disabled File",
				type: MentionItemType.PROJECT_FILE,
				unSelectable: true,
			},
		])

		render(<MentionPanel visible={true} catalogBehavior={defaultMentionPanelCatalogBehavior} />)

		expect(screen.queryByText("多选")).not.toBeInTheDocument()

		act(() => {
			expect(latestUseMentionPanelProps?.onKeyboardMetaEnter?.()).toBe(false)
		})

		expect(screen.queryByText("完成")).not.toBeInTheDocument()
		expect(screen.queryByTestId("menu-item-checkbox")).not.toBeInTheDocument()
	})

	it("should toggle highlighted item with Enter while in multi-select mode", async () => {
		setCatalogState([
			{
				id: "file-1",
				name: "File 1",
				type: MentionItemType.PROJECT_FILE,
			},
		])

		render(<MentionPanel visible={true} catalogBehavior={defaultMentionPanelCatalogBehavior} />)

		enterMultiSelectMode()
		act(() => {
			expect(latestUseMentionPanelProps?.onKeyboardConfirm?.()).toBe(true)
		})

		await waitFor(() => {
			expect(screen.getByTestId("menu-item-checkbox")).toHaveAttribute("data-checked", "true")
		})
		expect(mockConfirmSelection).not.toHaveBeenCalled()
	})

	it("should toggle a drillable directory with Enter while in multi-select mode", async () => {
		setCatalogState([
			{
				id: "folder-1",
				name: "Folder 1",
				type: MentionItemType.FOLDER,
				hasChildren: true,
				isFolder: true,
			},
		])

		render(<MentionPanel visible={true} catalogBehavior={defaultMentionPanelCatalogBehavior} />)

		enterMultiSelectMode()
		act(() => {
			expect(latestUseMentionPanelProps?.onKeyboardConfirm?.()).toBe(true)
		})

		await waitFor(() => {
			expect(screen.getByTestId("menu-item-checkbox")).toHaveAttribute("data-checked", "true")
		})
		expect(mockConfirmSelection).not.toHaveBeenCalled()
	})

	it("should toggle a drillable directory when clicking its row in multi-select mode", async () => {
		setCatalogState([
			{
				id: "folder-1",
				name: "Folder 1",
				type: MentionItemType.FOLDER,
				hasChildren: true,
				isFolder: true,
			},
		])

		render(<MentionPanel visible={true} catalogBehavior={defaultMentionPanelCatalogBehavior} />)

		enterMultiSelectMode()
		fireEvent.click(screen.getByTestId("menu-item"))

		await waitFor(() => {
			expect(screen.getByTestId("menu-item-checkbox")).toHaveAttribute("data-checked", "true")
		})
		expect(mockConfirmSelection).not.toHaveBeenCalled()
	})

	it("should allow custom multi-select predicate while keeping folders navigable", async () => {
		vi.useFakeTimers()
		try {
			setCatalogState([
				{
					id: "folder-1",
					name: "Folder 1",
					type: MentionItemType.FOLDER,
					hasChildren: true,
					isFolder: true,
				},
				{
					id: "file-1",
					name: "File 1",
					type: MentionItemType.PROJECT_FILE,
				},
			])
			const canvasLikeCatalogBehavior: MentionPanelCatalogBehavior = {
				shouldEnterFolderDirectly: ({ selectedItem, enterFolder }) =>
					!enterFolder && selectedItem.type === MentionItemType.FOLDER,
				getDynamicTransition: ({ selectedItem, enterFolder }) =>
					selectedItem.type === MentionItemType.FOLDER &&
					selectedItem.isFolder &&
					enterFolder
						? { state: PanelState.FOLDER }
						: null,
			}

			render(
				<MentionPanel
					visible={true}
					catalogBehavior={canvasLikeCatalogBehavior}
					canToggleMultiSelectItem={(item) => item.type === MentionItemType.PROJECT_FILE}
				/>,
			)

			enterMultiSelectMode()

			const items = screen.getAllByTestId("menu-item")
			expect(within(items[0]).queryByTestId("menu-item-checkbox")).not.toBeInTheDocument()
			expect(within(items[1]).getByTestId("menu-item-checkbox")).toHaveAttribute(
				"data-checked",
				"false",
			)

			fireEvent.click(items[0])
			vi.runAllTimers()
			expect(mockConfirmSelection).toHaveBeenCalledWith({ enterFolder: false })
			vi.useRealTimers()

			fireEvent.click(items[1])
			await waitFor(() => {
				expect(within(items[1]).getByTestId("menu-item-checkbox")).toHaveAttribute(
					"data-checked",
					"true",
				)
			})
		} finally {
			vi.useRealTimers()
		}
	})

	it("should enter a navigation-only folder on Enter in multi-select mode", () => {
		vi.useFakeTimers()
		try {
			setCatalogState([
				{
					id: "folder-1",
					name: "Folder 1",
					type: MentionItemType.FOLDER,
					hasChildren: true,
					isFolder: true,
				},
				{
					id: "file-1",
					name: "File 1",
					type: MentionItemType.PROJECT_FILE,
				},
			])
			const canvasLikeCatalogBehavior: MentionPanelCatalogBehavior = {
				shouldEnterFolderDirectly: ({ selectedItem, enterFolder }) =>
					!enterFolder && selectedItem.type === MentionItemType.FOLDER,
				getDynamicTransition: ({ selectedItem, enterFolder }) =>
					selectedItem.type === MentionItemType.FOLDER &&
					selectedItem.isFolder === true &&
					enterFolder
						? { state: PanelState.FOLDER }
						: null,
			}

			render(
				<MentionPanel
					visible={true}
					catalogBehavior={canvasLikeCatalogBehavior}
					canToggleMultiSelectItem={(item) => item.type === MentionItemType.PROJECT_FILE}
				/>,
			)

			enterMultiSelectMode()
			act(() => {
				expect(latestUseMentionPanelProps?.onKeyboardConfirm?.()).toBe(true)
			})
			vi.runAllTimers()

			expect(mockConfirmSelection).toHaveBeenCalledWith({ enterFolder: true })
			expect(
				within(screen.getAllByTestId("menu-item")[0]).queryByTestId("menu-item-checkbox"),
			).not.toBeInTheDocument()
		} finally {
			vi.useRealTimers()
		}
	})

	it("should toggle highlighted item with ArrowRight while in multi-select mode", async () => {
		setCatalogState([
			{
				id: "file-1",
				name: "File 1",
				type: MentionItemType.PROJECT_FILE,
			},
		])

		render(<MentionPanel visible={true} catalogBehavior={defaultMentionPanelCatalogBehavior} />)

		enterMultiSelectMode()
		act(() => {
			expect(latestUseMentionPanelProps?.onKeyboardEnterFolder?.()).toBe(true)
		})

		await waitFor(() => {
			expect(screen.getByTestId("menu-item-checkbox")).toHaveAttribute("data-checked", "true")
		})
		expect(mockConfirmSelection).not.toHaveBeenCalled()
	})

	it("should drill down and clear pending items with ArrowRight on a drillable item", async () => {
		setCatalogState([
			{
				id: "file-1",
				name: "File 1",
				type: MentionItemType.PROJECT_FILE,
			},
			{
				id: "folder-1",
				name: "Folder 1",
				type: MentionItemType.FOLDER,
				hasChildren: true,
				isFolder: true,
			},
		])

		const { rerender } = render(
			<MentionPanel visible={true} catalogBehavior={defaultMentionPanelCatalogBehavior} />,
		)

		enterMultiSelectMode()
		act(() => {
			expect(latestUseMentionPanelProps?.onKeyboardConfirm?.()).toBe(true)
		})
		await waitFor(() => {
			expect(screen.getAllByTestId("menu-item-checkbox")[0]).toHaveAttribute(
				"data-checked",
				"true",
			)
		})

		mockState.selectedIndex = 1
		act(() => {
			expect(latestUseMentionPanelProps?.onKeyboardEnterFolder?.()).toBe(true)
		})

		expect(mockConfirmSelection).toHaveBeenCalledWith({ enterFolder: true })
		expect(screen.getAllByTestId("menu-item-checkbox")[0]).toHaveAttribute(
			"data-checked",
			"true",
		)

		mockState.currentState = PanelState.FOLDER
		mockState.navigationStack = [
			...mockState.navigationStack,
			{ id: "folder-1", name: "Folder 1", state: PanelState.CATALOG },
		]
		rerender(
			<MentionPanel
				visible={true}
				className="after-navigation"
				catalogBehavior={defaultMentionPanelCatalogBehavior}
			/>,
		)

		await waitFor(() => {
			expect(screen.getAllByTestId("menu-item-checkbox")[0]).toHaveAttribute(
				"data-checked",
				"false",
			)
		})
	})

	it("should preserve pending items across directories when navigation policy is preserve", async () => {
		const onSelect = vi.fn()
		const fileOne: MentionItem = {
			id: "file-1",
			name: "File 1",
			type: MentionItemType.PROJECT_FILE,
		}
		const folder: MentionItem = {
			id: "folder-1",
			name: "Folder 1",
			type: MentionItemType.FOLDER,
			hasChildren: true,
			isFolder: true,
		}
		const fileTwo: MentionItem = {
			id: "file-2",
			name: "File 2",
			type: MentionItemType.PROJECT_FILE,
		}

		setCatalogState([fileOne, folder])
		const { rerender } = render(
			<MentionPanel
				visible={true}
				onSelect={onSelect}
				multiSelectNavigationPolicy="preserve"
				selectionScopeId="canvas-root"
				catalogBehavior={defaultMentionPanelCatalogBehavior}
			/>,
		)

		enterMultiSelectMode()
		fireEvent.click(screen.getAllByTestId("menu-item")[0])
		await waitFor(() => {
			expect(screen.getAllByTestId("menu-item-checkbox")[0]).toHaveAttribute(
				"data-checked",
				"true",
			)
		})

		fireEvent.click(screen.getAllByTestId("menu-item-arrow-icon")[1])
		await waitFor(() => {
			expect(mockConfirmSelection).toHaveBeenCalledWith({ enterFolder: true })
		})

		mockState.currentState = PanelState.FOLDER
		mockState.navigationStack = [
			...mockState.navigationStack,
			{ id: "folder-1", name: "Folder 1", state: PanelState.CATALOG },
		]
		mockState.items = [fileTwo]
		mockState.selectedIndex = 0
		rerender(
			<MentionPanel
				visible={true}
				className="folder-navigation"
				onSelect={onSelect}
				multiSelectNavigationPolicy="preserve"
				selectionScopeId="canvas-root"
				catalogBehavior={defaultMentionPanelCatalogBehavior}
			/>,
		)

		fireEvent.click(screen.getByTestId("menu-item"))
		await waitFor(() => {
			expect(screen.getByTestId("menu-item-checkbox")).toHaveAttribute("data-checked", "true")
		})

		mockState.currentState = PanelState.CATALOG
		mockState.navigationStack = [
			{ id: "project-files", name: "Project", state: PanelState.DEFAULT },
		]
		mockState.items = [fileOne]
		rerender(
			<MentionPanel
				visible={true}
				className="parent-navigation"
				onSelect={onSelect}
				multiSelectNavigationPolicy="preserve"
				selectionScopeId="canvas-root"
				catalogBehavior={defaultMentionPanelCatalogBehavior}
			/>,
		)

		await waitFor(() => {
			expect(screen.getByTestId("menu-item-checkbox")).toHaveAttribute("data-checked", "true")
		})

		act(() => {
			latestUseMentionPanelProps?.onKeyboardMetaEnter?.()
		})
		await waitFor(() => expect(onSelect).toHaveBeenCalledTimes(2))
		expect(onSelect.mock.calls.map(([item]) => item.id)).toEqual(["file-1", "file-2"])
	})

	it("should submit checked items as a batch when completing with keyboard", async () => {
		const onSelect = vi.fn()
		setCatalogState([
			{
				id: "file-1",
				name: "File 1",
				type: MentionItemType.PROJECT_FILE,
			},
			{
				id: "file-2",
				name: "File 2",
				type: MentionItemType.PROJECT_FILE,
			},
		])

		render(
			<MentionPanel
				visible={true}
				onSelect={onSelect}
				catalogBehavior={defaultMentionPanelCatalogBehavior}
			/>,
		)

		enterMultiSelectMode()
		fireEvent.click(screen.getAllByTestId("menu-item")[0])
		fireEvent.click(screen.getAllByTestId("menu-item")[1])

		await waitFor(() => {
			expect(screen.getAllByTestId("menu-item-checkbox")[0]).toHaveAttribute(
				"data-checked",
				"true",
			)
			expect(screen.getAllByTestId("menu-item-checkbox")[1]).toHaveAttribute(
				"data-checked",
				"true",
			)
		})

		act(() => {
			latestUseMentionPanelProps?.onKeyboardMetaEnter?.()
		})

		await waitFor(() => {
			expect(onSelect).toHaveBeenCalledTimes(2)
		})
		expect(onSelect.mock.calls[0][1]).toMatchObject({
			batch: { index: 0, total: 2 },
		})
		expect(onSelect.mock.calls[1][1]).toMatchObject({
			batch: { index: 1, total: 2 },
		})
		expect(typeof onSelect.mock.calls[1][1].reset).toBe("function")
		await waitFor(() => {
			expect(screen.queryAllByTestId("menu-item-checkbox")).toHaveLength(0)
		})
	})

	it("should clear local multi-select state before keyboard navigation back", async () => {
		setCatalogState([
			{
				id: "file-1",
				name: "File 1",
				type: MentionItemType.PROJECT_FILE,
			},
		])

		render(<MentionPanel visible={true} catalogBehavior={defaultMentionPanelCatalogBehavior} />)

		enterMultiSelectMode()
		act(() => {
			expect(latestUseMentionPanelProps?.onKeyboardConfirm?.()).toBe(true)
		})

		await waitFor(() => {
			expect(screen.getByTestId("menu-item-checkbox")).toHaveAttribute("data-checked", "true")
		})

		act(() => {
			latestUseMentionPanelProps?.onKeyboardNavigateBack?.()
		})

		await waitFor(() => {
			expect(screen.queryByTestId("menu-item-checkbox")).not.toBeInTheDocument()
			expect(screen.queryByText("完成")).not.toBeInTheDocument()
		})
	})

	it("should close when completing multi-select with no pending items", () => {
		const onClose = vi.fn()
		setCatalogState([
			{
				id: "file-1",
				name: "File 1",
				type: MentionItemType.PROJECT_FILE,
			},
		])

		render(
			<MentionPanel
				visible={true}
				onClose={onClose}
				catalogBehavior={defaultMentionPanelCatalogBehavior}
			/>,
		)

		enterMultiSelectMode()
		act(() => {
			latestUseMentionPanelProps?.onKeyboardMetaEnter?.()
		})

		expect(onClose).toHaveBeenCalledTimes(1)
	})

	it("should not show or enter multi-select mode on the root category screen and should still drill down", () => {
		vi.useFakeTimers()
		mockState.currentState = PanelState.DEFAULT
		mockState.navigationStack = []
		mockState.items = [
			{
				id: "project-files",
				name: "Project Files",
				type: MentionItemType.FOLDER,
				hasChildren: true,
			},
		]
		mockState.selectedIndex = 0

		render(<MentionPanel visible={true} catalogBehavior={defaultMentionPanelCatalogBehavior} />)

		expect(screen.queryByText("多选")).not.toBeInTheDocument()
		act(() => {
			expect(latestUseMentionPanelProps?.onKeyboardMetaEnter?.()).toBe(false)
		})
		expect(screen.queryByText("完成")).not.toBeInTheDocument()
		expect(screen.queryByTestId("menu-item-checkbox")).not.toBeInTheDocument()

		fireEvent.click(screen.getByTestId("menu-item"))
		vi.runAllTimers()

		expect(mockConfirmSelection).toHaveBeenCalledWith({ enterFolder: false })
		vi.useRealTimers()
	})

	it("should still enter folders from the right arrow while in multi-select mode", () => {
		vi.useFakeTimers()
		setCatalogState([
			{
				id: "folder-1",
				name: "Folder 1",
				type: MentionItemType.FOLDER,
				hasChildren: true,
				isFolder: true,
			},
			{
				id: "file-1",
				name: "File 1",
				type: MentionItemType.PROJECT_FILE,
			},
		])

		render(<MentionPanel visible={true} catalogBehavior={defaultMentionPanelCatalogBehavior} />)

		enterMultiSelectMode()
		fireEvent.click(screen.getAllByTestId("menu-item-arrow-icon")[0])
		vi.runAllTimers()

		expect(mockConfirmSelection).toHaveBeenCalledWith({ enterFolder: true })
		vi.useRealTimers()
	})

	it("should not add MCP items to pending when OAuth validation fails", async () => {
		mockPrepareMentionItemForPending.mockResolvedValue({
			canSelect: false,
			mcpValidated: false,
		})
		mockState.currentState = PanelState.CATALOG
		mockState.navigationStack = [{ id: "mcp", name: "MCP", state: PanelState.DEFAULT }]
		mockState.items = [
			{
				id: "mcp-1",
				name: "MCP 1",
				type: MentionItemType.MCP,
				data: {
					id: "mcp-1",
					name: "MCP 1",
					icon: "",
					require_fields: [],
				},
			},
		]
		mockState.selectedIndex = 0

		render(<MentionPanel visible={true} catalogBehavior={defaultMentionPanelCatalogBehavior} />)

		enterMultiSelectMode()
		fireEvent.click(screen.getByTestId("menu-item"))

		await waitFor(() => {
			expect(mockPrepareMentionItemForPending).toHaveBeenCalledTimes(1)
		})
		expect(screen.getByTestId("menu-item-checkbox")).toHaveAttribute("data-checked", "false")
	})
})
