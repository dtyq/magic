import { forwardRef, type ReactNode } from "react"
import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi, beforeEach } from "vitest"

import MobileHomePage from "../index"

const mockUseOptionalSuperMobileShellOutlet = vi.fn()

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => key,
	}),
}))

vi.mock("@/pages/superMagicMobile/components/MobileShell", () => ({
	SuperMobileShellRouteLayout: ({ children }: { children: ReactNode }) => (
		<div data-testid="shell">{children}</div>
	),
	useOptionalSuperMobileShellOutlet: () => mockUseOptionalSuperMobileShellOutlet(),
}))

vi.mock("react-router", () => ({
	useLocation: () => ({
		pathname: "/global/mobile-home",
		search: "",
	}),
}))

vi.mock("ahooks", () => ({
	useMemoizedFn: <T extends (...args: never[]) => unknown>(fn: T) => fn,
	useMount: () => undefined,
}))

vi.mock("@/routes/history/helpers", () => ({
	routesPathMatch: (name: string, pathname: string) => {
		if (name === "MobileHome") return pathname === "/global/mobile-home"
		if (name === "MobileTabs") return pathname === "/global/mobile-tabs"
		return false
	},
}))

vi.mock("@/routes/constants", () => ({
	RouteName: {
		MobileHome: "MobileHome",
		MobileTabs: "MobileTabs",
	},
}))

vi.mock("@/routes/components/ViewportRouteGuard", () => ({
	MobileOnlyRoute: ({ children }: { children: ReactNode }) => <>{children}</>,
}))

vi.mock("../components/ChatPageHeader", () => ({
	__esModule: true,
	default: ({ onMenuClick }: { onMenuClick: () => void }) => (
		<button type="button" data-testid="chat-page-header-menu-button" onClick={onMenuClick}>
			menu
		</button>
	),
}))

vi.mock("../components/SloganSection", () => ({
	__esModule: true,
	default: () => <div data-testid="slogan-section" />,
}))

vi.mock("../components/MobileInputContainer", () => ({
	__esModule: true,
	default: forwardRef(() => <div data-testid="mobile-input-container" />),
}))

vi.mock("@/pages/mobileTabs/constants", () => ({
	MobileTabParam: {
		Super: "super",
	},
}))

vi.mock("@/pages/superMagic/pages/Workspace/types", () => ({
	TaskStatus: {
		RUNNING: "RUNNING",
	},
}))

vi.mock("@/pages/superMagic/pages/Workspace/TopicMode", () => ({
	TopicMode: {
		General: "general",
	},
}))

vi.mock("@/pages/superMagic/stores/RoleStore", () => ({
	roleStore: {
		currentRole: null,
		setCurrentRole: vi.fn(),
	},
}))

vi.mock("@/pages/superMagic/components/MainInputContainer/components/editors/constant", () => ({
	MOBILE_LAYOUT_CONFIG: {},
}))

vi.mock("@/pages/superMagic/components/MainInputContainer/constants", () => ({
	INPUT_CONTAINER_MIN_HEIGHT: {
		HomePage: 88,
	},
}))

vi.mock("@/pages/superMagic/stores/core", () => ({
	topicStore: {
		selectedTopic: null,
		setSelectedTopic: vi.fn(),
	},
	projectStore: {
		selectedProject: null,
		setSelectedProject: vi.fn(),
	},
	workspaceStore: {
		setSelectedWorkspace: vi.fn(),
	},
}))

vi.mock("@/pages/superMagic/stores", () => ({
	superMagicStore: {
		messages: new Map(),
	},
}))

vi.mock("@/models/user", () => ({
	userStore: {
		user: {
			userInfo: {
				user_id: "user-1",
			},
		},
	},
}))

vi.mock("@/pages/superMagic/hooks/useTaskInterrupt", () => ({
	useTaskInterrupt: () => ({
		handleInterrupt: vi.fn(),
	}),
}))

vi.mock("@/pages/superMagic/hooks/useChatWorkspace", () => ({
	useChatWorkspace: () => ({
		chatWorkspace: null,
		createProjectInChatWorkspace: vi.fn(),
	}),
}))

vi.mock("@/components/base/MagicToaster/utils", () => ({
	__esModule: true,
	default: {
		error: vi.fn(),
	},
}))

vi.mock("@/pages/superMagic/services", () => ({
	__esModule: true,
	default: {
		switchChatProject: vi.fn(),
	},
}))

vi.mock("@/pages/superMagic/hooks/useAgentCodeModeFromSearch", () => ({
	__esModule: true,
	default: () => undefined,
}))

vi.mock("@/pages/superMagic/hooks/useTopicMode", () => ({
	__esModule: true,
	default: () => ({
		topicMode: "general",
		setTopicMode: vi.fn(),
	}),
}))

vi.mock("@/pages/superMagic/hooks/useFeaturedModeListRefresh", () => ({
	refreshFeaturedModeList: vi.fn(async () => []),
}))

vi.mock("@/pages/superMagic/services/topicStatusSyncService", () => ({
	applyOptimisticTopicRunningState: vi.fn(),
}))

vi.mock("@/services/superMagic/SuperMagicModeService", () => ({
	__esModule: true,
	default: {
		isModeValid: () => true,
	},
}))

vi.mock("@/stores/interface", () => ({
	interfaceStore: {
		mobileTabBarVisible: false,
	},
}))

vi.mock("../agentCodeRoutePolicy", () => ({
	shouldClearResolvedAgentCodeFromUrl: () => false,
}))

vi.mock("../homepageModeState", () => ({
	resolveHomepageDisplayTopicMode: ({ topicMode }: { topicMode: string }) => topicMode,
}))

describe("MobileHomePage", () => {
	beforeEach(() => {
		mockUseOptionalSuperMobileShellOutlet.mockReset()
	})

	it("does not crash when the panel temporarily renders before shell outlet is ready", () => {
		mockUseOptionalSuperMobileShellOutlet
			.mockReturnValueOnce({ openSidebar: vi.fn() })
			.mockReturnValueOnce(null)

		render(<MobileHomePage />)

		expect(screen.getByTestId("chat-page-header-menu-button")).toBeInTheDocument()
		expect(screen.getByTestId("mobile-input-container")).toBeInTheDocument()
	})
})