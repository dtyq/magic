import { act, fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { AudioReplaceMenuProvider } from "../AudioReplaceMenuProvider"

const mocks = vi.hoisted(() => ({
	eventHandler: undefined as
		| ((event: { data: { elementId: string; clientX?: number; clientY?: number } }) => void)
		| undefined,
	canvas: undefined as
		| {
				can: ReturnType<typeof vi.fn>
				container: HTMLDivElement
				audioReplaceController: {
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
			data: { elementId: string; clientX?: number; clientY?: number }
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
		sourceOptions?: Array<{ value: string; label: string }>
		contentClassName?: string
		sourceActionClassName?: string
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
				data-testid="audio-replace-popover"
				data-source-style={props.sourceOptions ? "custom" : "default"}
				data-content-style={props.contentClassName ? "custom" : "default"}
				data-action-style={props.sourceActionClassName ? "custom" : "default"}
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
									file_path: "/audios/project.mp3",
									file_name: "project.mp3",
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

describe("AudioReplaceMenuProvider", () => {
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
			audioReplaceController: {
				openLocalFilePicker: vi.fn(),
				replaceWithProjectFile: vi.fn(async () => true),
			},
		}
		mocks.eventHandler = undefined
	})

	it("opens at the corner-action point and routes both replacement sources", () => {
		render(
			<AudioReplaceMenuProvider>
				<div>canvas</div>
			</AudioReplaceMenuProvider>,
		)

		act(() => {
			mocks.eventHandler?.({
				data: { elementId: "audio-1", clientX: 110, clientY: 220 },
			})
		})

		const popover = screen.getByTestId("audio-replace-popover")
		expect(popover.parentElement).toHaveStyle({ left: "100px", top: "200px" })
		expect(popover).toHaveAttribute("data-source-style", "default")
		expect(popover).toHaveAttribute("data-content-style", "default")
		expect(popover).toHaveAttribute("data-action-style", "default")
		expect(screen.getByRole("button", { name: "从本地上传" })).toBeInTheDocument()
		expect(screen.getByRole("button", { name: "从项目选择" })).toBeInTheDocument()

		fireEvent.click(screen.getByRole("button", { name: "从本地上传" }))
		expect(mocks.canvas?.audioReplaceController.openLocalFilePicker).toHaveBeenCalledWith(
			"audio-1",
		)

		act(() => {
			mocks.eventHandler?.({
				data: { elementId: "audio-2", clientX: 210, clientY: 320 },
			})
		})
		fireEvent.click(screen.getByRole("button", { name: "select-project-file" }))
		expect(mocks.canvas?.audioReplaceController.replaceWithProjectFile).toHaveBeenCalledWith(
			"audio-2",
			"/audios/project.mp3",
		)
	})
})
