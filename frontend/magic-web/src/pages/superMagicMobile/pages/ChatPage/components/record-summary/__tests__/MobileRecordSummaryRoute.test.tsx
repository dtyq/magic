import { render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { RecordingSummaryEditorMode } from "@/pages/superMagic/components/MessagePanel/const/recordSummary"
import { TopicMode } from "@/pages/superMagic/pages/Workspace/TopicMode"
import type { SceneEditorContext } from "@/pages/superMagic/components/MainInputContainer/components/editors/types"

const testState = vi.hoisted(() => ({
	savedEditorMode: "recording" as "recording" | "editing",
}))

/** Props the route hands to the composer header (the crew selector's data source). */
const headerProps = vi.hoisted(() => ({ current: null as Record<string, unknown> | null }))

vi.mock("@/pages/superMagic/components/MessagePanel/hooks/useRecordingSummaryEditorMode", () => ({
	default: () => ({
		editorMode: testState.savedEditorMode,
		setEditorMode: vi.fn(),
	}),
}))

vi.mock("@/pages/superMagic/components/MainInputContainer/hooks", () => ({
	useSceneSelection: () => ({ hasOnlyScene: false }),
}))

vi.mock("@/pages/superMagic/components/MainInputContainer/hooks/useCurrentSceneConfig", () => ({
	useCurrentSceneConfig: () => ({
		placeholder: undefined,
		panels: [],
		isLoading: false,
	}),
}))

vi.mock("@/pages/superMagic/components/MessageEditor/hooks/useResolvedEditorStore", () => ({
	default: () => ({ store: {} }),
}))

vi.mock("@/pages/superMagic/components/MessageEditor/stores", () => ({
	MessageEditorStoreProvider: ({ children }: { children: unknown }) => <>{children}</>,
}))

vi.mock("@/pages/superMagic/stores/core", () => ({
	projectStore: { selectedProject: null },
	topicStore: { selectedTopic: null },
}))

vi.mock("@/pages/superMagic/stores", () => ({
	roleStore: { currentRole: "summary" },
}))

vi.mock("@/services/superMagic/SuperMagicModeService", () => ({
	default: {
		getModeConfigWithLegacy: () => undefined,
	},
}))

vi.mock("../../mobile-composer/MobileComposer", () => ({
	default: () => <div data-testid="mobile-message-editor" />,
}))

vi.mock("../../mobile-composer/MobileComposerHeader", () => ({
	default: (props: Record<string, unknown>) => {
		headerProps.current = props
		return <div data-testid="mobile-composer-header" />
	},
}))

vi.mock("../../mobile-composer/MobileScenePanels", () => ({
	default: () => <div data-testid="mobile-scene-panels" />,
}))

vi.mock(
	"@/pages/superMagic/components/MainInputContainer/components/editors/RecordSummaryEditorContainer",
	() => ({
		default: () => <div data-testid="record-summary-editor-container" />,
	}),
)

import MobileRecordSummaryRoute from "../MobileRecordSummaryRoute"

/** Builds a minimal editor context for the mobile recording-summary route. */
function createEditorContext(overrides: Partial<SceneEditorContext> = {}): SceneEditorContext {
	return {
		selectedTopic: null,
		selectedProject: { id: "mock-project-001" } as never,
		topicMode: TopicMode.RecordSummary,
		...overrides,
	}
}

describe("MobileRecordSummaryRoute", () => {
	beforeEach(() => {
		testState.savedEditorMode = RecordingSummaryEditorMode.Recording
		headerProps.current = null
	})

	it("keeps the employee switcher when recording mode is disabled", () => {
		render(
			<MobileRecordSummaryRoute
				editorContext={createEditorContext({ allowRecordingMode: false })}
			/>,
		)

		// Detail pages still use the recording chrome so the crew header stays available.
		expect(screen.getByTestId("mobile-record-summary-route")).toBeInTheDocument()
		expect(screen.getByTestId("mobile-composer-header")).toBeInTheDocument()
		expect(screen.queryByTestId("mobile-record-summary-route-editing")).not.toBeInTheDocument()
		expect(screen.getByTestId("record-summary-editor-container")).toBeInTheDocument()
	})

	it("keeps the recording route when recording mode stays allowed", () => {
		render(<MobileRecordSummaryRoute editorContext={createEditorContext()} />)

		expect(screen.getByTestId("mobile-record-summary-route")).toBeInTheDocument()
		expect(screen.queryByTestId("mobile-record-summary-route-editing")).not.toBeInTheDocument()
		expect(screen.getByTestId("record-summary-editor-container")).toBeInTheDocument()
	})

	it("keeps the employee switcher when the summary editor is in editing mode", () => {
		testState.savedEditorMode = RecordingSummaryEditorMode.Editing

		render(
			<MobileRecordSummaryRoute editorContext={createEditorContext({ messagesLength: 2 })} />,
		)

		// The header selector is the only driver of the composer's topic model store, so the
		// editing branch must keep rendering it or sending fails with "please select a model".
		expect(screen.getByTestId("mobile-record-summary-route-editing")).toBeInTheDocument()
		expect(screen.getByTestId("mobile-composer-header")).toBeInTheDocument()
		expect(screen.getByTestId("mobile-message-editor")).toBeInTheDocument()
		expect(screen.queryByTestId("mobile-record-summary-route")).not.toBeInTheDocument()
		expect(screen.queryByTestId("record-summary-editor-container")).not.toBeInTheDocument()
	})

	it("forwards the message count that keeps a non-empty topic on its own crew", () => {
		testState.savedEditorMode = RecordingSummaryEditorMode.Editing

		render(
			<MobileRecordSummaryRoute editorContext={createEditorContext({ messagesLength: 2 })} />,
		)

		// Desktop ModeToggle stops switching crews once the topic has messages and asks for a new
		// topic instead; the mobile selector applies the same rule from messagesLength, so dropping
		// this prop would let a summary topic be handed over to an unrelated crew in place.
		expect(headerProps.current?.messagesLength).toBe(2)
	})
})
