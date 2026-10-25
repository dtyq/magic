const INTERACTIVE_KEYBOARD_TARGET_SELECTOR = [
	"button",
	"a",
	"input",
	"textarea",
	"select",
	"[role='button']",
].join(",")

/** 交互控件应保留浏览器原生键盘行为，不响应画布编辑器级快捷键。 */
export function isEditorInteractiveKeyboardTarget(target: EventTarget | null): boolean {
	return (
		target instanceof HTMLElement &&
		(target.isContentEditable || Boolean(target.closest(INTERACTIVE_KEYBOARD_TARGET_SELECTOR)))
	)
}
