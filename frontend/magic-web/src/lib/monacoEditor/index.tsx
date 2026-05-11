import { Suspense, lazy } from "react"
import type { EditorProps } from "./MonacoEditor"
import type { DiffEditorProps } from "./MonacoDiffEditor"

const Editor = lazy(() => import("./MonacoEditor"))
const DiffEditor = lazy(() => import("./MonacoDiffEditor"))

export function MonacoEditor(props: EditorProps) {
	return (
		<Suspense fallback="">
			<Editor {...props} />
		</Suspense>
	)
}

export function MonacoDiffEditor(props: DiffEditorProps) {
	return (
		<Suspense fallback="">
			<DiffEditor {...props} />
		</Suspense>
	)
}

export { type Monaco, type editor, type EditorProps } from "./MonacoEditor"
export { type DiffEditorProps } from "./MonacoDiffEditor"
