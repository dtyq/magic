import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import StepDetailPanel from "./index"

const { crewEditStep, mockStore, sceneEditMountSpy } = vi.hoisted(() => ({
	crewEditStep: {
		Identity: "Identity",
		Playbook: "Playbook",
		Skills: "Skills",
		BuiltinSkills: "BuiltinSkills",
		KnowledgeBase: "KnowledgeBase",
		RunAndDebug: "RunAndDebug",
		Publishing: "Publishing",
	} as const,
	mockStore: {
		layout: {
			activeDetailKey: "Playbook",
			activePlaybookId: "scene-1",
			closePlaybook: vi.fn(),
			closePlaybookEditor: vi.fn(),
		},
	},
	sceneEditMountSpy: vi.fn(),
}))

vi.mock("mobx-react-lite", () => ({
	observer: <T,>(component: T) => component,
}))

vi.mock("../../store", () => ({
	CREW_EDIT_STEP: crewEditStep,
	isCrewStepEnabled: () => true,
}))

vi.mock("../../context", () => ({
	useCrewEditStore: () => mockStore,
}))

vi.mock("./IdentityPanel", () => ({
	default: () => <div data-testid="identity-panel" />,
}))

vi.mock("./IdentityPanel/constants", () => ({
	CREW_PANEL_IDS: {
		promptPanelContainer: "prompt-panel-container",
	},
}))

vi.mock("./PublishingPanel", () => ({
	default: () => <div data-testid="publishing-panel" />,
}))

vi.mock("./SkillsPanel", () => ({
	default: () => <div data-testid="skills-panel" />,
}))

vi.mock("../ConfigStepsPanel/BuiltinSkillsPanel", () => ({
	default: () => <div data-testid="builtin-skills-panel" />,
}))

vi.mock("./PlaybookPanel/components/SceneEditPanel", async () => {
	const React = await import("react")

	return {
		SceneEditPanel: ({ playbookId, onClose }: { playbookId: string; onClose: () => void }) => {
			React.useEffect(() => {
				sceneEditMountSpy(playbookId)
			}, [])

			return (
				<div data-testid="scene-edit-panel">
					<span>{playbookId}</span>
					<button type="button" onClick={onClose} data-testid="scene-edit-close-button" />
				</div>
			)
		},
	}
})

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => key,
	}),
}))

vi.mock("./IdentityPanel/identity-panel-bg.svg", () => ({
	default: "identity-panel-bg.svg",
}))

describe("StepDetailPanel", () => {
	it("remounts scene editor when active playbook changes", () => {
		const { rerender } = render(<StepDetailPanel />)

		expect(screen.getByTestId("scene-edit-panel")).toHaveTextContent("scene-1")
		expect(sceneEditMountSpy).toHaveBeenCalledTimes(1)
		expect(sceneEditMountSpy).toHaveBeenLastCalledWith("scene-1")

		mockStore.layout.activePlaybookId = "scene-2"
		rerender(<StepDetailPanel />)

		expect(screen.getByTestId("scene-edit-panel")).toHaveTextContent("scene-2")
		expect(sceneEditMountSpy).toHaveBeenCalledTimes(2)
		expect(sceneEditMountSpy).toHaveBeenLastCalledWith("scene-2")
	})

	it("closes the editor without collapsing the playbook section", () => {
		render(<StepDetailPanel />)

		fireEvent.click(screen.getByTestId("scene-edit-close-button"))

		expect(mockStore.layout.closePlaybookEditor).toHaveBeenCalledTimes(1)
		expect(mockStore.layout.closePlaybook).not.toHaveBeenCalled()
	})
})
