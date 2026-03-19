import { Editor, loader } from "@monaco-editor/react"
import type { Monaco, EditorProps } from "@monaco-editor/react"
import type { editor } from "monaco-editor"
import { env } from "@/utils/env"

/** Configure Monaco loader to load from CDN for better performance */
loader.config({
	paths: {
		vs: `${env("MAGIC_CDNHOST")}/monaco-editor/0.52.2/min/vs`,
		// vs: "https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.52.2/min/vs",
		// vs: iSOverseas()
		// 	? "https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.52.2/min/vs"
		// 	: "https://cdn.bootcdn.net/ajax/libs/monaco-editor/0.52.2/min/vs",
	},
})

export { type Monaco, type editor, type EditorProps }

export default Editor
