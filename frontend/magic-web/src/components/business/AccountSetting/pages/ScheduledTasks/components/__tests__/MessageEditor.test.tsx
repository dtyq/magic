import { createRef, forwardRef, useImperativeHandle, type RefObject } from "react"
import { act, render, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { ModelItem } from "@/pages/superMagic/components/MessageEditor/components/ModelSwitch/types"
import type { MessageEditorRef as BaseMessageEditorRef } from "@/pages/superMagic/components/MessageEditor/MessageEditor"
import MessageEditor, { type MessageEditorRef } from "../MessageEditor"

const mocks = vi.hoisted(() => ({
	setModels: vi.fn(),
}))

vi.mock(
	"@/pages/superMagic/components/MainInputContainer/components/editors/DefaultMessageEditorContainer",
	() => ({
		default: forwardRef<BaseMessageEditorRef>(function MockDefaultMessageEditorContainer(
			{ editorRef }: { editorRef?: RefObject<BaseMessageEditorRef | null> },
			ref,
		) {
			const editorApi = {
				getDraftKey: () => null,
				beginDraftSwitch: vi.fn(async () => true),
				endDraftSwitch: vi.fn(),
				prepareQueueDraft: vi.fn(async () => undefined),
				restoreQueueDraft: vi.fn(async () => "activated" as const),
				getQueueDraft: () => null,
				subscribeQueueDraft: vi.fn(() => () => undefined),
				keepQueueDraft: vi.fn(async () => undefined),
				completeQueueDraft: vi.fn(async () => false),
				editor: null,
				canSendMessage: true,
				getFiles: () => [],
				clearFiles: vi.fn(),
				getValue: () => undefined,
				clearContent: vi.fn(),
				clearContentAfterSend: vi.fn(),
				setContent: vi.fn(),
				restoreMentionItems: vi.fn(),
				restoreContent: vi.fn(),
				focus: vi.fn(),
				addUploadFiles: vi.fn(async () => undefined),
				loadDraftReady: vi.fn(async () => undefined),
				saveSuperMagicTopicModel: vi.fn(),
				setModels: mocks.setModels,
			}
			useImperativeHandle(ref, () => editorApi)
			useImperativeHandle(editorRef, () => editorApi)

			return <div data-testid="base-message-editor" />
		}),
	}),
)

vi.mock("@/pages/superMagic/components/TopicMode", () => ({
	ModeToggle: () => <div data-testid="mode-toggle" />,
}))

vi.mock("@/pages/superMagic/components/MessageEditor/services/uploadMentionService", () => ({
	collectMentionItemsFromContent: () => [],
}))

function createModel(modelId: string): ModelItem {
	return {
		id: modelId,
		group_id: "group",
		model_id: modelId,
		model_name: modelId,
		provider_model_id: modelId,
		model_description: "",
		model_icon: "",
		model_status: "normal" as ModelItem["model_status"],
		sort: 0,
	}
}

describe("ScheduledTasks MessageEditor", () => {
	beforeEach(() => {
		mocks.setModels.mockClear()
	})

	it("exposes language, image and video model selections", async () => {
		const ref = createRef<MessageEditorRef>()
		const languageModel = createModel("language-model")
		const imageModel = createModel("image-model")
		const videoModel = createModel("video-model")

		render(
			<MessageEditor
				ref={ref}
				selectedModel={languageModel}
				selectedImageModel={imageModel}
				selectedVideoModel={videoModel}
			/>,
		)

		await waitFor(() => {
			expect(ref.current?.selectedModel).toEqual(languageModel)
			expect(ref.current?.selectedImageModel).toEqual(imageModel)
			expect(ref.current?.selectedVideoModel).toEqual(videoModel)
		})
	})

	it("restores image and video models through the base editor", () => {
		const ref = createRef<MessageEditorRef>()

		render(<MessageEditor ref={ref} />)

		act(() => {
			ref.current?.setSelectedImageModel({ model_id: "image-model" })
			ref.current?.setSelectedVideoModel({ model_id: "video-model" })
		})

		expect(ref.current?.selectedImageModel).toMatchObject({
			model_id: "image-model",
			model_name: "image-model",
		})
		expect(ref.current?.selectedVideoModel).toMatchObject({
			model_id: "video-model",
			model_name: "video-model",
		})
		expect(mocks.setModels).toHaveBeenNthCalledWith(1, {
			imageModel: expect.objectContaining({ model_id: "image-model" }),
		})
		expect(mocks.setModels).toHaveBeenNthCalledWith(2, {
			videoModel: expect.objectContaining({ model_id: "video-model" }),
		})
	})
})
