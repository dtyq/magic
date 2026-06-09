import { useEffect, useReducer, useRef } from "react"
import type { Editor } from "@tiptap/react"

/**
 * Workaround for a tiptap React integration bug where `PureEditorContent`
 * passes a stale `contentComponent` reference to its internal `Portals` component.
 *
 * This can happen during React StrictMode double-mount cycles: the editor's
 * `contentComponent` gets replaced but `PureEditorContent` never re-renders
 * to pass the new reference to `Portals`, causing ReactNodeView portals
 * (e.g. mention chips) to render as empty DOM nodes.
 *
 * This hook detects the mismatch and forces the parent to re-render,
 * which propagates through EditorContent → PureEditorContent → picks up
 * the current `contentComponent`.
 */
export function useEditorPortalSync(editor: Editor | null) {
    const [, forceRender] = useReducer((c: number) => c + 1, 0)
    const lastContentComponentRef = useRef<unknown>(null)
    const isSyncedRef = useRef(false)

    useEffect(() => {
        if (!editor) return

        const editorWithCC = editor as Editor & { contentComponent?: unknown }

        const checkSync = () => {
            const current = editorWithCC.contentComponent
            if (current && current !== lastContentComponentRef.current) {
                lastContentComponentRef.current = current
                // Only force re-render if we've already been synced once
                // (the initial contentComponent is picked up by PureEditorContent.init)
                if (isSyncedRef.current) {
                    forceRender()
                }
                isSyncedRef.current = true
            }
        }

        // Check after a short delay to catch StrictMode double-mount scenarios
        // where contentComponent is replaced after the initial render
        const timer = setTimeout(checkSync, 50)

        // Listen for editor recreation (contentComponent gets replaced)
        editor.on("create", checkSync)

        return () => {
            clearTimeout(timer)
            editor.off("create", checkSync)
        }
    }, [editor])
}
