import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { ElementToolTypeEnum } from "../../../../../public/props"
import { ElementToolResolutionProvider } from "../../../model/ElementToolResolutionContext"
import ImageRemoveBackgroundButton from "."

vi.mock("../../../../../app/providers/CanvasProvider", () => ({
	useCanvas: () => ({ canvas: undefined }),
}))

vi.mock("../../../../../app/providers/CanvasUIProvider", () => ({
	useCanvasUI: () => ({ selectedElements: [] }),
}))

vi.mock("../../../../../app/providers/MagicProvider", () => ({
	useMagic: () => ({ methods: undefined }),
}))

vi.mock("../../../../../app/providers/I18nProvider", () => ({
	useCanvasDesignI18n: () => ({
		t: (_key: string, fallback: string) => fallback,
	}),
}))

describe("ImageRemoveBackgroundButton", () => {
	it("loads its Content tool command identity at render time", () => {
		render(
			<ElementToolResolutionProvider
				tool={
					{
						id: ElementToolTypeEnum.ContentRemoveBackground,
						execution: "command",
						surface: "top",
						visibility: "visible",
						presentation: {
							renderKind: "top-action",
							group: "image-edit",
							order: 22,
						},
						target: { elementId: "image-1", contentId: "content-a" },
						execute: vi.fn(),
					} as never
				}
			>
				<ImageRemoveBackgroundButton />
			</ElementToolResolutionProvider>,
		)

		expect(screen.getByText("去背景")).toBeInTheDocument()
	})
})
