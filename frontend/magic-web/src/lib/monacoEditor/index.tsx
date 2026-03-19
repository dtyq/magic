import { Suspense, lazy } from "react"
import type { EditorProps } from "./MonacoEditor"

const Editor = lazy(() => import("./MonacoEditor"))

export function MonacoEditor(props: EditorProps) {
	return (
		<Suspense fallback="">
			<Editor {...props} />
		</Suspense>
	)
}

export { type Monaco, type editor, type EditorProps } from "./MonacoEditor"
