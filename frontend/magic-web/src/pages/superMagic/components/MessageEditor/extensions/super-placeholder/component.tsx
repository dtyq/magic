import React, { useState, useCallback, useRef, useEffect } from "react"
import { NodeViewWrapper, ReactNodeViewProps } from "@tiptap/react"
import { useStyles } from "./styles"
import type { SuperPlaceholderAttrs } from "./types"

// Super Placeholder React 组件
export const SuperPlaceholderComponent: React.FC<ReactNodeViewProps> = ({
	node,
	updateAttributes,
	deleteNode,
	selected,
	editor,
}) => {
	const { styles } = useStyles({ size: node?.attrs?.size || "default" })
	const {
		props: { value = "", placeholder = "", defaultValue = "" },
		_direction,
	} = node.attrs as SuperPlaceholderAttrs & { _direction?: string }
	const [currentValue, setCurrentValue] = useState(value || defaultValue || "")
	const inputRef = useRef<HTMLSpanElement>(null)

	// Handle input event for contentEditable
	const handleInput = useCallback(
		(e: React.FormEvent<HTMLSpanElement>) => {
			const newValue = e.currentTarget.textContent || ""
			setCurrentValue(newValue)
			updateAttributes({
				props: {
					...node.attrs.props,
					value: newValue,
				},
			})
		},
		[updateAttributes, node.attrs.props],
	)

	// Initialize contentEditable content on mount
	useEffect(() => {
		if (inputRef.current) {
			if (currentValue === "") {
				inputRef.current.innerHTML = ""
			} else {
				inputRef.current.textContent = currentValue
			}
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []) // Only run on mount

	// Update contentEditable content when external value prop changes
	useEffect(() => {
		const effectiveValue = value || defaultValue || ""
		if (inputRef.current && effectiveValue !== currentValue) {
			if (effectiveValue === "") {
				inputRef.current.innerHTML = ""
			} else {
				inputRef.current.textContent = effectiveValue
			}
			setCurrentValue(effectiveValue)
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [value, defaultValue]) // Depend on both value and defaultValue

	// Handle click events including triple-click detection
	const handleClick = useCallback((e: React.MouseEvent<HTMLSpanElement>) => {
		e.stopPropagation()

		// Detect triple-click using the detail property
		if (e.detail === 3) {
			e.preventDefault()

			// Directly select all content in this placeholder
			if (inputRef.current) {
				const range = document.createRange()
				const selection = window.getSelection()

				if (selection) {
					range.selectNodeContents(inputRef.current)
					selection.removeAllRanges()
					selection.addRange(range)
				}
			}
			return
		}
	}, [])

	// Prevent default triple-click behavior
	const handleMouseDown = useCallback((e: React.MouseEvent<HTMLSpanElement>) => {
		e.stopPropagation()

		// For triple-click, prevent default to avoid browser's line selection
		if (e.detail === 3) {
			e.preventDefault()
		}
	}, [])

	// Handle mouse up events
	const handleMouseUp = useCallback((e: React.MouseEvent<HTMLSpanElement>) => {
		e.stopPropagation()
		// Let the browser handle focus and cursor positioning naturally
		// to preserve the user's click position
	}, [])

	// Check if all content in super placeholder is selected
	const isAllContentSelected = useCallback(() => {
		if (!inputRef.current) return false

		const selection = window.getSelection()
		if (!selection || selection.rangeCount === 0) return false

		const range = selection.getRangeAt(0)
		const textContent = inputRef.current.textContent || ""

		// Simple check: if selection is within our element and covers all text
		const isWithinElement =
			inputRef.current.contains(range.startContainer) &&
			inputRef.current.contains(range.endContainer)

		if (!isWithinElement) return false

		// Check if the selected text matches our content (allowing for whitespace differences)
		const selectedText = range.toString()
		return textContent.length > 0 && selectedText.trim() === textContent.trim()
	}, [])

	// Handle key events
	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent) => {
			// Handle select all with hierarchical logic
			if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "a") {
				e.preventDefault()
				e.stopPropagation()

				const textContent = inputRef.current?.textContent || ""

				// If empty or already all selected, expand to editor level
				if (textContent.length === 0 || isAllContentSelected()) {
					// Clear current selection and focus editor
					window.getSelection()?.removeAllRanges()

					setTimeout(() => {
						editor?.commands.focus()
						editor?.commands.selectAll()
					}, 0)
					return
				}

				// Otherwise, select all content in this placeholder
				if (inputRef.current) {
					const range = document.createRange()
					const selection = window.getSelection()

					if (selection) {
						range.selectNodeContents(inputRef.current)
						selection.removeAllRanges()
						selection.addRange(range)
					}
				}
				return
			}

			// Prevent line breaks in SuperPlaceholder but trigger send functionality
			if (e.key === "Enter") {
				e.preventDefault() // Prevent line break in contentEditable
				e.stopPropagation() // Prevent bubbling

				// Check for modifier keys - if present, let editor handle (for line breaks)
				if (e.shiftKey || e.metaKey || e.ctrlKey || e.altKey) {
					// Manually trigger editor's hard break command
					editor.commands.setHardBreak()
					return
				}

				// For normal Enter, manually trigger the editor's send logic
				// We need to simulate the editor's handleKeyDown logic
				const editorView = editor.view
				if (editorView) {
					// Create a synthetic keyboard event for the editor
					const syntheticEvent = new KeyboardEvent("keydown", {
						key: "Enter",
						code: "Enter",
						bubbles: true,
						cancelable: true,
					})

					// Dispatch to editor's DOM element to trigger editor's handleKeyDown
					editorView.dom.dispatchEvent(syntheticEvent)
				}
				return
			}

			// Handle escape key to delete the node
			if (e.key === "Escape") {
				e.preventDefault()
				e.stopPropagation()
				deleteNode()
				return
			}

			// Allow all other keys to bubble normally (including Tab for navigation and spaces)
		},
		[deleteNode, editor, isAllContentSelected],
	)

	// Handle focus when node becomes selected via keyboard navigation
	useEffect(() => {
		if (selected && inputRef.current) {
			// Only focus if this is a single node selection (not part of a range selection like select all)
			const { selection } = editor.state
			const isNodeSelection =
				selection.from === selection.to - 1 &&
				editor.state.doc.nodeAt(selection.from)?.type.name === "super-placeholder"

			if (isNodeSelection) {
				// Get navigation direction from node attributes
				const isFromLeft = _direction === "from-left"

				// Use setTimeout to ensure DOM is ready and avoid conflicts with editor operations
				setTimeout(() => {
					if (inputRef.current && document.activeElement !== inputRef.current) {
						inputRef.current.focus()

						const range = document.createRange()
						const sel = window.getSelection()

						if (sel) {
							if (isFromLeft && currentValue) {
								// Coming from left: select all content for easy replacement
								range.selectNodeContents(inputRef.current)
								sel.removeAllRanges()
								sel.addRange(range)
							} else if (inputRef.current.firstChild) {
								// Coming from right or no direction info: set cursor to the end
								range.setStart(
									inputRef.current.firstChild,
									inputRef.current.textContent?.length || 0,
								)
								range.collapse(true)
								sel.removeAllRanges()
								sel.addRange(range)
							} else {
								// No text content, set cursor in the empty element
								range.selectNodeContents(inputRef.current)
								range.collapse(false)
								sel.removeAllRanges()
								sel.addRange(range)
							}
						}
					}
				}, 10)
			}
		}
	}, [selected, editor, currentValue, _direction])

	return (
		<NodeViewWrapper
			className={styles.wrapper}
			data-type="super-placeholder"
			data-input-type="input"
			as="span"
		>
			<span
				ref={inputRef}
				className="super-placeholder"
				contentEditable
				suppressContentEditableWarning
				onInput={handleInput}
				onKeyDown={handleKeyDown}
				onClick={handleClick}
				onMouseDown={handleMouseDown}
				onMouseUp={handleMouseUp}
				data-placeholder={placeholder as string}
				autoFocus={selected}
				tabIndex={0}
			/>
		</NodeViewWrapper>
	)
}
