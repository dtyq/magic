/**
 * Message types the iframe EditorRuntime posts to the host for editor shortcuts
 * (save, save and exit, cancel).
 *
 * Single source of truth for both sides: the runtime sends them and the host
 * message handler recognises them, so neither side keeps its own copy of the
 * string literals.
 */
export const KEYBOARD_MESSAGE_TYPES = {
	SAVE: "MAGIC_KEYBOARD_SAVE",
	SAVE_AND_EXIT: "MAGIC_KEYBOARD_SAVE_AND_EXIT",
	CANCEL: "MAGIC_KEYBOARD_CANCEL",
	SOURCE: "magic-html-iframe",
} as const
