import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from "react"
import { useTranslation } from "react-i18next"
import { cn } from "@/opensource/lib/utils"

export interface PresetContentEditorHandle {
	focus: () => void
	insertPresetValue: () => void
}

interface PresetContentEditorProps {
	value: string
	onChange: (value: string) => void
	placeholder: string
	"data-testid"?: string
}

const PRESET_VALUE_TOKEN = "{preset_value}"
const PRESET_TOKEN_CLASS_NAME =
	"inline-flex h-5 items-center gap-1 rounded-md border border-foreground-indigo bg-background px-2 align-baseline text-xs font-medium text-foreground-indigo"

export const PresetContentEditor = forwardRef<PresetContentEditorHandle, PresetContentEditorProps>(
	function PresetContentEditor(
		{ value, onChange, placeholder, "data-testid": testId }: PresetContentEditorProps,
		ref,
	) {
		const { t } = useTranslation("crew/create")
		const editorRef = useRef<HTMLDivElement>(null)
		const tokenLabel = t("playbook.edit.presets.form.presetValue")
		const placeholderParts = placeholder.split(PRESET_VALUE_TOKEN)

		const emitCurrentValue = useCallback(() => {
			if (!editorRef.current) return
			onChange(serializePresetContent(editorRef.current))
		}, [onChange])

		const focusEditor = useCallback(() => {
			editorRef.current?.focus()
		}, [])

		const insertPresetValue = useCallback(() => {
			const root = editorRef.current
			if (!root) return

			root.focus()
			insertTokenAtSelection(root, tokenLabel)
			emitCurrentValue()
		}, [emitCurrentValue, tokenLabel])

		useImperativeHandle(
			ref,
			() => ({
				focus: focusEditor,
				insertPresetValue,
			}),
			[focusEditor, insertPresetValue],
		)

		useEffect(() => {
			const root = editorRef.current
			if (!root) return

			if (serializePresetContent(root) === value) return
			renderPresetContent(root, value, tokenLabel)
		}, [tokenLabel, value])

		const handleInput = useCallback(() => {
			emitCurrentValue()
		}, [emitCurrentValue])

		const handleKeyDown = useCallback(
			(event: React.KeyboardEvent<HTMLDivElement>) => {
				const root = editorRef.current
				if (!root) return

				if (event.key === "Enter") {
					event.preventDefault()
					insertTextAtSelection(root, "\n")
					emitCurrentValue()
					return
				}

				if (event.key === "Backspace") {
					const removed = removeAdjacentToken(root, "backward")
					if (!removed) return

					event.preventDefault()
					emitCurrentValue()
					return
				}

				if (event.key === "Delete") {
					const removed = removeAdjacentToken(root, "forward")
					if (!removed) return

					event.preventDefault()
					emitCurrentValue()
				}
			},
			[emitCurrentValue],
		)

		const handlePaste = useCallback(
			(event: React.ClipboardEvent<HTMLDivElement>) => {
				event.preventDefault()
				const pastedText = event.clipboardData.getData("text/plain")
				insertTextAtSelection(event.currentTarget, pastedText)
				onChange(serializePresetContent(event.currentTarget))
			},
			[onChange],
		)

		const handleClick = useCallback(
			(event: React.MouseEvent<HTMLDivElement>) => {
				const target = event.target as HTMLElement
				const removeButton = target.closest("[data-preset-token-remove]")
				const token = target.closest("[data-preset-token]")
				const root = editorRef.current

				if (!root || !token) return
				if (!removeButton) return

				event.preventDefault()
				removeToken(root, token)
				emitCurrentValue()
			},
			[emitCurrentValue],
		)

		return (
			<div className="relative">
				{!value && (
					<div className="pointer-events-none absolute left-3 top-2 whitespace-pre-wrap break-words text-sm leading-5 text-muted-foreground">
						{placeholderParts.map((part, index) => (
							<span key={`${part}-${index}`}>
								{part}
								{index < placeholderParts.length - 1 && (
									<span
										className={cn(
											PRESET_TOKEN_CLASS_NAME,
											"mx-1 align-baseline",
										)}
									>
										{tokenLabel}
									</span>
								)}
							</span>
						))}
					</div>
				)}
				<div
					ref={editorRef}
					contentEditable
					suppressContentEditableWarning
					role="textbox"
					aria-multiline="true"
					onInput={handleInput}
					onKeyDown={handleKeyDown}
					onPaste={handlePaste}
					onClick={handleClick}
					className={cn(
						"shadow-xs min-h-[96px] w-full whitespace-pre-wrap break-words rounded-md border border-input bg-background px-3 py-2 text-sm leading-5 text-foreground outline-none",
						"focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
					)}
					data-testid={testId}
				/>
			</div>
		)
	},
)

function serializePresetContent(root: HTMLElement): string {
	return Array.from(root.childNodes)
		.map((node) => serializePresetNode(node))
		.join("")
		.replace(/\u200b/g, "")
}

function serializePresetNode(node: ChildNode): string {
	if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? ""
	if (!(node instanceof HTMLElement)) return ""
	if (node.dataset.presetToken === PRESET_VALUE_TOKEN) return PRESET_VALUE_TOKEN
	if (node.tagName === "BR") return "\n"

	return Array.from(node.childNodes)
		.map((child) => serializePresetNode(child))
		.join("")
}

function renderPresetContent(root: HTMLElement, value: string, tokenLabel: string) {
	root.innerHTML = ""

	const parts = value.split(PRESET_VALUE_TOKEN)
	parts.forEach((part, index) => {
		if (part) root.appendChild(document.createTextNode(part))
		if (index < parts.length - 1) root.appendChild(createPresetTokenElement(tokenLabel))
	})
}

function createPresetTokenElement(tokenLabel: string) {
	const token = document.createElement("span")
	token.dataset.presetToken = PRESET_VALUE_TOKEN
	token.contentEditable = "false"
	token.className = PRESET_TOKEN_CLASS_NAME

	const label = document.createElement("span")
	label.textContent = tokenLabel

	const remove = document.createElement("button")
	remove.type = "button"
	remove.dataset.presetTokenRemove = "true"
	remove.className = "inline-flex items-center justify-center"
	remove.tabIndex = -1
	remove.setAttribute("aria-label", tokenLabel)
	remove.innerHTML =
		'<svg viewBox="0 0 12 12" class="h-3 w-3" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 3 3 9"/><path d="m3 3 6 6"/></svg>'

	token.appendChild(label)
	token.appendChild(remove)

	return token
}

function insertTokenAtSelection(root: HTMLElement, tokenLabel: string) {
	const selection = window.getSelection()
	if (!selection || selection.rangeCount === 0) {
		root.appendChild(createPresetTokenElement(tokenLabel))
		placeCaretAtEnd(root)
		return
	}

	const range = selection.getRangeAt(0)
	if (!root.contains(range.startContainer)) {
		placeCaretAtEnd(root)
		insertTokenAtSelection(root, tokenLabel)
		return
	}

	range.deleteContents()
	const token = createPresetTokenElement(tokenLabel)
	range.insertNode(token)
	placeCaretAfterNode(root, token)
}

function insertTextAtSelection(root: HTMLElement, text: string) {
	const selection = window.getSelection()
	if (!selection || selection.rangeCount === 0) {
		root.appendChild(document.createTextNode(text))
		placeCaretAtEnd(root)
		return
	}

	const range = selection.getRangeAt(0)
	if (!root.contains(range.startContainer)) {
		placeCaretAtEnd(root)
		insertTextAtSelection(root, text)
		return
	}

	range.deleteContents()
	const textNode = document.createTextNode(text)
	range.insertNode(textNode)

	const nextRange = document.createRange()
	nextRange.setStart(textNode, textNode.textContent?.length ?? 0)
	nextRange.collapse(true)
	selection.removeAllRanges()
	selection.addRange(nextRange)
}

function placeCaretAfterNode(root: HTMLElement, node: Node) {
	const selection = window.getSelection()
	if (!selection) return

	const spacer = document.createTextNode("")
	if (node.parentNode) node.parentNode.insertBefore(spacer, node.nextSibling)

	const range = document.createRange()
	range.setStart(spacer, 0)
	range.collapse(true)
	selection.removeAllRanges()
	selection.addRange(range)
	root.focus()
}

function placeCaretAtEnd(root: HTMLElement) {
	const selection = window.getSelection()
	if (!selection) return

	const range = document.createRange()
	range.selectNodeContents(root)
	range.collapse(false)
	selection.removeAllRanges()
	selection.addRange(range)
	root.focus()
}

function removeAdjacentToken(root: HTMLElement, direction: "backward" | "forward") {
	const selection = window.getSelection()
	if (!selection || selection.rangeCount === 0 || !selection.isCollapsed) return false

	const range = selection.getRangeAt(0)
	if (!root.contains(range.startContainer)) return false

	const adjacentToken = findAdjacentToken(range, direction)
	if (!adjacentToken) return false

	removeToken(root, adjacentToken)
	return true
}

function removeToken(root: HTMLElement, token: Element) {
	const removedWithNativeUndo = removeTokenWithNativeUndo(root, token)
	if (removedWithNativeUndo) return

	removeTokenAndPlaceCaret(root, token)
}

function removeTokenWithNativeUndo(root: HTMLElement, token: Element) {
	if (!root.contains(token)) return false

	const selection = window.getSelection()
	if (!selection) return false

	root.focus()

	const range = document.createRange()
	range.selectNode(token)
	selection.removeAllRanges()
	selection.addRange(range)

	return document.execCommand("delete")
}

function removeTokenAndPlaceCaret(root: HTMLElement, token: Element) {
	const selection = window.getSelection()
	if (!selection) return

	const parent = token.parentNode
	if (!parent) return

	const spacer = document.createTextNode("")
	parent.insertBefore(spacer, token.nextSibling)
	token.remove()

	const range = document.createRange()
	range.setStart(spacer, 0)
	range.collapse(true)
	selection.removeAllRanges()
	selection.addRange(range)
	root.focus()
}

function findAdjacentToken(range: Range, direction: "backward" | "forward") {
	const { startContainer, startOffset } = range

	if (startContainer.nodeType === Node.TEXT_NODE) {
		const textNode = startContainer as Text
		if (direction === "backward" && startOffset > 0) return null
		if (direction === "forward" && startOffset < textNode.length) return null

		let sibling = direction === "backward" ? textNode.previousSibling : textNode.nextSibling

		while (sibling) {
			if (sibling instanceof HTMLElement && sibling.dataset.presetToken) return sibling
			if (sibling.nodeType === Node.TEXT_NODE && sibling.textContent) return null
			sibling = direction === "backward" ? sibling.previousSibling : sibling.nextSibling
		}
	}

	if (startContainer instanceof HTMLElement) {
		const sibling =
			direction === "backward"
				? startContainer.childNodes[startOffset - 1]
				: startContainer.childNodes[startOffset]

		if (sibling instanceof HTMLElement && sibling.dataset.presetToken) return sibling
	}

	return null
}
