import type { ReactNode } from "react"
import { act, fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { SceneEditorContext } from "@/pages/superMagic/components/MainInputContainer/components/editors/types"
import { ToolbarButton } from "@/pages/superMagic/components/MessageEditor/types"
import { TopicMode } from "@/pages/superMagic/pages/Workspace/TopicMode"
import MicroAppCreatePrompt from "../MicroAppCreatePrompt"

const mocks = vi.hoisted(() => ({
	setSelectedProject: vi.fn(),
	setSelectedTopic: vi.fn(),
	setSelectedWorkspace: vi.fn(),
	createMicroAppProject: vi.fn(),
	report: vi.fn(),
	editorContext: undefined as SceneEditorContext | undefined,
}))

vi.mock("@/apis", () => ({
	SuperMagicApi: {
		createMicroAppProject: mocks.createMicroAppProject,
	},
}))

vi.mock("@/services/analytics", () => ({
	analyticsService: { report: mocks.report },
}))

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => key,
		i18n: { language: "zh_CN" },
	}),
}))

vi.mock("@/pages/superMagic/stores/core", () => ({
	projectStore: { setSelectedProject: mocks.setSelectedProject },
	topicStore: { setSelectedTopic: mocks.setSelectedTopic },
	workspaceStore: { setSelectedWorkspace: mocks.setSelectedWorkspace },
}))

vi.mock("@/pages/superMagic/pages/MicroAppPage/utils/microAppModelMode", () => ({
	resolveMicroAppModelSelectionMode: () => TopicMode.Default,
}))

vi.mock(
	"@/pages/superMagic/components/MainInputContainer/components/editors/DefaultMessageEditorContainer",
	() => ({
		default: ({ editorContext }: { editorContext: SceneEditorContext }) => {
			mocks.editorContext = editorContext
			return (
				<button
					type="button"
					data-testid="mock-editor-send-success"
					onClick={() =>
						editorContext.onSendSuccess?.({
							currentProject: { id: "project-created" },
							currentTopic: { id: "topic-created" },
						})
					}
				>
					send
				</button>
			)
		},
	}),
)

vi.mock("@/pages/superMagicMobile/pages/ChatPage/components/MobileInputContainer", () => ({
	default: ({ editorContext }: { editorContext: SceneEditorContext }) => {
		mocks.editorContext = editorContext
		return <div data-testid="mock-mobile-input-container" />
	},
}))

vi.mock("@/pages/superMagic/components/MainInputContainer/stores", () => ({
	SceneStateProvider: ({ children }: { children: ReactNode }) => children,
	buildTopicInputScopeKey: () => "micro-apps-create",
	createSceneStateStore: () => ({
		setInputScopeKey: vi.fn(),
	}),
	sceneStateStore: {
		setInputScopeKey: vi.fn(),
	},
}))

describe("MicroAppCreatePrompt", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		mocks.editorContext = undefined
		mocks.createMicroAppProject.mockResolvedValue({
			app_id: "app-created",
			project: { id: "project-created" },
			topic: { id: "topic-created" },
		})
	})

	it("uses the shared message editor to create a fresh micro app and enters it after send", async () => {
		const onCreated = vi.fn()
		const onFocusChange = vi.fn()
		render(
			<MicroAppCreatePrompt
				workspace={{ id: "workspace-1", name: "Micro Apps" } as never}
				onCreated={onCreated}
				onFocusChange={onFocusChange}
			/>,
		)

		expect(mocks.setSelectedProject).toHaveBeenCalledWith(null)
		expect(mocks.setSelectedTopic).toHaveBeenCalledWith(null)
		expect(mocks.editorContext?.topicMode).toBe(TopicMode.MicroApp)
		expect(mocks.editorContext?.modelTopicMode).toBe(TopicMode.Default)
		expect(mocks.editorContext?.selectedProject).toBeNull()
		expect(mocks.editorContext?.selectedTopic).toBeNull()
		expect(mocks.editorContext?.refreshProjectAfterTopicRename).toBe(true)
		expect(mocks.editorContext?.placeholder).toBe("microAppsPage.heroPlaceholder")
		expect(mocks.editorContext?.promptCarousel?.examples).toHaveLength(60)
		expect(mocks.editorContext?.promptCarousel?.examples).toContain(
			"做一个适合销售团队使用的客户跟进看板，可以记录客户阶段、负责人、预计金额和下次联系时间。",
		)
		expect(mocks.editorContext?.promptCarousel?.examples).toContain(
			"做一个记忆翻牌小游戏，包含不同难度、计时、步数和最佳成绩。",
		)
		expect(mocks.editorContext?.promptCarousel?.examples).toContain(
			"做一个团队权限管理后台，支持成员、角色、资源权限和操作日志。",
		)
		expect(mocks.editorContext?.promptCarousel?.navigationLabel).toBe(
			"microAppsPage.heroPromptSwitch",
		)
		expect(mocks.editorContext?.promptCarousel?.acceptLabel).toBe(
			"microAppsPage.heroPromptAccept",
		)
		expect(mocks.editorContext?.layoutConfig?.bottomRight).toContain(ToolbarButton.MCP)
		expect(screen.getByTestId("micro-apps-keyboard-port")).toBeInTheDocument()

		const editor = screen.getByTestId("mock-editor-send-success")
		await act(async () => {
			await mocks.editorContext?.createProject?.({ projectMode: TopicMode.MicroApp })
		})
		expect(mocks.createMicroAppProject).toHaveBeenCalledWith({
			workspace_id: "workspace-1",
			dynamic_params: {
				agent_mode: "micro-app",
				message_version: "v2",
			},
		})
		expect(mocks.report).toHaveBeenCalledWith("project_create_attempted", {
			workspaceId: "workspace-1",
			sceneOverride: "micro_app",
		})
		fireEvent.focus(editor)
		expect(onFocusChange).toHaveBeenCalledWith(true)

		fireEvent.blur(editor)
		expect(onFocusChange).toHaveBeenLastCalledWith(false)

		fireEvent.click(editor)
		expect(onCreated).toHaveBeenCalledWith("app-created")
	})

	it("keeps the mobile prompt static", () => {
		render(
			<MicroAppCreatePrompt
				workspace={{ id: "workspace-1", name: "Micro Apps" } as never}
				onCreated={vi.fn()}
				mobile
			/>,
		)

		expect(mocks.editorContext?.placeholder).toBe("microAppsPage.heroPlaceholder")
		expect(mocks.editorContext?.promptCarousel).toBeUndefined()
		expect(mocks.editorContext?.showModeToggle).toBe(false)
		expect(mocks.editorContext?.showModelSelector).toBe(true)
		expect(mocks.editorContext?.containerClassName).toBeUndefined()
		expect(screen.getByTestId("mock-mobile-input-container")).toBeInTheDocument()
		expect(screen.queryByTestId("mock-editor-send-success")).not.toBeInTheDocument()
		expect(screen.queryByTestId("micro-apps-keyboard-port")).not.toBeInTheDocument()
	})

	it("hides the keyboard port when the title has no cable anchor", () => {
		render(
			<MicroAppCreatePrompt
				workspace={{ id: "workspace-1", name: "Micro Apps" } as never}
				onCreated={vi.fn()}
				keyboardConnectorVisible={false}
			/>,
		)

		expect(screen.queryByTestId("micro-apps-keyboard-port")).not.toBeInTheDocument()
	})
})
