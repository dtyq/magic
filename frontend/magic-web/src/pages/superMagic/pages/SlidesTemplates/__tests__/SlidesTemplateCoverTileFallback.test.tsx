import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import type { OptionItem } from "@/pages/superMagic/components/MainInputContainer/panels/types"
import type {
	TemplateColorExtractionRequest,
	TemplateColorExtractionResponse,
} from "../templateColorExtractionProtocol"

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		i18n: { language: "en_US" },
		t: (key: string) => key,
	}),
}))

class FakeWorker {
	static instance: FakeWorker | null = null

	onerror: ((event: ErrorEvent) => void) | null = null
	onmessage: ((event: MessageEvent<TemplateColorExtractionResponse>) => void) | null = null
	readonly requests: TemplateColorExtractionRequest[] = []

	constructor() {
		FakeWorker.instance = this
	}

	postMessage(request: TemplateColorExtractionRequest) {
		this.requests.push(request)
	}

	respond(colors: string[]) {
		const request = this.requests[this.requests.length - 1]
		if (!request) throw new Error("No template color request to resolve")
		this.onmessage?.({
			data: { colors, requestId: request.requestId },
		} as MessageEvent<TemplateColorExtractionResponse>)
	}

	terminate() {
		return undefined
	}
}

describe("SlidesTemplateCoverTile color fallback", () => {
	beforeAll(() => {
		vi.stubGlobal("Worker", FakeWorker)
	})

	afterAll(() => {
		vi.unstubAllGlobals()
	})

	it("extracts colors after hover without changing the original template", async () => {
		const { default: SlidesTemplateCoverTile } = await import("../SlidesTemplateCoverTile")
		const template: OptionItem = {
			label: "Fallback template",
			value: "fallback-template",
		}
		const onFindSimilarColors = vi.fn()

		render(
			<SlidesTemplateCoverTile
				canPreview={false}
				imageUrl="/fallback.png"
				isExpanded={false}
				isSelected={false}
				onFindSimilarColors={onFindSimilarColors}
				onPreviewClick={vi.fn()}
				onSelect={vi.fn()}
				template={template}
			/>,
		)

		expect(screen.queryByTestId("slides-template-color-palette")).not.toBeInTheDocument()
		fireEvent.pointerEnter(screen.getByTestId("slides-template-cover-tile"))

		await waitFor(() => expect(FakeWorker.instance?.requests).toHaveLength(1))
		act(() => {
			FakeWorker.instance?.respond(["#315ECA", "#7AA7FF", "#182A5A"])
		})

		const palette = await screen.findByTestId("slides-template-color-palette")
		fireEvent.click(palette)

		expect(onFindSimilarColors).toHaveBeenCalledWith({
			...template,
			colors: ["#315ECA", "#7AA7FF", "#182A5A"],
		})
		expect(template.colors).toBeUndefined()
	})

	it("keeps preview and select actions hidden until hover or focus", async () => {
		const { default: SlidesTemplateCoverTile } = await import("../SlidesTemplateCoverTile")

		render(
			<SlidesTemplateCoverTile
				canPreview
				imageUrl="/preview.png"
				isExpanded={false}
				isSelected={false}
				onPreviewClick={vi.fn()}
				onSelect={vi.fn()}
				template={{ label: "Preview template", value: "preview-template" }}
			/>,
		)

		const actions = screen.getByTestId("slides-template-cover-actions")
		expect(actions.parentElement).toHaveClass(
			"opacity-0",
			"group-hover:opacity-100",
			"group-focus-within:opacity-100",
		)
		expect(actions).toContainElement(screen.getByTestId("slides-template-cover-preview-button"))
		expect(actions).toContainElement(screen.getByTestId("slides-template-cover-select-button"))
	})

	it("opens the source project without selecting or previewing the template", async () => {
		const { default: SlidesTemplateCoverTile } = await import("../SlidesTemplateCoverTile")
		const template: OptionItem = {
			label: "Source template",
			value: "source-template",
			project: { id: "project-1", directory_id: "directory-1" },
		}
		const onOpenProject = vi.fn()
		const onPreviewClick = vi.fn()
		const onSelect = vi.fn()

		render(
			<SlidesTemplateCoverTile
				canPreview={false}
				isExpanded={false}
				isSelected={false}
				onOpenProject={onOpenProject}
				onPreviewClick={onPreviewClick}
				onSelect={onSelect}
				template={template}
			/>,
		)

		fireEvent.click(screen.getByTestId("slides-template-cover-open-project-button"))

		expect(onOpenProject).toHaveBeenCalledWith(template)
		expect(onPreviewClick).not.toHaveBeenCalled()
		expect(onSelect).not.toHaveBeenCalled()
	})

	it("toggles favorite without selecting or previewing the template", async () => {
		const { default: SlidesTemplateCoverTile } = await import("../SlidesTemplateCoverTile")
		const template = { label: "Favorite template", value: "favorite-template" }
		const onFavoriteToggle = vi.fn()
		const onPreviewClick = vi.fn()
		const onSelect = vi.fn()

		render(
			<SlidesTemplateCoverTile
				canPreview
				imageUrl="/favorite.png"
				isExpanded={false}
				isSelected={false}
				onFavoriteToggle={onFavoriteToggle}
				onPreviewClick={onPreviewClick}
				onSelect={onSelect}
				template={template}
			/>,
		)

		fireEvent.click(screen.getByTestId("slides-template-cover-favorite-button"))

		expect(onFavoriteToggle).toHaveBeenCalledWith(template)
		expect(onPreviewClick).not.toHaveBeenCalled()
		expect(onSelect).not.toHaveBeenCalled()

		fireEvent.keyDown(screen.getByTestId("slides-template-cover-favorite-button"), {
			key: "Enter",
		})
		expect(onPreviewClick).not.toHaveBeenCalled()
		expect(onSelect).not.toHaveBeenCalled()
	})
})
