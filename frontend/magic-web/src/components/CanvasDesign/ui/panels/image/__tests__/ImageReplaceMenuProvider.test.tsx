import { act, fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { ImageReplaceMenuProvider } from "../ImageReplaceMenuProvider"

const mocks = vi.hoisted(() => ({
	eventHandler: undefined as
		| ((event: {
				data: {
					elementId: string
					contentId: string | null
					clientX?: number
					clientY?: number
				}
		  }) => void)
		| undefined,
	canvas: undefined as
		| {
				can: ReturnType<typeof vi.fn>
				container: HTMLDivElement
				imageReplaceController: {
					openLocalFilePicker: ReturnType<typeof vi.fn>
					replaceWithProjectFile: ReturnType<typeof vi.fn>
				}
		  }
		| undefined,
}))

vi.mock("../../../../app/hooks/canvas", () => ({
	useCanvasEvent: (
		_event: string,
		handler: (event: {
			data: {
				elementId: string
				contentId: string | null
				clientX?: number
				clientY?: number
			}
		}) => void,
	) => {
		mocks.eventHandler = handler
	},
}))

vi.mock("../../../../app/providers/CanvasProvider", () => ({
	useCanvas: () => ({ canvas: mocks.canvas }),
}))

vi.mock("../../../editors/message/reference-assets/ReferenceResourcePopover", () => ({
	default: (props: {
		referenceResourceType: string
		sourceOptions?: Array<{ value: string; label: string }>
		onSelectSource: (source: string) => void
		onProjectSelect: (
			item: { data: { file_path: string; file_name: string } },
			context: { reset: () => void },
		) => void
	}) => {
		const sourceOptions = props.sourceOptions ?? [
			{ value: "local-upload", label: "从本地上传" },
			{ value: "project-select", label: "从项目选择" },
		]
		return (
			<div
				data-testid="image-replace-popover"
				data-resource-type={props.referenceResourceType}
			>
				{sourceOptions.map((option) => (
					<button
						key={option.value}
						type="button"
						onClick={() => props.onSelectSource(option.value)}
					>
						{option.label}
					</button>
				))}
				<button
					type="button"
					onClick={() =>
						props.onProjectSelect(
							{
								data: {
									file_path: "/images/project.png",
									file_name: "project.png",
								},
							},
							{ reset: vi.fn() },
						)
					}
				>
					select-project-file
				</button>
			</div>
		)
	},
}))

describe("ImageReplaceMenuProvider", () => {
	beforeEach(() => {
		const container = document.createElement("div")
		vi.spyOn(container, "getBoundingClientRect").mockReturnValue({
			x: 10,
			y: 20,
			left: 10,
			top: 20,
			right: 1010,
			bottom: 820,
			width: 1000,
			height: 800,
			toJSON: () => ({}),
		})
		mocks.canvas = {
			can: vi.fn(() => true),
			permissionManager: { can: vi.fn(() => true) },
			container,
			imageReplaceController: {
				openLocalFilePicker: vi.fn(),
				replaceWithProjectFile: vi.fn(async () => true),
			},
		}
		mocks.eventHandler = undefined
	})

	it("opens at the toolbar click point and routes both image sources", () => {
		render(
			<ImageReplaceMenuProvider>
				<div>canvas</div>
			</ImageReplaceMenuProvider>,
		)

		act(() => {
			mocks.eventHandler?.({
				data: {
					elementId: "image-1",
					contentId: "version-1",
					clientX: 110,
					clientY: 220,
				},
			})
		})

		const popover = screen.getByTestId("image-replace-popover")
		expect(popover.parentElement).toHaveStyle({ left: "100px", top: "200px" })
		expect(popover).toHaveAttribute("data-resource-type", "image")

		fireEvent.click(screen.getByRole("button", { name: "从本地上传" }))
		expect(mocks.canvas?.imageReplaceController.openLocalFilePicker).toHaveBeenCalledWith(
			"image-1",
			"version-1",
		)

		act(() => {
			mocks.eventHandler?.({
				data: {
					elementId: "image-2",
					contentId: null,
					clientX: 210,
					clientY: 320,
				},
			})
		})
		fireEvent.click(screen.getByRole("button", { name: "select-project-file" }))
		expect(mocks.canvas?.imageReplaceController.replaceWithProjectFile).toHaveBeenCalledWith(
			"image-2",
			"/images/project.png",
			null,
		)
	})
})
