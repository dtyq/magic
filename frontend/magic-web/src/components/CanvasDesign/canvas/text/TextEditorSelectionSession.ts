import { Transforms, type BaseEditor, type BaseRange } from "slate"

export class TextEditorSelectionSession {
	private latestSelection: BaseRange | null = null

	public capture(selection: BaseRange | null | undefined): void {
		if (!selection) {
			return
		}
		this.latestSelection = cloneSlateRange(selection)
	}

	public restoreIfNeeded(editor: BaseEditor | null): boolean {
		if (!editor || editor.selection || !this.latestSelection) {
			return false
		}

		try {
			const selectionToRestore = cloneSlateRange(this.latestSelection)
			if (!selectionToRestore) {
				return false
			}
			Transforms.select(editor, selectionToRestore)
			return true
		} catch {
			return false
		}
	}

	public clear(): void {
		this.latestSelection = null
	}
}

export function cloneSlateRange(range: BaseRange | null | undefined): BaseRange | null {
	if (!range) {
		return null
	}

	return {
		anchor: {
			path: [...range.anchor.path],
			offset: range.anchor.offset,
		},
		focus: {
			path: [...range.focus.path],
			offset: range.focus.offset,
		},
	}
}
