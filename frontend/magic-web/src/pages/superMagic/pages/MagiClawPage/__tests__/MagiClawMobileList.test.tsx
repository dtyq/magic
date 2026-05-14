import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { MagiClawMobileList } from "../MagiClawMobileList"

vi.mock("react-i18next", async (importOriginal) => {
	const actual = await importOriginal<typeof import("react-i18next")>()
	return {
		...actual,
		useTranslation: () => ({
			t: (key: string) => key,
		}),
	}
})

vi.mock("../components/DefaultMagiClawAvatar", () => ({
	DefaultMagiClawAvatar: function MockDefaultMagiClawAvatar() {
		return <span data-testid="default-magi-claw-avatar" />
	},
}))

vi.mock("../MagiClawMobileListItem", () => ({
	MagiClawMobileListItem: function MockMagiClawMobileListItem() {
		return <div data-testid="magi-claw-mobile-list-item" />
	},
	resolveMagiClawMobileDisplayName: () => "Mock Claw",
}))

vi.mock("../useMagiClawMobilePage", () => ({
	getMagiClawRowId: () => "mock-claw",
}))

describe("MagiClawMobileList", () => {
	it("shows no-permission label and disables empty create CTA", () => {
		const onOpenCreate = vi.fn()

		render(
			<MagiClawMobileList
				claws={[]}
				clawBrandValues={{}}
				t={(key: string) => key}
				visibleListLoading={false}
				activeActionClawCode={null}
				dismissedUpgradeBadgeByClawKey={{}}
				getDisplayedClawStatus={() => "running"}
				canCreateMagicClaw={false}
				createButtonLabel="superLobster.created.noCreatePermission"
				onOpenCreate={onOpenCreate}
				onRetry={vi.fn()}
				onOpenMenu={vi.fn()}
				onOpenChat={vi.fn()}
				onUpgradeClaw={vi.fn()}
			/>,
		)

		const createButton = screen.getByTestId("magi-claw-mobile-create-cta")
		expect(createButton).toBeDisabled()
		expect(createButton).toHaveTextContent("superLobster.created.noCreatePermission")

		fireEvent.click(createButton)

		expect(onOpenCreate).not.toHaveBeenCalled()
	})
})
