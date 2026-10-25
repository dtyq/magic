import { render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { TopicMode } from "@/pages/superMagic/pages/Workspace/TopicMode"
import { RecordingSummaryEditorMode } from "@/pages/superMagic/components/MessagePanel/const/recordSummary"
import type { SceneEditorContext } from "../types"
import type { RecordSummaryEditorPanelProps } from "@/components/business/RecordingSummary/EditorPanel"

const testState = vi.hoisted(() => ({
	setEditorMode: vi.fn(),
	audioFileHook: vi.fn(),
	defaultEditorContext: null as SceneEditorContext | null,
	recordingPanelProps: null as RecordSummaryEditorPanelProps | null,
}))

vi.mock("@/hooks/useIsMobile", () => ({
	useIsMobile: () => false,
}))

vi.mock("@/pages/superMagic/stores/core", () => ({
	projectStore: { selectedProject: null },
	topicStore: { selectedTopic: null },
	workspaceStore: { selectedWorkspace: null, firstWorkspace: null },
}))

vi.mock("@/pages/superMagic/stores", () => ({
	roleStore: {
		setCurrentRole: vi.fn(),
	},
}))

vi.mock("@/pages/superMagic/hooks/useSharedProjectMode", () => ({
	default: vi.fn(),
}))

vi.mock("@/pages/superMagic/components/MessagePanel/hooks/useRecordingSummaryEditorMode", () => ({
	default: () => ({
		editorMode: "recording",
		setEditorMode: testState.setEditorMode,
	}),
}))

vi.mock("@/pages/superMagic/components/MessagePanel/hooks/useRecordSummaryAudioFile", () => ({
	default: (params: unknown) => testState.audioFileHook(params),
}))

vi.mock("@/pages/superMagic/components/ConversationInputResize/context", () => ({
	useConversationInputLayout: () => ({ fillHeight: true }),
}))

vi.mock("@/components/business/RecordingSummary/components/EditorModeSwitch", () => ({
	default: () => <div data-testid="recording-mode-switch" />,
}))

vi.mock("@/components/business/RecordingSummary/EditorPanel", () => ({
	default: (props: RecordSummaryEditorPanelProps) => {
		testState.recordingPanelProps = props
		return <div data-testid="recording-editor-panel" />
	},
}))

vi.mock("../DefaultMessageEditorContainer", () => ({
	default: ({ editorContext }: { editorContext: SceneEditorContext }) => {
		testState.defaultEditorContext = editorContext
		return <div data-testid="default-message-editor" />
	},
}))

vi.mock(
	"@/pages/superMagicMobile/pages/ChatPage/components/mobile-composer/MobileComposer",
	() => ({
		default: () => <div data-testid="mobile-message-editor" />,
	}),
)

import RecordSummaryEditorContainer from "../RecordSummaryEditorContainer"

/** Creates a synthetic editor context for recording-summary behavior tests. */
function createEditorContext(overrides: Partial<SceneEditorContext> = {}): SceneEditorContext {
	return {
		selectedTopic: { id: "mock-topic-001" } as never,
		selectedProject: { id: "mock-project-001" } as never,
		selectedWorkspace: { id: "mock-workspace-001" } as never,
		topicMode: TopicMode.RecordSummary,
		...overrides,
	}
}

describe("RecordSummaryEditorContainer", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		testState.defaultEditorContext = null
		testState.recordingPanelProps = null
	})

	it("forces detail conversations into editing mode and hides the recording switch", () => {
		render(
			<RecordSummaryEditorContainer
				editorContext={createEditorContext({ allowRecordingMode: false })}
			/>,
		)

		expect(screen.getByTestId("default-message-editor")).toBeInTheDocument()
		expect(screen.queryByTestId("recording-editor-panel")).not.toBeInTheDocument()
		expect(testState.defaultEditorContext?.editorModeSwitch).toBeUndefined()
		expect(testState.audioFileHook).toHaveBeenCalledWith(
			expect.objectContaining({ editorMode: RecordingSummaryEditorMode.Editing }),
		)
	})

	it("keeps the persisted recording mode available for normal recording pages", () => {
		render(<RecordSummaryEditorContainer editorContext={createEditorContext()} />)

		expect(screen.getByTestId("recording-editor-panel")).toBeInTheDocument()
		expect(screen.queryByTestId("default-message-editor")).not.toBeInTheDocument()
		expect(testState.audioFileHook).toHaveBeenCalledWith(
			expect.objectContaining({ editorMode: RecordingSummaryEditorMode.Recording }),
		)
		expect(testState.recordingPanelProps?.fillHeight).toBe(true)
		expect(screen.getByTestId("recording-editor-panel").parentElement).toHaveClass(
			"flex",
			"h-full",
			"min-h-0",
			"w-full",
			"flex-col",
		)
	})
})
