import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import type { JSONContent } from "@/infrastructure/editors/tiptap/core"
import { describe, expect, it, vi } from "vitest"
import SelfMediaComposerConfigPanel from "../SelfMediaComposerConfigPanel"

const storeMock = vi.hoisted(() => ({
	sendCount: 0,
	setPresetSuffixContentForSource: vi.fn(),
}))
const panelVariantMock = vi.hoisted(() => ({
	value: undefined as string | undefined,
}))

const translationMap = vi.hoisted(() => ({
	"detail.selfMedia.initPanel.visuals.personalInsight.label": "个人洞察",
	"detail.selfMedia.initPanel.visuals.personalInsight.description": "适合个人观点和经验复盘",
	"detail.selfMedia.initPanel.visuals.insModern.label": "现代简洁",
	"detail.selfMedia.initPanel.visuals.insModern.description": "适合 Instagram 的现代排版",
	"detail.selfMedia.initPanel.visuals.custom.label": "自定义",
	"detail.selfMedia.initPanel.visuals.custom.description": "使用自定义视觉方向",
	"detail.selfMedia.initPanel.visuals.none.label": "无模板",
	"detail.selfMedia.initPanel.visuals.none.description": "不使用视觉模板",
	"detail.selfMedia.initPanel.visuals.scrollHint": "滚动预览",
	"detail.selfMedia.initPanel.composerConfig.cardCountValue": "{{count}}张",
	"detail.selfMedia.initPanel.composerConfig.clear": "清空",
	"detail.selfMedia.initPanel.composerConfig.currentConfig": "当前配置：{{value}}",
	"detail.selfMedia.initPanel.composerConfig.custom": "自定义",
	"detail.selfMedia.initPanel.composerConfig.empty": "模板配置",
	"detail.selfMedia.initPanel.composerConfig.emptyPresets": "当前平台暂无可选模板",
	"detail.selfMedia.initPanel.composerConfig.fields.cardCount": "卡片数量",
	"detail.selfMedia.initPanel.composerConfig.fields.platform": "平台",
	"detail.selfMedia.initPanel.composerConfig.fields.visualPreset": "模板",
}))

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string, options?: Record<string, string | number>) => {
			const value = translationMap[key as keyof typeof translationMap] ?? key

			return value.replace(/\{\{(\w+)\}\}/g, (_, name: string) =>
				String(options?.[name] ?? ""),
			)
		},
		i18n: { language: "zh_CN" },
	}),
}))

vi.mock("../../stores", () => ({
	useOptionalScenePanelVariant: () => panelVariantMock.value,
	useSceneStateStore: () => storeMock,
}))

function getPlainTextFromNode(node: JSONContent | null | undefined): string {
	if (!node) return ""
	if (node.type === "text") return node.text ?? ""
	if (!Array.isArray(node.content)) return ""
	if (node.type === "doc") return node.content.map(getPlainTextFromNode).join("\n")
	return node.content.map(getPlainTextFromNode).join("")
}

function getLastPresetSuffixText() {
	const contentCalls = storeMock.setPresetSuffixContentForSource.mock.calls.filter(
		([, content]) => Boolean(content),
	)
	const lastContent = contentCalls.at(-1)?.[1] as JSONContent | undefined
	return getPlainTextFromNode(lastContent)
}

function getLastPresetSuffixContent() {
	return storeMock.setPresetSuffixContentForSource.mock.calls.at(-1)?.[1] as
		JSONContent | undefined
}

function getAllPresetSuffixTexts() {
	return storeMock.setPresetSuffixContentForSource.mock.calls
		.map(([, content]) => getPlainTextFromNode(content as JSONContent | undefined))
		.filter(Boolean)
}

function renderPanel(variant?: string) {
	storeMock.sendCount = 0
	storeMock.setPresetSuffixContentForSource.mockClear()
	panelVariantMock.value = variant

	return render(<SelfMediaComposerConfigPanel />)
}

function openComposerConfigPopover() {
	const trigger = screen.queryByTestId("self-media-composer-config-trigger")
	if (trigger) fireEvent.click(trigger)
}

describe("SelfMediaComposerConfigPanel", () => {
	it("uses a compact popover trigger in topic page projects", () => {
		renderPanel("topicPage")

		expect(screen.getByTestId("self-media-composer-config-trigger")).toHaveTextContent(
			"模板配置",
		)
		expect(screen.queryByText("平台")).not.toBeInTheDocument()

		openComposerConfigPopover()

		expect(screen.getByText("平台")).toBeInTheDocument()
		expect(screen.getByRole("button", { name: /select-platform-rednote/ })).toBeInTheDocument()
	})

	it("starts empty and shows label:value placeholders without writing a suffix", () => {
		renderPanel()

		expect(getLastPresetSuffixContent()).toBeUndefined()
		expect(screen.getByTestId("self-media-composer-config-panel")).toHaveTextContent("模板配置")
		expect(screen.getByText("模板配置")).toHaveClass("text-muted-foreground")
		expect(screen.getByTestId("self-media-composer-config-panel")).not.toHaveTextContent(
			"自媒体配置",
		)
		openComposerConfigPopover()
		expect(screen.getAllByText("个人洞察").length).toBeGreaterThan(0)
		expect(screen.getByTestId("visual-preset-layout-mark-personal-insight")).toBeInTheDocument()
		expect(screen.getByRole("button", { name: /select-platform-rednote/ })).toHaveAttribute(
			"aria-pressed",
			"false",
		)
	})

	it("shows and sends only the fields the user selected", () => {
		renderPanel()
		openComposerConfigPopover()

		fireEvent.click(screen.getByRole("button", { name: /select-platform-instagram/ }))

		expect(getLastPresetSuffixText()).toBe("平台: instagram.")
		expect(screen.getByTestId("self-media-composer-config-panel")).toHaveAttribute(
			"aria-label",
			expect.stringContaining("平台:Instagram"),
		)
		expect(screen.getByTestId("self-media-composer-config-panel")).not.toHaveTextContent(
			"模板:",
		)

		fireEvent.click(screen.getByRole("button", { name: /select-visual-preset-ins-modern/ }))

		expect(getLastPresetSuffixText()).toBe("平台: instagram; 模板: ins-modern.")
		expect(getAllPresetSuffixTexts()).not.toContain(
			"平台: instagram; 模板: personal-insight; 卡片数量: 6.",
		)
		expect(
			screen.getByRole("button", { name: /select-visual-preset-ins-modern/ }),
		).toHaveAttribute("aria-pressed", "true")
		expect(screen.queryByRole("button", { name: /code-dispatch/ })).not.toBeInTheDocument()
		expect(screen.getByTestId("self-media-composer-config-panel")).toHaveAttribute(
			"aria-label",
			expect.stringContaining("平台:Instagram / 模板:现代简洁"),
		)
	})

	it("can clear an active config back to an empty suffix", () => {
		renderPanel()
		openComposerConfigPopover()

		fireEvent.click(screen.getByRole("button", { name: /select-platform-rednote/ }))
		expect(getLastPresetSuffixText()).toBe("平台: rednote.")

		fireEvent.click(screen.getByRole("button", { name: "clear-self-media-composer-config" }))

		expect(getLastPresetSuffixContent()).toBeUndefined()
		expect(screen.getByTestId("self-media-composer-config-panel")).toHaveTextContent("模板配置")
	})

	it("toggles a selected option off when the user clicks it again", () => {
		renderPanel()
		openComposerConfigPopover()

		const platformButton = screen.getByRole("button", { name: /select-platform-rednote/ })
		fireEvent.click(platformButton)
		expect(getLastPresetSuffixText()).toBe("平台: rednote.")
		fireEvent.click(platformButton)
		expect(getLastPresetSuffixContent()).toBeUndefined()
		expect(screen.getByTestId("self-media-composer-config-panel")).toHaveTextContent("模板配置")

		const presetButton = screen.getByRole("button", {
			name: /select-visual-preset-personal-insight/,
		})
		fireEvent.click(presetButton)
		expect(getLastPresetSuffixText()).toBe("模板: personal-insight.")
		fireEvent.click(presetButton)
		expect(getLastPresetSuffixContent()).toBeUndefined()
		expect(screen.queryByTestId("self-media-composer-preview-panel")).not.toBeInTheDocument()

		const cardCountButton = screen.getByRole("button", { name: "6" })
		fireEvent.click(cardCountButton)
		expect(getLastPresetSuffixText()).toBe("卡片数量: 6.")
		fireEvent.click(cardCountButton)
		expect(getLastPresetSuffixContent()).toBeUndefined()
		expect(screen.getByTestId("self-media-composer-config-panel")).toHaveTextContent("模板配置")
	})

	it("clears the config after send", async () => {
		const { rerender } = renderPanel()
		openComposerConfigPopover()
		fireEvent.click(screen.getByRole("button", { name: /select-platform-rednote/ }))

		expect(getLastPresetSuffixText()).toBe("平台: rednote.")

		storeMock.sendCount = 1
		rerender(<SelfMediaComposerConfigPanel className="after-send" />)

		await waitFor(() =>
			expect(screen.getByTestId("self-media-composer-config-panel")).toHaveTextContent(
				"模板配置",
			),
		)
		expect(getLastPresetSuffixContent()).toBeUndefined()
	})

	it("shows a right preview panel only after choosing a template", () => {
		renderPanel()
		openComposerConfigPopover()

		expect(screen.queryByTestId("self-media-composer-preview-panel")).not.toBeInTheDocument()
		expect(
			screen.queryByTestId("self-media-composer-preview-image-personal-insight"),
		).not.toBeInTheDocument()

		const presetButton = screen.getByRole("button", {
			name: /select-visual-preset-personal-insight/,
		})

		fireEvent.click(presetButton)

		expect(screen.getByTestId("self-media-composer-preview-panel")).toHaveTextContent(
			"个人洞察",
		)
		expect(
			screen.getByTestId("self-media-composer-preview-image-personal-insight"),
		).toHaveAttribute("src", "/self-media-preset-previews/rednote/personal-insight.webp")
		expect(
			screen.getByTestId("self-media-composer-preview-scroll-personal-insight"),
		).toHaveClass("overflow-y-auto")
	})

	it("does not expose custom style or no-template choices in this entry", () => {
		renderPanel()
		openComposerConfigPopover()

		expect(
			screen.queryByRole("button", { name: /select-visual-preset-custom/ }),
		).not.toBeInTheDocument()
		expect(
			screen.queryByRole("button", { name: /select-visual-preset-none/ }),
		).not.toBeInTheDocument()
	})

	it("keeps visual presets in a wrapping grid without secondary horizontal scroll", () => {
		renderPanel()
		openComposerConfigPopover()

		const presetGrid = screen.getByTestId("self-media-visual-preset-grid")

		expect(presetGrid).toHaveClass("grid")
		expect(presetGrid).not.toHaveClass("overflow-x-auto")
	})

	it("uses the custom numeric value in the suffix", () => {
		renderPanel()
		openComposerConfigPopover()

		fireEvent.click(screen.getByRole("button", { name: "custom-card-count" }))
		fireEvent.change(screen.getByLabelText("card-count-custom-input"), {
			target: { value: "8" },
		})

		expect(getLastPresetSuffixText()).toBe("卡片数量: 8.")
		expect(screen.getByTestId("self-media-composer-config-panel")).toHaveAttribute(
			"aria-label",
			expect.stringContaining("卡片数量:8张"),
		)
		expect(getLastPresetSuffixText()).not.toContain("cardCount: custom")
	})

	it("hides card count and omits it for wechat official accounts", () => {
		renderPanel()
		openComposerConfigPopover()

		fireEvent.click(
			screen.getByRole("button", { name: /select-platform-wechat-official-accounts/ }),
		)

		expect(screen.queryByText("3")).not.toBeInTheDocument()
		expect(screen.queryByRole("button", { name: "custom-card-count" })).not.toBeInTheDocument()
		expect(screen.queryByRole("button", { name: /select-visual-preset-custom/ })).toBeNull()
		expect(screen.queryByRole("button", { name: /select-visual-preset-none/ })).toBeNull()
		expect(screen.getByText("当前平台暂无可选模板")).toBeInTheDocument()
		expect(getLastPresetSuffixText()).toBe("平台: wechat-official-accounts.")
		expect(getLastPresetSuffixText()).not.toContain("cardCount")
	})
})
