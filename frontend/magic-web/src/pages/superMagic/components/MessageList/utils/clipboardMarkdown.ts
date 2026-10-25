import { Editor } from "@/infrastructure/editors/tiptap/core"
import { DOMParser } from "@/infrastructure/editors/tiptap/pm-model"
import { StarterKit } from "@/infrastructure/editors/tiptap/starter-kit"
import { Link } from "@/infrastructure/editors/tiptap/extension-link"
import { Image } from "@/infrastructure/editors/tiptap/extension-image"
import {
	Markdown,
	type MarkdownMarkSpec,
	type MarkdownStorage,
} from "@/infrastructure/editors/tiptap/markdown"

const ClipboardLink = Link.extend({
	addStorage() {
		const markdown: MarkdownMarkSpec = {
			serialize: {
				open: "[",
				close: (_state, mark) => {
					const href = String(mark.attrs.href || "")
					const destination = href.includes(" ")
						? `<${href}>`
						: href.replace(/[\\()]/g, "\\$&")
					const title = mark.attrs.title
						? ` "${String(mark.attrs.title).replace(/[\\"]/g, "\\$&")}"`
						: ""
					return `](${destination}${title})`
				},
				mixable: true,
			},
		}
		return { ...this.parent?.(), markdown }
	},
})

/** 复用现有 Markdown 序列化保留格式；实例不挂到页面，也不改变消息编辑器的 schema。 */
export function htmlToClipboardMarkdown(container: HTMLElement): string {
	const source = container.cloneNode(true) as HTMLElement
	// 消息渲染器把每个列表项包成 p；单段列表不应因此平白多出空行。
	source.querySelectorAll("ul, ol").forEach((list) => {
		const hasMultipleParagraphs = Array.from(list.children).some(
			(item) => Array.from(item.children).filter((child) => child.tagName === "P").length > 1,
		)
		if (!hasMultipleParagraphs) list.setAttribute("data-tight", "true")
	})
	const editor = new Editor({
		element: document.createElement("div"),
		injectCSS: false,
		editable: false,
		extensions: [
			StarterKit.configure({ link: false, undoRedo: false }),
			ClipboardLink.configure({ openOnClick: false }),
			Image,
			Markdown.configure({ html: false, tightLists: true }),
		],
	})
	try {
		const content = DOMParser.fromSchema(editor.schema).parse(source)
		editor.commands.setContent(content.toJSON(), { emitUpdate: false })
		return (editor.storage.markdown as MarkdownStorage).getMarkdown()
	} finally {
		editor.destroy()
	}
}
