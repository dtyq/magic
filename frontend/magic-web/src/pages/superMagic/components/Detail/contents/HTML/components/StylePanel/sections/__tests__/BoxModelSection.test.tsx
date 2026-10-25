import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import type { ChangeEvent, ComponentProps, InputHTMLAttributes, ReactNode } from "react"
import { describe, expect, it, vi } from "vitest"
import BoxModelSection from "../BoxModelSection"

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => key,
	}),
}))

vi.mock("../../controls", () => ({
	DimensionInput: ({ label, value, id }: { label: string; value: string; id?: string }) => (
		<label>
			{label}
			<input id={id} value={value} readOnly />
		</label>
	),
	NumericDragInput: ({
		value,
		onChange,
		onCommit,
		hideStepper,
		...props
	}: Omit<InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> & {
		value: string | number
		onChange: (value: string) => void
		onCommit?: (value: string) => void
		hideStepper?: boolean
	}) => (
		<input
			{...props}
			data-hide-stepper={hideStepper}
			value={value}
			onChange={(event: ChangeEvent<HTMLInputElement>) => onChange(event.target.value)}
			onBlur={(event) => onCommit?.(event.currentTarget.value)}
		/>
	),
}))

function createSelectedElement(
	width = "1920px",
	height = "1080px",
): ComponentProps<typeof BoxModelSection>["selectedElement"] {
	return {
		selector: ".slide",
		tagName: "div",
		computedStyles: {
			width,
			height,
			margin: "0px",
			padding: "0px",
			borderWidth: "0px",
		},
	} as never
}

function renderSection(ui: ReactNode) {
	return render(ui)
}

function createDeferred<T = void>() {
	let resolve!: (value: T | PromiseLike<T>) => void
	let reject!: (error: unknown) => void
	const promise = new Promise<T>((res, rej) => {
		resolve = res
		reject = rej
	})
	return { promise, resolve, reject }
}

describe("BoxModelSection", () => {
	it("centers used-pixel dimensions in the content box", () => {
		renderSection(
			<BoxModelSection
				selectedElement={createSelectedElement()}
				editorRef={{ current: null }}
			/>,
		)

		const content = screen.getByTestId("html-style-panel-box-model-content")
		expect(content.textContent).toContain("1920px")
		expect(content.textContent).toContain("1080px")
		expect(content.className).toContain("items-center")
		expect(content.className).toContain("justify-center")
		expect(content.className).toContain("w-full")
	})

	it("keeps box-model edge fields inside their grid rows", () => {
		renderSection(
			<BoxModelSection
				selectedElement={createSelectedElement()}
				editorRef={{ current: null }}
			/>,
		)

		const edge = screen.getByTestId("box-model-edge-margin-top")
		expect(edge.closest(".grid")?.className).toContain(
			"grid-rows-[1.25rem_minmax(2rem,auto)_1.25rem]",
		)
		expect(edge.className).toContain("h-5")
		expect(edge.className).toContain("ring-0")
	})

	it("persists the value when starting a preview batch fails", async () => {
		const editorRef = {
			current: {
				beginBatchOperation: vi.fn().mockRejectedValue(new Error("begin failed")),
				applyStylesTemporary: vi.fn(),
				endBatchOperation: vi.fn(),
				cancelBatchOperation: vi.fn(),
				refreshSelectedElement: vi.fn(),
			},
		}
		const onStyleChange = vi.fn()

		renderSection(
			<BoxModelSection
				selectedElement={createSelectedElement()}
				editorRef={editorRef as never}
				onStyleChange={onStyleChange}
			/>,
		)

		const leftPadding = screen.getByTestId("box-model-edge-padding-left")
		fireEvent.change(leftPadding, { target: { value: "16" } })
		fireEvent.blur(leftPadding)

		await waitFor(() =>
			expect(onStyleChange).toHaveBeenCalledWith("padding", "0px 0px 0px 16px"),
		)
		expect(editorRef.current.endBatchOperation).not.toHaveBeenCalled()
	})

	it("cancels a partially started preview when temporary styles fail", async () => {
		const editorRef = {
			current: {
				beginBatchOperation: vi.fn().mockResolvedValue(undefined),
				applyStylesTemporary: vi.fn().mockRejectedValue(new Error("apply failed")),
				endBatchOperation: vi.fn(),
				cancelBatchOperation: vi.fn().mockResolvedValue(undefined),
				refreshSelectedElement: vi.fn(),
			},
		}
		const onStyleChange = vi.fn()

		renderSection(
			<BoxModelSection
				selectedElement={createSelectedElement()}
				editorRef={editorRef as never}
				onStyleChange={onStyleChange}
			/>,
		)

		const leftPadding = screen.getByTestId("box-model-edge-padding-left")
		fireEvent.change(leftPadding, { target: { value: "16" } })
		await waitFor(() => expect(editorRef.current.cancelBatchOperation).toHaveBeenCalledOnce())
		fireEvent.blur(leftPadding)

		await waitFor(() =>
			expect(onStyleChange).toHaveBeenCalledWith("padding", "0px 0px 0px 16px"),
		)
		expect(editorRef.current.endBatchOperation).not.toHaveBeenCalled()
	})

	it("waits for an in-flight preview before committing", async () => {
		const applyTemporary = createDeferred<void>()
		const editorRef = {
			current: {
				beginBatchOperation: vi.fn().mockResolvedValue(undefined),
				applyStylesTemporary: vi.fn(() => applyTemporary.promise),
				endBatchOperation: vi.fn().mockResolvedValue(undefined),
				cancelBatchOperation: vi.fn().mockResolvedValue(undefined),
				refreshSelectedElement: vi.fn().mockResolvedValue(undefined),
			},
		}
		const onStyleChange = vi.fn()

		renderSection(
			<BoxModelSection
				selectedElement={createSelectedElement()}
				editorRef={editorRef as never}
				onStyleChange={onStyleChange}
			/>,
		)

		const leftPadding = screen.getByTestId("box-model-edge-padding-left")
		fireEvent.change(leftPadding, { target: { value: "16" } })
		await waitFor(() => expect(editorRef.current.applyStylesTemporary).toHaveBeenCalledOnce())
		fireEvent.blur(leftPadding)
		expect(editorRef.current.endBatchOperation).not.toHaveBeenCalled()

		applyTemporary.resolve()
		await waitFor(() => expect(editorRef.current.endBatchOperation).toHaveBeenCalledOnce())
		expect(onStyleChange).not.toHaveBeenCalled()
	})

	it("previews padding while dragging and commits once on blur", async () => {
		const editorRef = {
			current: {
				beginBatchOperation: vi.fn().mockResolvedValue(undefined),
				applyStylesTemporary: vi.fn().mockResolvedValue(undefined),
				endBatchOperation: vi.fn().mockResolvedValue(undefined),
				refreshSelectedElement: vi.fn().mockResolvedValue(undefined),
			},
		}
		const onStyleChange = vi.fn()

		renderSection(
			<BoxModelSection
				selectedElement={createSelectedElement()}
				editorRef={editorRef as never}
				onStyleChange={onStyleChange}
			/>,
		)

		const leftPadding = screen.getByTestId("box-model-edge-padding-left")

		fireEvent.change(leftPadding, { target: { value: "16" } })
		await waitFor(() => {
			expect(editorRef.current.beginBatchOperation).toHaveBeenCalledWith(".slide", {
				padding: "0px 0px 0px 0px",
			})
		})
		expect(editorRef.current.applyStylesTemporary).toHaveBeenCalledWith(".slide", {
			padding: "0px 0px 0px 16px",
		})

		fireEvent.blur(leftPadding)
		await waitFor(() => {
			expect(editorRef.current.endBatchOperation).toHaveBeenCalledWith(".slide", {
				padding: "0px 0px 0px 16px",
			})
		})
		expect(onStyleChange).not.toHaveBeenCalledWith("padding", expect.anything())

		fireEvent.blur(leftPadding)
		expect(editorRef.current.endBatchOperation).toHaveBeenCalledTimes(1)
		expect(onStyleChange).not.toHaveBeenCalled()
	})
})
