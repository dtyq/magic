import type { ReactNode } from "react"
import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import ChatsPage from "../index"
import { SuperMobileShellRouteLayout } from "@/pages/superMagicMobile/components/MobileShell/SuperMobileShellRouteLayout"

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => key,
	}),
}))

vi.mock("@/routes/components/ViewportRouteGuard", () => ({
	MobileOnlyRoute: ({ children }: { children: ReactNode }) => <>{children}</>,
}))

vi.mock("@/pages/superMagic/services", () => ({
	default: {
		switchChatProject: vi.fn(),
		deleteProject: vi.fn(),
		project: {
			pinProjectAndRefresh: vi.fn(),
		},
	},
}))

vi.mock("@/components/base/MagicToaster/utils", () => ({
	default: {
		error: vi.fn(),
	},
}))

vi.mock("@/pages/superMagic/stores", () => ({
	roleStore: {
		currentRole: null,
	},
}))

vi.mock("@/pages/superMagic/pages/Workspace/TopicMode", () => ({
	TopicMode: {
		General: "general",
	},
}))

vi.mock("@/pages/superMagic/hooks/useChatWorkspace", () => ({
	useChatWorkspace: () => ({
		createProjectInChatWorkspace: vi.fn(),
	}),
}))

vi.mock("@/pages/superMagicMobile/components/ProjectList/hooks/useProjectActions", () => ({
	useProjectListActions: () => ({
		projectActions: [],
		projectActionComponents: null,
		updateCurrentActionItem: vi.fn(),
	}),
}))

vi.mock("../hooks/useChatConversationList", () => ({
	useChatConversationList: () => ({
		items: [],
		isLoading: false,
		searchValue: "",
		setSearchValue: vi.fn(),
		debouncedSearchValue: "",
		isEmpty: true,
		isSearchEmpty: false,
		hasMore: false,
		reload: vi.fn(),
		loadMore: vi.fn(),
		optimisticRemove: vi.fn(),
	}),
}))

vi.mock("../components/ChatConversationListView", () => ({
	ChatConversationListView: ({ onOpenSidebar }: { onOpenSidebar: () => void }) => (
		<button type="button" data-testid="chat-list" onClick={onOpenSidebar}>
			list
		</button>
	),
}))

vi.mock("@/pages/superMagicMobile/components/ConversationActionsPopup", () => ({
	default: () => null,
}))

vi.mock("@/layouts/BaseLayoutMobile/components/MobileTabBar/constants/tabsConfig.shared", () => ({
	hasOrganizationAppsShortcuts: () => false,
}))

vi.mock("@/models/user", () => ({
	userStore: {
		user: {
			isPersonalOrganization: false,
		},
	},
}))

vi.mock("@/platform/native", () => ({
	getNativePort: () => ({
		navigation: {
			changeBottomTab: vi.fn(),
		},
	}),
}))

vi.mock("@/pages/superMagicMobile/components/icons/MagiClawNavIcon", () => ({
	MagiClawNavIcon: () => null,
}))

vi.mock("@/routes/hooks/useNavigate", () => ({
	default: () => vi.fn(),
}))

vi.mock("@/layouts/BaseLayoutMobile/components/MobileSettings", () => ({
	MobileSettingsPanel: () => null,
}))

vi.mock("@/pages/superMagicMobile/components/MobileShell/MobileSettingsContext", () => ({
	MobileSettingsProvider: ({ children }: { children: ReactNode }) => children,
}))

vi.mock("@/pages/superMagicMobile/components/MobileShell/useRecentProjectsForMenu", () => ({
	useRecentProjectsForMenu: () => ({
		recentItems: [],
		reloadRecentItems: vi.fn(),
		loadMoreRecentItems: vi.fn(),
		hasMore: false,
	}),
}))

vi.mock("@/pages/superMagicMobile/components/MobileShell/MobileShellSidebar", () => ({
	default: () => <div data-testid="mobile-shell-sidebar" />,
}))

vi.mock("@/pages/superMagicMobile/components/MobileShell/MobileShellAppLayout", () => ({
	MobileShellAppLayout: ({ panel }: { panel: ReactNode }) => <div data-testid="shell">{panel}</div>,
}))

describe("ChatsPage", () => {
	it("falls back to its own shell when rendered without route shell context", () => {
		render(<ChatsPage />)

		expect(screen.getByTestId("shell")).toBeInTheDocument()
		expect(screen.getByTestId("chat-list")).toBeInTheDocument()
	})

	it("reuses the existing shell context when already wrapped by the route shell", () => {
		render(
			<SuperMobileShellRouteLayout activeView="chats" closeSidebarAriaLabel="close">
				<ChatsPage />
			</SuperMobileShellRouteLayout>,
		)

		expect(screen.getByTestId("chat-list")).toBeInTheDocument()
	})
})