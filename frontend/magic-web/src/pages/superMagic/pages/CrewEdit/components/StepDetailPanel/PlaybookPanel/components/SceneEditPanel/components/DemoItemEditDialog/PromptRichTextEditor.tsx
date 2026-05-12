import Placeholder from "@tiptap/extension-placeholder"
import StarterKit from "@tiptap/starter-kit"
import { EditorContent, useEditor, type JSONContent } from "@tiptap/react"
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { MentionExtension } from "@/components/business/MentionPanel/tiptap-plugin"
import { MentionItemType } from "@/components/business/MentionPanel/types"
import type { DataService } from "@/components/business/MentionPanel/types"
import { cn } from "@/lib/utils"
import {
	getPromptRichTextPlainText,
	isPromptRichTextEmpty,
	parsePromptRichText,
	PROMPT_PRESET_VALUE_TOKEN,
	serializePromptRichTextLocaleValue,
} from "@/pages/superMagic/components/MainInputContainer/panels/promptRichText"
import { PromptPresetValueExtension } from "./PromptPresetValueExtension"

const PRESET_TOKEN_CLASS_NAME =
	"inline-flex h-5 items-center gap-1 rounded-md border border-foreground-indigo bg-background px-2 align-baseline text-xs font-medium text-foreground-indigo"

const PROMPT_EDITOR_MENTION_CLASS_NAME = cn(
	"[&_.mention-node-view]:inline [&_.mention-node-view]:align-baseline",
	"[&_p>.magic-mention:first-child]:ml-0",
	"[&_p>.mention-node-view:first-child>.magic-mention]:ml-0",
	"[&_.magic-mention]:mx-0.5 [&_.magic-mention]:inline [&_.magic-mention]:cursor-pointer",
	"[&_.magic-mention]:overflow-hidden [&_.magic-mention]:text-ellipsis [&_.magic-mention]:rounded-[4px]",
	"[&_.magic-mention]:bg-primary-10 [&_.magic-mention]:px-1 [&_.magic-mention]:py-0.5",
	"[&_.magic-mention]:align-baseline [&_.magic-mention]:text-xs [&_.magic-mention]:leading-4",
	"[&_.magic-mention]:text-foreground",
)

const PROMPT_EDITOR_SEPARATOR_CLASS_NAME = cn(
	"[&_.ProseMirror-separator]:inline",
	"[&_img.ProseMirror-separator]:inline",
)

export interface PromptRichTextEditorHandle {
	focus: () => void
	insertPresetValue: () => void
}

interface PromptRichTextEditorProps {
	value: string
	onChange: (value: string) => void
	placeholder?: string
	mentionDataService: DataService
	className?: string
	"data-testid"?: string
}

function getNormalizedLocaleValue(value: string): string {
	return serializePromptRichTextLocaleValue(parsePromptRichText(value))
}

function getMentionLanguage(language: string) {
	return language.startsWith("zh") ? "zh" : "en"
}

function renderPlaceholder(
	placeholder: string | undefined,
	tokenLabel: string,
	plainTextFallback?: string,
) {
	const displayText = plainTextFallback || placeholder
	if (!displayText) return null

	const parts = displayText.split(PROMPT_PRESET_VALUE_TOKEN)
	return (
		<div className="pointer-events-none absolute left-3 top-2 whitespace-pre-wrap break-words pr-3 text-sm leading-5 text-muted-foreground">
			{parts.map((part, index) => (
				<span key={`${part}-${index}`}>
					{part}
					{index < parts.length - 1 && (
						<span className={cn(PRESET_TOKEN_CLASS_NAME, "mx-1 align-baseline")}>
							{tokenLabel}
						</span>
					)}
				</span>
			))}
		</div>
	)
}

export const PromptRichTextEditor = forwardRef<
	PromptRichTextEditorHandle,
	PromptRichTextEditorProps
>(function PromptRichTextEditor(
	{ value, onChange, placeholder, mentionDataService, className, "data-testid": testId },
	ref,
) {
	const { i18n, t } = useTranslation("crew/create")
	const normalizedValue = useMemo(() => getNormalizedLocaleValue(value), [value])
	const normalizedValueRef = useRef(normalizedValue)
	const [isEmpty, setIsEmpty] = useState(() => isPromptRichTextEmpty(value))
	const tokenLabel = t("playbook.edit.presets.form.presetValue")

	useEffect(() => {
		normalizedValueRef.current = normalizedValue
		setIsEmpty(isPromptRichTextEmpty(value))
	}, [normalizedValue, value])

	const mentionExtension = useMemo(
		() =>
			MentionExtension.configure({
				language: getMentionLanguage(i18n.language),
				getParentContainer: () => document.body,
				dataService: mentionDataService,
				canSelectItem: (item) =>
					[
						MentionItemType.SKILL,
						MentionItemType.MCP,
						MentionItemType.TOOL,
						MentionItemType.AGENT,
					].includes(item.type),
			}),
		[i18n.language, mentionDataService],
	)

	const editor = useEditor(
		{
			extensions: [
				StarterKit.configure({
					blockquote: false,
					bold: false,
					bulletList: false,
					code: false,
					codeBlock: false,
					heading: false,
					horizontalRule: false,
					italic: false,
					orderedList: false,
					strike: false,
				}),
				Placeholder.configure({
					placeholder: "",
				}),
				PromptPresetValueExtension,
				mentionExtension,
			],
			content: parsePromptRichText(value),
			onCreate({ editor: currentEditor }) {
				setIsEmpty(isPromptRichTextEmpty(currentEditor.getJSON()))
			},
			onUpdate({ editor: currentEditor }) {
				const nextContent = currentEditor.getJSON()
				const nextValue = serializePromptRichTextLocaleValue(nextContent)
				setIsEmpty(isPromptRichTextEmpty(nextContent))
				if (nextValue === normalizedValueRef.current) return
				onChange(nextValue)
			},
			editorProps: {
				attributes: {
					class: "min-h-[96px] whitespace-pre-wrap break-words px-3 py-2 text-sm leading-5 text-foreground outline-none",
				},
			},
		},
		[mentionExtension],
	)

	useEffect(() => {
		if (!editor) return
		if (serializePromptRichTextLocaleValue(editor.getJSON()) === normalizedValue) return
		editor.commands.setContent(parsePromptRichText(value) as JSONContent, false)
		setIsEmpty(isPromptRichTextEmpty(value))
	}, [editor, normalizedValue, value])

	useImperativeHandle(
		ref,
		() => ({
			focus: () => {
				editor?.commands.focus("end")
			},
			insertPresetValue: () => {
				if (!editor) return
				editor.chain().focus().insertPromptPresetValue().run()
			},
		}),
		[editor],
	)

	const defaultLocalePlainText =
		value && !normalizedValue ? getPromptRichTextPlainText(value) : undefined

	return (
		<div className="relative">
			{isEmpty && renderPlaceholder(placeholder, tokenLabel, defaultLocalePlainText)}
			<div
				className={cn(
					"min-h-[96px] rounded-md border border-input bg-background shadow-xs",
					"focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50",
					"[&_.ProseMirror]:min-h-[96px]",
					PROMPT_EDITOR_MENTION_CLASS_NAME,
					PROMPT_EDITOR_SEPARATOR_CLASS_NAME,
					className,
				)}
				onClick={() => editor?.commands.focus("end")}
			>
				<EditorContent editor={editor} data-testid={testId} />
			</div>
		</div>
	)
})
