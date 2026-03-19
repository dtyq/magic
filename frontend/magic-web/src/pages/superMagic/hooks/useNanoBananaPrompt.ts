import { RefObject } from "react"
import { useDeepCompareEffect } from "ahooks"
import { TopicMode } from "../pages/Workspace/types"
import { MessageEditorRef } from "../components/MessageEditor/MessageEditor"
import { ModelItem } from "../components/MessageEditor/types"
import superMagicModeService from "@/services/superMagic/SuperMagicModeService"
import { logger as Logger } from "@/utils/log"

const NANO_BANANA_STORAGE_KEY = "nanoBananaPrompt"

export interface NanoBananaPromptContent {
	topicMode?: TopicMode
	value?: string
	llm?: string
	imageModel?: string
}

export interface UseNanoBananaPromptOptions {
	editorRef: RefObject<MessageEditorRef | null>
	setTopicMode: (mode: TopicMode) => void
	setIsFocused: (value: boolean) => void
	logger?: ReturnType<typeof Logger.createLogger>
}

/**
 * Reads nanoBanana prompt from sessionStorage and applies it to the editor.
 * Used when navigating from external sources (e.g. nanoBanana) with pre-filled content.
 */
export function useNanoBananaPrompt({
	editorRef,
	setTopicMode,
	setIsFocused,
	logger = Logger.createLogger("useNanoBananaPrompt"),
}: UseNanoBananaPromptOptions) {
	useDeepCompareEffect(() => {
		const raw = sessionStorage.getItem(NANO_BANANA_STORAGE_KEY)
		if (!raw) return

		try {
			const content = JSON.parse(raw) as NanoBananaPromptContent
			const mode = content?.topicMode || TopicMode.Design
			setTopicMode(mode)

			setTimeout(() => {
				editorRef.current?.editor?.commands.focus()

				requestAnimationFrame(() => {
					editorRef.current?.setContent?.({
						type: "doc",
						content: [
							{
								type: "paragraph",
								content: [{ type: "text", text: content?.value ?? "" }],
							},
						],
					})
				})

				const models = superMagicModeService.getModelListByMode(mode)
				const imageModels = superMagicModeService.getImageModelListByMode(mode)
				const languageModel = (models || []).find((o) => o.model_name === content?.llm)
				const imageModel = (imageModels || []).find(
					(o) => o.model_name === content?.imageModel,
				)
				const modelParams: {
					languageModel?: ModelItem | null
					imageModel?: ModelItem | null
				} = {}
				if (languageModel) modelParams.languageModel = languageModel
				if (imageModel) modelParams.imageModel = imageModel
				if (Object.keys(modelParams).length > 0) {
					editorRef.current?.setModels?.(modelParams)
				}

				setIsFocused(true)
			}, 500)

			const timeout = setTimeout(() => {
				sessionStorage.removeItem(NANO_BANANA_STORAGE_KEY)
			}, 3000)

			return () => clearTimeout(timeout)
		} catch (error) {
			logger.error("Failed to parse nanoBananaPrompt content from sessionStorage", error)
		}
	}, [])
}
