import { forwardRef } from "react"
import type { MouseEvent, ReactNode } from "react"
import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import MentionPanel from "../index"
import { MentionItemType } from "../types"
import type { MentionItem } from "../types"

const mockSelectItem = vi.fn()
const mockConfirmSelection = vi.fn()

const mockState = {
	currentState: "default",
	items: [] as MentionItem[],
	selectedIndex: -1,
	searchQuery: "",
	navigationStack: [],
}

// Mock all dependencies to prevent complex interactions
vi.mock("../hooks/useMentionPanel", () => ({
	useMentionPanel: () => ({
		state: mockState,
		actions: {
			selectItem: mockSelectItem,
			confirmSelection: mockConfirmSelection,
			search: vi.fn(),
			navigateBack: vi.fn(),
			navigateToBreadcrumb: vi.fn(),
			enterFolder: vi.fn(),
			exit: vi.fn(),
			reset: vi.fn(),
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
	}),
}))

vi.mock("react-virtuoso", () => ({
	Virtuoso: forwardRef<
		HTMLDivElement,
		{
			totalCount: number
			itemContent: (index: number) => ReactNode
		}
	>(({ totalCount, itemContent }, ref) => (
		<div ref={ref} data-testid="virtuoso-list">
			{Array.from({ length: totalCount }, (_, index) => itemContent(index))}
		</div>
	)),
}))

vi.mock("../hooks/useI18n", () => ({
	useI18nStatic: () => ({
		loading: "Loading...",
		empty: "No results found",
		retry: "Retry",
		searchPlaceholder: "Search",
		searchResults: "Search Results",
		ariaLabels: {
			panel: "Mention panel",
			retryButton: "Retry loading",
			menuItem: "Menu item",
		},
		keyboardHints: {
			navigate: "Navigate",
			confirm: "Confirm",
			goBack: "Go back",
			goForward: "Go forward",
		},
	}),
}))

vi.mock("../../../hooks/useIsMobile", () => ({
	useIsMobile: () => false,
}))

vi.mock("@/styles/fonts/geist", () => ({
	default: () => undefined,
}))

vi.mock("../components/MenuItem", () => ({
	default: ({ onClick }: { onClick?: (event?: MouseEvent) => void }) => (
		<div data-testid="menu-item" onClick={onClick}>
			<button data-testid="menu-item-arrow" data-right-arrow onClick={onClick}>
				<span data-testid="menu-item-arrow-icon">Arrow</span>
			</button>
		</div>
	),
}))

describe("MentionPanel", () => {
	beforeEach(() => {
		mockState.currentState = "default"
		mockState.items = []
		mockState.selectedIndex = -1
		mockState.searchQuery = ""
		mockState.navigationStack = []
		mockSelectItem.mockReset()
		mockConfirmSelection.mockReset()
	})

	it("should not render when not visible", () => {
		const { container } = render(<MentionPanel visible={false} />)
		expect(container.firstChild).toBeNull()
	})

	it("should render when visible", () => {
		const { container } = render(<MentionPanel visible={true} />)
		expect(container.firstChild).toBeTruthy()
	})

	it("should render with default props", () => {
		const { container } = render(<MentionPanel />)
		expect(container.firstChild).toBeTruthy()
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

		render(<MentionPanel visible={true} />)

		fireEvent.click(screen.getByTestId("menu-item-arrow-icon"))
		vi.runAllTimers()

		expect(mockSelectItem).toHaveBeenCalledWith(0)
		expect(mockConfirmSelection).toHaveBeenCalledWith({ enterFolder: true })
		vi.useRealTimers()
	})
})
