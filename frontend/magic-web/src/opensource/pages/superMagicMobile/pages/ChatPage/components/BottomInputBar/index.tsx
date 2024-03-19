import { cn } from "@/opensource/lib/utils"
import ModeSelector from "./ModeSelector"
import { SceneEditorNodes } from "@/opensource/pages/superMagic/components/MainInputContainer/components/editors/types"
import { useTranslation } from "react-i18next"
import { VoiceInputRef } from "@/opensource/components/business/VoiceInput/types"
import { useEffect, useRef, useState } from "react"
import SuperMagicVoiceInput from "@/opensource/pages/superMagic/components/MessageEditor/components/VoiceInput"
import { useEditor, EditorContent } from "@tiptap/react"
import { Document } from "@tiptap/extension-document"
import { Paragraph } from "@tiptap/extension-paragraph"
import { Text } from "@tiptap/extension-text"
import type { JSONContent } from "@tiptap/core"

interface BottomInputBarProps {
	show: boolean
	/** 点击输入区域时触发，若当前有语音输入内容则携带 JSONContent 传出 */
	onInputClick?: (content: JSONContent | null) => void
	/** 弹窗编辑器的实时内容，变化时将同步到底部栏本地编辑器 */
	syncContent?: JSONContent | null
	editorNodes?: SceneEditorNodes
}

export default function BottomInputBar({
	show,
	onInputClick,
	syncContent,
	editorNodes,
}: BottomInputBarProps) {
	const { t } = useTranslation("super/mainInput")

	const voiceInputRef = useRef<VoiceInputRef>(null)

	const [isEmpty, setIsEmpty] = useState(true)

	const editor = useEditor({
		extensions: [Document, Paragraph, Text],
		editable: true,
		onCreate: ({ editor: e }) => setIsEmpty(e.isEmpty),
		onUpdate: ({ editor: e }) => setIsEmpty(e.isEmpty),
	})

	/** 弹窗编辑器内容回写：当 syncContent 更新时，将最新内容同步到本地展示编辑器 */
	useEffect(() => {
		if (!editor || syncContent == null) return
		editor.commands.setContent(syncContent)
		setIsEmpty(editor.isEmpty)
	}, [syncContent, editor])

	return (
		<div className={cn("flex w-full flex-col gap-2 px-2 pb-1.5", show ? "block" : "hidden")}>
			{editorNodes?.taskDataNode}
			{editorNodes?.messageQueueNode}
			<div className="flex items-center gap-1 rounded-3xl border border-border bg-background p-1 shadow-xs">
				{/* 角色选择器 */}
				<ModeSelector />

				{/* TipTap 编辑器展示区 - 语音输入内容落点，点击只触发弹出输入框 */}
				<div className="relative min-w-0 flex-1">
					<EditorContent
						editor={editor}
						className={cn(
							"pointer-events-none",
							"[&_.ProseMirror]:m-0 [&_.ProseMirror]:truncate [&_.ProseMirror]:font-['Geist'] [&_.ProseMirror]:text-sm [&_.ProseMirror]:text-foreground [&_.ProseMirror]:outline-none",
							"[&_p]:m-0 [&_p]:p-0",
						)}
					/>
					{/* 内容为空时的占位文本 */}
					{isEmpty && (
						<div className="pointer-events-none absolute inset-0 flex items-center truncate font-['Geist'] text-sm text-muted-foreground">
							{t("chatInput.mobilePlaceholder")}
						</div>
					)}
					{/* 点击拦截层 - 阻止键盘唤起，统一转发至 onInputClick */}
					<div
						className="absolute inset-0 cursor-text"
						role="textbox"
						aria-label={t("chatInput.mobilePlaceholder")}
						tabIndex={0}
						onClick={() =>
							onInputClick?.(editor?.isEmpty ? null : (editor?.getJSON() ?? null))
						}
					/>
				</div>

				{/* <SuperMagicVoiceInput
					ref={voiceInputRef}
					tiptapEditor={editor}
					iconSize={20}
					className="flex size-10 items-center justify-center gap-2 rounded-full bg-secondary"
				/> */}
			</div>
		</div>
	)
}
