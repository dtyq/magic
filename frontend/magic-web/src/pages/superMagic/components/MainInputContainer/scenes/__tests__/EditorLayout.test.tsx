import { render, screen, waitFor } from "@testing-library/react"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const { mockLoad, mockSetCurrentScene, defaultMCPStoreMock, sceneStateStoreMock, mockPlaybooks } =
	vi.hoisted(() => ({
		mockLoad: vi.fn(),
		defaultMCPStoreMock: {
			hasMCP: false,
			hasEverAddedMcp: false,
			initialized: true,
			load: vi.fn(),
		},
		mockSetCurrentScene: vi.fn(),
		mockPlaybooks: [] as Array<{
			id: string
			name: string
			desc: string
			icon: string
			theme_color: string | null
		}>,
		sceneStateStoreMock: {
			currentScene: null as unknown,
			setCurrentScene: vi.fn(),
			resetState: vi.fn(),
		},
	}))

vi.mock("mobx-react-lite", () => ({
	observer: (component: unknown) => component,
}))

vi.mock("react-i18next", async (importOriginal) => {
	const actual = await importOriginal<typeof import("react-i18next")>()

	return {
		...actual,
		useTranslation: () => ({
			t: (key: string) => key,
		}),
	}
})

vi.mock("@/components/Agent/MCP/store/mcp-store", () => ({
	defaultMCPStore: defaultMCPStoreMock,
}))

vi.mock("@/models/user", () => ({
	userStore: {
		user: {
			organizationCode: "test-org",
			userInfo: {
				user_id: "test-user",
			},
		},
	},
}))

vi.mock("@/pages/superMagic/services", () => ({
	default: {
		route: {
			navigateToTopic: vi.fn(),
		},
	},
}))

vi.mock("../../components/LazyScenePanel", () => ({
	default: () => <div data-testid="lazy-scene-panel" />,
}))

vi.mock("../../components/PluginTips", () => ({
	default: ({ onConnectClick }: { onConnectClick: () => void }) => (
		<button type="button" onClick={onConnectClick}>
			pluginTips.connectTools
		</button>
	),
}))

vi.mock("../../components/SelectedSkillBadge", () => ({
	default: () => <div data-testid="current-scene-badge" />,
}))

vi.mock("../../hooks/useSkillPanelScroll", () => ({
	useSkillPanelScroll: vi.fn(),
}))

vi.mock("../../stores", () => ({
	sceneStateStore: sceneStateStoreMock,
	SceneStateProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}))

vi.mock("@/services/superMagic/SuperMagicModeService", () => ({
	default: {
		getModeConfigWithLegacy: () => ({
			mode: {
				playbooks: mockPlaybooks,
			},
		}),
	},
}))

vi.mock("@/pages/superMagic/stores", () => ({
	roleStore: {
		setCurrentRole: vi.fn(),
	},
}))

vi.mock("@/pages/superMagic/stores/core", () => ({
	projectStore: {
		selectedProject: null,
		setSelectedProject: vi.fn(),
	},
	topicStore: {
		selectedTopic: null,
		setSelectedTopic: vi.fn(),
	},
	workspaceStore: {
		selectedWorkspace: null,
		firstWorkspace: null,
	},
}))

vi.mock("@/components/Agent/AgentCommonModal", () => ({
	AgentCommonModal: ({ children }: { children: ReactNode }) => (
		<div data-testid="agent-common-modal">{children}</div>
	),
}))

vi.mock("@/components/Agent/MCP/AgentSettings", () => ({
	default: () => <div data-testid="agent-settings" />,
}))

import EditorLayout from "../EditorLayout"

describe("EditorLayout", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		defaultMCPStoreMock.hasMCP = false
		defaultMCPStoreMock.hasEverAddedMcp = false
		defaultMCPStoreMock.initialized = true
		defaultMCPStoreMock.load = mockLoad.mockResolvedValue(undefined)
		mockPlaybooks.length = 0
		sceneStateStoreMock.currentScene = null
		sceneStateStoreMock.setCurrentScene = mockSetCurrentScene
	})

	it("shows plugin tips when user has no global MCP", async () => {
		render(<EditorLayout />)

		await waitFor(() => {
			expect(screen.getByText("pluginTips.connectTools")).toBeInTheDocument()
		})
	})

	it("hides plugin tips after user once added MCP but removed all", async () => {
		defaultMCPStoreMock.hasEverAddedMcp = true

		render(<EditorLayout />)

		await waitFor(() => {
			expect(mockLoad).toHaveBeenCalled()
		})

		expect(screen.queryByText("pluginTips.connectTools")).not.toBeInTheDocument()
	})

	it("hides plugin tips when user already has a global MCP", async () => {
		defaultMCPStoreMock.hasMCP = true

		render(<EditorLayout />)

		await waitFor(() => {
			expect(mockLoad).toHaveBeenCalled()
		})

		expect(screen.queryByText("pluginTips.connectTools")).not.toBeInTheDocument()
	})

	it("loads MCP state from shared store", async () => {
		render(<EditorLayout />)

		await waitFor(() => {
			expect(mockLoad).toHaveBeenCalled()
		})
	})

	it("selects the only available scene automatically", async () => {
		const onlyScene = {
			id: "single-scene",
			name: "Single scene",
			desc: "Only option",
			icon: "wand",
			theme_color: null,
		}
		mockPlaybooks.push(onlyScene)

		render(<EditorLayout />)

		await waitFor(() => {
			expect(mockSetCurrentScene).toHaveBeenCalledWith(onlyScene)
		})
	})

	it("hides selected scene badge when there is only one scene", () => {
		const onlyScene = {
			id: "single-scene",
			name: "Single scene",
			desc: "Only option",
			icon: "wand",
			theme_color: null,
		}
		mockPlaybooks.push(onlyScene)
		sceneStateStoreMock.currentScene = onlyScene

		render(<EditorLayout />)

		expect(screen.queryByTestId("current-scene-badge")).not.toBeInTheDocument()
	})

	it("shows selected scene badge when multiple scenes are available", () => {
		const selectedScene = {
			id: "selected-scene",
			name: "Selected scene",
			desc: "Selected option",
			icon: "wand",
			theme_color: null,
		}
		mockPlaybooks.push(selectedScene)
		mockPlaybooks.push({
			id: "another-scene",
			name: "Another scene",
			desc: "Another option",
			icon: "wand",
			theme_color: null,
		})
		sceneStateStoreMock.currentScene = selectedScene

		render(<EditorLayout />)

		expect(screen.getByTestId("current-scene-badge")).toBeInTheDocument()
	})

	it("clears selected scene when it is no longer available", async () => {
		sceneStateStoreMock.currentScene = {
			id: "removed-scene",
			name: "Removed scene",
			desc: "No longer listed",
			icon: "wand",
			theme_color: null,
		}
		mockPlaybooks.push({
			id: "available-scene",
			name: "Available scene",
			desc: "Still listed",
			icon: "wand",
			theme_color: null,
		})
		mockPlaybooks.push({
			id: "another-available-scene",
			name: "Another available scene",
			desc: "Also listed",
			icon: "wand",
			theme_color: null,
		})

		render(<EditorLayout />)

		await waitFor(() => {
			expect(mockSetCurrentScene).toHaveBeenCalledWith(null)
		})
	})
})
