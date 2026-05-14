import type { JSONContent } from "@tiptap/core"
import { RefObject, useEffect } from "react"
import { TopicMode } from "../pages/Workspace/TopicMode"
import { MessageEditorRef } from "../components/MessageEditor/MessageEditor"
import superMagicModeService from "@/services/superMagic/SuperMagicModeService"
import { logger as Logger } from "@/utils/log"

const OFFICIAL_PROMPTS_PAYLOAD_STORAGE_KEY = "officialPromptsPayload"

export interface OfficialPromptsPayload {
	topicMode?: TopicMode
	agentCode?: string
	value?: string
	llm?: string
	imageModel?: string
}

export interface UseOfficialPromptsPayloadOptions {
	editorRef: RefObject<MessageEditorRef | null>
	setTopicMode: (mode: TopicMode) => void
	setIsFocused: (value: boolean) => void
	logger?: ReturnType<typeof Logger.createLogger>
}

function clearOfficialPromptsPayload() {
	sessionStorage.removeItem(OFFICIAL_PROMPTS_PAYLOAD_STORAGE_KEY)
}

function buildEditorContent(value?: string): JSONContent {
	return {
		type: "doc",
		content: [
			{
				type: "paragraph",
				content: [{ type: "text", text: value ?? "" }],
			},
		],
	}
}

function resolveModelParams(mode: TopicMode, content: OfficialPromptsPayload) {
	const models = superMagicModeService.getModelListByMode(mode, content.agentCode)
	const imageModels = superMagicModeService.getImageModelListByMode(mode, content.agentCode)
	return {
		languageModel: models?.find((item) => item.model_name === content.llm) ?? null,
		imageModel: imageModels?.find((item) => item.model_name === content.imageModel) ?? null,
	}
}

function waitForEditorReady(
	editorRef: RefObject<MessageEditorRef | null>,
	maxFrames = 60,
): Promise<boolean> {
	let frameCount = 0
	return new Promise((resolve) => {
		const check = () => {
			frameCount += 1
			if (editorRef.current?.editor) return resolve(true)
			if (frameCount >= maxFrames) return resolve(false)
			requestAnimationFrame(check)
		}
		requestAnimationFrame(check)
	})
}

function waitForEditorAfterModeSwitch(
	editorRef: RefObject<MessageEditorRef | null>,
	editorBeforeSwitch: MessageEditorRef["editor"] | null | undefined,
	maxFrames = 60,
): Promise<boolean> {
	let frameCount = 0
	return new Promise((resolve) => {
		const check = () => {
			frameCount += 1
			const currentEditor = editorRef.current?.editor
			if (currentEditor && currentEditor !== editorBeforeSwitch) return resolve(true)
			if (frameCount >= maxFrames) return resolve(Boolean(currentEditor))
			requestAnimationFrame(check)
		}
		requestAnimationFrame(check)
	})
}

export function useOfficialPromptsPayload({
	editorRef,
	setTopicMode,
	setIsFocused,
	logger = Logger.createLogger("useOfficialPromptsPayload"),
}: UseOfficialPromptsPayloadOptions) {
	useEffect(() => {
		const raw = sessionStorage.getItem(OFFICIAL_PROMPTS_PAYLOAD_STORAGE_KEY)
		if (!raw) return

		let cancelled = false

		void (async () => {
			try {
				const content = JSON.parse(raw) as OfficialPromptsPayload
				const mode = content.topicMode || TopicMode.Design
				const editorBeforeSwitch = editorRef.current?.editor
				setTopicMode(mode)

				const switchedReady = await waitForEditorAfterModeSwitch(
					editorRef,
					editorBeforeSwitch,
				)
				const ready = switchedReady || (await waitForEditorReady(editorRef))
				if (cancelled) return
				if (!ready) {
					clearOfficialPromptsPayload()
					logger.warn("Official prompt injection skipped because editor is not ready")
					return
				}

				const editor = editorRef.current
				editor?.focus?.({ enableWhenIsMobile: true })

				const modelParams = resolveModelParams(mode, content)
				if (modelParams.languageModel || modelParams.imageModel) {
					editor?.setModels?.({
						...(modelParams.languageModel
							? { languageModel: modelParams.languageModel }
							: {}),
						...(modelParams.imageModel ? { imageModel: modelParams.imageModel } : {}),
					})
				}

				editor?.setContent?.(buildEditorContent(content.value))
				setIsFocused(true)
				clearOfficialPromptsPayload()
			} catch (error) {
				clearOfficialPromptsPayload()
				logger.error("Failed to consume officialPromptsPayload from sessionStorage", error)
			}
		})()

		return () => {
			cancelled = true
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [])
}
