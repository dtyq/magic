import { JSONContent } from "@tiptap/core"
import type { Editor, SuperPlaceholderAttrs } from "./types"
import { SUPER_PLACEHOLDER_TYPE } from "./const"

/**
 * 验证 Super Placeholder 属性
 * @param attrs 属性对象
 * @returns 是否有效
 */
export const validateSuperPlaceholderAttrs = (attrs: Partial<SuperPlaceholderAttrs>): boolean => {
	// 基本验证
	if (!attrs || typeof attrs !== "object") {
		return false
	}

	// 类型验证
	if (attrs.type && attrs.type !== "input") {
		return false
	}

	// 字符串属性验证
	const stringProps = ["placeholder", "defaultValue", "value"] as const
	for (const prop of stringProps) {
		if (attrs.props?.[prop] && typeof attrs.props?.[prop] !== "string") {
			return false
		}
	}

	return true
}

/**
 * 清理 Super Placeholder 属性
 * @param attrs 原始属性
 * @returns 清理后的属性
 */
export const sanitizeSuperPlaceholderAttrs = (
	attrs: Partial<SuperPlaceholderAttrs>,
): SuperPlaceholderAttrs => {
	return {
		type: "input",
		props: {
			placeholder: attrs.props?.placeholder ?? "",
			defaultValue: attrs.props?.defaultValue ?? "",
			value: attrs.props?.value ?? "",
		},
		size: attrs.size ?? "default",
	}
}

/**
 * 从节点属性获取显示文本
 * @param attrs 节点属性
 * @returns 显示文本
 */
export const getDisplayText = (attrs: SuperPlaceholderAttrs): string => {
	if (attrs.props?.value && attrs.props?.value.trim()) {
		return attrs.props?.value
	}

	if (attrs.props?.defaultValue && attrs.props?.defaultValue.trim()) {
		return attrs.props?.defaultValue
	}

	if (attrs.props?.placeholder && attrs.props?.placeholder.trim()) {
		return attrs.props?.placeholder
	}

	return ""
}

/**
 * 检查是否为空的 Super Placeholder
 * @param attrs 节点属性
 * @returns 是否为空
 */
export const isEmptySuperPlaceholder = (attrs: SuperPlaceholderAttrs): boolean => {
	return !attrs.props?.value?.trim() && !attrs.props?.defaultValue?.trim()
}

/**
 * Calculate the display width of a string considering Chinese and English characters
 * Chinese characters are roughly twice as wide as English characters
 * @param text - The text to calculate width for
 * @returns The estimated display width in character units
 */
export const calculateStringWidth = (text: string): number => {
	if (!text) return 0

	let width = 0
	for (const char of text) {
		// Check if character is CJK (Chinese, Japanese, Korean)
		const charCode = char.charCodeAt(0)
		const isCJK =
			(charCode >= 0x4e00 && charCode <= 0x9fff) || // CJK Unified Ideographs
			(charCode >= 0x3400 && charCode <= 0x4dbf) || // CJK Extension A
			(charCode >= 0x20000 && charCode <= 0x2a6df) || // CJK Extension B
			(charCode >= 0x2a700 && charCode <= 0x2b73f) || // CJK Extension C
			(charCode >= 0x2b740 && charCode <= 0x2b81f) || // CJK Extension D
			(charCode >= 0x3000 && charCode <= 0x303f) || // CJK Symbols and Punctuation
			(charCode >= 0xff00 && charCode <= 0xffef) // Fullwidth Forms

		width += isCJK ? 2 : 1
	}

	return width
}

/**
 * Validate all super placeholder nodes have values
 * @param content JSONContent that can be a single node or array of nodes
 * @returns Object with validation result and error details
 */
export const validateSuperPlaceholderContent = (
	content: JSONContent | JSONContent[],
): { isValid: boolean; emptyPlaceholders: string[] } => {
	const emptyPlaceholders: string[] = []

	const validateNode = (node: JSONContent): void => {
		// Handle super placeholder nodes
		if (node.type === SUPER_PLACEHOLDER_TYPE) {
			const attrs = node.attrs as SuperPlaceholderAttrs
			if (isEmptySuperPlaceholder(attrs)) {
				const placeholder = attrs.props?.placeholder || "input"
				emptyPlaceholders.push(placeholder)
			}
		}

		// Recursively validate nested content
		if (node.content && Array.isArray(node.content)) {
			node.content.forEach(validateNode)
		}
	}

	// Handle array of nodes
	if (Array.isArray(content)) {
		content.forEach(validateNode)
	} else {
		validateNode(content)
	}

	return {
		isValid: emptyPlaceholders.length === 0,
		emptyPlaceholders,
	}
}

/**
 * Replace super placeholder nodes with text nodes recursively
 * @param content JSONContent that can be a single node or array of nodes
 * @param options Options for replacement behavior
 * @returns Transformed JSONContent with super placeholders replaced by text nodes
 */
export const replaceSuperPlaceholderToString = (
	content: JSONContent | JSONContent[],
	options: { validate?: boolean } = {},
): JSONContent | JSONContent[] => {
	const transformNode = (node: JSONContent): JSONContent => {
		// Handle super placeholder nodes
		if (node.type === SUPER_PLACEHOLDER_TYPE) {
			const attrs = node.attrs as SuperPlaceholderAttrs

			// Validate if requested - throw error immediately when found empty
			if (options.validate && isEmptySuperPlaceholder(attrs)) {
				const placeholder = attrs.props?.placeholder
				const error = new Error(
					`Super placeholder validation failed. Empty placeholder: ${placeholder}`,
				)
				// Add validation details to error object for consumer to handle
				;(
					error as Error & {
						validationResult: { isValid: boolean; emptyPlaceholder?: string }
					}
				).validationResult = {
					isValid: false,
					emptyPlaceholder: placeholder,
				}
				throw error
			}

			const value = attrs.props?.value

			return {
				type: "text",
				text: typeof value === "string" ? value : "",
			}
		}

		// For other nodes, recursively transform nested content if it exists
		const transformedNode: JSONContent = {
			...node,
		}

		if (node.content && Array.isArray(node.content)) {
			transformedNode.content = node.content.map(transformNode)
		}

		return transformedNode
	}

	// Handle array of nodes
	if (Array.isArray(content)) {
		return content.map(transformNode)
	}

	// Handle single node
	return transformNode(content)
}

/**
 * Find all SuperPlaceholder node positions in the document
 * @param editor TipTap editor instance
 * @returns Array of positions for SuperPlaceholder nodes
 */
export const findSuperPlaceholderPositions = (editor: Editor): number[] => {
	const positions: number[] = []
	const doc = editor.state.doc

	doc.descendants((node, pos) => {
		if (node.type.name === SUPER_PLACEHOLDER_TYPE) {
			positions.push(pos)
		}
		return true
	})

	return positions.sort((a, b) => a - b)
}

/**
 * Get the position of the currently focused SuperPlaceholder node
 * @param editor TipTap editor instance
 * @returns Current SuperPlaceholder position or null if none focused
 */
export const getCurrentSuperPlaceholderPosition = (editor: Editor): number | null => {
	const { selection } = editor.state
	const doc = editor.state.doc

	// Check if current selection is within a SuperPlaceholder node
	const nodeAtSelection = doc.nodeAt(selection.from)
	if (nodeAtSelection?.type.name === SUPER_PLACEHOLDER_TYPE) {
		return selection.from
	}

	// Look for SuperPlaceholder nodes around the selection
	let currentPos: number | null = null
	doc.descendants((node, pos) => {
		if (node.type.name === SUPER_PLACEHOLDER_TYPE) {
			// Check if this node contains the selection
			if (pos <= selection.from && selection.from <= pos + node.nodeSize) {
				currentPos = pos
			}
		}
		return true
	})

	return currentPos
}

/**
 * Navigate to the next SuperPlaceholder node
 * @param editor TipTap editor instance
 * @returns Whether navigation was successful
 */
export const navigateToNextSuperPlaceholder = (editor: Editor): boolean => {
	const allPositions = findSuperPlaceholderPositions(editor)

	if (allPositions.length === 0) {
		return false
	}

	const currentPos = getCurrentSuperPlaceholderPosition(editor)

	let targetPos: number

	// If no current position, focus on the first SuperPlaceholder
	if (currentPos === null) {
		targetPos = allPositions[0]
	} else {
		// Find next position
		const currentIndex = allPositions.indexOf(currentPos)
		if (currentIndex === -1) {
			// Current position not found, focus on first
			targetPos = allPositions[0]
		} else {
			// Navigate to next (or wrap around to first)
			const nextIndex = (currentIndex + 1) % allPositions.length
			targetPos = allPositions[nextIndex]
		}
	}

	const success = editor.commands.setNodeSelection(targetPos)

	// Manually focus the contentEditable span after selection
	if (success) {
		setTimeout(() => {
			const editorElement = editor.view.dom
			const inputs = editorElement.querySelectorAll(
				'[data-type="super-placeholder"] span[contenteditable]',
			)
			const currentIndex = allPositions.indexOf(targetPos)
			const targetInput = inputs[currentIndex] as HTMLSpanElement

			if (targetInput) {
				targetInput.focus()
			}
		}, 10)
	}

	return success
}

/**
 * Navigate to the previous SuperPlaceholder node
 * @param editor TipTap editor instance
 * @returns Whether navigation was successful
 */
export const navigateToPreviousSuperPlaceholder = (editor: Editor): boolean => {
	const allPositions = findSuperPlaceholderPositions(editor)

	if (allPositions.length === 0) {
		return false
	}

	const currentPos = getCurrentSuperPlaceholderPosition(editor)

	let targetPos: number

	// If no current position, focus on the last SuperPlaceholder
	if (currentPos === null) {
		targetPos = allPositions[allPositions.length - 1]
	} else {
		// Find previous position
		const currentIndex = allPositions.indexOf(currentPos)
		if (currentIndex === -1) {
			// Current position not found, focus on last
			targetPos = allPositions[allPositions.length - 1]
		} else {
			// Navigate to previous (or wrap around to last)
			const prevIndex = currentIndex === 0 ? allPositions.length - 1 : currentIndex - 1
			targetPos = allPositions[prevIndex]
		}
	}

	const success = editor.commands.setNodeSelection(targetPos)

	// Manually focus the contentEditable span after selection
	if (success) {
		setTimeout(() => {
			const editorElement = editor.view.dom
			const inputs = editorElement.querySelectorAll(
				'[data-type="super-placeholder"] span[contenteditable]',
			)
			const currentIndex = allPositions.indexOf(targetPos)
			const targetInput = inputs[currentIndex] as HTMLSpanElement

			if (targetInput) {
				targetInput.focus()
			}
		}, 10)
	}

	return success
}

/**
 * Focus the first SuperPlaceholder node in the document
 * @param editor TipTap editor instance
 * @returns Whether focusing was successful
 */
export const focusFirstSuperPlaceholder = (editor: Editor): boolean => {
	const allPositions = findSuperPlaceholderPositions(editor)

	if (allPositions.length === 0) {
		return false
	}

	const firstPos = allPositions[0]

	// Use TipTap's setNodeSelection
	const success = editor.commands.setNodeSelection(firstPos)

	// Since we removed automatic focus from component, manually focus the contentEditable span
	if (success) {
		setTimeout(() => {
			const editorElement = editor.view.dom
			const firstInput = editorElement.querySelector(
				'[data-type="super-placeholder"] span[contenteditable]',
			) as HTMLSpanElement

			if (firstInput) {
				firstInput.focus()
			}
		}, 10)
	}

	return success
}
