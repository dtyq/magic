import { fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { TopicMode } from "@/pages/superMagic/pages/Workspace/TopicMode"
import { ConversationInputLayoutProvider } from "@/pages/superMagic/components/ConversationInputResize/context"
import { SLIDES_TEMPLATE_RANDOM_DRAG_TYPE } from "../../constants"
import { ScenePanelVariant } from "../../components/LazyScenePanel/types"

const { mockEditorDragEnter, mockEditorDrop, mockPublish } = vi.hoisted(() => ({
	mockEditorDragEnter: vi.fn(),
	mockEditorDrop: vi.fn(),
	mockPublish: vi.fn(),
}))

vi.mock("mobx-react-lite", () => ({
	observer: <T,>(component: T) => component,
}))

vi.mock("@/hooks/usePortalTarget", () => ({
	default: () => document.body,
}))

vi.mock("@/hooks/useIsMobile", () => ({
	useIsMobile: () => false,
}))

vi.mock("../../hooks", () => ({
	useCurrentSceneConfig: () => ({
		placeholder: "",
		panels: [],
		isLoading: false,
	}),
}))

vi.mock("../../stores", () => ({
	useOptionalScenePanelVariant: () => ScenePanelVariant.TopicPage,
	useOptionalSceneStateStore: () => null,
}))

vi.mock("../../components/editors/DefaultMessageEditorContainer", () => ({
	default: () => (
		<div
			data-testid="default-message-editor"
			contentEditable
			onDragEnter={mockEditorDragEnter}
			onDrop={mockEditorDrop}
		/>
	),
}))

vi.mock("../../components/ScenePanelContainer", () => ({
	default: ({
		onTemplateSelect,
	}: {
		onTemplateSelect?: (template: { value: string }) => void
	}) => (
		<button type="button" onClick={() => onTemplateSelect?.({ value: "template-a" })}>
			选择模板
		</button>
	),
}))

vi.mock("../../components/VideoProductionConfigPanel", () => ({
	default: () => null,
}))

vi.mock("../Slides/SlidesTemplateHomeSelectionPreview", () => ({
	default: ({
		className,
		template,
		templatePickerOpen,
		onTemplatePickerOpenChange,
	}: {
		className?: string
		template?: { value: string } | null
		templatePickerOpen?: boolean
		onTemplatePickerOpenChange?: (open: boolean) => void
	}) => (
		<div
			className={className}
			data-testid="slides-template-preview"
			data-selected-template={template ? String(template.value) : ""}
			data-template-picker-open={templatePickerOpen}
		>
			<button type="button" onClick={() => onTemplatePickerOpenChange?.(true)}>
				更换模板
			</button>
		</div>
	),
}))

vi.mock("@/utils/pubsub", () => ({
	default: { publish: mockPublish },
	PubSubEvents: { Message_Scroll_To_Bottom: "scroll_messages_to_bottom" },
}))

import DefaultInputContainer from "../Default"

describe("DefaultInputContainer", () => {
	afterEach(() => {
		vi.useRealTimers()
		vi.clearAllMocks()
	})

	it("项目页选择模板后不改变消息列表位置", () => {
		vi.useFakeTimers()

		render(
			<DefaultInputContainer
				editorContext={{
					topicMode: TopicMode.PPT,
					editorRef: { current: null },
				}}
			/>,
		)

		fireEvent.click(screen.getByRole("button", { name: "更换模板" }))
		expect(screen.getByTestId("slides-template-preview")).toHaveAttribute(
			"data-template-picker-open",
			"true",
		)
		fireEvent.click(screen.getByRole("button", { name: "选择模板" }))
		expect(screen.getByTestId("slides-template-preview")).toHaveAttribute(
			"data-template-picker-open",
			"false",
		)
		expect(mockPublish).not.toHaveBeenCalled()
	})

	it("clears the selected PPT template when switching topics", () => {
		const { rerender } = render(
			<DefaultInputContainer
				editorContext={{
					topicMode: TopicMode.PPT,
					editorRef: { current: null },
					selectedTopic: { id: "topic-a" },
				}}
			/>,
		)

		fireEvent.click(screen.getByRole("button", { name: "选择模板" }))
		expect(screen.getByTestId("slides-template-preview")).toHaveAttribute(
			"data-selected-template",
			"template-a",
		)

		rerender(
			<DefaultInputContainer
				editorContext={{
					topicMode: TopicMode.PPT,
					editorRef: { current: null },
					selectedTopic: { id: "topic-b" },
				}}
			/>,
		)

		expect(screen.getByTestId("slides-template-preview")).toHaveAttribute(
			"data-selected-template",
			"",
		)
	})

	it("阻止 PPT 预览图拖入输入框", () => {
		render(
			<DefaultInputContainer
				editorContext={{
					topicMode: TopicMode.PPT,
					editorRef: { current: null },
				}}
			/>,
		)

		const editor = screen.getByTestId("default-message-editor")
		const dataTransfer = {
			dropEffect: "copy",
			types: [SLIDES_TEMPLATE_RANDOM_DRAG_TYPE],
		}

		expect(fireEvent.dragEnter(editor, { dataTransfer })).toBe(false)
		expect(mockEditorDragEnter).not.toHaveBeenCalled()
		expect(fireEvent.dragOver(editor, { dataTransfer })).toBe(false)
		expect(dataTransfer.dropEffect).toBe("none")
		expect(fireEvent.drop(editor, { dataTransfer })).toBe(false)
		expect(mockEditorDrop).not.toHaveBeenCalled()
	})

	it("固定会话高度会传递到 PPT 编辑器，并为模板面板保留固定空间", () => {
		render(
			<ConversationInputLayoutProvider value={{ fillHeight: true }}>
				<DefaultInputContainer
					editorContext={{
						topicMode: TopicMode.PPT,
						editorRef: { current: null },
					}}
				/>
			</ConversationInputLayoutProvider>,
		)

		const editorRegion = screen.getByTestId("default-message-editor").parentElement
		const sceneLayout = editorRegion?.parentElement
		const motionLayout = sceneLayout?.parentElement

		expect(editorRegion).toHaveClass("min-h-0", "flex-1", "[&>div]:h-full")
		expect(sceneLayout).toHaveClass("h-full", "min-h-0")
		expect(motionLayout).toHaveClass("h-full", "min-h-0")
		expect(screen.getByTestId("slides-template-preview")).toHaveClass("shrink-0")
	})
})
