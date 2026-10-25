"use client"

import * as React from "react"
import type { SimpleEditorProps, SimpleEditorRef } from "./types"

// Keep the historical import path as a small compatibility facade. The complete
// Tiptap runtime is loaded only when this editor is rendered.
const SimpleEditorRuntime = React.lazy(() => import("./SimpleEditorRuntime"))

export type { SimpleEditorProps, SimpleEditorRef } from "./types"

export const SimpleEditor = React.forwardRef<SimpleEditorRef, SimpleEditorProps>(
	function SimpleEditor(props, ref) {
		return (
			<React.Suspense fallback={null}>
				<SimpleEditorRuntime {...props} ref={ref} />
			</React.Suspense>
		)
	},
)
