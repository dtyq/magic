import { render, screen, waitFor } from "@testing-library/react"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { TopicMode } from "@/pages/superMagic/pages/Workspace/TopicMode"

const {
	mockLoad,
	mockSetCurrentScene,
	mockSetInputScopeKey,
	defaultMCPStoreMock,
	sceneStateStoreMock,
	mockPlaybooks,
	capturedEditorContext,
} = vi.hoisted(() => ({
	mockLoad: vi.fn(),
	defaultMCPStoreMock: {
		initialized: true,
		load: vi.fn(),
	},
	mockSetCurrentScene: vi.fn(),
	mockSetInputScopeKey: vi.fn(),
	capturedEditorContext: { current: null as Record<string, unknown> | null },
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
		setInputScopeKey: vi.fn(),
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
	default: ({ editorContext }: { editorContext: Record<string, unknown> }) => {
		capturedEditorContext.current = editorContext
		return <div data-testid="lazy-scene-panel" />
	},
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
	buildTopicInputScopeKey: vi.fn(() => "test-input-scope"),
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

import EditorLayout from "../EditorLayout"

describe("EditorLayout", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		defaultMCPStoreMock.initialized = true
		defaultMCPStoreMock.load = mockLoad.mockResolvedValue(undefined)
		mockPlaybooks.length = 0
		sceneStateStoreMock.currentScene = null
		sceneStateStoreMock.setCurrentScene = mockSetCurrentScene
		sceneStateStoreMock.setInputScopeKey = mockSetInputScopeKey
		capturedEditorContext.current = null
	})

	it("marks workspace-home entity creation as workspace regardless of selected mode", () => {
		render(<EditorLayout mode={"SMA-agent" as TopicMode} />)

		expect(capturedEditorContext.current?.creationScene).toBe("workspace")
	})

	it("loads MCP state from shared store", async () => {
		render(<EditorLayout />)

		await waitFor(() => {
			expect(mockLoad).toHaveBeenCalled()
		})
	})

	it("only uses the full workspace width for the PPT scene", () => {
		const { rerender } = render(<EditorLayout />)
		const configContainer = screen.getByTestId("home-scene-config-container")
		expect(configContainer).toHaveClass("max-w-4xl")

		rerender(<EditorLayout mode={TopicMode.PPT} />)
		expect(configContainer).not.toHaveClass("max-w-4xl")
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
