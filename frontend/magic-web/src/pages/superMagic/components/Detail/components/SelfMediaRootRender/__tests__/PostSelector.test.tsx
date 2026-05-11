import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import PostSelector from "../components/PostSelector"

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string, params?: { index?: number }) =>
			key === "detail.selfMedia.common.postFallbackTitle" && params?.index
				? `Post ${params.index}`
				: key,
	}),
}))

describe("PostSelector", () => {
	it("uses content-fit trigger width and truncates the selected label", () => {
		render(
			<PostSelector
				posts={[
					{
						meta: {
							id: "post-1",
							title: "This is a very long post title that should truncate in the selector trigger",
						},
						cards: [],
					},
				]}
				activeIndex={0}
				onChange={vi.fn()}
				className="flex-1"
			/>,
		)

		const selector = screen.getByTestId("self-media-post-selector")
		const value = screen.getByTestId("self-media-post-selector-value")
		const trigger = selector.querySelector("[data-slot='select-trigger']") as HTMLElement | null

		expect(trigger).toBeTruthy()
		expect(trigger?.classList.contains("w-full")).toBe(false)
		expect(trigger?.classList.contains("w-fit")).toBe(true)
		expect(trigger?.classList.contains("max-w-full")).toBe(true)

		expect(value).toBeTruthy()
		expect(value?.classList.contains("truncate")).toBe(true)
		expect(value?.classList.contains("min-w-0")).toBe(true)
	})
})
