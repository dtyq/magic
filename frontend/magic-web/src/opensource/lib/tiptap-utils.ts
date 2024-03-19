import type { Node as TiptapNode } from "@tiptap/pm/model"
import { NodeSelection, Selection, TextSelection } from "@tiptap/pm/state"
import type { Editor } from "@tiptap/react"

export const MAX_FILE_SIZE = 20 * 1024 * 1024 // 20MB

export const MAC_SYMBOLS: Record<string, string> = {
	mod: "⌘",
	command: "⌘",
	meta: "⌘",
	ctrl: "⌃",
	control: "⌃",
	alt: "⌥",
	option: "⌥",
	shift: "⇧",
	backspace: "Del",
	delete: "⌦",
	enter: "⏎",
	escape: "⎋",
	capslock: "⇪",
} as const

export function cn(...classes: (string | boolean | undefined | null)[]): string {
	return classes.filter(Boolean).join(" ")
}

/**
 * Determines if the current platform is macOS
 * @returns boolean indicating if the current platform is Mac
 */
export function isMac(): boolean {
	return typeof navigator !== "undefined" && navigator.platform.toLowerCase().includes("mac")
}

/**
 * Formats a shortcut key based on the platform (Mac or non-Mac)
 * @param key - The key to format (e.g., "ctrl", "alt", "shift")
 * @param isMac - Boolean indicating if the platform is Mac
 * @param capitalize - Whether to capitalize the key (default: true)
 * @returns Formatted shortcut key symbol
 */
export const formatShortcutKey = (key: string, isMac: boolean, capitalize: boolean = true) => {
	if (isMac) {
		const lowerKey = key.toLowerCase()
		return MAC_SYMBOLS[lowerKey] || (capitalize ? key.toUpperCase() : key)
	}

	return capitalize ? key.charAt(0).toUpperCase() + key.slice(1) : key
}

/**
 * Parses a shortcut key string into an array of formatted key symbols
 * @param shortcutKeys - The string of shortcut keys (e.g., "ctrl-alt-shift")
 * @param delimiter - The delimiter used to split the keys (default: "-")
 * @param capitalize - Whether to capitalize the keys (default: true)
 * @returns Array of formatted shortcut key symbols
 */
export const parseShortcutKeys = (props: {
	shortcutKeys: string | undefined
	delimiter?: string
	capitalize?: boolean
}) => {
	const { shortcutKeys, delimiter = "+", capitalize = true } = props

	if (!shortcutKeys) return []

	return shortcutKeys
		.split(delimiter)
		.map((key) => key.trim())
		.map((key) => formatShortcutKey(key, isMac(), capitalize))
}

/**
 * Checks if a mark exists in the editor schema
 * @param markName - The name of the mark to check
 * @param editor - The editor instance
 * @returns boolean indicating if the mark exists in the schema
 */
export const isMarkInSchema = (markName: string, editor: Editor | null): boolean => {
	if (!editor?.schema) return false
	return editor.schema.spec.marks.get(markName) !== undefined
}

/**
 * Checks if a node exists in the editor schema
 * @param nodeName - The name of the node to check
 * @param editor - The editor instance
 * @returns boolean indicating if the node exists in the schema
 */
export const isNodeInSchema = (nodeName: string, editor: Editor | null): boolean => {
	if (!editor?.schema) return false
	return editor.schema.spec.nodes.get(nodeName) !== undefined
}

/**
 * Moves the focus to the next node in the editor
 * @param editor - The editor instance
 * @returns boolean indicating if the focus was moved
 */
export function focusNextNode(editor: Editor) {
	const { state, view } = editor
	const { doc, selection } = state

	const nextSel = Selection.findFrom(selection.$to, 1, true)
	if (nextSel) {
		view.dispatch(state.tr.setSelection(nextSel).scrollIntoView())
		return true
	}

	const paragraphType = state.schema.nodes.paragraph
	if (!paragraphType) {
		console.warn("No paragraph node type found in schema.")
		return false
	}

	const end = doc.content.size
	const para = paragraphType.create()
	let tr = state.tr.insert(end, para)

	// Place the selection inside the new paragraph
	const $inside = tr.doc.resolve(end + 1)
	tr = tr.setSelection(TextSelection.near($inside)).scrollIntoView()
	view.dispatch(tr)
	return true
}

/**
 * Checks if a value is a valid number (not null, undefined, or NaN)
 * @param value - The value to check
 * @returns boolean indicating if the value is a valid number
 */
export function isValidPosition(pos: number | null | undefined): pos is number {
	return typeof pos === "number" && pos >= 0
}

/**
 * Checks if one or more extensions are registered in the Tiptap editor.
 * @param editor - The Tiptap editor instance
 * @param extensionNames - A single extension name or an array of names to check
 * @returns True if at least one of the extensions is available, false otherwise
 */
export function isExtensionAvailable(
	editor: Editor | null,
	extensionNames: string | string[],
): boolean {
	if (!editor) return false

	const names = Array.isArray(extensionNames) ? extensionNames : [extensionNames]

	const found = names.some((name) =>
		editor.extensionManager.extensions.some((ext) => ext.name === name),
	)

	return found
}

/**
 * Finds a node at the specified position with error handling
 * @param editor The Tiptap editor instance
 * @param position The position in the document to find the node
 * @returns The node at the specified position, or null if not found
 */
export function findNodeAtPosition(editor: Editor, position: number) {
	try {
		const node = editor.state.doc.nodeAt(position)
		if (!node) {
			console.warn(`No node found at position ${position}`)
			return null
		}
		return node
	} catch (error) {
		console.error(`Error getting node at position ${position}:`, error)
		return null
	}
}

/**
 * Finds the position and instance of a node in the document
 * @param props Object containing editor, node (optional), and nodePos (optional)
 * @param props.editor The Tiptap editor instance
 * @param props.node The node to find (optional if nodePos is provided)
 * @param props.nodePos The position of the node to find (optional if node is provided)
 * @returns An object with the position and node, or null if not found
 */
export function findNodePosition(props: {
	editor: Editor | null
	node?: TiptapNode | null
	nodePos?: number | null
}): { pos: number; node: TiptapNode } | null {
	const { editor, node, nodePos } = props

	if (!editor || !editor.state?.doc) return null

	// Zero is valid position
	const hasValidNode = node !== undefined && node !== null
	const hasValidPos = isValidPosition(nodePos)

	if (!hasValidNode && !hasValidPos) {
		return null
	}

	// First search for the node in the document if we have a node
	if (hasValidNode) {
		let foundPos = -1
		let foundNode: TiptapNode | null = null

		editor.state.doc.descendants((currentNode, pos) => {
			// TODO: Needed?
			// if (currentNode.type && currentNode.type.name === node!.type.name) {
			if (currentNode === node) {
				foundPos = pos
				foundNode = currentNode
				return false
			}
			return true
		})

		if (foundPos !== -1 && foundNode !== null) {
			return { pos: foundPos, node: foundNode }
		}
	}

	// If we have a valid position, use findNodeAtPosition
	if (hasValidPos) {
		const nodeAtPos = findNodeAtPosition(editor, nodePos!)
		if (nodeAtPos) {
			return { pos: nodePos!, node: nodeAtPos }
		}
	}

	return null
}

/**
 * Checks if the current selection in the editor is a node selection of specified types
 * @param editor The Tiptap editor instance
 * @param types An array of node type names to check against
 * @returns boolean indicating if the selected node matches any of the specified types
 */
export function isNodeTypeSelected(editor: Editor | null, types: string[] = []): boolean {
	if (!editor || !editor.state.selection) return false

	const { state } = editor
	const { selection } = state

	if (selection.empty) return false

	if (selection instanceof NodeSelection) {
		const node = selection.node
		return node ? types.includes(node.type.name) : false
	}

	return false
}

/**
 * Handles image upload with progress tracking and abort capability
 * @param file The file to upload
 * @param onProgress Optional callback for tracking upload progress
 * @param abortSignal Optional AbortSignal for cancelling the upload
 * @returns Promise resolving to the URL of the uploaded image
 */
export const handleImageUpload = async (
	file: File,
	onProgress?: (event: { progress: number }) => void,
	abortSignal?: AbortSignal,
): Promise<string> => {
	// Validate file
	if (!file) {
		throw new Error("No file provided")
	}

	if (file.size > MAX_FILE_SIZE) {
		throw new Error(`File size exceeds maximum allowed (${MAX_FILE_SIZE / (1024 * 1024)}MB)`)
	}

	// For demo/testing: Simulate upload progress. In production, replace the following code
	// with your own upload implementation.
	for (let progress = 0; progress <= 100; progress += 10) {
		if (abortSignal?.aborted) {
			throw new Error("Upload cancelled")
		}
		await new Promise((resolve) => setTimeout(resolve, 500))
		onProgress?.({ progress })
	}

	return "/images/tiptap-ui-placeholder-image.jpg"
}

type ProtocolOptions = {
	/**
	 * The protocol scheme to be registered.
	 * @default '''
	 * @example 'ftp'
	 * @example 'git'
	 */
	scheme: string

	/**
	 * If enabled, it allows optional slashes after the protocol.
	 * @default false
	 * @example true
	 */
	optionalSlashes?: boolean
}

type ProtocolConfig = Array<ProtocolOptions | string>

const ATTR_WHITESPACE =
	// eslint-disable-next-line no-control-regex
	/[\u0000-\u0020\u00A0\u1680\u180E\u2000-\u2029\u205F\u3000]/g

export function isAllowedUri(uri: string | undefined, protocols?: ProtocolConfig) {
	const allowedProtocols: string[] = [
		"http",
		"https",
		"ftp",
		"ftps",
		"mailto",
		"tel",
		"callto",
		"sms",
		"cid",
		"xmpp",
	]

	if (protocols) {
		protocols.forEach((protocol) => {
			const nextProtocol = typeof protocol === "string" ? protocol : protocol.scheme

			if (nextProtocol) {
				allowedProtocols.push(nextProtocol)
			}
		})
	}

	return (
		!uri ||
		uri.replace(ATTR_WHITESPACE, "").match(
			new RegExp(
				// eslint-disable-next-line no-useless-escape
				`^(?:(?:${allowedProtocols.join("|")}):|[^a-z]|[a-z0-9+.\-]+(?:[^a-z+.\-:]|$))`,
				"i",
			),
		)
	)
}

export function sanitizeUrl(inputUrl: string, baseUrl: string, protocols?: ProtocolConfig): string {
	try {
		const url = new URL(inputUrl, baseUrl)

		if (isAllowedUri(url.href, protocols)) {
			return url.href
		}
	} catch {
		// If URL creation fails, it's considered invalid
	}
	return "#"
}
