import * as React from "react"
import type { MessageEditorProps, MessageEditorRef } from "./types"

// Preserve the public MessageEditor API while keeping its optional runtime out
// of routes that only need the surrounding page shell.
const MessageEditorRuntime = React.lazy(() =>
	import("./MessageEditorContainer").then(({ MessageEditorContainer }) => ({
		default: MessageEditorContainer,
	})),
)

interface MessageEditorLoaderProps extends MessageEditorProps {
	/**
	 * Shown while the editor runtime loads. Defaults to nothing; a composer that is visible before
	 * the runtime arrives (e.g. the desktop project page) passes a skeleton so it never looks empty.
	 */
	loadingFallback?: React.ReactNode
}

export const MessageEditor = React.forwardRef<MessageEditorRef, MessageEditorLoaderProps>(
	function MessageEditor({ loadingFallback = null, ...props }, ref) {
		return (
			<React.Suspense fallback={loadingFallback}>
				<MessageEditorRuntime {...props} ref={ref} />
			</React.Suspense>
		)
	},
)

export default MessageEditor
export type { MessageEditorProps, MessageEditorRef } from "./types"
export type { InvalidModeFallbackProps } from "./components/TopicInvalidModeFallback"
