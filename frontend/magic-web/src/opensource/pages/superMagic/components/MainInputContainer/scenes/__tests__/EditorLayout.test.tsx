import { render, screen, waitFor } from "@testing-library/react"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const { mockLoad, mockSetCurrentScene, defaultMCPStoreMock, sceneStateStoreMock } = vi.hoisted(
	() => ({
		mockLoad: vi.fn(),
		defaultMCPStoreMock: {
			hasMCP: false,
			initialized: true,
			load: vi.fn(),
		},
		mockSetCurrentScene: vi.fn(),
		sceneStateStoreMock: {
			currentScene: null as unknown,
			setCurrentScene: vi.fn(),
			resetState: vi.fn(),
		},
	}),
)

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

vi.mock("@/opensource/components/Agent/MCP/store/mcp-store", () => ({
	defaultMCPStore: defaultMCPStoreMock,
}))

vi.mock("../../components/LazyScenePanel", () => ({
	default: () => <div data-testid="lazy-scene-panel" />,
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

vi.mock("@/opensource/services/superMagic/SuperMagicModeService", () => ({
	default: {
		getModeConfigWithLegacy: () => ({
			mode: {
				playbooks: [],
			},
		}),
	},
}))

vi.mock("@/opensource/pages/superMagic/stores", () => ({
	roleStore: {
		setCurrentRole: vi.fn(),
	},
}))

vi.mock("@/opensource/pages/superMagic/stores/core", () => ({
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

vi.mock("@/opensource/components/Agent/AgentCommonModal", () => ({
	AgentCommonModal: ({ children }: { children: ReactNode }) => (
		<div data-testid="agent-common-modal">{children}</div>
	),
}))

vi.mock("@/opensource/components/Agent/MCP/AgentSettings", () => ({
	default: () => <div data-testid="agent-settings" />,
}))

import EditorLayout from "../EditorLayout"

describe("EditorLayout", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		defaultMCPStoreMock.hasMCP = false
		defaultMCPStoreMock.initialized = true
		defaultMCPStoreMock.load = mockLoad.mockResolvedValue(undefined)
		sceneStateStoreMock.currentScene = null
		sceneStateStoreMock.setCurrentScene = mockSetCurrentScene
	})

	it("shows plugin tips when user has no global MCP", async () => {
		render(<EditorLayout />)

		await waitFor(() => {
			expect(screen.getByText("pluginTips.connectTools")).toBeInTheDocument()
		})
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
})
