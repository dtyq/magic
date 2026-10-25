import type { ElementType, PropsWithChildren } from "react"
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import type { NodeViewProps } from "@/infrastructure/editors/tiptap/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { MentionItemType } from "@/components/business/MentionPanel/types"
import { TooltipProvider } from "@/components/shadcn-ui/tooltip"
import { InspectorDetailComponent } from "../component"
import {
	resetHtmlScreenshotTargetStore,
	setHtmlScreenshotMention,
} from "../../../services/HtmlScreenshotTargetStore"

const getStoredScreenshotBlob = vi.hoisted(() => vi.fn())

vi.mock("@/infrastructure/editors/tiptap/react", () => ({
	NodeViewWrapper: ({
		as: Component = "div",
		children,
		...props
	}: PropsWithChildren<{ as?: ElementType }>) => {
		const Wrapper = Component
		return <Wrapper {...props}>{children}</Wrapper>
	},
}))

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => (key === "stylePanel.inspector.selectedElement" ? "已选取的元素" : key),
	}),
}))

vi.mock("@/pages/superMagic/hooks/useFileUrl", () => ({
	useFileUrl: () => ({ fileUrl: "blob:inspector-screenshot" }),
}))

vi.mock("@/pages/superMagic/components/MessageEditor/services/HtmlScreenshotUploadService", () => ({
	htmlScreenshotUploadService: { getStoredScreenshotBlob },
}))

describe("InspectorDetailComponent", () => {
	beforeEach(() => {
		getStoredScreenshotBlob.mockReset()
		resetHtmlScreenshotTargetStore()
	})

	it("keeps the collapsed chip tall enough and separates its border from the caret", () => {
		const props = {
			node: {
				attrs: { textContent: "hello" },
			},
		} as unknown as NodeViewProps
		const { container } = render(<InspectorDetailComponent {...props} />)

		const wrapper = container.querySelector('[data-type="inspector-detail"]')
		const button = screen.getByTestId("set-expanded")

		expect(wrapper).toHaveClass(
			"!inline-flex",
			"!overflow-visible",
			"!bg-transparent",
			"relative",
			"top-[1px]",
			"!align-baseline",
			// 宽度上限必须扣掉标签自身的左右外边距，否则窄容器（如任务队列预览）里
			// 行内盒会连边距一起溢出被裁，右侧边框与圆角会消失。
			"max-w-[min(220px,calc(100%_-_8px))]",
		)
		expect(wrapper).not.toHaveClass("max-w-[min(220px,100%)]")
		expect(button).toHaveClass("min-w-0")
		expect(button).not.toHaveClass("overflow-hidden")
		expect(wrapper).toHaveAttribute("draggable", "false")
		expect(wrapper).toHaveAttribute("data-magic-editor-node")
		expect(wrapper).toHaveClass("!p-0")
		expect(wrapper).not.toHaveClass("border", "border-border/60")
		expect(button).toHaveClass(
			"h-5",
			"rounded-md",
			"border",
			"border-border/60",
			"bg-muted/30",
			"text-xs",
			"leading-5",
		)
		expect(button).toHaveTextContent("hello")
		const event = new MouseEvent("mousedown", { bubbles: true, cancelable: true })
		wrapper?.dispatchEvent(event)
		expect(event.defaultPrevented).toBe(true)
	})

	it("shows a layout-safe highlight when the inspector detail node is selected", () => {
		const props = {
			node: {
				attrs: { textContent: "hello" },
			},
			selected: true,
		} as unknown as NodeViewProps
		const { container } = render(<InspectorDetailComponent {...props} />)

		expect(container.querySelector('[data-type="inspector-detail"]')).toHaveClass(
			"select-none",
			"!outline-none",
		)
		expect(screen.getByTestId("set-expanded")).toHaveClass("border-primary/70", "bg-primary/10")
	})

	it("expands on click even when a local screenshot preview is attached", async () => {
		getStoredScreenshotBlob.mockResolvedValue(new Blob(["png"], { type: "image/png" }))
		const createObjectURL = vi
			.spyOn(URL, "createObjectURL")
			.mockReturnValue("blob:expand-inspector-screenshot")
		const revokeObjectURL = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {})
		const setNodeSelection = vi.fn()
		const props = {
			node: {
				attrs: {
					textContent: "全球新能源汽车市场运营指标洞察",
					captureId: "element:#hero:1",
					screenshotMention: {
						type: MentionItemType.UPLOAD_FILE,
						data: {
							file_id: "storage-1",
							file_name: "hero.png",
							file_path: "storage-1",
							file_extension: "png",
							is_html_screenshot: true,
							storage_id: "storage-1",
						},
					},
				},
			},
			editor: { commands: { setNodeSelection } },
			getPos: () => 3,
		} as unknown as NodeViewProps

		render(
			<TooltipProvider>
				<InspectorDetailComponent {...props} />
			</TooltipProvider>,
		)

		const button = screen.getByTestId("set-expanded")
		expect(button).not.toHaveClass("overflow-hidden")
		expect(button.querySelector("svg.lucide-chevron-right")).toBeTruthy()
		expect(await screen.findByTestId("inspector-screenshot-preview-trigger")).toHaveClass(
			"min-w-0",
		)

		await act(async () => {
			button.click()
		})

		expect(setNodeSelection).toHaveBeenCalledWith(3)
		expect(button.querySelector("svg.lucide-chevron-down")).toBeTruthy()
		createObjectURL.mockRestore()
		revokeObjectURL.mockRestore()
	})

	it("waits for a click before selecting so mouse drag can start", () => {
		const setNodeSelection = vi.fn()
		const props = {
			node: {
				attrs: { textContent: "hello" },
			},
			editor: { commands: { setNodeSelection } },
			getPos: () => 3,
		} as unknown as NodeViewProps
		render(<InspectorDetailComponent {...props} />)

		const button = screen.getByTestId("set-expanded")
		fireEvent.mouseDown(button, { button: 0 })
		fireEvent.dragStart(button)

		expect(setNodeSelection).not.toHaveBeenCalled()

		fireEvent.click(button)

		expect(setNodeSelection).toHaveBeenCalledWith(3)
	})

	it("renders the screenshot preview inside the expanded detail card", async () => {
		const props = {
			node: {
				attrs: {
					screenshotMention: {
						type: MentionItemType.PROJECT_FILE,
						data: {
							file_id: "screenshot-1",
							file_name: "hero.png",
							file_path: "hero.png",
							file_extension: "png",
						},
					},
				},
			},
			editor: { commands: { setNodeSelection: vi.fn() } },
			getPos: () => 3,
		} as unknown as NodeViewProps
		render(
			<TooltipProvider>
				<InspectorDetailComponent {...props} />
			</TooltipProvider>,
		)

		await act(async () => {
			screen.getByTestId("set-expanded").click()
		})
		expect(screen.getByTestId("inspector-screenshot-preview")).toBeInTheDocument()
		expect(screen.getByRole("img", { name: "hero.png" })).toHaveAttribute(
			"src",
			"blob:inspector-screenshot",
		)
	})

	it("loads a persisted local screenshot by storage id", async () => {
		getStoredScreenshotBlob.mockResolvedValue(new Blob(["png"], { type: "image/png" }))
		const createObjectURL = vi
			.spyOn(URL, "createObjectURL")
			.mockReturnValue("blob:local-inspector-screenshot")
		const revokeObjectURL = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {})

		const props = {
			node: {
				attrs: {
					screenshotMention: {
						type: MentionItemType.UPLOAD_FILE,
						data: {
							file_id: "storage-1",
							file_name: "hero.png",
							file_path: "storage-1",
							file_extension: "png",
							is_html_screenshot: true,
							storage_id: "storage-1",
						},
					},
				},
			},
			editor: { commands: { setNodeSelection: vi.fn() } },
			getPos: () => 3,
		} as unknown as NodeViewProps
		render(
			<TooltipProvider>
				<InspectorDetailComponent {...props} />
			</TooltipProvider>,
		)

		await act(async () => {
			screen.getByTestId("set-expanded").click()
		})
		await waitFor(() => expect(getStoredScreenshotBlob).toHaveBeenCalledWith("storage-1"))
		expect(await screen.findByRole("img", { name: "hero.png" })).toHaveAttribute(
			"src",
			"blob:local-inspector-screenshot",
		)
		createObjectURL.mockRestore()
		revokeObjectURL.mockRestore()
	})

	it("reloads the collapsed preview after the local screenshot mention is prepared", async () => {
		getStoredScreenshotBlob
			.mockResolvedValueOnce(null)
			.mockResolvedValue(new Blob(["png"], { type: "image/png" }))
		const createObjectURL = vi
			.spyOn(URL, "createObjectURL")
			.mockReturnValue("blob:prepared-inspector-screenshot")
		const revokeObjectURL = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {})

		const props = {
			node: {
				attrs: {
					textContent: "Hero title",
					captureId: "element:#hero:1",
				},
			},
			editor: { commands: { setNodeSelection: vi.fn() } },
			getPos: () => 3,
		} as unknown as NodeViewProps

		render(
			<TooltipProvider>
				<InspectorDetailComponent {...props} />
			</TooltipProvider>,
		)

		await waitFor(() => expect(getStoredScreenshotBlob).toHaveBeenCalledWith("element:#hero:1"))
		expect(screen.queryByRole("img", { name: "html-screenshot.png" })).not.toBeInTheDocument()

		act(() => {
			setHtmlScreenshotMention("element:#hero:1", {
				type: MentionItemType.UPLOAD_FILE,
				data: {
					file_id: "element:#hero:1",
					file_name: "html-screenshot-hero.png",
					file_path: "element:#hero:1",
					file_extension: "png",
					is_html_screenshot: true,
					storage_id: "element:#hero:1",
				},
			})
		})

		await waitFor(() => expect(getStoredScreenshotBlob).toHaveBeenCalledTimes(2))
		expect(screen.getByTestId("inspector-screenshot-preview-trigger")).toBeInTheDocument()
		createObjectURL.mockRestore()
		revokeObjectURL.mockRestore()
	})

	it("shows the element text when the stored screenshot is missing", async () => {
		getStoredScreenshotBlob.mockResolvedValueOnce(null)

		const props = {
			node: {
				attrs: {
					textContent: "Hero title",
					captureId: "element:#hero:1",
					screenshotMention: {
						type: MentionItemType.UPLOAD_FILE,
						data: {
							file_id: "storage-1",
							file_name: "hero.png",
							file_path: "storage-1",
							file_extension: "png",
							is_html_screenshot: true,
							storage_id: "storage-1",
						},
					},
				},
			},
			editor: { commands: { setNodeSelection: vi.fn() } },
			getPos: () => 3,
		} as unknown as NodeViewProps

		render(
			<TooltipProvider>
				<InspectorDetailComponent {...props} />
			</TooltipProvider>,
		)

		expect(screen.getByTestId("set-expanded")).toHaveTextContent("Hero title")
		await act(async () => {
			screen.getByTestId("set-expanded").click()
		})
		await waitFor(() => expect(getStoredScreenshotBlob).toHaveBeenCalledWith("storage-1"))
		expect(screen.queryByRole("img", { name: "hero.png" })).not.toBeInTheDocument()
		expect(screen.getAllByText("Hero title").length).toBeGreaterThan(0)
	})

	it("renders a local screenshot resolved from the target store", async () => {
		getStoredScreenshotBlob.mockResolvedValue(new Blob(["png"], { type: "image/png" }))
		const createObjectURL = vi
			.spyOn(URL, "createObjectURL")
			.mockReturnValue("blob:target-inspector-screenshot")
		const revokeObjectURL = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {})
		setHtmlScreenshotMention("element:#hero:1", {
			type: MentionItemType.UPLOAD_FILE,
			data: {
				file_id: "storage-1",
				file_name: "hero.png",
				file_path: "storage-1",
				file_extension: "png",
				is_html_screenshot: true,
				storage_id: "storage-1",
			},
		})

		const props = {
			node: {
				attrs: {
					captureId: "element:#hero:1",
					textContent: "Hero",
				},
			},
			editor: { commands: { setNodeSelection: vi.fn() } },
			getPos: () => 3,
		} as unknown as NodeViewProps
		render(
			<TooltipProvider>
				<InspectorDetailComponent {...props} />
			</TooltipProvider>,
		)

		await act(async () => {
			screen.getByTestId("set-expanded").click()
		})
		await waitFor(() => expect(getStoredScreenshotBlob).toHaveBeenCalledWith("storage-1"))
		expect(await screen.findByRole("img", { name: "hero.png" })).toHaveAttribute(
			"src",
			"blob:target-inspector-screenshot",
		)
		createObjectURL.mockRestore()
		revokeObjectURL.mockRestore()
	})
})
