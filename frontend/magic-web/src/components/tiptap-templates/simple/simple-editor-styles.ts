// Stylesheet contract for the `.simple-editor-wrapper` / `.simple-editor-content` /
// `.tiptap.ProseMirror.simple-editor` markup.
//
// Two components render that markup: the rich editor (SimpleEditorRuntime, loaded only
// through React.lazy) and the large-document virtual preview (LargeMarkdownPreview). The
// layout rules in simple-editor.scss and the node typography live here, and neither is part
// of the always-loaded bundle. When the preview did not import this module, a direct large
// file preview left `.simple-editor-content` at `height: auto`, so Virtuoso's `height: 100%`
// scroller resolved to 0px and rendered zero items — a blank page. Previewing a small file
// first masked the bug because the lazily loaded editor had already injected the styles.
//
// Keep the node stylesheets before simple-editor.scss: this mirrors the import order in
// SimpleEditorRuntime and the cascade depends on it.
import "@/components/tiptap-node/blockquote-node/blockquote-node.scss"
import "@/components/tiptap-node/code-block-node/code-block-node.scss"
import "@/components/tiptap-node/horizontal-rule-node/horizontal-rule-node.scss"
import "@/components/tiptap-node/list-node/list-node.scss"
import "@/components/tiptap-node/image-node/image-node.scss"
import "@/components/tiptap-node/heading-node/heading-node.scss"
import "@/components/tiptap-node/paragraph-node/paragraph-node.scss"
import "@/components/tiptap-node/table-node/table-node.scss"
import "@/components/tiptap-templates/simple/simple-editor.scss"
