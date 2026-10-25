import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import MobileComposerHeader from "../MobileComposerHeader"

vi.mock("@/pages/superMagic/components/MainInputContainer/stores", () => ({
	useOptionalSceneStateStore: () => null,
	sceneStateStore: {
		currentScene: null,
		setCurrentScene: vi.fn(),
	},
}))

vi.mock("@/pages/superMagic/components/MainInputContainer/components/SelectedSkillBadge", () => ({
	default: () => <div data-testid="selected-scene" />,
}))

vi.mock("@/pages/superMagic/components/MainInputContainer/components/SceneSwitcher", () => ({
	default: () => <div data-testid="scene-switcher" />,
}))

vi.mock("../MobileComposerModeSelector", () => ({
	default: ({
		selectorVariant,
		messagesLength,
	}: {
		selectorVariant?: string
		messagesLength?: number
	}) => (
		<div
			data-testid="mobile-mode-selector"
			data-selector-variant={selectorVariant}
			data-messages-length={messagesLength === undefined ? "unset" : String(messagesLength)}
		/>
	),
}))

describe("MobileComposerHeader", () => {
	it("shows the default mobile mode selector", () => {
		render(<MobileComposerHeader />)

		expect(screen.getByTestId("mobile-mode-selector")).toBeInTheDocument()
	})

	it("hides only the mode selector while preserving scene controls", () => {
		render(
			<MobileComposerHeader showModeSelector={false} scenes={[{ id: "scene-1" }] as never} />,
		)

		expect(screen.queryByTestId("mobile-mode-selector")).toBeNull()
		expect(screen.getByTestId("scene-switcher")).toBeInTheDocument()
	})

	it("can show the model selector without the employee selector", () => {
		render(<MobileComposerHeader showModeSelector={false} showModelSelector />)

		expect(screen.getByTestId("mobile-mode-selector")).toHaveAttribute(
			"data-selector-variant",
			"claw",
		)
	})

	it("passes the topic message count down to the employee selector", () => {
		render(<MobileComposerHeader messagesLength={2} />)

		// The selector turns this into its allowChangeMode rule, so it must not be swallowed here.
		expect(screen.getByTestId("mobile-mode-selector")).toHaveAttribute(
			"data-messages-length",
			"2",
		)
	})
})
