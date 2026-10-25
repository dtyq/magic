import { act, render, screen } from "@testing-library/react"
import { useEffect } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { HtmlPreviewRendererProps } from "../HtmlPreviewRenderer"
import { HtmlCodeBlockDesktopPreview } from "../HtmlCodeBlockDesktopPreview"

vi.mock("../HtmlPreviewRenderer", () => ({
	HtmlPreviewRenderer: () => null,
}))

let emitMetrics: HtmlPreviewRendererProps["onMetrics"] | null = null

function MetricsPreviewRenderer(props: HtmlPreviewRendererProps) {
	const { onMetrics } = props

	useEffect(() => {
		emitMetrics = onMetrics
		return () => {
			emitMetrics = null
		}
	}, [onMetrics])

	return <div data-testid="html-code-block-preview-metrics-renderer" />
}

function renderPhonePreview(resolvedCode: string) {
	return render(
		<HtmlCodeBlockDesktopPreview
			resolvedCode={resolvedCode}
			isPreviewLoading={false}
			onPreviewRenderReady={() => undefined}
			previewLayout="phone"
			PreviewRendererComponent={MetricsPreviewRenderer}
		/>,
	)
}

function reportContentWidth(
	contentWidth: number,
	options: { hasVerticalOverflow?: boolean; verticalScrollbarWidth?: number } = {},
) {
	act(() => {
		emitMetrics?.({
			contentWidth,
			contentHeight: 900,
			phase: "initial",
			hasHorizontalOverflow: true,
			hasVerticalOverflow: options.hasVerticalOverflow,
			verticalScrollbarWidth: options.verticalScrollbarWidth,
		})
	})
}

describe("HtmlCodeBlockDesktopPreview", () => {
	afterEach(() => {
		emitMetrics = null
	})

	it("keeps the phone canvas at the source-derived width when runtime metrics grow", () => {
		renderPhonePreview('<div style="width: 1000px">content</div>')

		const canvas = screen.getByTestId("html-code-block-preview-canvas")
		expect(canvas).toHaveAttribute("data-preview-canvas-width", "1000")

		for (const contentWidth of [1300, 1690, 2197]) {
			reportContentWidth(contentWidth)
			expect(canvas).toHaveAttribute("data-preview-canvas-width", "1000")
		}
	})

	it("keeps max-width responsive instead of enlarging the phone canvas", () => {
		renderPhonePreview('<main style="width: 100%; max-width: 1000px">content</main>')

		const canvas = screen.getByTestId("html-code-block-preview-canvas")
		expect(canvas).toHaveAttribute("data-preview-canvas-width", "414")

		reportContentWidth(1300)
		expect(canvas).toHaveAttribute("data-preview-canvas-width", "414")
	})

	it("keeps scrollbar compensation without adopting runtime overflow width", () => {
		renderPhonePreview('<div style="width: 1000px">content</div>')

		const canvas = screen.getByTestId("html-code-block-preview-canvas")
		reportContentWidth(1300, {
			hasVerticalOverflow: true,
			verticalScrollbarWidth: 15,
		})
		expect(canvas).toHaveAttribute("data-preview-canvas-width", "1015")

		reportContentWidth(1690, {
			hasVerticalOverflow: true,
			verticalScrollbarWidth: 15,
		})
		expect(canvas).toHaveAttribute("data-preview-canvas-width", "1015")
	})

	it("uses the phone viewport fallback when the source has no intrinsic width", () => {
		renderPhonePreview("<div>content</div>")

		const canvas = screen.getByTestId("html-code-block-preview-canvas")
		expect(canvas).toHaveAttribute("data-preview-canvas-width", "414")

		reportContentWidth(1600)
		expect(canvas).toHaveAttribute("data-preview-canvas-width", "414")
	})
})
