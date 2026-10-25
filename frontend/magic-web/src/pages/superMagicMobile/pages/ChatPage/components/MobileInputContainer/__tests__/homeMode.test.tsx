import type { ReactNode } from "react"
import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import type { SceneEditorContext } from "@/pages/superMagic/components/MainInputContainer/components/editors/types"
import { TopicMode } from "@/pages/superMagic/pages/Workspace/TopicMode"
import MobileInputContainer from "../index"

vi.mock("@/services/superMagic/SuperMagicModeService", () => ({
	default: { getModeConfigWithLegacy: () => undefined },
}))
vi.mock("@/pages/superMagic/components/MainInputContainer/stores", () => ({
	sceneStateStore: { currentScene: null },
	useOptionalSceneStateStore: () => null,
	SceneStateProvider: ({ children }: { children: ReactNode }) => children,
}))
vi.mock("../../mobile-composer/useMobileEditorType", () => ({
	default: () => ({ isRecordSummaryEditor: true }),
}))
vi.mock("../../mobile-composer/MobileComposer", () => ({
	default: () => <div data-testid="composer" />,
}))
vi.mock("../../record-summary/MobileRecordSummaryRoute", () => ({
	default: () => <div data-testid="recording-route" />,
}))

const context: SceneEditorContext = {
	selectedTopic: null,
	selectedProject: null,
	topicMode: TopicMode.RecordSummary,
}
describe("mobile home editor routing", () => {
	it("uses the shared recording expert on the task homepage", () => {
		render(
			<MobileInputContainer
				editorContext={{
					...context,
					deferProjectCreationUntilSend: true,
					showModeToggle: true,
				}}
			/>,
		)
		expect(screen.getByTestId("recording-route")).toBeInTheDocument()
		expect(screen.queryByTestId("composer")).toBeNull()
	})
	it("keeps the send-first composer when the homepage cannot switch employees", () => {
		render(
			<MobileInputContainer
				editorContext={{ ...context, deferProjectCreationUntilSend: true }}
			/>,
		)
		expect(screen.getAllByTestId("composer")).toHaveLength(1)
		expect(screen.queryByTestId("recording-route")).toBeNull()
	})
	it("preserves the recording editor for existing detail pages", () => {
		render(<MobileInputContainer editorContext={context} />)
		expect(screen.getByTestId("recording-route")).toBeInTheDocument()
		expect(screen.queryByTestId("composer")).toBeNull()
	})
})
