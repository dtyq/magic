import { fireEvent, render, screen, within } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { CanvasDesignI18nProvider } from "../../../../../app/providers/I18nProvider"
import type { ImageEditorConfig } from "../useImageEditorConfig"
import ImageGenerationSettingsPopover from "../ImageGenerationSettingsPopover"

const ratioOptions = [
	{
		value: "ratio-16-9",
		label: "16:9",
		width: 16,
		height: 9,
		iconWidth: 16,
		iconHeight: 9,
		originalLabel: "16:9",
		originalValue: "1600x900",
		originalScale: "2K",
	},
	{
		value: "ratio-1-1",
		label: "1:1",
		width: 1,
		height: 1,
		iconWidth: 16,
		iconHeight: 16,
		originalLabel: "1:1",
		originalValue: "1024x1024",
		originalScale: "2K",
	},
]

const resolutionOptions = [
	{ label: "1K", value: "1K", data: { label: "1:1", value: "1024x1024", scale: "1K" } },
	{ label: "2K", value: "2K", data: { label: "1:1", value: "2048x2048", scale: "2K" } },
]

const imageSettings = [
	{
		key: "quality",
		label: "画质",
		requestKey: "quality",
		default: "high",
		options: [
			{ label: "低画质", value: "high" },
			{ label: "极致画质", value: "standard" },
		],
	},
	{
		key: "background",
		label: "背景",
		requestKey: "background",
		options: [
			{ label: "不透明", value: "opaque" },
			{ label: "透明", value: "transparent" },
		],
	},
]

function createConfig(
	overrides: Partial<
		Pick<
			ImageEditorConfig,
			| "supportedAspectRatioOptions"
			| "supportedResolutionOptions"
			| "supportedImageSettingOptions"
			| "selectedImageGenerationConfig"
			| "selectedResolution"
			| "currentSelectValue"
			| "ratioOption"
		>
	> = {},
): ImageEditorConfig {
	return {
		supportedAspectRatioOptions: ratioOptions,
		supportedResolutionOptions: resolutionOptions,
		supportedImageSettingOptions: imageSettings,
		selectedImageGenerationConfig: { quality: "high" },
		selectedResolution: "2K",
		currentSelectValue: "ratio-16-9",
		ratioOption: ratioOptions[0],
		handlers: {
			handleRatioChange: vi.fn(),
			handleResolutionChange: vi.fn(),
			handleImageSettingChange: vi.fn(),
		},
		...overrides,
	} as unknown as ImageEditorConfig
}

function renderPopover(config: ImageEditorConfig) {
	return render(
		<CanvasDesignI18nProvider>
			<ImageGenerationSettingsPopover config={config} />
		</CanvasDesignI18nProvider>,
	)
}

describe("ImageGenerationSettingsPopover", () => {
	it("does not render an entry when the model has no generation parameters", () => {
		renderPopover(
			createConfig({
				supportedAspectRatioOptions: [],
				supportedResolutionOptions: [],
				supportedImageSettingOptions: [],
			}),
		)

		expect(screen.queryByRole("button", { name: "图片生成参数" })).not.toBeInTheDocument()
	})

	it("uses the generation settings label when no current value is available", () => {
		renderPopover(
			createConfig({
				supportedImageSettingOptions: [],
				selectedResolution: undefined,
				currentSelectValue: undefined,
				ratioOption: undefined,
			}),
		)

		expect(screen.getByRole("button", { name: "图片生成参数" })).toHaveTextContent("生成设置")
	})

	it("keeps the custom ratio summary when the current size is not in the model options", () => {
		renderPopover(
			createConfig({
				currentSelectValue: "custom-ratio",
				ratioOption: undefined,
				supportedResolutionOptions: [],
				supportedImageSettingOptions: [],
			}),
		)

		expect(screen.getByRole("button", { name: "图片生成参数" })).toHaveTextContent("自定义")
	})

	it("shows the summary and renders groups in the fixed order", () => {
		renderPopover(createConfig())

		const trigger = screen.getByRole("button", { name: "图片生成参数" })
		expect(trigger).toHaveTextContent("16:9 · 2K · 低画质 · 不透明")

		fireEvent.click(trigger)
		const content = screen.getByRole("dialog")
		const contentText = content.textContent || ""
		expect(contentText.indexOf("比例")).toBeLessThan(contentText.indexOf("分辨率"))
		expect(contentText.indexOf("分辨率")).toBeLessThan(contentText.indexOf("画质"))
		expect(contentText.indexOf("画质")).toBeLessThan(contentText.indexOf("背景"))
		expect(within(content).getByRole("button", { name: "16:9" })).toHaveAttribute(
			"aria-pressed",
			"true",
		)
		expect(within(content).getByText("1600x900")).toBeInTheDocument()
		expect(within(content).getByRole("button", { name: "2K" })).toHaveAttribute(
			"aria-pressed",
			"true",
		)
		expect(within(content).getByRole("button", { name: "低" })).toHaveAttribute(
			"aria-pressed",
			"true",
		)
		expect(within(content).getByRole("button", { name: "不透明" })).toHaveAttribute(
			"aria-pressed",
			"true",
		)
	})

	it("omits automatic quality and background from the trigger summary", () => {
		renderPopover(
			createConfig({
				supportedImageSettingOptions: [
					{
						key: "quality",
						label: "画质",
						requestKey: "quality",
						options: [
							{ label: "自动", value: "auto" },
							{ label: "低画质", value: "low" },
						],
					},
					{
						key: "background",
						label: "背景",
						requestKey: "background",
						options: [
							{ label: "自动", value: "auto" },
							{ label: "不透明", value: "opaque" },
						],
					},
				],
				selectedImageGenerationConfig: { quality: "auto", background: "auto" },
			}),
		)

		const trigger = screen.getByRole("button", { name: "图片生成参数" })
		expect(trigger).toHaveTextContent("16:9 · 2K")
		expect(trigger.textContent).not.toContain("自动")
	})

	it("routes all parameter changes and keeps the popover open", () => {
		const config = createConfig()
		renderPopover(config)
		fireEvent.click(screen.getByRole("button", { name: "图片生成参数" }))

		const content = screen.getByRole("dialog")
		fireEvent.click(within(content).getByRole("button", { name: "1:1" }))
		expect(config.handlers.handleRatioChange).toHaveBeenCalledWith("ratio-1-1")
		expect(screen.getByRole("dialog")).toBeInTheDocument()

		fireEvent.click(within(content).getByRole("button", { name: "1K" }))
		expect(config.handlers.handleResolutionChange).toHaveBeenCalledWith("1K")
		expect(screen.getByRole("dialog")).toBeInTheDocument()

		fireEvent.click(within(content).getByRole("button", { name: "极致" }))
		expect(config.handlers.handleImageSettingChange).toHaveBeenCalledWith("quality", "standard")
		expect(screen.getByRole("dialog")).toBeInTheDocument()

		fireEvent.click(within(content).getByRole("button", { name: "透明" }))
		expect(config.handlers.handleImageSettingChange).toHaveBeenCalledWith(
			"background",
			"transparent",
		)
		expect(screen.getByRole("dialog")).toBeInTheDocument()
	})

	it("updates its content and summary when the selected model configuration changes", () => {
		const config = createConfig()
		const view = renderPopover(config)
		fireEvent.click(screen.getByRole("button", { name: "图片生成参数" }))

		const nextSettings = [
			{
				key: "background",
				label: "背景",
				requestKey: "background",
				options: [{ label: "透明", value: "transparent" }],
			},
		]
		view.rerender(
			<CanvasDesignI18nProvider>
				<ImageGenerationSettingsPopover
					config={createConfig({
						supportedAspectRatioOptions: [],
						supportedResolutionOptions: [],
						supportedImageSettingOptions: nextSettings,
						selectedImageGenerationConfig: { background: "transparent" },
						selectedResolution: undefined,
						currentSelectValue: undefined,
						ratioOption: undefined,
					})}
				/>
			</CanvasDesignI18nProvider>,
		)

		expect(screen.getByRole("button", { name: "图片生成参数" })).toHaveTextContent("透明")
		expect(screen.getByText("透明背景")).toBeInTheDocument()
		expect(screen.getByRole("dialog")).toBeInTheDocument()
	})
})
