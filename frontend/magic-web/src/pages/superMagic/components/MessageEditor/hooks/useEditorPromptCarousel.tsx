import type { Editor } from "@/infrastructure/editors/tiptap/react"
import { useRef, useState, type RefObject } from "react"
import { useMemoizedFn } from "ahooks"
import EditorPromptCarousel, {
	type EditorPromptCarouselHandle,
} from "../components/EditorPromptCarousel"
import type { EditorPromptCarouselConfig } from "../types"
import { runActiveEditor } from "../utils/editorLifecycle"
import { resolvePromptCarouselState, type PromptCarouselState } from "../utils/promptCarousel"

interface UseEditorPromptCarouselParams {
	promptCarousel?: EditorPromptCarouselConfig
	isMobile: boolean
	hasEditorContent: boolean
	hasFiles: boolean
	isComposing: boolean
	aiCompletionEnabled: boolean
	editorRef: RefObject<Editor | null>
}

export default function useEditorPromptCarousel({
	promptCarousel,
	isMobile,
	hasEditorContent,
	hasFiles,
	isComposing,
	aiCompletionEnabled,
	editorRef,
}: UseEditorPromptCarouselParams) {
	const promptCarouselRef = useRef<EditorPromptCarouselHandle>(null)
	const previousStateRef = useRef<PromptCarouselState | null>(null)
	const [isEditorFocused, setIsEditorFocused] = useState(false)
	const promptCarouselConfigured = !isMobile && Boolean(promptCarousel?.examples.some(Boolean))
	const state = resolvePromptCarouselState({
		promptCarouselConfigured,
		hasEditorContent,
		hasFiles,
		isComposing,
		aiCompletionEnabled,
		previousState: previousStateRef.current,
	})

	if (!isComposing) previousStateRef.current = state

	const acceptPromptCarousel = useMemoizedFn(() => {
		const prompt = promptCarouselRef.current?.getAcceptablePrompt()
		if (!prompt) return false

		return (
			runActiveEditor(
				editorRef.current,
				(editor) => editor.chain().focus().insertContent(prompt).run(),
				false,
			) ?? false
		)
	})

	const navigatePromptCarousel = useMemoizedFn((direction: "previous" | "next") => {
		const navigate =
			direction === "previous"
				? promptCarouselRef.current?.showPreviousPrompt
				: promptCarouselRef.current?.showNextPrompt
		return navigate?.() ?? false
	})

	const promptCarouselNode =
		promptCarouselConfigured && promptCarousel ? (
			<EditorPromptCarousel
				ref={promptCarouselRef}
				config={promptCarousel}
				enabled={state.promptCarouselEnabled}
				visible={!isComposing}
				isFocused={isEditorFocused}
				onAccept={acceptPromptCarousel}
			/>
		) : null

	return {
		promptCarouselConfigured,
		effectiveAiCompletionEnabled: state.aiCompletionEnabled,
		promptCarouselNode,
		acceptPromptCarousel,
		navigatePromptCarousel,
		setIsEditorFocused,
	}
}
