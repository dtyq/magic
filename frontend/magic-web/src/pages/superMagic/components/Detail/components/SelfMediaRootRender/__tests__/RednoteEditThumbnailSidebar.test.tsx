import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => key,
	}),
	initReactI18next: {
		type: "3rdParty",
		init: () => undefined,
	},
}))

vi.mock("../components/CardFrame", () => ({
	__esModule: true,
	default: ({ cardId }: { cardId: string }) => (
		<div data-testid="mock-card-frame" data-card-id={cardId} />
	),
}))

import { RednoteEditThumbnailSidebar } from "../platforms/rednote/RednoteEditThumbnailSidebar"

describe("RednoteEditThumbnailSidebar", () => {
	it("triggers card refresh from the inline refresh control", () => {
		const onRefreshCard = vi.fn()
		const onSelectCard = vi.fn()

		render(
			<RednoteEditThumbnailSidebar
				post={{
					meta: {
						id: "post-1",
						title: "Post 1",
						author: "@magic",
					},
					cards: [
						{ path: "cards/01.html", fileId: "card-1" },
						{ path: "cards/02.html", fileId: "card-2" },
					],
				}}
				activeCardIndex={0}
				attachmentList={[]}
				postRefreshVersion={0}
				cardRefreshVersions={{}}
				onSelectCard={onSelectCard}
				onRefreshCard={onRefreshCard}
			/>,
		)

		fireEvent.click(screen.getByTestId("red-edit-card-refresh-0"))

		expect(onRefreshCard).toHaveBeenCalledWith(0)
	})

	it("renders cache-busting card ids from refresh versions", () => {
		render(
			<RednoteEditThumbnailSidebar
				post={{
					meta: {
						id: "post-1",
						title: "Post 1",
						author: "@magic",
					},
					cards: [{ path: "cards/01.html", fileId: "card-1" }],
				}}
				activeCardIndex={0}
				attachmentList={[]}
				postRefreshVersion={2}
				cardRefreshVersions={{ 0: 3 }}
				onSelectCard={vi.fn()}
				onRefreshCard={vi.fn()}
			/>,
		)

		expect(screen.getByTestId("mock-card-frame")).toHaveAttribute(
			"data-card-id",
			"edit-thumb-post-1-0-2-3",
		)
	})
})
