import { act, render, screen, waitFor } from "@testing-library/react"
import { createRef } from "react"
import { describe, expect, it, vi } from "vitest"
import type { OptionItem } from "@/pages/superMagic/components/MainInputContainer/panels/types"
import { HomeOnboardingAnchor } from "@/pages/superMagic/components/LazyGuideTour/GuideTourManager"
import SlidesTemplateCanvas, { type SlidesTemplateCanvasHandle } from "../SlidesTemplateCanvas"

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		i18n: { language: "en_US" },
		t: (key: string) => key,
	}),
}))

const FEATURED_EVERY = 11

function createTemplate(index: number): OptionItem {
	const isFeatured = index % FEATURED_EVERY === 0
	return {
		value: `PPT-${index}`,
		label: `Template ${index}`,
		thumbnail_url: `https://example.com/${index}-cover.png`,
		preview_image_urls: [],
		...(isFeatured
			? {
					tags: [
						{
							code: "featured",
							id: `featured-${index}`,
							name_i18n: { en_US: "Featured", zh_CN: "精选" },
						},
					],
				}
			: {}),
	}
}

const templates = Array.from({ length: 120 }, (_, index) => createTemplate(index + 1))

const CANVAS_RECT = {
	bottom: 600,
	height: 600,
	left: 0,
	right: 800,
	top: 0,
	width: 800,
	x: 0,
	y: 0,
	toJSON: () => ({}),
}

function renderCanvas() {
	const canvasRef = createRef<SlidesTemplateCanvasHandle>()
	render(
		<SlidesTemplateCanvas
			ref={canvasRef}
			templates={templates}
			selectedTemplate={null}
			onTemplateSelect={vi.fn()}
			hasMore={false}
			isLoading={false}
			isLoadingMore={false}
			isRefreshing={false}
			onLoadMore={vi.fn()}
			resetKey="guide:"
		/>,
	)
	vi.spyOn(screen.getByTestId("slides-template-canvas"), "getBoundingClientRect").mockReturnValue(
		CANVAS_RECT,
	)
	return canvasRef
}

describe("SlidesTemplateCanvas guide focus", () => {
	it("publishes the anchor marker the tour measures for the featured card it centres", async () => {
		const canvasRef = renderCanvas()

		expect(screen.queryByTestId("slides-template-canvas-guide-anchor")).toBeNull()

		let focusedTemplate: OptionItem | null = null
		act(() => {
			focusedTemplate = canvasRef.current?.focusGuideFeaturedTemplate() ?? null
		})
		expect(focusedTemplate).not.toBeNull()

		await waitFor(
			() => {
				expect(
					document.querySelector(
						`[data-guide-anchor="${HomeOnboardingAnchor.SlidesTemplateFeaturedCard}"]`,
					),
				).not.toBeNull()
			},
			{ timeout: 3000 },
		)
	})

	it("keeps a run on the card its first card step settled on", () => {
		const canvasRef = renderCanvas()
		const settled: { template: OptionItem | null } = { template: null }

		act(() => {
			settled.template = canvasRef.current?.focusGuideFeaturedTemplate() ?? null
		})
		const firstCardStep = settled.template
		if (!firstCardStep) throw new Error("the run centred no card to point at")

		/*
		 * A run's second card step asks again for a card to frame once the first one is in place.
		 * It has to be answered with the card already centred: framing a second one would move the
		 * canvas between the two steps, which is the jump the run is meant to spare the user. Only
		 * the answered template is asserted — whether the move itself has finished is the canvas's
		 * business, and waiting on it here would tie this test to the animation clock.
		 */
		act(() => {
			settled.template = canvasRef.current?.focusGuideFeaturedTemplate() ?? null
		})
		const secondCardStep = settled.template
		if (!secondCardStep) throw new Error("the run centred no card to point at")

		/*
		 * The library here carries ten featured cards, so a canvas that moved on to "another one of
		 * them" would answer with a different value rather than the same one.
		 */
		expect(secondCardStep.value).toBe(firstCardStep.value)
	})
})
