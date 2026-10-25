import { render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const sceneConfigState = vi.hoisted(() => ({
	panels: [] as Array<Record<string, unknown>>,
	isLoading: false,
}))

vi.mock("@/pages/superMagic/components/MainInputContainer/hooks/useCurrentSceneConfig", () => ({
	useCurrentSceneConfig: () => sceneConfigState,
}))

vi.mock("@/pages/superMagic/components/MainInputContainer/components/ScenePanelContainer", () => ({
	default: () => <div data-testid="scene-panel-container" />,
}))

import MobileScenePanels from "../MobileScenePanels"

describe("MobileScenePanels", () => {
	beforeEach(() => {
		sceneConfigState.panels = []
		sceneConfigState.isLoading = false
	})

	it("does not render a wrapper when no scene panels are available", () => {
		render(<MobileScenePanels editorContext={{} as never} />)

		expect(screen.queryByTestId("mobile-scene-panels")).not.toBeInTheDocument()
	})

	it("does not render unsupported panel types after loading completes", () => {
		sceneConfigState.panels = [{ type: "guide" }]

		render(<MobileScenePanels editorContext={{} as never} />)

		expect(screen.queryByTestId("mobile-scene-panels")).not.toBeInTheDocument()
	})

	it("does not render FIELD panels without visible options", () => {
		sceneConfigState.panels = [{ type: "field", field: { items: [] } }]

		render(<MobileScenePanels editorContext={{} as never} />)

		expect(screen.queryByTestId("mobile-scene-panels")).not.toBeInTheDocument()
	})

	it("renders FIELD panels", () => {
		sceneConfigState.panels = [
			{
				type: "field",
				field: {
					items: [
						{
							data_key: "mock-option",
							label: "Mock option",
							options: [{ value: "mock-value" }],
						},
					],
				},
			},
		]

		render(<MobileScenePanels editorContext={{} as never} />)

		expect(screen.getByTestId("mobile-scene-panels")).toBeInTheDocument()
		expect(screen.getByTestId("scene-panel-container")).toBeInTheDocument()
	})

	it("keeps slide template panels mounted while runtime options load", () => {
		sceneConfigState.panels = [
			{
				type: "field",
				field: {
					view_type: "slides_preset",
					items: [
						{
							data_key: "mock-template",
							label: "Mock template",
							option_view_type: "grid",
							options: [],
						},
					],
				},
			},
		]

		render(<MobileScenePanels editorContext={{} as never} />)

		expect(screen.getByTestId("mobile-scene-panels")).toBeInTheDocument()
		expect(screen.getByTestId("scene-panel-container")).toBeInTheDocument()
	})

	it("keeps the panel container while loading", () => {
		sceneConfigState.isLoading = true

		render(<MobileScenePanels editorContext={{} as never} />)

		expect(screen.getByTestId("mobile-scene-panels")).toBeInTheDocument()
		expect(screen.getByTestId("scene-panel-container")).toBeInTheDocument()
	})
})
