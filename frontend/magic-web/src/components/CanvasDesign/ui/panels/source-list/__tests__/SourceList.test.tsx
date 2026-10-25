import { fireEvent, render, screen } from "@testing-library/react"
import type { ReactElement } from "react"
import { describe, expect, it, vi } from "vitest"
import { CanvasDesignI18nProvider } from "../../../../app/providers/I18nProvider"
import { TooltipProvider } from "../../../primitives/shadcn/tooltip"
import { createTestResourceReferenceResolver } from "../../../../public/__tests__/testResourceReferenceResolver"
import SourceList from "../index"

vi.mock("../../../previews/reference-media/index", () => ({
	default: (props: { enableTooltip?: boolean }) => (
		<div
			data-testid="reference-media-preview"
			data-tooltip-enabled={props.enableTooltip ? "true" : "false"}
		/>
	),
}))

function renderSourceList(ui: ReactElement) {
	return render(
		<CanvasDesignI18nProvider>
			<TooltipProvider>{ui}</TooltipProvider>
		</CanvasDesignI18nProvider>,
	)
}

describe("SourceList selection", () => {
	it("toggles selection from both the checkbox and the whole item", () => {
		const onCheckedChange = vi.fn()

		renderSourceList(
			<SourceList
				options={[
					{
						kind: "slot",
						label: "参考图",
						value: "linked-image",
						slotIndex: 0,
						resourcePath: "/images/linked.png",
						readOnly: true,
						selection: {
							checked: false,
							ariaLabel: "参与参考媒体：linked.png",
							onCheckedChange,
						},
					},
				]}
			/>,
		)

		const checkbox = screen.getByRole("checkbox", { name: "参与参考媒体：linked.png" })
		expect(checkbox).not.toBeChecked()

		fireEvent.click(checkbox)
		fireEvent.click(checkbox.parentElement as HTMLElement)

		expect(onCheckedChange).toHaveBeenNthCalledWith(1, true)
		expect(onCheckedChange).toHaveBeenNthCalledWith(2, true)
	})

	it("does not toggle a disabled linked media checkbox", () => {
		const onCheckedChange = vi.fn()

		renderSourceList(
			<SourceList
				options={[
					{
						kind: "slot",
						label: "参考图",
						value: "disabled-linked-image",
						slotIndex: 0,
						resourcePath: "/images/linked.png",
						readOnly: true,
						selection: {
							checked: false,
							disabled: true,
							ariaLabel: "参与参考媒体：linked.png",
							onCheckedChange,
						},
					},
				]}
			/>,
		)

		const checkbox = screen.getByRole("checkbox", { name: "参与参考媒体：linked.png" })
		expect(checkbox).toBeDisabled()

		fireEvent.click(checkbox)
		fireEvent.click(checkbox.parentElement as HTMLElement)

		expect(onCheckedChange).not.toHaveBeenCalled()
	})
})

describe("SourceList preview", () => {
	it("shows a non-interactive play indicator only for video resources", () => {
		const { container } = renderSourceList(
			<SourceList
				options={[
					{
						kind: "slot",
						label: "参考视频",
						value: "reference-video",
						slotIndex: 0,
						resourcePath: "asset://reference-video",
						resourceMediaType: "video",
					},
					{
						kind: "slot",
						label: "参考图片",
						value: "reference-image",
						slotIndex: 1,
						resourcePath: "./images/reference.png",
					},
				]}
			/>,
		)

		const videoIndicators = container.querySelectorAll(
			'[data-testid="source-list-video-indicator"]',
		)
		expect(videoIndicators).toHaveLength(1)
		expect(videoIndicators[0]).toHaveAttribute("aria-hidden", "true")
	})

	it("hides preview for a resource deleted from the attachment snapshot", () => {
		renderSourceList(
			<SourceList
				resolveResourceReference={createTestResourceReferenceResolver({
					attachmentsReady: true,
				})}
				options={[
					{
						kind: "slot",
						label: "参考图",
						value: "deleted-image",
						slotIndex: 0,
						resourcePath: "./images/deleted.png",
					},
				]}
			/>,
		)

		expect(screen.getByTestId("reference-media-preview")).toHaveAttribute(
			"data-tooltip-enabled",
			"false",
		)
	})

	it("uses media tooltip preview for an available resource", () => {
		renderSourceList(
			<SourceList
				resolveResourceReference={createTestResourceReferenceResolver({
					attachmentsReady: true,
					attachmentPathsByFileId: {
						available: "/画布A/images/available.png",
					},
				})}
				options={[
					{
						kind: "slot",
						label: "参考图",
						value: "available-image",
						slotIndex: 0,
						resourcePath: "./images/available.png",
					},
				]}
			/>,
		)

		expect(screen.getByTestId("reference-media-preview")).toHaveAttribute(
			"data-tooltip-enabled",
			"true",
		)
	})

	it("copies the full path from a path tooltip", async () => {
		const writeText = vi.fn().mockResolvedValue(undefined)
		Object.assign(navigator, { clipboard: { writeText } })

		const { container } = renderSourceList(
			<SourceList
				options={[
					{
						kind: "slot",
						label: "参考素材",
						value: "opaque-asset",
						slotIndex: 0,
						resourcePath: "asset://virtual-human-asset-id",
					},
				]}
			/>,
		)

		const trigger = container.querySelector<HTMLElement>("[data-state]")
		if (!trigger) throw new Error("SourceList tooltip trigger not found")
		fireEvent.pointerMove(trigger, { pointerType: "mouse" })

		const tooltip = await screen.findByRole("tooltip")
		expect(tooltip).toHaveTextContent("asset://virtual-human-asset-id")
		const copyButton = screen.getAllByRole("button", { name: "复制资源路径" })[0]
		expect(copyButton).toHaveClass("cursor-pointer")
		fireEvent.click(copyButton)
		expect(writeText).toHaveBeenCalledWith("asset://virtual-human-asset-id")
	})
})
