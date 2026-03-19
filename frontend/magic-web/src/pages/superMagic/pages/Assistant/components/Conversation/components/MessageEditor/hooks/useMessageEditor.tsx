import { useEditor, JSONContent } from "@tiptap/react"
import type { Extension } from "@tiptap/react"
import { UndoRedo } from "@tiptap/extensions"
import { Document } from "@tiptap/extension-document"
import { Paragraph } from "@tiptap/extension-paragraph"
import { Text } from "@tiptap/extension-text"
import { useMemo, useRef, useEffect } from "react"
import AiCompletionService from "@/services/chat/editor/AiCompletionService"
import {
	CodeAwarePasteExtension,
	HardBlock,
	PlaceholderExtension,
} from "@/pages/superMagic/components/MessageEditor/extensions"
import QuickInstructionExtension from "@/pages/chatNew/components/quick-instruction/extension"
import { type FileError } from "@/components/base/MagicRichEditor/utils"
import { useImageExtensions } from "@/components/base/MagicRichEditor/hooks"
import EditorService from "@/services/chat/editor/EditorService"

interface UseMessageEditorProps {
	value?: JSONContent | string | null
	placeholder?: string
	onSend?: (content: JSONContent | undefined) => void
	onChange?: (content: JSONContent) => void
	onImageRemoved?: (attrs: Record<string, unknown>) => void
	onFileUploadError?: (error: FileError[]) => void
}

export const useMessageEditor = ({
	value,
	onSend,
	placeholder,
	onChange,
	onImageRemoved,
	onFileUploadError,
}: UseMessageEditorProps) => {
	const domRef = useRef<HTMLDivElement>(null)

	const scrollToBottom = () => {
		setTimeout(() => {
			const proseMirror = domRef.current?.querySelector(".ProseMirror")
			if (proseMirror) {
				proseMirror.scrollTop = proseMirror.scrollHeight
			}
		}, 0)
	}

	// Use image extensions hook with custom handlers (only when enabled)
	const { extensions: imageExtensions } = useImageExtensions({
		onImageRemoved,
		onPasteFileFail: onFileUploadError,
	})

	const aiCompletionExtension = useMemo(() => {
		return AiCompletionService.getExtension({
			alwaysShowTip: true,
			fetchSuggestion: EditorService.fetchAiAutoCompletion,
		}) as Extension
	}, [])

	const tiptapEditor = useEditor({
		content: value,
		onUpdate({ editor }) {
			onChange?.(editor.getJSON())
		},
		editorProps: {
			handleKeyDown: (_, event) => {
				event.stopPropagation()

				// 其他实际内容输入键触发停止语音录制
				const isContentKey =
					event.key.length === 1 || // 单字符按键（字母、数字、符号）
					event.key === "Backspace" ||
					event.key === "Delete" ||
					event.key === "Space"

				// 如果按下的不是Tab键, 且是实际内容输入键，则清除提示词
				if (isContentKey) {
					AiCompletionService.clearSuggestion()
				}

				// 如果按下的是回车键
				if (event.key === "Enter") {
					// shift+enter, command+enter, ctrl+enter, alt+enter 换行，让扩展处理
					if (event.shiftKey || event.metaKey || event.ctrlKey || event.altKey) {
						return false // 让扩展的键盘快捷键处理
					}

					// 普通回车发送消息
					// onKeyboardInput?.()
					onSend?.(tiptapEditor?.getJSON())
					return true
				}

				if (isContentKey) {
					// onKeyboardInput?.()
				}

				// 对于其他键，让扩展优先处理，包括mention面板
				return false
			},
		},
		extensions: [
			Document,
			Paragraph,
			Text,
			HardBlock,
			CodeAwarePasteExtension,
			PlaceholderExtension.configure({
				placeholder, // Initial value, dynamically updated via updatePlaceholder
			}),
			QuickInstructionExtension,
			UndoRedo.configure({
				depth: 100,
				newGroupDelay: 250,
			}),
			...(imageExtensions as Extension[]),
			aiCompletionExtension,
		],
	})

	AiCompletionService.setInstance({ editor: tiptapEditor })

	// Handle dynamic placeholder updates
	useEffect(() => {
		if (tiptapEditor && placeholder) {
			tiptapEditor.commands.updatePlaceholder(placeholder)
		}
	}, [tiptapEditor, placeholder])

	return {
		tiptapEditor,
		domRef,
		scrollToBottom,
	}
}
