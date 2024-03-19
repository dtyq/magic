import { render } from "@testing-library/react"
import { describe, it, expect, vi } from "vitest"
import MentionPanel from "../index"

// Mock all dependencies to prevent complex interactions
vi.mock("../hooks/useMentionPanel", () => ({
	useMentionPanel: () => ({
		state: {
			currentState: "default",
			items: [],
			selectedIndex: -1,
			searchQuery: "",
			navigationStack: [],
		},
		actions: {
			selectItem: vi.fn(),
			confirmSelection: vi.fn(),
			search: vi.fn(),
			navigateBack: vi.fn(),
			enterFolder: vi.fn(),
			exit: vi.fn(),
			reset: vi.fn(),
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

vi.mock("../hooks/usePanelLayout", () => ({
	usePanelLayout: () => ({
		layoutStyle: { top: 0, left: 0 },
		menuListStyle: { maxHeight: "300px" },
		expandDirection: "down",
	}),
}))

vi.mock("../hooks/useI18n", () => ({
	useI18nStatic: () => ({
		loading: "Loading...",
		empty: "No results found",
		retry: "Retry",
		ariaLabels: {
			panel: "Mention panel",
			retryButton: "Retry loading",
		},
		keyboardHints: {
			navigate: "Navigate",
			confirm: "Confirm",
			goBack: "Go back",
			goForward: "Go forward",
		},
	}),
}))

vi.mock("../styles", () => ({
	useStyles: () => ({
		styles: {
			panelContainer: "panel-container",
			panelContent: "panel-content",
			searchSection: "search-section",
			breadcrumb: "breadcrumb",
			menuList: "menu-list",
			loading: "loading",
			error: "error",
			empty: "empty",
			keyboardHints: "keyboard-hints",
			keyboardHint: "keyboard-hint",
			keyboardKey: "keyboard-key",
			keyboardLabel: "keyboard-label",
		},
		cx: (...args: unknown[]) => args.filter(Boolean).join(" "),
	}),
}))

vi.mock("../components/MenuItem", () => ({
	default: () => <div data-testid="menu-item">Menu Item</div>,
}))

describe("MentionPanel", () => {
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
})
