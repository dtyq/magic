import { fireEvent, render, screen } from "@testing-library/react"
import { useState } from "react"
import { describe, expect, it, vi } from "vitest"
import { createEmptyPlatformInfoFormState } from "../../../src/features/platform-info/api"
import {
	PlatformInfoWatermarkForm,
	PlatformInfoWatermarkPreview,
} from "../../../src/features/platform-info/components/platform-info-watermark"
import type { PlatformInfoWatermark } from "../../../src/features/platform-info/types"

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }))

const defaultWatermark = createEmptyPlatformInfoFormState().watermark

function WatermarkFormHarness({
	initialValue = defaultWatermark,
	error,
}: {
	error?: string
	initialValue?: PlatformInfoWatermark
}) {
	const [value, setValue] = useState(initialValue)

	return <PlatformInfoWatermarkForm error={error} value={value} onChange={setValue} />
}

describe("platform info watermark preview", () => {
	it("shows the enabled state, selected fields and depth in read-only form", () => {
		render(
			<PlatformInfoWatermarkPreview
				value={{ enabled: true, fields: ["real_name", "phone"], depth: "strong" }}
			/>,
		)

		expect(screen.getByText("common.enabled")).toBeInTheDocument()
		expect(screen.getByText("platformInfo.watermark.field.realName")).toBeInTheDocument()
		expect(screen.getByText("platformInfo.watermark.field.phone")).toBeInTheDocument()
		expect(screen.getByText("platformInfo.watermark.depth.strong")).toBeInTheDocument()
		expect(screen.getByText("platformInfo.watermark.preview.tip")).toBeInTheDocument()
	})

	it("repeats the preview text on the watermark canvas in the canonical field order", () => {
		render(
			<PlatformInfoWatermarkPreview
				value={{ enabled: true, fields: ["phone", "real_name"], depth: "light" }}
			/>,
		)

		const previewText =
			"platformInfo.watermark.preview.sample.realName · platformInfo.watermark.preview.sample.phone"

		expect(screen.getAllByText(previewText)).toHaveLength(12)
	})

	it("falls back to the sample copy when no field is selected", () => {
		render(
			<PlatformInfoWatermarkPreview
				value={{ enabled: false, fields: [], depth: "light" }}
			/>,
		)

		expect(screen.getByText("common.disabled")).toBeInTheDocument()
		expect(screen.getByText("common.emptyValue")).toBeInTheDocument()
		expect(screen.getAllByText("platformInfo.watermark.preview.fallback")).toHaveLength(12)
	})
})

describe("platform info watermark form", () => {
	it("keeps content and depth read-only while the watermark is disabled", () => {
		render(<WatermarkFormHarness />)

		expect(screen.getByRole("checkbox", { name: "platformInfo.watermark.field.realName" })).toBeDisabled()

		for (const depth of ["light", "standard", "strong"]) {
			expect(
				screen.getByRole("radio", { name: `platformInfo.watermark.depth.${depth}` }),
			).toBeDisabled()
		}
	})

	it("enables content and depth once the watermark switch is turned on", () => {
		render(<WatermarkFormHarness />)

		fireEvent.click(screen.getByRole("switch"))

		expect(
			screen.getByRole("checkbox", { name: "platformInfo.watermark.field.realName" }),
		).toBeEnabled()
		expect(
			screen.getByRole("radio", { name: "platformInfo.watermark.depth.light" }),
		).toBeEnabled()
		expect(screen.getByText("common.enabled")).toBeInTheDocument()
	})

	it("adds and removes a watermark field while keeping the canonical order", () => {
		render(
			<WatermarkFormHarness
				initialValue={{ enabled: true, fields: ["real_name"], depth: "light" }}
			/>,
		)

		fireEvent.click(screen.getByRole("checkbox", { name: "platformInfo.watermark.field.phone" }))
		expect(
			screen.getByRole("checkbox", { name: "platformInfo.watermark.field.phone" }),
		).toHaveAttribute("data-state", "checked")
		expect(
			screen.getByRole("checkbox", { name: "platformInfo.watermark.field.realName" }),
		).toHaveAttribute("data-state", "checked")

		fireEvent.click(
			screen.getByRole("checkbox", { name: "platformInfo.watermark.field.realName" }),
		)
		expect(
			screen.getByRole("checkbox", { name: "platformInfo.watermark.field.realName" }),
		).toHaveAttribute("data-state", "unchecked")
	})

	it("keeps at least one field selected while the watermark is enabled", () => {
		render(
			<WatermarkFormHarness
				initialValue={{ enabled: true, fields: ["real_name"], depth: "light" }}
			/>,
		)

		fireEvent.click(
			screen.getByRole("checkbox", { name: "platformInfo.watermark.field.realName" }),
		)

		// 改动被阻止，字段保持选中，并就地提示原因。
		expect(
			screen.getByRole("checkbox", { name: "platformInfo.watermark.field.realName" }),
		).toHaveAttribute("data-state", "checked")
		expect(
			screen.getByText("platformInfo.validation.watermarkContentRequired"),
		).toBeInTheDocument()

		// 重新选中其他字段后提示消失。
		fireEvent.click(screen.getByRole("checkbox", { name: "platformInfo.watermark.field.email" }))
		expect(
			screen.queryByText("platformInfo.validation.watermarkContentRequired"),
		).not.toBeInTheDocument()
	})

	it("selects the clicked depth option and marks it as checked", () => {
		render(
			<WatermarkFormHarness
				initialValue={{ enabled: true, fields: ["real_name"], depth: "light" }}
			/>,
		)

		fireEvent.click(screen.getByRole("radio", { name: "platformInfo.watermark.depth.strong" }))

		expect(
			screen.getByRole("radio", { name: "platformInfo.watermark.depth.strong" }),
		).toHaveAttribute("aria-checked", "true")
		expect(
			screen.getByRole("radio", { name: "platformInfo.watermark.depth.light" }),
		).toHaveAttribute("aria-checked", "false")
	})

	it("renders the validation message next to the content field", () => {
		render(
			<WatermarkFormHarness
				error="platformInfo.validation.watermarkContentRequired"
				initialValue={{ enabled: true, fields: [], depth: "light" }}
			/>,
		)

		expect(
			screen.getByText("platformInfo.validation.watermarkContentRequired"),
		).toBeInTheDocument()
	})

	it("always explains the default watermark behaviour", () => {
		render(<WatermarkFormHarness />)

		expect(screen.getByText("platformInfo.watermark.defaultTip")).toBeInTheDocument()
	})

	it("shows the watermark preview while editing", () => {
		render(
			<WatermarkFormHarness
				initialValue={{ enabled: true, fields: ["real_name"], depth: "light" }}
			/>,
		)

		expect(screen.getByText("platformInfo.watermark.preview.title")).toBeInTheDocument()
		expect(screen.getByText("platformInfo.watermark.preview.tip")).toBeInTheDocument()
		expect(
			screen.getAllByText("platformInfo.watermark.preview.sample.realName"),
		).toHaveLength(12)
	})

	it("updates the editing preview as content and depth change", () => {
		render(
			<WatermarkFormHarness
				initialValue={{ enabled: true, fields: ["real_name"], depth: "light" }}
			/>,
		)

		fireEvent.click(screen.getByRole("checkbox", { name: "platformInfo.watermark.field.email" }))

		const previewText =
			"platformInfo.watermark.preview.sample.realName · platformInfo.watermark.preview.sample.email"
		const canvas = screen.getAllByText(previewText)
		expect(canvas).toHaveLength(12)

		fireEvent.click(screen.getByRole("radio", { name: "platformInfo.watermark.depth.strong" }))

		// 深浅档位直接体现在预览画布的文字颜色上。
		const layer = screen.getAllByText(previewText)[0].parentElement
		expect(layer).toHaveStyle({ color: "rgba(0, 0, 0, 0.06)" })
	})
})
