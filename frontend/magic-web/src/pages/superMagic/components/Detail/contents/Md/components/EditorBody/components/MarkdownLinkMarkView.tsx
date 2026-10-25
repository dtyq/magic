import { MarkViewContent } from "@/infrastructure/editors/tiptap/react"
import type { MarkViewProps } from "@/infrastructure/editors/tiptap/core"
import { MarkdownFileLink } from "./MarkdownFileLink"
import type { CustomLinkNodeOptions } from "../extensions/custom-link-node-extension"

/** React 只负责展示，链接文字仍由 ProseMirror 管理，不生成 mention 或改写 href。 */
export function MarkdownLinkMarkView({ mark, editor, extension, HTMLAttributes }: MarkViewProps) {
	const options = extension.options as CustomLinkNodeOptions
	const href = typeof mark.attrs.href === "string" ? mark.attrs.href : ""
	if (editor.isEditable)
		return (
			<a {...HTMLAttributes}>
				<MarkViewContent />
			</a>
		)
	return (
		<MarkdownFileLink
			{...HTMLAttributes}
			href={href}
			onClick={(event) => {
				if (options.onLinkClick?.(event.nativeEvent, href, event.currentTarget) === true) {
					event.preventDefault()
					event.stopPropagation()
				}
			}}
		>
			<MarkViewContent />
		</MarkdownFileLink>
	)
}
